#!/usr/bin/env python3
"""Seed the MongoDB `candidates` collection from the candidat-*.csv files.

The 23 files overlap: the same person shows up in a sales sheet, in a trade-show
list and in the contract follow-up. Each row is therefore *resolved* against what
is already known — by email first, by fuzzy name otherwise — and merged instead of
overwritten: a thin trade-show row never blanks the description or the desired
sectors of a complete record, and a status never regresses.

Usage:
    python import_candidates.py [--dry-run]
"""

import argparse
import csv
import os
import uuid
from datetime import datetime

from dotenv import load_dotenv

from db.guard import guard_local_target
from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection
from lib.candidate_csv import (
    CANDIDATE_FILES,
    STATUS_RANK,
    build_candidate,
    build_contract_candidate,
    read_rows,
)
from lib.candidate_matcher import CandidateMatcher, normalize_tokens
from lib.company_match import CompanyMatcher, load_companies

RESOURCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resources")

CANDIDATE_REJECTS = os.path.join(RESOURCE_DIR, "_rejets-candidats.csv")
COMPANY_REJECTS = os.path.join(RESOURCE_DIR, "_rejets-entreprises.csv")

# Champs listes : on cumule les valeurs vues dans les différents fichiers au lieu
# de remplacer la liste précédente.
LIST_FIELDS = (
    "tp_types",
    "training_sites",
    "desired_sectors",
    "expected_company_skills",
    "job_info.geographic_mobility",
)

# Champs qui ne doivent être posés qu'à la création.
INSERT_ONLY_FIELDS = ("_id", "candidate_id", "created_at", "imported_at", "import_source")

# Champs d'identité : renseignés s'ils manquent, jamais réécrits. L'e-mail est la
# clé de dédoublonnage : le remplacer par celui d'une ligne rapprochée par nom
# déplace l'adresse d'une personne sur la fiche d'une autre, et l'import cesse
# d'être idempotent (la personne dépossédée est recréée au run suivant).
IDENTITY_FIELDS = ("identity.email", "identity.full_name")


def flatten(document, prefix=""):
    """{'identity': {'age': 20}} -> {'identity.age': 20}, arrays left whole."""
    flat = {}
    for key, value in document.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            flat.update(flatten(value, f"{path}."))
        else:
            flat[path] = value
    return flat


def is_empty(value):
    return value in (None, "", [], {}) or (isinstance(value, int) and value == 0)


def best_status(current, incoming):
    """Keep the most advanced of two statuses (a trade-show row never un-hires anyone)."""
    if not current:
        return incoming
    if not incoming:
        return current
    return incoming if STATUS_RANK.get(incoming, 0) > STATUS_RANK.get(current, 0) else current


def build_update(document, existing):
    """Split a document into ($set, $addToSet) against the record already in base.

    Empty values are dropped so an incomplete file never erases a richer one, and
    list fields accumulate rather than replace.
    """
    flat = flatten(document)
    set_fields = {}
    add_fields = {}

    existing_flat = flatten(existing) if existing else {}
    for path, value in flat.items():
        if path in INSERT_ONLY_FIELDS or is_empty(value):
            continue
        if path in IDENTITY_FIELDS and not is_empty(existing_flat.get(path)):
            continue
        if path in LIST_FIELDS:
            add_fields[path] = {"$each": value}
        elif path == "status":
            merged = best_status((existing or {}).get("status"), value)
            if merged != (existing or {}).get("status"):
                set_fields[path] = merged
        else:
            set_fields[path] = value

    update = {}
    if set_fields:
        update["$set"] = set_fields
    if add_fields:
        update["$addToSet"] = add_fields
    return update


class CandidateResolver:
    """Resolves a row to an existing candidate, by email then by fuzzy name."""

    def __init__(self, candidates):
        self.by_email = {}
        self.by_name = {}
        for candidate in candidates:
            self.index(candidate)
        self.matcher = CandidateMatcher(candidates)

    def index(self, candidate):
        identity = candidate.get("identity") or {}
        email = (identity.get("email") or "").strip().lower()
        if email:
            self.by_email.setdefault(email, candidate)
        tokens = normalize_tokens(identity.get("full_name"))
        if tokens:
            self.by_name.setdefault((tokens, candidate.get("training_site")), candidate)

    def resolve(self, document):
        """Return (candidate, status) with status in {matched, ambiguous, unmatched}."""
        identity = document.get("identity") or {}
        email = (identity.get("email") or "").strip().lower()
        if email and email in self.by_email:
            return self.by_email[email], "matched"

        # Clé historique : nom + centre de formation, pour les fiches sans e-mail.
        tokens = normalize_tokens(identity.get("full_name"))
        exact = self.by_name.get((tokens, document.get("training_site")))
        if exact:
            return exact, "matched"

        # Dernier recours : rapprochement flou du nom, tous centres confondus. Un
        # même candidat apparaît souvent avec deux adresses différentes d'un
        # fichier à l'autre, ou inscrit dans deux secteurs.
        return self.matcher.match(identity.get("full_name") or "")


def attach_company(document, matcher, rejects):
    """Resolve the employer of a contract row against the MySQL companies."""
    raw_name = document.pop("_company_name", None)
    if not raw_name or matcher is None:
        return
    entry, status = matcher.match(raw_name)
    if status == "matched":
        document["background"]["professional_experiences"][0]["company"] = entry["name"]
        document["company_id"] = entry["id"]
        return
    closest, score = matcher.best_effort(raw_name)
    rejects.append(
        (document["identity"]["full_name"], raw_name, closest, score, status)
    )


def load_company_matcher():
    """Best effort: a MySQL outage must not abort the candidate import."""
    try:
        connection = get_mysql_connection()
    except Exception as error:  # noqa: BLE001 - on dégrade sans faire échouer le seed
        print(f"  [WARN] companies unreachable, raw company names kept: {error}")
        return None
    try:
        cursor = connection.cursor()
        matcher = CompanyMatcher(load_companies(cursor))
        print(f"  {len(matcher.entries)} companies loaded for contract matching")
        return matcher
    finally:
        connection.close()


def write_rejects(path, header, rows):
    if not rows:
        if os.path.exists(path):
            os.remove(path)
        return
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def documents_for(config, run_date):
    """Yield (row number, document) for one file, skipping unusable rows."""
    path = os.path.join(RESOURCE_DIR, config["filename"])
    if not os.path.exists(path):
        return None
    columns, rows = read_rows(path, config)
    documents = []
    for offset, row in enumerate(rows, start=2):
        if config.get("contract"):
            document = build_contract_candidate(row, config, run_date)
        else:
            document = build_candidate(row, columns, config, run_date)
        if document:
            documents.append((offset, document))
    return documents


def seed_candidates(dry_run=False):
    """Import the 23 candidate files. Returns (inserted, merged, rejected)."""
    run_date = datetime.now()
    client = get_mongo_connection()
    collection = client["human_ressources"]["candidates"]

    company_matcher = load_company_matcher()
    candidate_rejects = []
    company_rejects = []
    inserted = merged = 0

    try:
        resolver = CandidateResolver(
            list(collection.find(
                {}, {"identity": 1, "training_site": 1, "status": 1, "created_at": 1}
            ))
        )

        for config in sorted(CANDIDATE_FILES, key=lambda entry: entry["priority"]):
            documents = documents_for(config, run_date)
            if documents is None:
                print(f"  SKIP -- {config['filename']} not found")
                continue

            file_inserted = file_merged = 0
            for line, document in documents:
                attach_company(document, company_matcher, company_rejects)
                existing, status = resolver.resolve(document)

                if status == "ambiguous":
                    candidate_rejects.append((
                        config["filename"], line, document["identity"]["full_name"],
                        document["identity"].get("email", ""), "homonymes en base",
                    ))
                    continue

                update = build_update(document, existing)
                if existing:
                    # Un candidat vu dans plusieurs fichiers garde sa date d'entrée
                    # la plus ancienne.
                    incoming = document.get("created_at")
                    known = existing.get("created_at")
                    if incoming and (not known or incoming < known):
                        update.setdefault("$set", {})["created_at"] = incoming
                        existing["created_at"] = incoming
                    if update and not dry_run:
                        collection.update_one({"_id": existing["_id"]}, update)
                    existing["status"] = best_status(
                        existing.get("status"), document.get("status")
                    )
                    file_merged += 1
                    continue

                document["candidate_id"] = document["_id"] = str(uuid.uuid4())
                document["imported_at"] = run_date
                document["import_source"] = config["filename"]
                if not dry_run:
                    collection.insert_one(document)
                resolver.index(document)
                file_inserted += 1

            inserted += file_inserted
            merged += file_merged
            print(f"  {config['filename']:<42} {file_inserted:>4} insérés, {file_merged:>4} fusionnés")
    finally:
        client.close()

    write_rejects(
        CANDIDATE_REJECTS, ["fichier", "ligne", "nom", "email", "raison"], candidate_rejects
    )
    write_rejects(
        COMPANY_REJECTS,
        ["candidat", "entreprise_csv", "entreprise_la_plus_proche", "score", "statut"],
        company_rejects,
    )
    if company_rejects:
        print(f"  {len(company_rejects)} entreprises non rattachées -> {COMPANY_REJECTS}")
    return inserted, merged, len(candidate_rejects)


def main():
    parser = argparse.ArgumentParser(description="Import des candidats CSV -> MongoDB")
    parser.add_argument("--dry-run", action="store_true", help="n'écrit rien")
    args = parser.parse_args()

    load_dotenv()
    guard_local_target(action="Import candidats")
    inserted, merged, rejected = seed_candidates(args.dry_run)
    print(f"\n{inserted} insérés, {merged} fusionnés, {rejected} rejetés"
          + (" (dry-run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
