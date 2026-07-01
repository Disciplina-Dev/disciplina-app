#!/usr/bin/env python3
"""Disciplina — consolidated database seed script.

Imports CSV data into MySQL and MongoDB in 4 steps:
  1. Companies -> MySQL (disciplina.companies)
  2. Sales candidates -> MongoDB (human_ressources.candidates)
  3. Secretariat candidates -> MongoDB (human_ressources.candidates)
  4. Jobs -> MongoDB (human_ressources.jobs)

Missing CSV files are skipped gracefully.
Environment variables control DB host/port (defaults to localhost for dev).
"""

import os
import csv
import glob
import sys
import uuid
from datetime import datetime

from dotenv import load_dotenv

from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection
from lib.company_csv import remove_accents
from clean_companies import clean_all
from import_company import import_companies
from import_blacklist import import_blacklist

load_dotenv()

RESOURCE_DIR = os.path.join(os.path.dirname(__file__), 'resources')

# -- Enums -----------------------------------------------------------------------

SECTOR_SALES = [
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "BIJOUX", "COSMETIQUE",
    "IMMOBILIER", "ASSURANCE", "ANIMAUX", "SPORT", "ENFANTS",
    "PHARMACIE", "BAZAR",
]

SECTOR_ENUM = {
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE_SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "BIJOUX", "COSMETIQUE",
    "IMMOBILIER", "ASSURANCE", "ANIMAUX", "SPORT", "ENFANT",
    "PHARMACIE", "BAZAR", "NONE",
}

LOCALISATION_ENUM = {
    "SAINT_DENIS", "SAINTE_MARIE", "SAINTE_SUZANNE", "SAINT_PAUL",
    "LA_POSSESSION", "LE_PORT", "TROIS_BASSINS", "SAINT_LEU",
    "SAINT_PIERRE", "CILAOS", "ETANG_SALE", "SAINT_LOUIS",
    "ENTRE_DEUX", "LES_AVIRONS", "LE_TAMPON", "SAINT_PHILLIPE",
    "SAINT_JOSEPH", "PETIT_ILE", "SAINTE_ROSE", "SAINT_BENOIT",
    "BRAS_PANON", "SAINT_ANDRE", "LA_PLAINE_DES_PALMISTES",
    "SALAZIE", "SAINTE_ANNE",
}

DESIRED_TP_ENUM = {"AD", "CC", "NTC", "REM", "SA"}
DESIRED_SEX_ENUM = {"MIXTE", "FILLE", "GARCON"}

POSTAL_CODE_MAP = {
    "SAINT_DENIS": "97400", "SAINT_PAUL": "97460", "SAINT_PIERRE": "97410",
    "LE_TAMPON": "97430", "SAINT_ANDRE": "97440", "SAINT_LOUIS": "97450",
    "SAINT_BENOIT": "97470", "SAINT_JOSEPH": "97480", "LE_PORT": "97420",
    "SAINT_LEU": "97436", "SAINTE_MARIE": "97438", "LA_POSSESSION": "97419",
    "SAINTE_SUZANNE": "97441", "ETANG_SALE": "97427", "BRAS_PANON": "97412",
    "PETIT_ILE": "97429", "LES_AVIRONS": "97425", "TROIS_BASSINS": "97426",
    "SALAZIE": "97433", "SAINTE_ROSE": "97439", "ENTRE_DEUX": "97414",
    "LA_PLAINE_DES_PALMISTES": "97431", "CILAOS": "97413", "SAINT_PHILLIPE": "97442",
    "SAINTE_CLOTILDE": "97490", "SAINTE_ANNE": "97437",
}

# -- Helpers ---------------------------------------------------------------------


def normalize_city(city: str) -> str:
    return remove_accents(city.upper().replace("-", "_").replace(" ", "_"))


def normalize_token(value: str) -> str:
    cleaned = remove_accents(value or '').upper().replace('"', ' ').replace("'", ' ').replace("-", ' ')
    return "_".join(cleaned.split())


def parse_fr_date(value: str) -> datetime | None:
    value = (value or '').strip()
    try:
        return datetime.strptime(value, "%d/%m/%Y") if value else None
    except ValueError:
        return None


def birth_date_from_age(age: int) -> datetime | None:
    return datetime(2026 - age, 1, 1) if age else None


def parse_geographic_mobility(raw: str) -> list:
    tokens = [normalize_token(part) for part in (raw or '').split(",")]
    return [token for token in tokens if token in LOCALISATION_ENUM]


def parse_expected_skills(raw: str) -> list:
    skills = []
    for part in (raw or '').split(","):
        token = normalize_token(part)
        if token and token != "PAS_D_EXPERIENCE" and token not in skills:
            skills.append(token)
    return skills


LOCALISATION_ALIASES = {"SAINT_ANNE": "SAINTE_ANNE"}

FRENCH_MONTHS = {
    "JANVIER": 1, "FEVRIER": 2, "MARS": 3, "AVRIL": 4, "MAI": 5, "JUIN": 6,
    "JUILLET": 7, "AOUT": 8, "SEPTEMBRE": 9, "OCTOBRE": 10, "NOVEMBRE": 11, "DECEMBRE": 12,
}


def parse_sales_mobility(raw: str) -> list:
    result = []
    for part in (raw or '').split(","):
        norm = normalize_loc_part(part)
        norm = LOCALISATION_ALIASES.get(norm, norm)
        if norm in LOCALISATION_ENUM and norm not in result:
            result.append(norm)
    return result


def parse_availability(dispo: str, interview_date: datetime | None) -> tuple:
    value = (dispo or '').strip()
    if not value or normalize_token(value) == "DISPONIBLE":
        return "SEEKING", None
    month = next((m for name, m in FRENCH_MONTHS.items() if name in normalize_token(value)), None)
    if not month:
        return "UNAVAILABLE", None
    base = interview_date or datetime(2026, 1, 1)
    year = base.year + 1 if month < base.month else base.year
    return "UNAVAILABLE", datetime(year, month, 1)


# -- Seeded checks -----------------------------------------------------------------


def mongo_has_docs(collection: str, filter_: dict | None = None) -> bool:
    client = get_mongo_connection()
    db = client["human_ressources"]
    count = db[collection].count_documents(filter_ or {})
    client.close()
    return count > 0


# -- 1. Companies -> MySQL: see clean_companies.py + import_company.py ------------


# -- 2. Sales candidates -> MongoDB ----------------------------------------------


def parse_sales_sectors(row: list) -> list:
    sectors = []
    for sector, value in zip(SECTOR_SALES, row[10:27]):
        if (value or '').strip().upper() != "OUI":
            continue
        normalized = "ENFANT" if sector == "ENFANTS" else sector.replace(" ", "_")
        sectors.append(normalized)
    return sectors


def build_sales_candidate(row: list) -> dict:
    city = normalize_city((row[3] or '').strip())
    age = int(row[4]) if (row[4] or '').strip().isdigit() else 0
    candidate_id = str(uuid.uuid4())
    interview_date = parse_fr_date(row[28])
    status, availability_date = parse_availability(row[27], interview_date)

    identity = {
        "sex": "GARCON" if normalize_token(row[0]) == "GARCON" else "FILLE",
        "full_name": (row[1] or '').strip(),
        "city": city,
        "age": age,
        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
        "phone": (row[5] or '').replace(" ", ""),
        "email": (row[6] or '').strip(),
        "driving_license_b": (row[8] or '').strip().upper() == "OUI",
        "has_vehicle": (row[9] or '').strip().upper() == "OUI",
        "description": (row[29] or '').strip(),
    }
    birth = birth_date_from_age(age)
    if birth:
        identity["date_of_birth"] = birth

    job_info = {"geographic_mobility": parse_sales_mobility(row[7])}
    if availability_date:
        job_info["availability_date"] = availability_date

    doc = {
        "_id": candidate_id,
        "candidate_id": candidate_id,
        "training_site": "NORD_SAINTE_MARIE",
        "formation_type": "VENTE",
        "tp_type": (row[2] or '').strip().upper() if (row[2] or '').strip().upper() in DESIRED_TP_ENUM else "CC",
        "status": status,
        "identity": identity,
        "job_info": job_info,
        "desired_sectors": parse_sales_sectors(row),
    }
    if interview_date:
        doc["created_at"] = interview_date
    return doc


def import_sales_candidates(filepath: str) -> int:
    client = get_mongo_connection()
    collection = client["human_ressources"]["candidates"]
    count = 0

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if len(row) < 2 or not (row[1] or '').strip():
                continue
            try:
                collection.insert_one(build_sales_candidate(row))
                count += 1
            except Exception as e:
                print(f"  [WARN] Skipping sales candidate row: {e}")

    client.close()
    return count


# -- 3. Secretariat candidates -> MongoDB ----------------------------------------


def build_secretariat_candidate(row: dict) -> dict:
    city = normalize_city((row.get("VILLE") or '').strip())
    age = int(row["AGE"]) if (row.get("AGE") or '').strip().isdigit() else 0
    candidate_id = str(uuid.uuid4())

    identity = {
        "sex": "GARCON" if normalize_token(row.get("n")) == "GARCON" else "FILLE",
        "full_name": (row.get("NOM - PRENOM") or '').strip(),
        "city": city,
        "age": age,
        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
        "phone": (row.get("TELEPHONE") or '').replace(" ", ""),
        "email": (row.get("ADRESSE MAIL") or '').strip(),
        "driving_license_b": (row.get("PERMIS") or '').strip().upper() == "OUI",
        "has_vehicle": (row.get("Véhiculé") or '').strip().upper() == "OUI",
        "description": (row.get("DESCRIPTION") or '').strip(),
    }
    birth = birth_date_from_age(age)
    if birth:
        identity["date_of_birth"] = birth

    doc = {
        "_id": candidate_id,
        "candidate_id": candidate_id,
        "training_site": "NORD_SAINTE_MARIE",
        "formation_type": "SECRETARIAT",
        "tp_type": "AD",
        "status": "SEEKING",
        "identity": identity,
        "job_info": {"geographic_mobility": parse_geographic_mobility(row.get("SECTEUR GÉOGRAPHIQUE"))},
        "expected_company_skills": parse_expected_skills(row.get("SPÉCIALITÉ ")),
    }
    created_at = parse_fr_date(row.get("DATE "))
    if created_at:
        doc["created_at"] = created_at
    return doc


def import_secretariat_candidates(filepath: str) -> int:
    client = get_mongo_connection()
    collection = client["human_ressources"]["candidates"]
    count = 0

    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not (row.get("NOM - PRENOM") or '').strip():
                continue
            try:
                collection.insert_one(build_secretariat_candidate(row))
                count += 1
            except Exception as e:
                print(f"  [WARN] Skipping secretariat candidate row: {e}")

    client.close()
    return count


# -- 4. Jobs -> MongoDB ----------------------------------------------------------


def normalize_loc_part(part: str) -> str:
    s = remove_accents(part.strip()).upper()
    if s.startswith("STE "):
        s = "SAINTE_" + s[4:]
    elif s.startswith("ST "):
        s = "SAINT_" + s[3:]
    return s.replace(" ", "_")


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


def resolve_sector(row: dict) -> str:
    secteur_raw = (row.get("Secteur") or '').strip()
    if secteur_raw:
        candidate = secteur_raw.upper().replace(" ", "_")
        if candidate in SECTOR_ENUM:
            return candidate
    activite_raw = (row.get("Activite") or '').strip()
    if activite_raw:
        candidate = activite_raw.upper().replace(" ", "_")
        if candidate in SECTOR_ENUM:
            return candidate
    return "NONE"


def import_jobs(filepaths: list) -> int:
    client = get_mongo_connection()
    collection = client["human_ressources"]["jobs"]
    total = 0

    for filepath in filepaths:
        count = 0
        with open(filepath, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                try:
                    company_name = (row.get("Nom societe") or '').strip()
                    if not company_name:
                        continue

                    formation = (row.get("Formation") or '').strip().upper()
                    genre_raw = remove_accents((row.get("Genre") or '').strip()).upper()

                    doc = {
                        "_id": str(uuid.uuid4()),
                        "company_name": company_name,
                        "age_range": (row.get("Age") or '').strip(),
                        "desired_tp": formation if formation in DESIRED_TP_ENUM else None,
                        "desired_sex": genre_raw if genre_raw in DESIRED_SEX_ENUM else None,
                        "driving_license_b": (row.get("Permis") or '').strip().upper() == "OUI",
                        "professional_experience": (row.get("Experience connaissance") or '').strip().upper() == "OUI",
                        "sector": resolve_sector(row),
                        "localisation": parse_localisation(row.get("Localisation") or ''),
                        "status": "NOT_MATCHED",
                        "matched_candidate": [],
                    }
                    collection.insert_one(doc)
                    count += 1
                except Exception as e:
                    print(f"  [WARN] Skipping job row: {e}")
        print(f"    Inserted {count} jobs from {os.path.basename(filepath)}")
        total += count

    client.close()
    return total


# -- Main ------------------------------------------------------------------------


def main() -> int:
    print("=" * 50)
    print("  Disciplina -- Database Seed Script")
    print("=" * 50)

    errors = []

    # 1. Companies -- idempotent via INSERT IGNORE, runs even on a populated table.
    print("\n[1/5] Importing companies -> MySQL ...")
    try:
        clean_all()
        n = import_companies()
        print(f"  OK -- {n} companies inserted")
    except Exception as e:
        print(f"  FAIL -- Companies: {e}")
        errors.append(f"Companies: {e}")

    # 2. Blacklist -- idempotent via INSERT IGNORE, runs even on a populated table.
    print("\n[2/5] Importing blacklist -> MySQL ...")
    try:
        n = import_blacklist()
        print(f"  OK -- {n} blacklisted companies inserted")
    except Exception as e:
        print(f"  FAIL -- Blacklist: {e}")
        errors.append(f"Blacklist: {e}")

    # 3. Sales candidates
    print("\n[3/5] Importing sales candidates -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidat-nord-vente.csv')
    if not os.path.exists(path):
        print(f"  SKIP -- candidat-nord-vente.csv not found")
    elif mongo_has_docs("candidates", {"formation_type": "VENTE"}):
        print(f"  SKIP -- sales candidates already exist")
    else:
        try:
            n = import_sales_candidates(path)
            print(f"  OK -- {n} sales candidates inserted")
        except Exception as e:
            print(f"  FAIL -- Sales candidates: {e}")
            errors.append(f"Sales candidates: {e}")

    # 4. Secretariat candidates
    print("\n[4/5] Importing secretariat candidates -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidat-nord-secretariat.csv')
    if not os.path.exists(path):
        print(f"  SKIP -- candidat-nord-secretariat.csv not found")
    elif mongo_has_docs("candidates", {"formation_type": "SECRETARIAT"}):
        print(f"  SKIP -- secretariat candidates already exist")
    else:
        try:
            n = import_secretariat_candidates(path)
            print(f"  OK -- {n} secretariat candidates inserted")
        except Exception as e:
            print(f"  FAIL -- Secretariat candidates: {e}")
            errors.append(f"Secretariat candidates: {e}")

    # 5. Jobs
    print("\n[5/5] Importing jobs -> MongoDB ...")
    job_files = sorted(glob.glob(os.path.join(RESOURCE_DIR, 'company_recruitement_nord*.csv')))
    if not job_files:
        print(f"  SKIP -- no company_recruitement_nord*.csv files found")
    elif mongo_has_docs("jobs"):
        print(f"  SKIP -- jobs already exist")
    else:
        try:
            n = import_jobs(job_files)
            print(f"  OK -- {n} jobs inserted from {len(job_files)} file(s)")
        except Exception as e:
            print(f"  FAIL -- Jobs: {e}")
            errors.append(f"Jobs: {e}")

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
