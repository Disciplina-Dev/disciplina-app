#!/usr/bin/env python3
"""Seed the MongoDB `offers` collection from the recrutment-nord-<theme>.csv files.

Each CSV row becomes one offer per desired TP (Formation split on '/'), and the
'A envoyer' / 'Candidat ... à envoyer' columns are resolved against existing
candidates to populate matching.candidates[]. Unmatched/ambiguous names and unknown
localisations are collected into a JSON report under scripts/backups/.

Offers are upserted by (company_infos.name, tp_type, localisation[0]) so the
script is idempotent — re-runs update existing offers instead of duplicating them.
"""

import argparse
import csv
import glob
import json
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

from db.mongo import get_mongo_connection
from lib.candidate_matcher import CandidateMatcher
from lib.recruitment_csv import FILE_CONFIG, build_jobs, theme_from_path

DB_NAME = "human_ressources"
RESOURCE_DIR = os.path.join(os.path.dirname(__file__), "resources")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")
MATCHED_STATUS = "PRE_SELECTED"
JOB_STATUS = "NOT_MATCHED"
VALID_MATCHED_SEX = {"FILLE", "GARCON"}
CITY_OVERRIDES = {"STE_CLOTILDE": "SAINT_DENIS", "SAINTE_CLOTILDE": "SAINT_DENIS"}

TP_TO_TITLE = {
    "CC": "conseiller commercial",
    "NTC": "négociateur technico-commercial",
    "REM": "responsable d'établissement marchand",
    "AD": "assistante de direction",
    "SA": "secrétaire assistante",
}


def load_candidates(db):
    projection = {"identity.full_name": 1, "identity.age": 1, "identity.sex": 1,
                  "identity.city": 1, "identity.email": 1, "identity.phone": 1}
    return list(db["candidates"].find({}, projection))


def candidate_to_matched(candidate):
    identity = candidate.get("identity") or {}
    sex = identity.get("sex")
    city = identity.get("city")
    entry = {
        "id": candidate["_id"],
        "full_name": identity.get("full_name"),
        "city": CITY_OVERRIDES.get(city, city),
        "email": identity.get("email"),
        "phone": identity.get("phone"),
        "status": MATCHED_STATUS,
    }
    if identity.get("age") is not None:
        entry["age"] = int(identity["age"])
    if sex in VALID_MATCHED_SEX:
        entry["sex"] = sex
    return {key: value for key, value in entry.items() if value is not None}


def resolve_matched_candidates(names, matcher):
    matched, unmatched, ambiguous = {}, [], []
    for name in names:
        candidate, status = matcher.match(name)
        if status == "matched":
            matched[candidate["_id"]] = candidate_to_matched(candidate)
        elif status == "ambiguous":
            ambiguous.append(name)
        else:
            unmatched.append(name)
    return list(matched.values()), unmatched, ambiguous


def parse_age_range(raw):
    if not raw or "-" not in raw:
        return None, None
    parts = raw.strip().split("-")
    if len(parts) == 2:
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            return None, None
    return None, None


def build_offer_document(job, matched_candidates):
    age_min, age_max = parse_age_range(job.get("age_range"))

    criteria = {}
    if job.get("driving_license_b") is not None:
        criteria["driving_license"] = job["driving_license_b"]
    if job.get("professional_experience") is not None:
        criteria["experience_required"] = job["professional_experience"]
    if age_min is not None:
        criteria["age_min"] = age_min
    if age_max is not None:
        criteria["age_max"] = age_max
    if job.get("desired_sex"):
        criteria["desired_sex"] = job["desired_sex"]

    tp = job["desired_tp"]
    training_domain = "VENTE" if tp in ("CC", "NTC", "REM") else "SECRETARIAT"

    company_infos = {"name": job["company_name"], "sector": "NORD"}
    if job.get("sector") and job["sector"] != "NONE":
        company_infos["activities"] = [job["sector"]]

    document = {
        "_id": str(uuid.uuid4()),
        "needs_analysis_id": None,
        "company_infos": company_infos,
        "localisation": job.get("localisation", []),
        "tp_type": tp,
        "training_domain": training_domain,
        "title": TP_TO_TITLE.get(tp),
        "criteria": criteria,
        "matching": {
            "status": "NOT_MATCHED",
            "candidates": matched_candidates,
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return {k: v for k, v in document.items() if v not in (None, "", [], {}, ())}


def upsert_offer(collection, doc):
    name = doc.get("company_infos", {}).get("name")
    tp = doc.get("tp_type")
    loc = doc.get("localisation", [])
    if not name or not tp or not loc:
        collection.insert_one(doc)
        return

    doc_id = doc.pop("_id", None)
    created_at = doc.pop("created_at", None)
    updated_at = doc.pop("updated_at", None)
    # The app owns `matching` once the offer exists: RH pick candidates and book
    # interview slots there. Seeding it on every run would wipe that work, which is
    # why OfferRepository.updateContent keeps it out of its own $set.
    matching = doc.pop("matching", None)

    set_on_insert = {}
    if doc_id:
        set_on_insert["_id"] = doc_id
    if created_at:
        set_on_insert["created_at"] = created_at
    if matching:
        set_on_insert["matching"] = matching

    filter_ = {"company_infos.name": name, "tp_type": tp, "localisation.0": loc[0]}
    update = {"$set": doc}
    if updated_at:
        update["$set"]["updated_at"] = updated_at
    if set_on_insert:
        update["$setOnInsert"] = set_on_insert

    collection.update_one(filter_, update, upsert=True)


def process_row(theme, values, matcher, report):
    jobs, names, unknown_loc = build_jobs(theme, values)
    if not jobs:
        return []
    matched, unmatched, ambiguous = resolve_matched_candidates(names, matcher)
    documents = [build_offer_document(job, matched) for job in jobs]
    if unmatched or ambiguous or unknown_loc:
        report.append({
            "file": f"recrutment-nord-{theme}.csv",
            "company": jobs[0]["company_name"],
            "tp": [job["desired_tp"] for job in jobs],
            "matched": [c["full_name"] for c in matched],
            "unmatched": unmatched,
            "ambiguous": ambiguous,
            "unknown_localisations": unknown_loc,
        })
    return documents


def read_documents(path, theme, matcher, report):
    data_start = FILE_CONFIG[theme]["data_start"]
    with open(path, encoding="utf-8") as file:
        rows = list(csv.reader(file))[data_start:]
    documents = []
    for values in rows:
        if any(value.strip() for value in values):
            documents.extend(process_row(theme, values, matcher, report))
    return documents


def write_report(report, total):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"offers_import_report_{stamp}.json")
    with open(path, "w", encoding="utf-8") as file:
        json.dump({"total_offers": total, "rows_with_issues": report}, file,
                  ensure_ascii=False, indent=2, default=str)
    return path


def confirm(prompt):
    return input(f"{prompt} [y/N] ").strip().lower() == "y"


def collect_documents(db, report):
    matcher = CandidateMatcher(load_candidates(db))
    documents = []
    for path in sorted(glob.glob(os.path.join(RESOURCE_DIR, "recrutment-nord-*.csv"))):
        theme = theme_from_path(path)
        if theme is None:
            continue
        file_docs = read_documents(path, theme, matcher, report)
        documents.extend(file_docs)
        print(f"  {os.path.basename(path)}: {len(file_docs)} offers built")
    return documents


def seed_offers(write_report_output=False):
    """Build and upsert all offers; used by startup.py. Returns the upserted count."""
    client = get_mongo_connection()
    try:
        db = client[DB_NAME]
        report = []
        documents = collect_documents(db, report)
        if write_report_output:
            write_report(report, len(documents))
        if documents:
            for doc in documents:
                upsert_offer(db["offers"], doc)
        return len(documents)
    finally:
        client.close()


def parse_args():
    parser = argparse.ArgumentParser(description="Seed MongoDB jobs from recrutment-nord CSVs.")
    parser.add_argument("--dry-run", action="store_true", help="Build and report, do not insert")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()
    if not glob.glob(os.path.join(RESOURCE_DIR, "recrutment-nord-*.csv")):
        print("  SKIP -- no recrutment-nord-*.csv files found")
        return 1

    client = get_mongo_connection()
    try:
        db = client[DB_NAME]
        report = []
        documents = collect_documents(db, report)
        report_path = write_report(report, len(documents))
        matched_count = sum(len(d.get("matching", {}).get("candidates", [])) for d in documents)
        print(f"Built {len(documents)} offers, {matched_count} matched candidates")
        print(f"Report written to {report_path}")

        if args.dry_run:
            print("Dry-run -- nothing inserted")
            return 0
        if not args.yes and not confirm(f"Upsert {len(documents)} offers into MongoDB?"):
            print("Aborted.")
            return 0
        for doc in documents:
            upsert_offer(db["offers"], doc)
        print(f"Done -- {len(documents)} offers upserted")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
