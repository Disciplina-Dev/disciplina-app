#!/usr/bin/env python3
"""Migrate production data into the local docker-compose databases.

Reads prod through MYSQL_URI / MONGO_URI, syncs the docker init files to the prod
schema (rewriting on drift), then upserts the data into the local containers in
dependency order: users → rest of MySQL → MongoDB. Never writes to prod.

Usage:
    python scripts/migrate_prod_to_local.py [--dry-run] [--skip-schema] [--only mysql|mongo]
"""

import argparse
import os
import sys

from dotenv import load_dotenv

from db.mongo import connect_source_mongo, connect_target_mongo
from db.mysql import connect_source_mysql, connect_target_mysql
from lib import data_copy, schema_sync

LOCAL_HOSTS = {"localhost", "127.0.0.1", "sql-db", "nosql-db"}


def _guard_local_target():
    host = os.getenv("MYSQL_HOST", "localhost")
    if host not in LOCAL_HOSTS:
        sys.exit(f"Refus: MYSQL_HOST='{host}' n'est pas local. Import annulé.")
    if os.getenv("NODE_ENV") == "production":
        sys.exit("Refus: NODE_ENV=production. La cible doit être locale.")


def _parse_args():
    parser = argparse.ArgumentParser(description="Prod → local data migration")
    parser.add_argument("--dry-run", action="store_true", help="n'écrit rien")
    parser.add_argument("--skip-schema", action="store_true", help="saute la sync des init")
    parser.add_argument("--only", choices=["mysql", "mongo"], help="limite le périmètre")
    return parser.parse_args()


def _run_mysql(dry_run, skip_schema):
    source = connect_source_mysql()
    target = connect_target_mysql()
    if not skip_schema:
        print("Schéma MySQL:")
        schema_sync.sync_mysql_schema(source.cursor(), dry_run)
    print("Données MySQL:")
    data_copy.copy_mysql(source, target, dry_run)
    source.close()
    target.close()


def _run_mongo(dry_run, skip_schema):
    source = connect_source_mongo()
    target = connect_target_mongo()
    if not skip_schema:
        print("Schéma MongoDB:")
        schema_sync.sync_mongo_schema(source["human_ressources"], dry_run)
    print("Données MongoDB:")
    data_copy.copy_mongo(source, target, dry_run)
    source.close()
    target.close()


def main():
    load_dotenv()
    args = _parse_args()
    _guard_local_target()
    if args.only != "mongo":
        _run_mysql(args.dry_run, args.skip_schema)
    if args.only != "mysql":
        _run_mongo(args.dry_run, args.skip_schema)
    print("Terminé." + (" (dry-run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
