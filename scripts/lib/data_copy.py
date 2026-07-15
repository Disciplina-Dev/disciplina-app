"""Upsert copy of prod data into the local databases.

MySQL rows are copied with INSERT ... ON DUPLICATE KEY UPDATE (FK checks disabled
for the duration). Mongo documents are copied via bulk UpdateOne upserts keyed on
_id. Both stream in batches to bound memory and TiDB/Atlas request units.
"""

from pymongo import ReplaceOne

BATCH_SIZE = 500

# users first (FK root), then parents, then child tables.
MYSQL_TABLE_ORDER = [
    "users", "filiz", "companies", "companies_blacklist", "relance_history",
    "company_history", "contact_logs", "commercial_kpi", "rh_kpi",
    "booking_settings", "match_link", "interview_access", "sector_settings",
]


def _table_columns(cursor, table):
    cursor.execute(f"SHOW COLUMNS FROM `{table}`")
    return [row[0] for row in cursor.fetchall()]


def _upsert_query(table, columns):
    placeholders = ", ".join(["%s"] * len(columns))
    assignments = ", ".join(f"`{c}` = VALUES(`{c}`)" for c in columns)
    cols = ", ".join(f"`{c}`" for c in columns)
    return f"INSERT INTO `{table}` ({cols}) VALUES ({placeholders}) " \
           f"ON DUPLICATE KEY UPDATE {assignments}"


def _copy_table(source_cursor, target_cursor, table, dry_run):
    columns = _table_columns(source_cursor, table)
    source_cursor.execute(f"SELECT {', '.join(f'`{c}`' for c in columns)} FROM `{table}`")
    query = _upsert_query(table, columns)
    total = 0
    while True:
        rows = source_cursor.fetchmany(BATCH_SIZE)
        if not rows:
            break
        total += len(rows)
        if not dry_run:
            target_cursor.executemany(query, rows)
    print(f"  {table}: {total} lignes" + (" (dry-run)" if dry_run else " upsertées"))
    return total


def copy_mysql(source, target, dry_run):
    source_cursor = source.cursor()
    target_cursor = target.cursor()
    if not dry_run:
        target_cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    for table in MYSQL_TABLE_ORDER:
        _copy_table(source_cursor, target_cursor, table, dry_run)
    if not dry_run:
        target_cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        target.commit()


def _copy_collection(source_db, target_db, name, dry_run):
    documents = list(source_db[name].find())
    if not dry_run and documents:
        operations = [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in documents]
        target_db[name].bulk_write(operations, ordered=False)
    print(f"  {name}: {len(documents)} documents" + (" (dry-run)" if dry_run else " upsertés"))


def copy_mongo(source_client, target_client, dry_run):
    source_db = source_client["human_ressources"]
    target_db = target_client["human_ressources"]
    names = [c for c in source_db.list_collection_names() if not c.startswith("system.")]
    for name in names:
        _copy_collection(source_db, target_db, name, dry_run)
