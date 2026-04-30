import os
import csv
import glob
import sys
import unicodedata
from sys import stderr
from dotenv import load_dotenv
from pymongo import MongoClient
from bson.binary import UuidRepresentation
from uuid import uuid4

load_dotenv('../.env')

SECTOR_ENUM = [
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE_SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "BIJOUX", "COSMETIQUE",
    "IMMOBILIER", "ASSURANCE", "ANIMAUX", "SPORT", "ENFANT",
    "PHARMACIE", "BAZAR", "NONE"
]

LOCALISATION_ENUM = [
    "SAINT_DENIS", "SAINTE_MARIE", "SAINTE_SUZANNE", "SAINT_PAUL",
    "LA_POSSESSION", "LE_PORT", "TROIS_BASSINS", "SAINT_LEU",
    "SAINT_PIERRE", "CILAOS", "ETANG_SALE", "SAINT_LOUIS",
    "ENTRE_DEUX", "LES_AVIRONS", "LE_TAMPON", "SAINT_PHILLIPE",
    "SAINT_JOSEPH", "PETIT_ILE", "SAINTE_ROSE", "SAINT_BENOIT",
    "BRAS_PANON", "SAINT_ANDRE", "LA_PLAINE_DES_PALMISTES",
    "SALAZIE", "SAINTE_ANNE"
]

DESIRED_TP_ENUM = ["AD", "CC", "NTC", "REM", "SA"]
DESIRED_SEX_ENUM = ["MIXTE", "FILLE", "GARCON"]


def get_mongo_connection():
    username = os.getenv("MONGO_ROOT_USERNAME")
    password = os.getenv("MONGO_ROOT_PASSWORD")
    port = os.getenv("MONGO_PORT", "27017")
    if not username or not password:
        raise ValueError("MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD must be set in .env")
    uri = f"mongodb://{username}:{password}@localhost:{port}/?authSource=admin"
    return MongoClient(uri, UuidRepresentation='standard')


def remove_accents(text: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )


def normalize_sector(raw: str) -> str:
    return raw.strip().upper().replace(" ", "_")


def resolve_sector(row: dict) -> str:
    secteur_raw = row.get("Secteur", "").strip()
    if secteur_raw:
        candidate = normalize_sector(secteur_raw)
        if candidate in SECTOR_ENUM:
            return candidate

    activite_raw = row.get("Activité", "").strip()
    if activite_raw:
        candidate = normalize_sector(activite_raw)
        if candidate in SECTOR_ENUM:
            return candidate

    return "NONE"


def normalize_loc_part(part: str) -> str:
    s = remove_accents(part.strip()).upper()
    if s.startswith("STE "):
        s = "SAINTE_" + s[4:]
    elif s.startswith("ST "):
        s = "SAINT_" + s[3:]
    s = s.replace(" ", "_")
    return s


def parse_localisation(raw: str) -> list:
    if not raw.strip():
        return []
    parts = raw.split("/") if "/" in raw else [raw]
    result = []
    for part in parts:
        norm = normalize_loc_part(part)
        if norm in LOCALISATION_ENUM:
            result.append(norm)
    return result


def build_job(row: dict) -> dict:
    formation = row.get("Formation", "").strip().upper()
    genre_raw = remove_accents(row.get("Genre", "").strip()).upper()

    return {
        "company_name": row.get("Nom société", "").strip(),
        "age_range": row.get("Age", "").strip(),
        "desired_tp": formation if formation in DESIRED_TP_ENUM else None,
        "desired_sex": genre_raw if genre_raw in DESIRED_SEX_ENUM else None,
        "driving_license_b": row.get("Permis", "").strip().upper() == "OUI",
        "professional_experience": row.get("Expérience connaissance", "").strip().upper() == "OUI",
        "sector": resolve_sector(row),
        "localisation": parse_localisation(row.get("Localisation", "")),
        "status": "NOT_MATCHED",
        "matched_candidate": [],
    }


def insert_jobs(files: list):
    client = get_mongo_connection()
    jobs_collection = client["human_ressources"]["jobs"]
    total = 0

    for filepath in files:
        print(f"Processing {filepath}...")
        inserted = 0
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    doc = build_job(row)
                    if not doc["company_name"]:
                        continue
                    doc['_id'] = str(uuid4())
                    jobs_collection.insert_one(doc)
                    inserted += 1
                except Exception as e:
                    print(f"  Error on row {row}: {e}", file=stderr)
        print(f"  Inserted {inserted} jobs from {os.path.basename(filepath)}")
        total += inserted

    print(f"\nDone. Total inserted: {total}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = sorted(glob.glob("../ressources/company_recruitement_nord*.csv"))
        if not files:
            files = sorted(glob.glob("ressources/company_recruitement_nord*.csv"))

    if not files:
        print("No CSV files found.", file=stderr)
        sys.exit(1)

    insert_jobs(files)
