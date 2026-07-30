#!/usr/bin/env python3
"""Sync Digiforma companies with the local MySQL database.

Digiforma is the source of truth. Three exclusive modes:
  --compare        Print conflicts/diffs to stdout, no writes.
  --report [PATH]  Write conflicts/diffs to a JSON file, no DB writes.
  --import         Insert new companies, update existing ones, write conflicts to stdout.
"""

import argparse
import os
import sys
from datetime import datetime

from dotenv import load_dotenv

from db.mysql import get_mysql_connection
from lib.digiforma_sync import (
    FALLBACK_USER_FIRST_NAME,
    ensure_company_conflict_table,
    fetch_digiforma_companies,
    fetch_local_users,
    normalize_name_for_matching,
    print_human_summary,
    run_sync,
    write_json_report,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DIGIFORMA_API_KEY = os.getenv("DIGIFORMA_API_KEY")
DIGIFORMA_BASE_API_URL = os.getenv("DIGIFORMA_BASE_API_URL")


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--compare", action="store_true", help="Print conflicts and diffs, no writes")
    group.add_argument("--report", nargs="?", const="", metavar="PATH", help="Write conflicts and diffs to a JSON file")
    group.add_argument("--import", dest="do_import", action="store_true", help="Insert/update companies in the database")
    return parser.parse_args()


def resolve_fallback_user(users):
    index = {normalize_name_for_matching(u["first_name"]): u for u in users.values()}
    fallback = index.get(normalize_name_for_matching(FALLBACK_USER_FIRST_NAME))
    if not fallback:
        print(f"WARNING: Fallback user '{FALLBACK_USER_FIRST_NAME}' not found. "
              f"New companies without a matched commercial will not be inserted.")
    return fallback


def default_report_path():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return os.path.join(os.path.dirname(__file__), "resources", f"digiforma_report_{timestamp}.json")


def main():
    args = parse_args()

    if not DIGIFORMA_API_KEY or not DIGIFORMA_BASE_API_URL:
        print("ERROR: DIGIFORMA_API_KEY and DIGIFORMA_BASE_API_URL must be set in .env")
        return 1

    print("Fetching Digiforma companies...")
    digiforma_companies = fetch_digiforma_companies(DIGIFORMA_BASE_API_URL, DIGIFORMA_API_KEY)
    print(f"  Found {len(digiforma_companies)} non-draft companies")

    print("Connecting to MySQL...")
    conn = get_mysql_connection()
    cursor = conn.cursor()

    try:
        ensure_company_conflict_table(cursor)
        users = fetch_local_users(cursor)
        print(f"  Found {len(users)} users in database")
        fallback_user = resolve_fallback_user(users)

        apply_changes = bool(args.do_import)
        report = run_sync(cursor, digiforma_companies, users, fallback_user, apply_changes)

        if apply_changes:
            conn.commit()
            print(f"\n{report['summary']['to_insert']} entreprises insérées, "
                  f"{report['summary']['to_update']} mises à jour, "
                  f"{report['summary']['to_conflict']} en quarantaine (company_conflict).")
        elif args.report is not None:
            path = args.report or default_report_path()
            write_json_report(report, path)
            print(f"Rapport écrit : {path}")

        print_human_summary(report)
        return 1 if report["summary"]["blocking_conflicts"] else 0
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
