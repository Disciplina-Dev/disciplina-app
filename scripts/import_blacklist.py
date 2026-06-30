#!/usr/bin/env python3
"""Import the blacklist-<zone>.csv files into MySQL/TiDB companies_blacklist.

Each file maps Entreprise/SIRET/Motif onto name/siret/conclusion, derives the
sector from the filename, owns every row to Amanda, and inserts in batches of 10
with INSERT IGNORE so re-runs and cross-file SIRET duplicates stay idempotent.
"""

import csv
import glob
import os
import sys

from db.mysql import get_mysql_connection
from lib.blacklist_csv import build_blacklist_row, zone_from_path

RESOURCE_DIR = os.path.join(os.path.dirname(__file__), "resources")
OWNER_FIRST_NAME = "Amanda"
BATCH_SIZE = 10

INSERT_QUERY = """
    INSERT IGNORE INTO companies_blacklist (
        user_id, name, address, sector, siret, conclusion, notes, all_blacklist
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""


def resolve_owner_id(cursor):
    cursor.execute("SELECT id FROM users WHERE first_name = %s", (OWNER_FIRST_NAME,))
    row = cursor.fetchone()
    return row[0] if row else None


def read_blacklist_rows(path, placeholder_by_name):
    zone = zone_from_path(path)
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)
        return [
            build_blacklist_row(values, zone, placeholder_by_name)
            for values in reader
            if any(value.strip() for value in values)
        ]


def row_to_params(user_id, row):
    return (
        user_id,
        row["name"],
        row["address"],
        row["sector"],
        row["siret"],
        row["conclusion"],
        row["notes"] or None,
        0,
    )


def insert_in_batches(cursor, conn, user_id, rows):
    inserted = 0
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start:start + BATCH_SIZE]
        cursor.executemany(INSERT_QUERY, [row_to_params(user_id, row) for row in chunk])
        conn.commit()
        inserted += cursor.rowcount
    return inserted


def import_blacklist():
    conn = get_mysql_connection()
    cursor = conn.cursor()
    user_id = resolve_owner_id(cursor)
    if user_id is None:
        cursor.close()
        conn.close()
        raise Exception(f"No user matches '{OWNER_FIRST_NAME}', cannot own blacklist rows")
    placeholder_by_name = {}
    total = 0
    for path in sorted(glob.glob(os.path.join(RESOURCE_DIR, "blacklist-*.csv"))):
        rows = read_blacklist_rows(path, placeholder_by_name)
        inserted = insert_in_batches(cursor, conn, user_id, rows)
        print(f"  OK -- {os.path.basename(path)}: {inserted}/{len(rows)} blacklisted")
        total += inserted
    cursor.close()
    conn.close()
    return total


def main():
    if not glob.glob(os.path.join(RESOURCE_DIR, "blacklist-*.csv")):
        print("  SKIP -- no blacklist-*.csv files found")
        return 1
    print("Importing blacklist -> MySQL ...")
    total = import_blacklist()
    print(f"Done -- {total} blacklisted companies inserted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
