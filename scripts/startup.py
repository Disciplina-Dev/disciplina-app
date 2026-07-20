#!/usr/bin/env python3
"""Disciplina — consolidated database seed script.

Imports CSV data into MySQL and MongoDB in 9 steps:
  1. Companies -> MySQL (disciplina.companies)
  2. Blacklist -> MySQL (disciplina.blacklist)
  3. Sales candidates (Nord) -> MongoDB (human_ressources.candidates)
  4. Secretariat candidates (Nord) -> MongoDB (human_ressources.candidates)
  5. Sales candidates (Ouest) -> MongoDB (human_ressources.candidates)
  6. Secretariat candidates (Ouest) -> MongoDB (human_ressources.candidates)
  7. Sales candidates (Sud) -> MongoDB (human_ressources.candidates)
  8. Secretariat candidates (Sud) -> MongoDB (human_ressources.candidates)
  9. Offers -> MongoDB (human_ressources.offers)

Missing CSV files are skipped gracefully.
Environment variables control DB host/port (defaults to localhost for dev).
"""

import os
import csv
import sys
import uuid
from datetime import datetime

from dotenv import load_dotenv

from db.guard import guard_local_target
from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection
from lib.company_csv import remove_accents
from clean_companies import clean_all
from import_company import import_companies
from import_blacklist import import_blacklist
from import_jobs import seed_offers

load_dotenv()

RESOURCE_DIR = os.path.join(os.path.dirname(__file__), 'resources')

# -- Enums -----------------------------------------------------------------------

SECTOR_SALES = [
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "BIJOUX", "COSMETIQUE",
    "IMMOBILIER", "ASSURANCE", "ANIMAUX", "SPORT", "ENFANTS",
    "PHARMACIE", "BAZAR",
]

OUEST_SECTOR_HEADERS = [
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE SERVICE",
    "TELEPHONIE", "AUTO", "Commercial", "Commercial terrain",
    "COSMETIQUE PARFUMERIE", "Jardinnerie / Espaces verts",
    "Immobilier", "Assurance", "Animaux", "Sport", "Bazar", "Enfant",
]

SUD_SECTOR_HEADERS = [
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "Commercial terrain",
    "COSMETIQUE PARFUMERIE", "Jardinnerie / Espaces verts",
    "Immobilier", "Assurance", "Animaux", "Sport", "Bazar",
]

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


# -- Upsert helper ----------------------------------------------------------------


def candidate_filter(doc: dict) -> dict:
    """Identify a candidate by email, or by name on their training site when unknown.

    Both keys merge a candidate listed in several files into one document, which is
    what the email key already does for the 140 candidates present in more than one
    CSV. Without a fallback key the row could only be inserted, so every run added
    the same person again under a fresh uuid.
    """
    identity = doc.get("identity", {})
    email = identity.get("email")
    if email:
        return {"identity.email": email}
    return {
        "identity.full_name": identity.get("full_name"),
        "training_site": doc.get("training_site"),
    }


def upsert_candidate(collection, doc: dict) -> None:
    """Upsert a candidate, keyed on email when known and on name + site otherwise."""
    filter_ = candidate_filter(doc)

    # Pull out fields that should only be set on first creation
    doc_id = doc.pop("_id", None)
    cand_id = doc.pop("candidate_id", None)
    created_at = doc.pop("created_at", None)

    set_on_insert = {}
    if doc_id:
        set_on_insert["_id"] = doc_id
    if cand_id:
        set_on_insert["candidate_id"] = cand_id
    if created_at:
        set_on_insert["created_at"] = created_at

    collection.update_one(
        filter_,
        {"$set": doc, "$setOnInsert": set_on_insert} if set_on_insert else {"$set": doc},
        upsert=True,
    )


def import_candidates(filepath, build, has_name, label, positional=False):
    """Squelette commun aux imports de candidats : ouvre la connexion, itère le CSV,
    ignore les lignes sans nom, upsert, journalise les lignes en échec, ferme.

    `build(row)` construit le document, `has_name(row)` filtre les lignes vides.
    `positional=True` pour les CSV lus par index (`csv.reader` → liste) au lieu des
    en-têtes (`csv.DictReader` → dict).
    """
    client = get_mongo_connection()
    collection = client["human_ressources"]["candidates"]
    count = 0
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            if positional:
                reader = csv.reader(f)
                next(reader, None)  # saute l'en-tête
            else:
                reader = csv.DictReader(f)
            for row in reader:
                if not has_name(row):
                    continue
                try:
                    upsert_candidate(collection, build(row))
                    count += 1
                except Exception as e:
                    print(f"  [WARN] Skipping {label} row: {e}")
    finally:
        client.close()
    return count


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
    # Une date d'entretien future (typo année dans le fichier source) fausserait
    # le tri "plus récent d'abord" : on n'importe jamais un created_at futur.
    if interview_date and interview_date <= datetime.now():
        doc["created_at"] = interview_date
    return doc


def import_sales_candidates(filepath: str) -> int:
    return import_candidates(
        filepath,
        build_sales_candidate,
        lambda r: len(r) >= 2 and (r[1] or '').strip(),
        "sales candidate",
        positional=True,
    )


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
    # Même garde-fou que côté vente : pas de created_at futur.
    if created_at and created_at <= datetime.now():
        doc["created_at"] = created_at
    return doc


def _has_nom_prenom(row: dict) -> bool:
    return bool((row.get("NOM - PRENOM") or '').strip())


def import_secretariat_candidates(filepath: str) -> int:
    return import_candidates(
        filepath, build_secretariat_candidate, _has_nom_prenom, "secretariat candidate"
    )


# -- 4. Ouest sales candidates -> MongoDB --------------------------------------


def _first_value(row: dict) -> str:
    return next(iter(row.values()), "")


def _sector_token(header: str) -> str:
    return header.strip().upper().replace(" ", "_")


def build_ouest_sales_candidate(row: dict, tp_type: str) -> dict:
    city = normalize_city((row.get("Ville ") or '').strip())
    age_raw = (row.get("ÂGE") or row.get(" AGE") or '').strip()
    age = int(age_raw) if age_raw.isdigit() else 0
    candidate_id = str(uuid.uuid4())
    interview_date = parse_fr_date(row.get("Date 1er entretien"))

    mobility_raw = (row.get("SAINT PAUL") or row.get("SECTEUR") or '')
    status, availability_date = parse_availability(row.get("Disponibilité"), interview_date)

    identity = {
        "sex": "GARCON" if normalize_token(_first_value(row)) == "GARCON" else "FILLE",
        "full_name": (row.get("NOM PRENOM") or '').strip(),
        "city": city,
        "age": age,
        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
        "phone": (row.get("TÉLÉPHONE") or '').replace(" ", ""),
        "email": (row.get("ADRESSE MAIL") or '').strip(),
        "driving_license_b": (row.get("PERMIS") or '').strip().upper() == "OUI",
        "has_vehicle": False,
        "description": (row.get("INFOS COMPLÉMENTAIRES") or '').strip(),
    }
    birth = birth_date_from_age(age)
    if birth:
        identity["date_of_birth"] = birth

    sectors = []
    for header in OUEST_SECTOR_HEADERS:
        if (row.get(header) or '').strip().upper() == "OUI":
            sectors.append(_sector_token(header))

    job_info = {"geographic_mobility": parse_sales_mobility(mobility_raw)}
    if availability_date:
        job_info["availability_date"] = availability_date

    doc = {
        "_id": candidate_id,
        "candidate_id": candidate_id,
        "training_site": "OUEST_SAINT_PAUL",
        "formation_type": "VENTE",
        "tp_type": tp_type,
        "status": status,
        "identity": identity,
        "job_info": job_info,
        "desired_sectors": sectors,
    }
    if interview_date and interview_date <= datetime.now():
        doc["created_at"] = interview_date
    return doc


def _has_nom_prenom_nospace(row: dict) -> bool:
    return bool((row.get("NOM PRENOM") or '').strip())


def import_ouest_sales_candidates(filepath: str, tp_type: str) -> int:
    return import_candidates(
        filepath,
        lambda row: build_ouest_sales_candidate(row, tp_type),
        _has_nom_prenom_nospace,
        "ouest sales candidate",
    )


# -- 5. Sud sales candidates -> MongoDB -----------------------------------------


def build_sud_sales_candidate(row: dict, tp_type: str) -> dict:
    city = normalize_city((row.get("Ville ") or '').strip())
    age_raw = (row.get("ÂGE") or row.get(" AGE") or row.get("AGE") or '').strip()
    age = int(age_raw) if age_raw.isdigit() else 0
    candidate_id = str(uuid.uuid4())
    interview_date = parse_fr_date(row.get("Date 1er entretien"))

    mobility_raw = (row.get("SAINT PAUL") or row.get("SECTEUR") or '')
    status, availability_date = parse_availability(row.get("Disponibilité"), interview_date)

    identity = {
        "sex": "GARCON" if normalize_token(_first_value(row)) == "GARCON" else "FILLE",
        "full_name": (row.get("NOM PRENOM") or '').strip(),
        "city": city,
        "age": age,
        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
        "phone": (row.get("TÉLÉPHONE") or '').replace(" ", ""),
        "email": (row.get("ADRESSE MAIL") or '').strip(),
        "driving_license_b": (row.get("PERMIS") or '').strip().upper() == "OUI",
        "has_vehicle": False,
        "description": (row.get("Descriptif") or row.get("INFOS COMPLÉMENTAIRES") or '').strip(),
    }
    birth = birth_date_from_age(age)
    if birth:
        identity["date_of_birth"] = birth

    sectors = []
    for header in SUD_SECTOR_HEADERS:
        if (row.get(header) or '').strip().upper() == "OUI":
            sectors.append(_sector_token(header))

    job_info = {"geographic_mobility": parse_sales_mobility(mobility_raw)}
    if availability_date:
        job_info["availability_date"] = availability_date

    doc = {
        "_id": candidate_id,
        "candidate_id": candidate_id,
        "training_site": "SUD_SAINT_PIERRE",
        "formation_type": "VENTE",
        "tp_type": tp_type,
        "status": status,
        "identity": identity,
        "job_info": job_info,
        "desired_sectors": sectors,
    }
    if interview_date and interview_date <= datetime.now():
        doc["created_at"] = interview_date
    return doc


def import_sud_sales_candidates(filepath: str, tp_type: str) -> int:
    return import_candidates(
        filepath,
        lambda row: build_sud_sales_candidate(row, tp_type),
        _has_nom_prenom_nospace,
        "sud sales candidate",
    )


# -- 6. Ouest secretariat candidates -> MongoDB ---------------------------------


# Ouest et Sud partagent le même format de fichier secrétariat : seul le centre de
# formation change. Un seul builder paramétré au lieu de deux copies à l'identique.
def build_region_secretariat_candidate(row: dict, training_site: str) -> dict:
    city = normalize_city((row.get("Ville") or '').strip())
    age_raw = (row.get("Âge") or '').strip()
    age = int(age_raw) if age_raw.isdigit() else 0
    candidate_id = str(uuid.uuid4())
    interview_date = parse_fr_date(row.get("Date 1er entretien"))

    identity = {
        "sex": "GARCON" if normalize_token(_first_value(row)) == "GARCON" else "FILLE",
        "full_name": (row.get("NOM - PRENOM") or '').strip(),
        "city": city,
        "age": age,
        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
        "phone": (row.get("TELEPHONE") or '').replace(" ", ""),
        "email": (row.get("ADRESSE MAIL") or '').strip(),
        "driving_license_b": (row.get("PERMIS") or '').strip().upper() == "OUI",
        "has_vehicle": False,
        "description": (row.get("INFOS COMPLÉMENTAIRES") or '').strip(),
    }
    birth = birth_date_from_age(age)
    if birth:
        identity["date_of_birth"] = birth

    doc = {
        "_id": candidate_id,
        "candidate_id": candidate_id,
        "training_site": training_site,
        "formation_type": "SECRETARIAT",
        "tp_type": "AD",
        "status": "SEEKING",
        "identity": identity,
        "job_info": {"geographic_mobility": parse_geographic_mobility(row.get("SECTEUR GÉOGRAPHIQUE"))},
        "expected_company_skills": parse_expected_skills(row.get("SPÉCIALITÉ ")),
    }
    if interview_date and interview_date <= datetime.now():
        doc["created_at"] = interview_date
    return doc


def import_ouest_secretariat_candidates(filepath: str) -> int:
    return import_candidates(
        filepath,
        lambda row: build_region_secretariat_candidate(row, "OUEST_SAINT_PAUL"),
        _has_nom_prenom,
        "ouest secretariat candidate",
    )


def import_sud_secretariat_candidates(filepath: str) -> int:
    return import_candidates(
        filepath,
        lambda row: build_region_secretariat_candidate(row, "SUD_SAINT_PIERRE"),
        _has_nom_prenom,
        "sud secretariat candidate",
    )


# -- 8. Jobs -> MongoDB: see import_jobs.py ------


def normalize_loc_part(part: str) -> str:
    s = remove_accents(part.strip()).upper()
    if s.startswith("STE "):
        s = "SAINTE_" + s[4:]
    elif s.startswith("ST "):
        s = "SAINT_" + s[3:]
    return s.replace(" ", "_")


# -- Main ------------------------------------------------------------------------


def main() -> int:
    print("=" * 50)
    print("  Disciplina -- Database Seed Script")
    print("=" * 50)

    # Le seed écrit des données de démo : NODE_ENV=production le brancherait sur
    # MYSQL_URI/MONGO_URI, donc sur la prod.
    guard_local_target(action="Seed")

    errors = []

    # 1. Companies -- idempotent via INSERT IGNORE, runs even on a populated table.
    print("\n[1/9] Importing companies -> MySQL ...")
    try:
        clean_all()
        n = import_companies()
        print(f"  OK -- {n} companies inserted")
    except Exception as e:
        print(f"  FAIL -- Companies: {e}")
        errors.append(f"Companies: {e}")

    # 2. Blacklist -- idempotent via INSERT IGNORE, runs even on a populated table.
    print("\n[2/9] Importing blacklist -> MySQL ...")
    try:
        n = import_blacklist()
        print(f"  OK -- {n} blacklisted companies inserted")
    except Exception as e:
        print(f"  FAIL -- Blacklist: {e}")
        errors.append(f"Blacklist: {e}")

    # 3. Sales candidates (Nord) — idempotent via upsert on email
    print("\n[3/9] Importing sales candidates (Nord) -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidat-nord-vente.csv')
    if not os.path.exists(path):
        print(f"  SKIP -- candidat-nord-vente.csv not found")
    else:
        try:
            n = import_sales_candidates(path)
            print(f"  OK -- {n} sales candidates upserted")
        except Exception as e:
            print(f"  FAIL -- Sales candidates (Nord): {e}")
            errors.append(f"Sales candidates (Nord): {e}")

    # 4. Secretariat candidates (Nord) — idempotent via upsert on email
    print("\n[4/9] Importing secretariat candidates (Nord) -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidat-nord-secretariat.csv')
    if not os.path.exists(path):
        print(f"  SKIP -- candidat-nord-secretariat.csv not found")
    else:
        try:
            n = import_secretariat_candidates(path)
            print(f"  OK -- {n} secretariat candidates upserted")
        except Exception as e:
            print(f"  FAIL -- Secretariat candidates (Nord): {e}")
            errors.append(f"Secretariat candidates (Nord): {e}")

    # 5. Sales candidates (Ouest) — idempotent via upsert on email
    ouest_sales_files = [
        ("candidat-ouest-vente-CC.csv", "CC"),
        ("candidat-ouest-vente-NTC.csv", "NTC"),
        ("candidat-ouest-vente-REM.csv", "REM"),
    ]
    print("\n[5/9] Importing sales candidates (Ouest) -> MongoDB ...")
    for filename, tp_type in ouest_sales_files:
        path = os.path.join(RESOURCE_DIR, filename)
        if not os.path.exists(path):
            print(f"  SKIP -- {filename} not found")
            continue
        try:
            n = import_ouest_sales_candidates(path, tp_type)
            print(f"  OK -- {n} ouest sales {tp_type} candidates upserted")
        except Exception as e:
            print(f"  FAIL -- Ouest sales candidates ({tp_type}): {e}")
            errors.append(f"Ouest sales candidates ({tp_type}): {e}")

    # 6. Secretariat candidates (Ouest) — idempotent via upsert on email
    print("\n[6/9] Importing secretariat candidates (Ouest) -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidat-ouest-secretariat-AD.csv')
    if not os.path.exists(path):
        print(f"  SKIP -- candidat-ouest-secretariat-AD.csv not found")
    else:
        try:
            n = import_ouest_secretariat_candidates(path)
            print(f"  OK -- {n} ouest secretariat candidates upserted")
        except Exception as e:
            print(f"  FAIL -- Secretariat candidates (Ouest): {e}")
            errors.append(f"Secretariat candidates (Ouest): {e}")

    # 7. Sales candidates (Sud) — idempotent via upsert on email
    sud_sales_files = [
        ("candidat-sud-vente-CC.csv", "CC"),
        ("candidat-sud-vente-NTC.csv", "NTC"),
        ("candidat-sud-vente-REM.csv", "REM"),
    ]
    print("\n[7/9] Importing sales candidates (Sud) -> MongoDB ...")
    for filename, tp_type in sud_sales_files:
        path = os.path.join(RESOURCE_DIR, filename)
        if not os.path.exists(path):
            print(f"  SKIP -- {filename} not found")
            continue
        try:
            n = import_sud_sales_candidates(path, tp_type)
            print(f"  OK -- {n} sud sales {tp_type} candidates upserted")
        except Exception as e:
            print(f"  FAIL -- Sud sales candidates ({tp_type}): {e}")
            errors.append(f"Sud sales candidates ({tp_type}): {e}")

    # 8. Secretariat candidates (Sud) — idempotent via upsert on email
    print("\n[8/9] Importing secretariat candidates (Sud) -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidat-sud-secretariat-AD.csv')
    if not os.path.exists(path):
        print(f"  SKIP -- candidat-sud-secretariat-AD.csv not found")
    else:
        try:
            n = import_sud_secretariat_candidates(path)
            print(f"  OK -- {n} sud secretariat candidates upserted")
        except Exception as e:
            print(f"  FAIL -- Secretariat candidates (Sud): {e}")
            errors.append(f"Secretariat candidates (Sud): {e}")

    # 9. Offers — idempotent via upsert on (company_infos.name, tp_type, localisation[0])
    print("\n[9/9] Importing offers -> MongoDB ...")
    try:
        n = seed_offers()
        print(f"  OK -- {n} offers upserted")
    except Exception as e:
        print(f"  FAIL -- Offers: {e}")
        errors.append(f"Offers: {e}")

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
