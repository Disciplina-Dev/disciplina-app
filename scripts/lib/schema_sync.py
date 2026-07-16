"""Introspect the production schema and regenerate the docker init files.

MySQL: `SHOW CREATE TABLE` per table, preserving the static seed INSERTs already
present in mysql-init.sql. Mongo: `listCollections` + `listIndexes` rewritten into
mongo-init.js. Both compare against the current file and only rewrite on drift.
"""

import os
import re

DATABASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "database")
MYSQL_INIT = os.path.join(DATABASE_DIR, "mysql", "mysql-init.sql")
MONGO_INIT = os.path.join(DATABASE_DIR, "mongodb", "mongo-init.js")


def _ordered_tables(cursor):
    cursor.execute("SHOW TABLES")
    return [row[0] for row in cursor.fetchall()]


def _create_statement(cursor, table):
    cursor.execute(f"SHOW CREATE TABLE `{table}`")
    statement = cursor.fetchone()[1]
    statement = re.sub(r"\s*AUTO_INCREMENT=\d+", "", statement)
    return statement.replace("CREATE TABLE `", "CREATE TABLE IF NOT EXISTS `", 1)


def _extract_seed_inserts(current_sql):
    return "\n\n".join(re.findall(r"INSERT[^;]+;", current_sql, re.IGNORECASE))


def build_mysql_init(cursor, current_sql):
    header = "SET NAMES utf8mb4;\n\nCREATE DATABASE IF NOT EXISTS disciplina;\nUSE disciplina;"
    creates = [_create_statement(cursor, t) + ";" for t in _ordered_tables(cursor)]
    seeds = _extract_seed_inserts(current_sql)
    body = "\n\n".join([header] + creates)
    return f"{body}\n\n{seeds}\n" if seeds else f"{body}\n"


def sync_mysql_schema(cursor, dry_run):
    current = _read(MYSQL_INIT)
    generated = build_mysql_init(cursor, current)
    return _apply(MYSQL_INIT, current, generated, dry_run, "mysql-init.sql")


def _mongo_collection_block(db, name):
    info = db.command("listCollections", filter={"name": name})["cursor"]["firstBatch"][0]
    validator = info.get("options", {}).get("validator")
    lines = [f"db.createCollection('{name}', {_js(validator)});"] if validator \
        else [f"db.createCollection('{name}');"]
    for index in db[name].list_indexes():
        if index["name"] == "_id_":
            continue
        lines.append(f"db['{name}'].createIndex({_js(dict(index['key']))});")
    return "\n".join(lines)


def build_mongo_init(db):
    header = (
        "const ROOT = process.env.MONGO_INITDB_ROOT_USERNAME;\n"
        "const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;\n"
        "db = db.getSiblingDB('admin')\n"
        "db.auth(ROOT, PASSWORD)\n\n"
        "db = db.getSiblingDB('human_ressources');"
    )
    names = [c for c in db.list_collection_names() if not c.startswith("system.")]
    blocks = [_mongo_collection_block(db, name) for name in sorted(names)]
    return "\n\n".join([header] + blocks) + "\n"


def sync_mongo_schema(db, dry_run):
    current = _read(MONGO_INIT)
    generated = build_mongo_init(db)
    return _apply(MONGO_INIT, current, generated, dry_run, "mongo-init.js")


def _js(value):
    import json

    return json.dumps(value, indent=2, default=str)


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _apply(path, current, generated, dry_run, label):
    if current.strip() == generated.strip():
        print(f"  {label}: à jour")
        return False
    print(f"  {label}: DRIFT détecté" + (" (dry-run, non écrit)" if dry_run else " → réécrit"))
    if not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            f.write(generated)
    return True
