#!/usr/bin/env python3
"""Migration: bring legacy flat offers up to the current offer schema.

Legacy offers (seeded before the desired_tp refactor) keep flat TP fields at the
document root (tp_type, missions, ...), a partial criteria, and lack desired_tp,
saler_info, referents, count, job_role and company_infos.id. This script rewrites
each such offer in place to match back/src/db/mongo/schemas/offer.schema.ts, while
preserving matching state (candidates are never overwritten).

Usage:
    source .venv/bin/activate
    python scripts/normalize_legacy_offers.py [--dry-run] [--yes]
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection
from migrate_offers_to_ab import build_desired_tp

MONGO_DB_NAME = "human_ressources"
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")

FLAT_FIELDS = [
    "tp_type",
    "missions",
    "description_missions",
    "other_missions",
    "other_description_missions",
]

CRITERIA_DEFAULTS = {
    "education_level": None,
    "driving_license": False,
    "experience_required": False,
    "training_domain": None,
    "age_min": None,
    "age_max": None,
    "desired_sex": None,
    "soft_skills": None,
    "schedule_options": [],
    "conditions": None,
    "additional_comments": None,
}

DEFAULT_REFERENT = {"name": None, "phone": None, "email": None, "function": None}


def build_default_saler_info():
    return {"id": None, "email": None}


def build_default_referents():
    return {
        "is_same": False,
        "legal_referents": dict(DEFAULT_REFERENT),
        "recruitment_referents": dict(DEFAULT_REFERENT),
    }


def merge_criteria(existing):
    merged = dict(CRITERIA_DEFAULTS)
    merged.update(existing or {})
    return merged


def ensure_matching(existing):
    matching = dict(existing or {})
    matching.setdefault("status", "NOT_MATCHED")
    matching.setdefault("candidates", [])
    matching.setdefault("interview_slots", [])
    return matching


def is_legacy_offer(offer):
    has_desired_tp = bool(offer.get("desired_tp"))
    has_flat = any(field in offer for field in FLAT_FIELDS)
    return has_flat or not has_desired_tp


def build_company_infos(offer, company_id):
    company_infos = dict(offer.get("company_infos") or {})
    if company_id is not None:
        company_infos["id"] = company_id
    company_infos.setdefault("activities", [])
    return company_infos


def normalize_offer(offer, company_id):
    return {
        "desired_tp": build_desired_tp(offer),
        "company_infos": build_company_infos(offer, company_id),
        "saler_info": offer.get("saler_info") or build_default_saler_info(),
        "referents": offer.get("referents") or build_default_referents(),
        "job_role": offer.get("job_role"),
        "count": offer.get("count") or 1,
        "criteria": merge_criteria(offer.get("criteria")),
        "matching": ensure_matching(offer.get("matching")),
        "updated_at": datetime.now(timezone.utc),
    }


def fetch_company_ids_by_name(mysql_conn, names):
    if not names:
        return {}
    placeholders = ", ".join(["%s"] * len(names))
    cursor = mysql_conn.cursor(dictionary=True)
    cursor.execute(
        f"SELECT id, name FROM companies WHERE name IN ({placeholders})",
        list(names),
    )
    rows = cursor.fetchall()
    cursor.close()
    return {row["name"]: row["id"] for row in rows}


def collect_company_names(offers):
    names = set()
    for offer in offers:
        name = (offer.get("company_infos") or {}).get("name")
        if name:
            names.add(name)
    return names


def write_report(updated_ids):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"normalize_legacy_offers_report_{stamp}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"total_offers_normalized": len(updated_ids), "offer_ids": updated_ids},
            f, ensure_ascii=False, indent=2, default=str,
        )
    return path


def confirm(prompt):
    return input(f"{prompt} [y/N] ").strip().lower() == "y"


def apply_normalization(offers_collection, offers, company_ids):
    unset = {field: "" for field in FLAT_FIELDS}
    updated_ids = []
    for offer in offers:
        company_id = company_ids.get((offer.get("company_infos") or {}).get("name"))
        offers_collection.update_one(
            {"_id": offer["_id"]},
            {"$set": normalize_offer(offer, company_id), "$unset": unset},
        )
        updated_ids.append(offer["_id"])
    return updated_ids


def run_normalization(dry_run=False, auto_confirm=False):
    mongo_client = get_mongo_connection()
    mysql_conn = get_mysql_connection()

    try:
        db = mongo_client[MONGO_DB_NAME]
        offers_collection = db["offers"]

        candidates = offers_collection.find({
            "$or": [
                {"tp_type": {"$exists": True}},
                {"desired_tp": {"$exists": False}},
                {"desired_tp": {"$size": 0}},
            ]
        })
        legacy_offers = [offer for offer in candidates if is_legacy_offer(offer)]
        print(f"Found {len(legacy_offers)} legacy offers to normalize")

        if not legacy_offers:
            print("Nothing to normalize.")
            return 0

        company_ids = fetch_company_ids_by_name(
            mysql_conn, collect_company_names(legacy_offers)
        )

        if dry_run:
            path = write_report([offer["_id"] for offer in legacy_offers])
            print(f"Dry-run -- report written to {path}")
            return 0

        prompt = f"Normalize {len(legacy_offers)} offers in MongoDB ({MONGO_DB_NAME})?"
        if not auto_confirm and not confirm(prompt):
            print("Aborted.")
            return 0

        updated_ids = apply_normalization(offers_collection, legacy_offers, company_ids)
        path = write_report(updated_ids)
        print(f"Done -- {len(updated_ids)} offers normalized, report at {path}")

    finally:
        mongo_client.close()
        mysql_conn.close()

    return 0


def parse_args():
    parser = argparse.ArgumentParser(
        description="Bring legacy flat offers up to the current offer schema."
    )
    parser.add_argument("--dry-run", action="store_true", help="Build report, do not update")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()
    return run_normalization(dry_run=args.dry_run, auto_confirm=args.yes)


if __name__ == "__main__":
    sys.exit(main())
