#!/usr/bin/env python3
"""Disciplina — consolidated database seed script.

Imports CSV data into MySQL and MongoDB in 6 steps:
  1. Companies -> MySQL (disciplina.companies)
  2. Blacklist -> MySQL (disciplina.blacklist)
  3. Candidates -> MongoDB (human_ressources.candidates), all candidat-*.csv files
  4. Offers -> MongoDB (human_ressources.offers)
  5. Migrate legacy offers -> needs_analysis (human_ressources.needs_analysis)
  6. Normalize legacy offers -> current offer schema (human_ressources.offers)

Missing CSV files are skipped gracefully.
Environment variables control DB host/port (defaults to localhost for dev).
"""

import sys

from dotenv import load_dotenv

from db.guard import guard_local_target
from clean_companies import clean_all
from import_company import import_companies
from import_blacklist import import_blacklist
from import_candidates import seed_candidates
from import_jobs import seed_offers
from migrate_offers_to_ab import run_migration
from normalize_legacy_offers import run_normalization

load_dotenv()


def main() -> int:
    print("=" * 50)
    print("  Disciplina -- Database Seed Script")
    print("=" * 50)

    # Le seed écrit des données de démo : NODE_ENV=production le brancherait sur
    # MYSQL_URI/MONGO_URI, donc sur la prod.
    guard_local_target(action="Seed")

    errors = []

    # 1. Companies -- idempotent via INSERT IGNORE, runs even on a populated table.
    #    Doit précéder les candidats : le rattachement des contrats à une
    #    entreprise lit cette table.
    print("\n[1/6] Importing companies -> MySQL ...")
    try:
        clean_all()
        n = import_companies()
        print(f"  OK -- {n} companies inserted")
    except Exception as e:
        print(f"  FAIL -- Companies: {e}")
        errors.append(f"Companies: {e}")

    # 2. Blacklist -- idempotent via INSERT IGNORE, runs even on a populated table.
    print("\n[2/6] Importing blacklist -> MySQL ...")
    try:
        n = import_blacklist()
        print(f"  OK -- {n} blacklisted companies inserted")
    except Exception as e:
        print(f"  FAIL -- Blacklist: {e}")
        errors.append(f"Blacklist: {e}")

    # 3. Candidates — idempotent : chaque ligne est résolue par e-mail puis par nom
    #    avant d'être fusionnée (cf. import_candidates.py).
    print("\n[3/6] Importing candidates -> MongoDB ...")
    try:
        inserted, merged, rejected = seed_candidates()
        print(f"  OK -- {inserted} inserted, {merged} merged, {rejected} rejected")
    except Exception as e:
        print(f"  FAIL -- Candidates: {e}")
        errors.append(f"Candidates: {e}")

    # 4. Offers — idempotent via upsert on (company_infos.name, tp_type, localisation[0])
    print("\n[4/6] Importing offers -> MongoDB ...")
    try:
        n = seed_offers()
        print(f"  OK -- {n} offers upserted")
    except Exception as e:
        print(f"  FAIL -- Offers: {e}")
        errors.append(f"Offers: {e}")

    # 5. Migrate legacy offers to needs_analysis — creates one SIGNE needs_analysis
    #    per company for offers without needs_analysis_id, tagged 'Importé du drive'.
    print("\n[5/6] Migrating legacy offers -> needs_analysis ...")
    try:
        run_migration(auto_confirm=True)
        print("  OK -- migration complete")
    except Exception as e:
        print(f"  FAIL -- Migration: {e}")
        errors.append(f"Migration: {e}")

    # 6. Normalize legacy offers to the current offer schema (desired_tp + full fields)
    print("\n[6/6] Normalizing legacy offers -> current schema ...")
    try:
        run_normalization(auto_confirm=True)
        print("  OK -- normalization complete")
    except Exception as e:
        print(f"  FAIL -- Normalization: {e}")
        errors.append(f"Normalization: {e}")

    print()
    print("=" * 50)
    if errors:
        print(f"  Completed with {len(errors)} error(s):")
        for e in errors:
            print(f"    x {e}")
        print("=" * 50)
        return 1
    else:
        print("  All imports completed successfully!")
        print("=" * 50)
        return 0


if __name__ == '__main__':
    sys.exit(main())
