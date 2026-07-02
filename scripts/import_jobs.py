#!/usr/bin/env python3
"""Seed the MongoDB `jobs` collection from the recrutment-nord-<theme>.csv files.

Each CSV row becomes one job per desired TP (Formation split on '/'), and the
'A envoyer' / 'Candidat ... à envoyer' columns are resolved against existing
candidates to populate matched_candidate[]. Unmatched/ambiguous names and unknown
localisations are collected into a JSON report under scripts/backups/.

The collection is expected to be empty: each run inserts fresh UUIDs, so a re-run
duplicates jobs — clear `db.jobs` before re-seeding.
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
MATCHED_STATUS = "RETAINED"
JOB_STATUS = "NOT_MATCHED"
VALID_MATCHED_SEX = {"FILLE", "GARCON"}
CITY_OVERRIDES = {"STE_CLOTILDE": "SAINT_DENIS", "SAINTE_CLOTILDE": "SAINT_DENIS"}


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


def build_job_document(job, matched_candidates):
    document = {"_id": str(uuid.uuid4()), "status": JOB_STATUS, **job}
    if matched_candidates:
        document["matched_candidate"] = matched_candidates
    return document


def process_row(theme, values, matcher, report):
    jobs, names, unknown_loc = build_jobs(theme, values)
    if not jobs:
        return []
    matched, unmatched, ambiguous = resolve_matched_candidates(names, matcher)
    documents = [build_job_document(job, matched) for job in jobs]
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
    path = os.path.join(BACKUP_DIR, f"jobs_import_report_{stamp}.json")
    with open(path, "w", encoding="utf-8") as file:
        json.dump({"total_jobs": total, "rows_with_issues": report}, file,
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
        print(f"  {os.path.basename(path)}: {len(file_docs)} jobs built")
    return documents


def seed_jobs(write_report_output=False):
    """Build and insert all jobs; used by startup.py. Returns the inserted count."""
    client = get_mongo_connection()
    try:
        db = client[DB_NAME]
        report = []
        documents = collect_documents(db, report)
        if write_report_output:
            write_report(report, len(documents))
        if documents:
            db["jobs"].insert_many(documents)
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
        matched_count = sum(len(d.get("matched_candidate", [])) for d in documents)
        print(f"Built {len(documents)} jobs, {matched_count} matched candidates")
        print(f"Report written to {report_path}")

        if args.dry_run:
            print("Dry-run -- nothing inserted")
            return 0
        if not args.yes and not confirm(f"Insert {len(documents)} jobs into MongoDB?"):
            print("Aborted.")
            return 0
        result = db["jobs"].insert_many(documents)
        print(f"Done -- {len(result.inserted_ids)} jobs inserted")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
