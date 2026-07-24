#!/usr/bin/env python3
"""Delete test-phase candidates from MongoDB (human_ressources).

Candidate _id is a UUID (no embedded creation date) and the schema has no
created_at. We derive a threshold date from a reference candidate — the first
valid one — then delete every candidate created before it.

Date source per candidate: classmarker.completed_at, else identity.avatar_updated_at.
Candidates with no usable date are treated as incomplete test data and deleted.

Cascade: also removes candidate_history, candidate_avatars, and pulls the
candidate from offers.matching.candidates[], which embeds their name, email,
phone, age and sex.

Google Drive folders/files (drive_folder_id, cv_link, ...) are NOT removed.
"""

import argparse
import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv

from db.mongo import get_mongo_connection

DB_NAME = "human_ressources"
DEFAULT_REFERENCE_ID = "3d1e67c4-5919-438d-9a49-879cbb216714"
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def parse_timestamp(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return _to_utc(value)
    if isinstance(value, str):
        try:
            return _to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
        except ValueError:
            return None
    return None


def candidate_timestamp(doc: dict) -> datetime | None:
    classmarker = doc.get("classmarker") or {}
    completed = parse_timestamp(classmarker.get("completed_at"))
    if completed is not None:
        return completed
    identity = doc.get("identity") or {}
    return parse_timestamp(identity.get("avatar_updated_at"))


def find_candidates_to_delete(collection, reference_id: str):
    reference = collection.find_one({"_id": reference_id})
    if reference is None:
        raise ValueError(f"Reference candidate {reference_id} not found")
    threshold = candidate_timestamp(reference)
    if threshold is None:
        raise ValueError(
            f"Reference candidate {reference_id} has no classmarker.completed_at "
            "nor identity.avatar_updated_at — cannot establish a threshold date"
        )
    to_delete = []
    for doc in collection.find({"_id": {"$ne": reference_id}}):
        ts = candidate_timestamp(doc)
        if ts is None or ts < threshold:
            to_delete.append(doc)
    return to_delete, threshold


def backup_documents(docs: list[dict]) -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"deleted_candidates_{stamp}.json")
    with open(path, "w", encoding="utf-8") as file:
        json.dump(docs, file, ensure_ascii=False, indent=2, default=str)
    return path


def delete_candidates_cascade(db, ids: list[str]) -> dict[str, int]:
    candidates = db["candidates"].delete_many({"_id": {"$in": ids}})
    history = db["candidate_history"].delete_many({"candidate_id": {"$in": ids}})
    avatars = db["candidate_avatars"].delete_many({"candidate_id": {"$in": ids}})
    # `offers.matching.candidates[]` embarque nom, email, téléphone, âge et sexe :
    # sans ce $pull, les données personnelles survivent à la suppression du candidat.
    # Même clé que OfferRepository.removeMatchedCandidate.
    offers = db["offers"].update_many(
        {"matching.candidates.id": {"$in": ids}},
        {"$pull": {"matching.candidates": {"id": {"$in": ids}}}},
    )
    return {
        "candidates": candidates.deleted_count,
        "candidate_history": history.deleted_count,
        "candidate_avatars": avatars.deleted_count,
        "offers_updated": offers.modified_count,
    }


def print_summary(total: int, to_delete: int, threshold: datetime) -> None:
    print(f"Reference threshold date : {threshold.isoformat()}")
    print(f"Total candidates         : {total}")
    print(f"To delete                : {to_delete}")
    print(f"To keep                  : {total - to_delete}")


def confirm(prompt: str) -> bool:
    return input(f"{prompt} [y/N] ").strip().lower() == "y"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Delete test-phase candidates from MongoDB.")
    parser.add_argument("--reference-id", default=DEFAULT_REFERENCE_ID)
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()
    client = get_mongo_connection()
    try:
        db = client[DB_NAME]
        collection = db["candidates"]
        to_delete, threshold = find_candidates_to_delete(collection, args.reference_id)
        print_summary(collection.count_documents({}), len(to_delete), threshold)
        if not to_delete:
            print("Nothing to delete.")
            return
        backup_path = backup_documents(to_delete)
        print(f"Backup written to {backup_path}")
        if not args.yes and not confirm("Proceed with deletion?"):
            print("Aborted.")
            return
        counts = delete_candidates_cascade(db, [doc["_id"] for doc in to_delete])
        print(f"Deleted: {counts}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
