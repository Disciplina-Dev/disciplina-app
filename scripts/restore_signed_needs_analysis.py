#!/usr/bin/env python3
"""Restore signed needs_analysis rows from the legacy CSV backup into prod Mongo.

Source: scripts/backups/results-2026-07-09-084832.csv (legacy MySQL `needs_analysis`
dump). Only rows whose status is not BROUILLON are inserted -- drafts are skipped.

Each CSV row is converted into one NeedsAnalysis document matching the current
schema (back/src/types/needsAnalysisNoSql.types.ts, back/src/db/mongo/schemas/
needsAnalysis.schema.ts): company_infos, referents, offers[] (one per legacy
`positions` entry), criteria, matching (empty -- no legacy job was linked to
these 3 rows).

The legacy `localisation` value is the zone-level string "NORD", which is not a
valid commune-level Localisation. Since only 3 companies are affected here, the
commune is hardcoded per company_id rather than inferred:
  - company_id 32650  (Degust'Sushi) -> SAINTE_MARIE
  - company_id 31742  (Tayyebfood)   -> SAINT_DENIS
  - company_id 240001 (Urban Store)  -> SAINTE_MARIE
"""

import argparse
import csv
import json
import os
import sys
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
    cursor.execute(f"SELECT id, name, siret FROM companies WHERE id IN ({placeholders})", list(company_ids))
    rows = cursor.fetchall()
    cursor.close()
    return {row["id"]: row for row in rows}


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


def build_company_infos(row, company_row):
    company_infos = {"id": int(row["company_id"])}
    if company_row:
        company_infos["name"] = company_row.get("name")
        company_infos["siret"] = company_row.get("siret")
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
        "age_min": int(row["age_min"]) if row.get("age_min") else None,
        "age_max": int(row["age_max"]) if row.get("age_max") else None,
        "soft_skills": row.get("soft_skills") or None,
        "schedule_options": parse_json_field(row.get("schedule_options"), []),
        "conditions": row.get("conditions") or None,
        "additional_comments": row.get("additional_comments") or None,
    }
    return {key: value for key, value in criteria.items() if value not in (None, "", [])}


def build_offer(position, localisation):
    offer = {
        "localisation": [localisation],
        "training_domain": position.get("trainingDomain"),
        "title": position.get("jobTitle"),
        "missions": position.get("selectedMissions") or [],
        "matching": {"status": "NOT_MATCHED", "candidates": []},
    }
    return {key: value for key, value in offer.items() if value not in (None, "", [])}


def build_needs_analysis_document(row, company_row):
    localisation = COMPANY_LOCALISATION[row["company_id"]]
    positions = parse_json_field(row.get("positions"), [])
    criteria = build_offer_criteria(row)
    offers = []
    for position in positions:
        offer = build_offer(position, localisation)
        if criteria:
            offer["criteria"] = criteria
        offers.append(offer)

    return {
        "_id": row["id"],
        "company_infos": build_company_infos(row, company_row),
        "referents": build_referents(row),
        "offers": offers,
        "recruitment_method": row.get("recruitment_method") or None,
        "immersion_period": row.get("immersion_period") or None,
        "training_days": row.get("training_days") or None,
        "signature_request_id": row.get("yousign_signature_request_id") or None,
        "status": row["status"],
        "created_at": parse_datetime(row.get("created_at")),
        "updated_at": parse_datetime(row.get("updated_at")),
    }


def build_documents(rows, mysql_conn):
    signed_rows = [row for row in rows if row["status"] != "BROUILLON"]
    company_ids = {int(row["company_id"]) for row in signed_rows}
    companies_by_id = fetch_company_names(mysql_conn, company_ids)
    documents = []
    for row in signed_rows:
        company_row = companies_by_id.get(int(row["company_id"]))
        documents.append(build_needs_analysis_document(row, company_row))
    return documents


def write_report(documents):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"restore_signed_needs_analysis_report_{stamp}.json")
    with open(path, "w", encoding="utf-8") as file:
        json.dump(
            {"total_documents": len(documents), "documents": documents},
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
        documents = build_documents(rows, mysql_conn)
    finally:
        mysql_conn.close()

    report_path = write_report(documents)
    print(f"Built {len(documents)} needs_analysis documents from {len(rows)} CSV rows (skipped BROUILLON)")
    print(f"Report written to {report_path}")

    if args.dry_run:
        print("Dry-run -- nothing inserted")
        return 0

    mongo_client = get_mongo_connection()
    try:
        db = mongo_client[MONGO_DB_NAME]
        if not args.yes and not confirm(f"Insert {len(documents)} needs_analysis documents into MongoDB ({MONGO_DB_NAME}.needs_analysis)?"):
            print("Aborted.")
            return 0
        result = db["needs_analysis"].insert_many(documents)
        print(f"Done -- {len(result.inserted_ids)} needs_analysis documents inserted")
    finally:
        mongo_client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
