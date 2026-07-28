#!/usr/bin/env python3
"""Migration: create a signed needs_analysis for every legacy offer without one.

Legacy offers (seeded by import_jobs.py) have `needs_analysis_id: None`. This script
groups them by company name, creates one SIGNE needs_analysis per company, tags it
'Importé du drive', and backfills `needs_analysis_id` on every offer.

Usage:
    source .venv/bin/activate
    python scripts/migrate_offers_to_ab.py [--dry-run] [--yes]
"""

import argparse
import json
import os
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from dotenv import load_dotenv

from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection

MONGO_DB_NAME = "human_ressources"
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")

SECTOR_MAP = {
    "NORD": "NORD",
    "OUEST": "OUEST",
    "SUD": "SUD",
}

TP_TO_TITLE = {
    "CC": "conseiller commercial",
    "NTC": "négociateur technico-commercial",
    "REM": "responsable d'établissement marchand",
    "AD": "assistante de direction",
    "SA": "secrétaire assistante",
}


def fetch_companies_by_name(mysql_conn, names):
    if not names:
        return {}
    placeholders = ", ".join(["%s"] * len(names))
    cursor = mysql_conn.cursor(dictionary=True)
    cursor.execute(
        f"SELECT id, name, siret, sector, main_activity, ape, idcc "
        f"FROM companies WHERE name IN ({placeholders})",
        list(names),
    )
    rows = cursor.fetchall()
    cursor.close()
    return {row["name"]: row for row in rows}


def build_company_infos(offers_group, company_row):
    first = offers_group[0]
    company_infos = {}
    if company_row:
        company_infos["id"] = company_row["id"]
        company_infos["name"] = company_row["name"]
        if company_row.get("siret"):
            company_infos["siret"] = company_row["siret"]
        if company_row.get("sector"):
            mapped = SECTOR_MAP.get(company_row["sector"])
            if mapped:
                company_infos["sector"] = mapped
        if company_row.get("main_activity"):
            company_infos["main_activity"] = company_row["main_activity"]
        if company_row.get("ape"):
            company_infos["ape"] = company_row["ape"]
        if company_row.get("idcc"):
            company_infos["idcc"] = company_row["idcc"]
    else:
        company_infos["name"] = first.get("company_infos", {}).get("name")

    sector = first.get("company_infos", {}).get("sector")
    if sector:
        company_infos["sector"] = sector

    activities = first.get("company_infos", {}).get("activities")
    if activities:
        company_infos["activities"] = activities

    return company_infos


def build_desired_tp(offer):
    tp_type = offer.get("tp_type")
    if not tp_type:
        return []
    return [{
        "tp_type": tp_type,
        "missions": offer.get("missions") or [],
        "description_missions": offer.get("description_missions") or [],
        "other_missions": offer.get("other_missions") or None,
        "other_description_missions": offer.get("other_description_missions") or None,
    }]


def build_position(offer):
    tp_type = offer.get("tp_type")
    desired_tp = build_desired_tp(offer)

    criteria = offer.get("criteria") or {}
    criteria = {k: v for k, v in criteria.items() if v not in (None, "", [], {})}

    title = offer.get("title") or TP_TO_TITLE.get(tp_type)

    position = {
        "localisation": offer.get("localisation") or [],
        "desired_tp": desired_tp,
        "training_domain": offer.get("training_domain") or None,
        "title": title,
        "count": 1,
    }
    if offer.get("job_role"):
        position["job_role"] = offer["job_role"]
    if criteria:
        position["criteria"] = criteria

    return {k: v for k, v in position.items() if v not in (None, "", [], {})}


def build_needs_analysis(offers_group, company_row):
    now = datetime.now(timezone.utc)
    na_id = str(uuid.uuid4())

    positions = [build_position(offer) for offer in offers_group]

    doc = {
        "_id": na_id,
        "company_infos": build_company_infos(offers_group, company_row),
        "positions": positions,
        "status": "SIGNE",
        "tags": ["Importé du drive"],
        "created_at": now,
        "updated_at": now,
    }
    return doc, na_id


def group_offers_by_company(offers):
    groups = defaultdict(list)
    for offer in offers:
        name = offer.get("company_infos", {}).get("name") or "INCONNU"
        groups[name].append(offer)
    return groups


def write_report(needs_analyses, updated_count, skipped_count):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"migrate_offers_to_ab_report_{stamp}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "total_needs_analyses_created": len(needs_analyses),
                "total_offers_updated": updated_count,
                "total_offers_skipped": skipped_count,
                "needs_analyses": [
                    {
                        "_id": na["_id"],
                        "company": na["company_infos"].get("name"),
                        "positions_count": len(na.get("positions", [])),
                    }
                    for na in needs_analyses
                ],
            },
            f, ensure_ascii=False, indent=2, default=str,
        )
    return path


def confirm(prompt):
    return input(f"{prompt} [y/N] ").strip().lower() == "y"


def run_migration(dry_run=False, auto_confirm=False):
    mongo_client = get_mongo_connection()
    mysql_conn = get_mysql_connection()

    try:
        db = mongo_client[MONGO_DB_NAME]
        offers_collection = db["offers"]
        na_collection = db["needs_analysis"]

        # 1. Find all offers without needs_analysis_id
        legacy_offers = list(
            offers_collection.find({
                "$or": [
                    {"needs_analysis_id": None},
                    {"needs_analysis_id": {"$exists": False}},
                ]
            })
        )
        print(f"Found {len(legacy_offers)} offers without needs_analysis_id")

        if not legacy_offers:
            print("Nothing to migrate.")
            return 0

        # 2. Group by company name
        groups = group_offers_by_company(legacy_offers)
        company_names = list(groups.keys())
        print(f"Grouped into {len(groups)} companies: {company_names}")

        # 3. Fetch company info from MySQL
        companies_by_name = fetch_companies_by_name(mysql_conn, company_names)
        found = sum(1 for n in company_names if n in companies_by_name)
        if found < len(company_names):
            missing = [n for n in company_names if n not in companies_by_name]
            print(f"  Warning: {len(missing)} companies not found in MySQL: {missing}")
        else:
            print(f"  All {found} companies resolved in MySQL")

        # 4. Build needs_analysis documents
        needs_analyses = []
        offer_updates = []
        for name, offers_group in groups.items():
            company_row = companies_by_name.get(name)
            na_doc, na_id = build_needs_analysis(offers_group, company_row)
            needs_analyses.append(na_doc)
            for offer in offers_group:
                offer_updates.append((offer["_id"], na_id))

        print(f"\nBuilt {len(needs_analyses)} needs_analysis documents")
        print(f"Will update {len(offer_updates)} offers with needs_analysis_id")

        # 5. Write report
        report_path = write_report(needs_analyses, len(offer_updates), 0)
        print(f"Report written to {report_path}")

        if dry_run:
            print("Dry-run -- nothing inserted")
            return 0

        # 6. Confirm and insert
        prompt = (
            f"Insert {len(needs_analyses)} needs_analysis documents and update "
            f"{len(offer_updates)} offers in MongoDB ({MONGO_DB_NAME})?"
        )
        if not auto_confirm and not confirm(prompt):
            print("Aborted.")
            return 0

        inserted = 0
        for na_doc in needs_analyses:
            na_collection.insert_one(na_doc)
            inserted += 1
        print(f"Done -- {inserted} needs_analysis documents inserted")

        updated = 0
        for offer_id, na_id in offer_updates:
            offers_collection.update_one(
                {"_id": offer_id},
                {"$set": {"needs_analysis_id": na_id, "updated_at": datetime.now(timezone.utc)}},
            )
            updated += 1
        print(f"Done -- {updated} offers updated with needs_analysis_id")

    finally:
        mongo_client.close()
        mysql_conn.close()

    return 0


def parse_args():
    parser = argparse.ArgumentParser(
        description="Create signed needs_analysis for legacy offers without one."
    )
    parser.add_argument("--dry-run", action="store_true", help="Build report, do not insert")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()
    return run_migration(dry_run=args.dry_run, auto_confirm=args.yes)


if __name__ == "__main__":
    sys.exit(main())
