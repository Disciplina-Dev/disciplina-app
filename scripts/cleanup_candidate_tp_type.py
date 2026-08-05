#!/usr/bin/env python3
"""Remove the legacy `tp_type` field from human_ressources.candidates.

`tp_type` (singular) has been fully replaced by `tp_types` (array) across the
application (schema, GraphQL, resolvers, front). This script is the last step
of that migration: it unsets the leftover field on documents written before
the cutover. Read-only by default — pass --apply to actually modify data.
"""

import argparse
import json
import sys

from dotenv import load_dotenv

from db.mongo import get_mongo_connection

DB_NAME = "human_ressources"


def find_inconsistent(collection) -> list[dict]:
    """Candidates with tp_type but no (or empty) tp_types — would lose data if unset blindly."""
    cursor = collection.find(
        {
            "tp_type": {"$exists": True},
            "$or": [{"tp_types": {"$exists": False}}, {"tp_types": {"$size": 0}}],
        },
        {"identity.full_name": 1, "tp_type": 1, "tp_types": 1},
    )
    return [
        {
            "id": doc["_id"],
            "full_name": (doc.get("identity") or {}).get("full_name"),
            "tp_type": doc.get("tp_type"),
        }
        for doc in cursor
    ]


def count_with_tp_type(collection) -> int:
    return collection.count_documents({"tp_type": {"$exists": True}})


def sample_with_tp_type(collection, limit: int = 10) -> list[dict]:
    cursor = collection.find(
        {"tp_type": {"$exists": True}},
        {"identity.full_name": 1, "tp_type": 1, "tp_types": 1},
    ).limit(limit)
    return [
        {
            "id": doc["_id"],
            "full_name": (doc.get("identity") or {}).get("full_name"),
            "tp_type": doc.get("tp_type"),
            "tp_types": doc.get("tp_types"),
        }
        for doc in cursor
    ]


def print_report(total: int, sample: list[dict], inconsistent: list[dict]) -> None:
    print(f"{total} candidate(s) still have a legacy tp_type field.\n")
    if sample:
        print("Sample:")
        for entry in sample:
            print(f"  - {entry['id']}  {entry['full_name']}  tp_type={entry['tp_type']} tp_types={entry['tp_types']}")
        print()
    if inconsistent:
        print(f"WARNING: {len(inconsistent)} document(s) have tp_type but no/empty tp_types — NOT touched:")
        for entry in inconsistent:
            print(f"  - {entry['id']}  {entry['full_name']}  tp_type={entry['tp_type']}")
        print("\nBackfill tp_types for these manually before re-running with --apply.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Unset the legacy tp_type field on human_ressources.candidates (dry-run by default)."
    )
    parser.add_argument("--apply", action="store_true", help="Actually unset tp_type (default: dry-run)")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of text")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()
    client = get_mongo_connection()
    try:
        collection = client[DB_NAME]["candidates"]
        inconsistent = find_inconsistent(collection)
        inconsistent_ids = {entry["id"] for entry in inconsistent}

        if not args.apply:
            total = count_with_tp_type(collection)
            sample = sample_with_tp_type(collection)
            if args.json:
                print(json.dumps({"total": total, "sample": sample, "inconsistent": inconsistent}, default=str))
            else:
                print_report(total, sample, inconsistent)
            sys.exit(1 if total else 0)

        result = collection.update_many(
            {"tp_type": {"$exists": True}, "_id": {"$nin": list(inconsistent_ids)}},
            {"$unset": {"tp_type": ""}},
        )
        if args.json:
            print(json.dumps({"modified": result.modified_count, "skipped": inconsistent}, default=str))
        else:
            print(f"Unset tp_type on {result.modified_count} document(s).")
            if inconsistent:
                print(f"Skipped {len(inconsistent)} inconsistent document(s) — see above for the list.")
                print_report(0, [], inconsistent)
    finally:
        client.close()


if __name__ == "__main__":
    main()
