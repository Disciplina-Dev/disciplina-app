#!/usr/bin/env python3
"""Read-only audit of the sectors migration, to run on prod before dropping the
legacy label columns (companies/company_conflict/companies_blacklist.sector and
users.sectors).

For one tenant it checks that every row still carrying a legacy label also has its
referential link (sector_id, company_sectors, user_sectors), and lists the labels
that match no sector of the referential. It never writes.

Exit code 0 = safe to drop, 1 = at least one gap (details printed), 2 = referential
missing or unreachable.

Usage (same container and connection rules as delete_companies.py):
    docker compose -f docker-compose.yaml -f docker-compose.prod.yaml run --rm --no-deps \\
      -v "$PWD/scripts:/app" startup-script python -u audit_sectors.py --tenant reunion
    # then --tenant annemasse
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv

from db.mysql import get_mysql_connection

# Tables carrying a single sector_id next to the legacy label.
SINGLE_SECTOR_TABLES = ("companies", "company_conflict", "companies_blacklist")
SAMPLE_SIZE = 10


def tenant_database(tenant: str) -> str:
    if tenant == "annemasse":
        return os.getenv("MYSQL_ANNEMASSE_DATABASE", "disciplina_annemasse")
    return os.getenv("MYSQL_DATABASE", "disciplina")


def connect(tenant: str):
    """Like the backend: Annemasse uses MYSQL_ANNEMASSE_URI in production when set."""
    if tenant == "annemasse" and os.getenv("NODE_ENV") == "production":
        override = os.getenv("MYSQL_ANNEMASSE_URI")
        if override:
            os.environ["MYSQL_URI"] = override
    conn = get_mysql_connection()
    conn.database = tenant_database(tenant)
    return conn


def scalar(cursor, sql: str, params=()) -> int:
    cursor.execute(sql, params)
    return int(cursor.fetchone()[0])


def sample(cursor, sql: str) -> list:
    cursor.execute(f"{sql} LIMIT {SAMPLE_SIZE}")
    return cursor.fetchall()


def split_labels(raw) -> list[str]:
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


def user_labels(raw) -> list[str]:
    if raw is None:
        return []
    value = raw
    if isinstance(value, (bytes, bytearray)):
        value = value.decode()
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return []
    return [v for v in value if isinstance(v, str)] if isinstance(value, list) else []


def report(title: str, count: int, rows: list | None = None) -> bool:
    status = "OK " if count == 0 else "GAP"
    print(f"[{status}] {title}: {count}")
    if count and rows:
        for row in rows:
            print(f"        {row}")
        if count > len(rows):
            print(f"        ... {count - len(rows)} more")
    return count == 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tenant", required=True, choices=("reunion", "annemasse"))
    args = parser.parse_args()
    load_dotenv()

    conn = connect(args.tenant)
    cursor = conn.cursor()
    print(f"Tenant: {args.tenant} (MySQL `{tenant_database(args.tenant)}`) — read-only audit")

    nb_sectors = scalar(cursor, "SELECT COUNT(*) FROM sectors WHERE level = 'sector'")
    if nb_sectors == 0:
        print("Referential `sectors` is empty or missing: start the backend once so the migration runs.")
        return 2
    print(f"Referential: {nb_sectors} sectors")

    cursor.execute("SELECT label FROM sectors WHERE level IN ('region', 'sector')")
    known = {row[0] for row in cursor.fetchall()}

    ok = True

    # Legacy label set but no sector_id.
    for table in SINGLE_SECTOR_TABLES:
        where = f"FROM {table} WHERE sector IS NOT NULL AND sector <> '' AND sector_id IS NULL"
        ok &= report(
            f"{table}: label without sector_id",
            scalar(cursor, f"SELECT COUNT(*) {where}"),
            sample(cursor, f"SELECT id, sector {where}"),
        )

    # Legacy label set but no company_sectors link.
    where = (
        "FROM companies c WHERE c.sector IS NOT NULL AND c.sector <> '' "
        "AND NOT EXISTS (SELECT 1 FROM company_sectors cs WHERE cs.company_id = c.id)"
    )
    ok &= report(
        "companies: label without company_sectors link",
        scalar(cursor, f"SELECT COUNT(*) {where}"),
        sample(cursor, f"SELECT c.id, c.sector {where}"),
    )

    # Legacy JSON set but no user_sectors link.
    cursor.execute(
        "SELECT u.id, u.sectors FROM users u WHERE u.sectors IS NOT NULL "
        "AND NOT EXISTS (SELECT 1 FROM user_sectors us WHERE us.user_id = u.id)"
    )
    unlinked_users = [(uid, user_labels(raw)) for uid, raw in cursor.fetchall()]
    unlinked_users = [(uid, labels) for uid, labels in unlinked_users if labels]
    ok &= report("users: sectors JSON without user_sectors link", len(unlinked_users), unlinked_users[:SAMPLE_SIZE])

    # Labels matching no sector of the referential.
    unknown: dict[str, int] = {}
    for table in SINGLE_SECTOR_TABLES:
        cursor.execute(f"SELECT sector, COUNT(*) FROM {table} WHERE sector IS NOT NULL AND sector <> '' GROUP BY sector")
        for raw, nb in cursor.fetchall():
            for label in split_labels(raw):
                if label not in known:
                    key = f"{table}.sector = {label!r}"
                    unknown[key] = unknown.get(key, 0) + int(nb)
    cursor.execute("SELECT sectors FROM users WHERE sectors IS NOT NULL")
    for (raw,) in cursor.fetchall():
        for label in user_labels(raw):
            if label not in known:
                key = f"users.sectors = {label!r}"
                unknown[key] = unknown.get(key, 0) + 1
    ok &= report("labels outside the referential", len(unknown), [f"{k} ({n} rows)" for k, n in unknown.items()][:SAMPLE_SIZE])

    cursor.close()
    conn.close()
    print("Result: safe to drop the legacy columns." if ok else "Result: gaps found, do NOT drop the legacy columns yet.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
