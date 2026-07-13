#!/usr/bin/env python3
"""Restore signed needs_analysis rows from the legacy CSV backup into prod Mongo.

Source: scripts/backups/results-2026-07-09-084832.csv (legacy MySQL `needs_analysis`
dump). Only rows whose status is not BROUILLON are inserted -- drafts are skipped.

Each CSV row is converted into two sets of documents matching the current schema
(back/src/types/needsAnalysisNoSql.types.ts, back/src/types/offer.types.ts,
back/src/db/mongo/schemas/): one `needs_analysis` document (company_infos,
referents, positions[] -- one per legacy `positions` entry) and one `offers`
document per position (needs_analysis_id, company_infos, referents, matching --
empty, no legacy job was linked to these 3 rows).

The legacy `localisation` value is the zone-level string "NORD", which is not a
valid commune-level Localisation. Since only 3 companies are affected here, the
commune is hardcoded per company_id rather than inferred:
  - company_id 32650  (Degust'Sushi) -> SAINTE_MARIE
  - company_id 31742  (Tayyebfood)   -> SAINT_DENIS
  - company_id 240001 (Urban Store)  -> SAINTE_MARIE

`criteria.desired_sex` has no equivalent column in the legacy CSV, so it defaults to
"MIXTE" (the domain default, see Sex/DesiredSex.MIXTE) rather than being left absent.

`tp_type` is derived from the position's `title` (job title), not `trainingDomain` --
`trainingDomain` only has two legacy values (SECRETARIAT/VENTE) and cannot distinguish
between the 5 title professional types. See TITLE_TO_TP below.

Both `tp_type` and `criteria` (including `desired_sex`) are built once via
build_position()/build_offer_criteria() and reused for both the `needs_analysis.positions[]`
and the corresponding `offers[]` documents, so they never appear in one and not the other.
"""

import argparse
import csv
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection

CSV_PATH = os.path.join(os.path.dirname(__file__), "backups", "results-2026-07-09-084832.csv")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")
MONGO_DB_NAME = "human_ressources"

COMPANY_LOCALISATION = {
    "32650": "SAINTE_MARIE",
    "31742": "SAINT_DENIS",
    "240001": "SAINTE_MARIE",
}

SECTOR_MAP = {
    "Nord-Est": "NORD",
    "Ouest": "OUEST",
    "Sud": "SUD",
}

# Table de vérité titre de poste -> TitleProfessionalType, fournie par le métier.
TITLE_TO_TP = {
    "conseiller commercial": "CC",
    "négociateur technico-commercial": "NTC",
    "responsable d'établissement marchand": "REM",
    "assistante de direction": "AD",
    "secrétaire assistante": "SA",
}


def tp_type_from_title(title):
    if not title:
        return None
    return TITLE_TO_TP.get(title.strip().lower())


def load_csv_rows(path):
    with open(path, encoding="utf-8") as file:
        return list(csv.DictReader(file))


def parse_json_field(raw, default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default


def parse_datetime(raw):
    if not raw:
        return None
    return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")


def fetch_company_names(mysql_conn, company_ids):
    if not company_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(company_ids))
    cursor = mysql_conn.cursor(dictionary=True)
    cursor.execute(
        f"SELECT id, name, siret, sector, main_activity, ape, idcc, address "
        f"FROM companies WHERE id IN ({placeholders})",
        list(company_ids),
    )
    rows = cursor.fetchall()
    cursor.close()
    return {row["id"]: row for row in rows}


def fetch_saler_infos(mysql_conn, user_ids):
    if not user_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(user_ids))
    cursor = mysql_conn.cursor(dictionary=True)
    cursor.execute(
        f"SELECT id, email FROM users WHERE id IN ({placeholders}) AND role = 'COMMERCIAL'",
        list(user_ids),
    )
    rows = cursor.fetchall()
    cursor.close()
    return {row["id"]: {"id": row["id"], "email": row["email"]} for row in rows}


def build_referent_details(name, phone, email, function):
    details = {"name": name or None, "phone": phone or None, "email": email or None, "function": function or None}
    return {key: value for key, value in details.items() if value is not None}


def build_referents(row):
    recruitment_referent = build_referent_details(
        row.get("recruitment_responsible_name"),
        row.get("recruitment_responsible_phone"),
        row.get("recruitment_responsible_email"),
        row.get("recruitment_responsible_function"),
    )
    return {
        "is_same": True,
        "legal_referents": recruitment_referent,
        "recruitment_referents": recruitment_referent,
    }


ADDRESS_RE = re.compile(r"\b(974\d{2})\b")


def parse_commune(address):
    """Crude commune extraction from address string, e.g. '... SAINTE_MARIE 97460'."""
    if not address:
        return None, None
    postal_match = ADDRESS_RE.search(address)
    postal_code = postal_match.group(1) if postal_match else None
    # Take the word(s) immediately before the postal code as the commune
    commune = None
    if postal_match:
        before = address[: postal_match.start()].strip()
        parts = before.rsplit(None, 1)
        if parts:
            commune = parts[-1].rstrip(",").strip().upper()
    return postal_code, commune


def build_company_infos(row, company_row):
    company_infos = {"id": int(row["company_id"])}
    if company_row:
        company_infos["name"] = company_row.get("name")
        company_infos["siret"] = company_row.get("siret")
        raw_sector = company_row.get("sector")
        if raw_sector:
            mapped = SECTOR_MAP.get(raw_sector)
            if mapped:
                company_infos["sector"] = mapped
        if company_row.get("main_activity"):
            company_infos["main_activity"] = company_row["main_activity"]
        if company_row.get("ape"):
            company_infos["ape"] = company_row["ape"]
        if company_row.get("idcc"):
            company_infos["idcc"] = company_row["idcc"]
        postal_code, commune = parse_commune(company_row.get("address"))
        if postal_code:
            company_infos["postal_code"] = postal_code
        if commune:
            company_infos["commune"] = commune
    activities = parse_json_field(row.get("company_sectors"), [])
    if activities:
        company_infos["activities"] = activities
    if row.get("company_description"):
        company_infos["description"] = row["company_description"]
    if row.get("opco"):
        company_infos["opco"] = row["opco"]
    if row.get("referral_source"):
        company_infos["referral_source"] = row["referral_source"]
    return company_infos


def build_offer_criteria(row):
    criteria = {
        "education_level": row.get("education_level") or None,
        "driving_license": row.get("driving_license") == "OUI",
        "experience_required": row.get("experience_required") == "OBLIGATOIRE",
        "training_domain": row.get("training_domain") or None,
        "age_min": int(row["age_min"]) if row.get("age_min") else None,
        "age_max": int(row["age_max"]) if row.get("age_max") else None,
        "soft_skills": row.get("soft_skills") or None,
        "schedule_options": parse_json_field(row.get("schedule_options"), []),
        "conditions": row.get("conditions") or None,
        "additional_comments": row.get("additional_comments") or None,
        # Pas de colonne source dans le CSV legacy -- MIXTE est la valeur par défaut
        # du domaine (cf. Sex/DesiredSex.MIXTE) plutôt qu'un champ absent.
        "desired_sex": row.get("desired_sex") or "MIXTE",
    }
    return {key: value for key, value in criteria.items() if value not in (None, "", [])}


def build_position(position, localisation, criteria, description_missions, other_description_missions, other_missions):
    title = position.get("jobTitle")
    entry = {
        "localisation": [localisation],
        "training_domain": position.get("trainingDomain"),
        "tp_type": tp_type_from_title(title),
        "title": title,
        "missions": position.get("selectedMissions") or [],
        "description_missions": description_missions,
        "other_description_missions": other_description_missions,
        "other_missions": other_missions,
    }
    if criteria:
        entry["criteria"] = criteria
    return {key: value for key, value in entry.items() if value not in (None, "", [])}


def build_offer(position, needs_analysis_id, company_infos, referents, saler_info, created_at=None, updated_at=None):
    offer = {
        "_id": str(uuid.uuid4()),
        "needs_analysis_id": needs_analysis_id,
        "company_infos": {
            key: company_infos[key]
            for key in ("id", "name", "sector", "activities") if key in company_infos
        },
        "saler_info": saler_info,
        "referents": referents,
        "localisation": position.get("localisation"),
        "training_domain": position.get("training_domain"),
        "tp_type": position.get("tp_type"),
        "title": position.get("title"),
        "missions": position.get("missions"),
        "description_missions": position.get("description_missions"),
        "other_description_missions": position.get("other_description_missions"),
        "other_missions": position.get("other_missions"),
        "criteria": position.get("criteria"),
        "matching": {"status": "NOT_MATCHED", "candidates": [], "interview_slots": [], "interview_location": None},
        "created_at": created_at,
        "updated_at": updated_at,
    }
    return {key: value for key, value in offer.items() if value not in (None, "", [])}


def build_needs_analysis_document(row, company_row, saler_info):
    localisation = COMPANY_LOCALISATION[row["company_id"]]
    raw_positions = parse_json_field(row.get("positions"), [])
    criteria = build_offer_criteria(row)
    description_missions = parse_json_field(row.get("job_description_missions"), [])
    other_description_missions = row.get("job_description_other") or None
    other_missions = row.get("other_missions") or None
    positions = [
        build_position(position, localisation, criteria, description_missions, other_description_missions, other_missions)
        for position in raw_positions
    ]

    return {
        "_id": row["id"],
        "company_infos": build_company_infos(row, company_row),
        "saler_info": saler_info,
        "referents": build_referents(row),
        "positions": positions,
        "recruitment_method": row.get("recruitment_method") or None,
        "immersion_period": row.get("immersion_period") or None,
        "training_days": row.get("training_days") or None,
        "signature_request_id": row.get("yousign_signature_request_id") or None,
        "status": row["status"],
        "created_at": parse_datetime(row.get("created_at")),
        "updated_at": parse_datetime(row.get("updated_at")),
    }


def build_offer_documents(needs_analysis_doc):
    return [
        build_offer(
            position,
            needs_analysis_doc["_id"],
            needs_analysis_doc["company_infos"],
            needs_analysis_doc["referents"],
            needs_analysis_doc.get("saler_info"),
            created_at=needs_analysis_doc.get("created_at"),
            updated_at=needs_analysis_doc.get("updated_at"),
        )
        for position in needs_analysis_doc.get("positions", [])
    ]


def build_documents(rows, mysql_conn):
    signed_rows = [row for row in rows if row["status"] != "BROUILLON"]
    company_ids = {int(row["company_id"]) for row in signed_rows}
    user_ids = {int(row["user_id"]) for row in signed_rows}
    companies_by_id = fetch_company_names(mysql_conn, company_ids)
    salers_by_id = fetch_saler_infos(mysql_conn, user_ids)
    needs_analyses = []
    offers = []
    for row in signed_rows:
        company_row = companies_by_id.get(int(row["company_id"]))
        saler_info = salers_by_id.get(int(row["user_id"]))
        needs_analysis_doc = build_needs_analysis_document(row, company_row, saler_info)
        needs_analyses.append(needs_analysis_doc)
        offers.extend(build_offer_documents(needs_analysis_doc))
    return needs_analyses, offers


def write_report(needs_analyses, offers):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"restore_signed_needs_analysis_report_{stamp}.json")
    with open(path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "total_needs_analyses": len(needs_analyses),
                "total_offers": len(offers),
                "needs_analyses": needs_analyses,
                "offers": offers,
            },
            file, ensure_ascii=False, indent=2, default=str,
        )
    return path


def confirm(prompt):
    return input(f"{prompt} [y/N] ").strip().lower() == "y"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Restore signed (non-BROUILLON) needs_analysis rows from the legacy CSV backup into Mongo."
    )
    parser.add_argument("--dry-run", action="store_true", help="Build and report, do not insert")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()

    rows = load_csv_rows(CSV_PATH)

    mysql_conn = get_mysql_connection()
    try:
        needs_analyses, offers = build_documents(rows, mysql_conn)
    finally:
        mysql_conn.close()

    report_path = write_report(needs_analyses, offers)
    print(
        f"Built {len(needs_analyses)} needs_analysis documents and {len(offers)} offer "
        f"documents from {len(rows)} CSV rows (skipped BROUILLON)"
    )
    print(f"Report written to {report_path}")

    if args.dry_run:
        print("Dry-run -- nothing inserted")
        return 0

    mongo_client = get_mongo_connection()
    try:
        db = mongo_client[MONGO_DB_NAME]
        prompt = (
            f"Insert {len(needs_analyses)} needs_analysis documents and {len(offers)} offer "
            f"documents into MongoDB ({MONGO_DB_NAME})?"
        )
        if not args.yes and not confirm(prompt):
            print("Aborted.")
            return 0
        na_result = db["needs_analysis"].insert_many(needs_analyses)
        print(f"Done -- {len(na_result.inserted_ids)} needs_analysis documents inserted")
        if offers:
            offers_result = db["offers"].insert_many(offers)
            print(f"Done -- {len(offers_result.inserted_ids)} offer documents inserted")
    finally:
        mongo_client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
