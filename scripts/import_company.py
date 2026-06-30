#!/usr/bin/env python3
"""Import cleaned company CSVs into MySQL/TiDB.

Resolves each commercial's user_id from the users table (matching the saler name
in the filename) and inserts companies in batches of 10 per commercial to limit
TiDB request units.
"""

import csv
import glob
import os
import sys

from db.mysql import get_mysql_connection

CLEANED_DIR = os.path.join(os.path.dirname(__file__), "resources", "cleaned")
BATCH_SIZE = 10

INSERT_QUERY = """
    INSERT IGNORE INTO companies (
        user_id, legal_referent, name, phone, email, address, sector,
        main_activity, siret, idcc, notes, conclusion, status, relance_date
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


def saler_from_path(path):
    return os.path.basename(path).split("-company")[0]


def resolve_saler_ids(cursor):
    cursor.execute("SELECT id, first_name FROM users")
    return {first_name.lower(): user_id for user_id, first_name in cursor.fetchall()}


def read_cleaned(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def row_to_params(user_id, row):
    return (
        user_id,
        row["legal_referent"] or None,
        row["name"],
        row["phone"] or None,
        row["email"] or None,
        row["address"] or "",
        row["sector"],
        row["main_activity"] or None,
        row["siret"],
        None,
        row["notes"] or None,
        row["conclusion"] or "",
        row["status"],
        row["relance_date"] or None,
    )


def insert_in_batches(cursor, conn, user_id, rows):
    inserted = 0
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start:start + BATCH_SIZE]
        cursor.executemany(INSERT_QUERY, [row_to_params(user_id, row) for row in chunk])
        conn.commit()
        inserted += cursor.rowcount
    return inserted


def import_companies():
    conn = get_mysql_connection()
    cursor = conn.cursor()
    saler_ids = resolve_saler_ids(cursor)
    total = 0
    for path in sorted(glob.glob(os.path.join(CLEANED_DIR, "*-company.cleaned.csv"))):
        saler = saler_from_path(path)
        user_id = saler_ids.get(saler.lower())
        if user_id is None:
            print(f"  [WARN] No user matches saler '{saler}', skipping {os.path.basename(path)}")
            continue
        rows = read_cleaned(path)
        inserted = insert_in_batches(cursor, conn, user_id, rows)
        print(f"  OK -- {saler} (user_id={user_id}): {inserted}/{len(rows)} companies inserted")
        total += inserted
    cursor.close()
    conn.close()
    return total


def main():
    if not os.path.isdir(CLEANED_DIR) or not os.listdir(CLEANED_DIR):
        print("  SKIP -- no cleaned CSVs found, run clean_companies.py first")
        return 1
    print("Importing cleaned companies -> MySQL ...")
    total = import_companies()
    print(f"Done -- {total} companies inserted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
