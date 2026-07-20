#!/usr/bin/env python3
"""Import cleaned company CSVs into MySQL/TiDB.

Resolves each commercial's user_id from the users table (matching the saler name
in the filename) and inserts companies in batches of 10 to limit TiDB request
units. A SIRET claimed by several salers is a portfolio conflict: the row goes to
CONFLICT_OWNER_FIRST_NAME and is listed in the conflicts report for arbitration,
instead of being silently awarded to whoever comes first alphabetically.
"""

import collections
import csv
import glob
import os
import sys

from db.mysql import get_mysql_connection

CLEANED_DIR = os.path.join(os.path.dirname(__file__), "resources", "cleaned")
CONFLICTS_REPORT = os.path.join(CLEANED_DIR, "conflicts.csv")
BATCH_SIZE = 10

# Only these roles can own a portfolio: several users may share a first name
# (a RH and a commercial both named Marion), and the CSVs are commercial ones.
SALER_ROLES = ("COMMERCIAL", "RESPONSABLE")
CONFLICT_OWNER_FIRST_NAME = "root"

INSERT_QUERY = """
    INSERT IGNORE INTO companies (
        user_id, legal_referent, name, phone, email, address, sector,
        main_activity, siret, idcc, notes, conclusion, status, relance_date
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


def saler_from_path(path):
    return os.path.basename(path).split("-company")[0]


def resolve_owner_ids(cursor):
    """Lowercased first name -> user_id, for salers and the conflict portfolio."""
    roles = ", ".join(["%s"] * len(SALER_ROLES))
    cursor.execute(
        f"SELECT id, first_name FROM users WHERE role IN ({roles}) OR first_name = %s ORDER BY id",
        (*SALER_ROLES, CONFLICT_OWNER_FIRST_NAME),
    )
    return {first_name.lower(): user_id for user_id, first_name in cursor.fetchall()}


def resolve_conflict_owner(user_ids):
    """Neutral portfolio for disputed SIRET, or None when that user does not exist."""
    key = CONFLICT_OWNER_FIRST_NAME.lower()
    return key if key in user_ids else None


def read_cleaned(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_claims():
    """Every cleaned row paired with the saler whose file it came from."""
    claims = []
    for path in sorted(glob.glob(os.path.join(CLEANED_DIR, "*-company.cleaned.csv"))):
        saler = saler_from_path(path)
        claims.extend((saler, row) for row in read_cleaned(path))
    return claims


def group_by_siret(claims):
    groups = collections.OrderedDict()
    for saler, row in claims:
        groups.setdefault(row["siret"], []).append((saler, row))
    return groups


def resolve_ownership(groups, conflict_owner):
    """Award each SIRET to one owner, and report what had to be arbitrated."""
    owned, conflicts, duplicates = [], [], []
    for siret, claims in groups.items():
        salers = sorted({saler for saler, _ in claims})
        row = claims[0][1]
        if len(salers) > 1:
            conflicts.append((siret, row["name"], salers))
            owned.append((conflict_owner or salers[0], row))
            continue
        if len(claims) > 1:
            duplicates.append((siret, row["name"], salers[0], len(claims)))
        owned.append((salers[0], row))
    return owned, conflicts, duplicates


def map_to_user_ids(owned, user_ids):
    entries, skipped = [], []
    for owner, row in owned:
        user_id = user_ids.get(owner.lower())
        if user_id is None:
            skipped.append((owner, row))
            continue
        entries.append((user_id, row))
    return entries, skipped


def write_conflicts_report(conflicts, conflict_owner):
    with open(CONFLICTS_REPORT, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["siret", "name", "claimed_by", "assigned_to"])
        for siret, name, salers in conflicts:
            writer.writerow([siret, name, " | ".join(salers), conflict_owner or salers[0]])
    return CONFLICTS_REPORT


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


def insert_in_batches(cursor, conn, entries):
    inserted = 0
    for start in range(0, len(entries), BATCH_SIZE):
        chunk = entries[start:start + BATCH_SIZE]
        cursor.executemany(INSERT_QUERY, [row_to_params(user_id, row) for user_id, row in chunk])
        conn.commit()
        inserted += cursor.rowcount
    return inserted


def report_ownership(conflicts, duplicates, skipped, conflict_owner):
    if duplicates:
        print(f"  [INFO] {len(duplicates)} SIRET duplicated within a single file, first kept")
    if conflicts:
        owner = conflict_owner or "the first saler alphabetically"
        print(f"  [WARN] {len(conflicts)} SIRET claimed by several salers -> assigned to "
              f"'{owner}', listed in {os.path.basename(CONFLICTS_REPORT)}")
    if conflicts and not conflict_owner:
        print(f"  [WARN] No user named '{CONFLICT_OWNER_FIRST_NAME}': conflicts keep their "
              f"historical owner")
    for owner, count in sorted(collections.Counter(o for o, _ in skipped).items()):
        print(f"  [WARN] No saler user matches '{owner}': {count} companies skipped")


def import_companies():
    conn = get_mysql_connection()
    cursor = conn.cursor()
    user_ids = resolve_owner_ids(cursor)
    conflict_owner = resolve_conflict_owner(user_ids)
    owned, conflicts, duplicates = resolve_ownership(group_by_siret(load_claims()), conflict_owner)
    entries, skipped = map_to_user_ids(owned, user_ids)
    inserted = insert_in_batches(cursor, conn, entries)
    cursor.close()
    conn.close()
    if conflicts:
        write_conflicts_report(conflicts, conflict_owner)
    report_ownership(conflicts, duplicates, skipped, conflict_owner)
    return inserted


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
