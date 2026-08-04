#!/usr/bin/env python3
"""Encrypt plaintext social security numbers in MongoDB (human_ressources.candidates)."""

import hashlib
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv, set_key

from db.guard import guard_local_target
from db.mongo import get_mongo_connection

DB_NAME = "human_ressources"
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
SCRYPT_SALT = b"ssn-salt"


def derive_key(secret: str) -> bytes:
    return hashlib.scrypt(secret.encode(), salt=SCRYPT_SALT, n=16384, r=8, p=1, dklen=32)


def get_or_create_secret() -> str:
    secret = os.getenv("SSN_ENCRYPTION_KEY")
    if secret:
        return secret
    secret = secrets.token_hex(32)
    set_key(ENV_PATH, "SSN_ENCRYPTION_KEY", secret)
    print(f"Generated SSN_ENCRYPTION_KEY and saved it to {ENV_PATH}")
    return secret


def encrypt_ssn(ssn: str, key: bytes) -> dict:
    iv = secrets.token_bytes(16)
    ciphertext = AESGCM(key).encrypt(iv, ssn.encode("utf-8"), None)
    encrypted, tag = ciphertext[:-16], ciphertext[-16:]
    return {"encrypted": encrypted.hex(), "iv": iv.hex(), "tag": tag.hex()}


def encrypt_all_candidates(collection, key: bytes) -> int:
    count = 0
    for doc in collection.find({"identity.social_security_number": {"$type": "string"}}):
        ssn = doc["identity"]["social_security_number"]
        collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"identity.social_security_number": encrypt_ssn(ssn, key)}},
        )
        count += 1
    return count


def main() -> None:
    load_dotenv(ENV_PATH)
    guard_local_target(action="Encrypt SSNs")
    key = derive_key(get_or_create_secret())
    client = get_mongo_connection()
    try:
        collection = client[DB_NAME]["candidates"]
        count = encrypt_all_candidates(collection, key)
        print(f"Encrypted {count} candidate social security number(s)")
    finally:
        client.close()


if __name__ == "__main__":
    main()
