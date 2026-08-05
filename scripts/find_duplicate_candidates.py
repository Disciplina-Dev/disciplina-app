#!/usr/bin/env python3
"""Find candidates sharing the same email in MongoDB (human_ressources.candidates).

Read-only diagnostic: candidate creation is now blocked by a unique constraint
on email, so existing duplicates need to be surfaced before they collide.
"""

import argparse
import json
import sys

from dotenv import load_dotenv

from db.mongo import get_mongo_connection

DB_NAME = "human_ressources"


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def find_duplicates(collection) -> dict[str, list[dict]]:
    by_email: dict[str, list[dict]] = {}
    for doc in collection.find({}, {"identity.email": 1, "identity.full_name": 1}):
        identity = doc.get("identity") or {}
        email = normalize_email(identity.get("email"))
        if not email:
            continue
        by_email.setdefault(email, []).append(
            {"id": doc["_id"], "full_name": identity.get("full_name")}
        )
    return {email: entries for email, entries in by_email.items() if len(entries) > 1}


def print_summary(duplicates: dict[str, list[dict]]) -> None:
    if not duplicates:
        print("No duplicate emails found.")
        return
    ordered = sorted(duplicates.items(), key=lambda item: len(item[1]), reverse=True)
    print(f"{len(ordered)} duplicate email(s):\n")
    for email, entries in ordered:
        print(f"{email} ({len(entries)} candidates)")
        for entry in entries:
            print(f"  - {entry['id']}  {entry['full_name']}")
        print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="List candidates sharing the same email (read-only)."
    )
    parser.add_argument("--json", action="store_true", help="Output JSON instead of text")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()
    client = get_mongo_connection()
    try:
        collection = client[DB_NAME]["candidates"]
        duplicates = find_duplicates(collection)
    finally:
        client.close()

    if args.json:
        print(json.dumps(duplicates, ensure_ascii=False, indent=2, default=str))
    else:
        print_summary(duplicates)

    sys.exit(1 if duplicates else 0)


if __name__ == "__main__":
    main()
