#!/usr/bin/env python3
"""Disciplina — consolidated database seed script.

Imports CSV data into MySQL and MongoDB in 4 steps:
  1. Companies -> MySQL (sales_service.companies)
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
import unicodedata
import uuid

import mysql.connector
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

RESOURCE_DIR = os.path.join(os.path.dirname(__file__), 'resource')

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


def remove_accents(text: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )


def normalize_city(city: str) -> str:
    return remove_accents(city.upper().replace("-", "_").replace(" ", "_"))


# -- DB connections --------------------------------------------------------------


def get_mysql_connection():
    return mysql.connector.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        port=int(os.getenv('MYSQL_PORT', '5001')),
        user=os.getenv('MYSQL_USER', 'root'),
        password=os.getenv('MYSQL_ROOT_PASSWORD'),
        database=os.getenv('MYSQL_DATABASE', 'sales_service'),
    )


def get_mongo_connection():
    username = os.getenv("MONGO_ROOT_USERNAME")
    password = os.getenv("MONGO_ROOT_PASSWORD")
    port = os.getenv("MONGO_PORT", "27017")
    host = os.getenv("MONGO_HOST", "localhost")
    if not username or not password:
        raise ValueError("MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD must be set")
    return MongoClient(
        f"mongodb://{username}:{password}@{host}:{port}/?authSource=admin"
    )


# -- 1. Companies -> MySQL -------------------------------------------------------


def select_saler_id(name: str, email: str) -> int:
    try:
        if name.capitalize() == "Amanda" or email == 'sinaman.commercial@disciplina.re':
            return 2
        if name.capitalize() == "Brandon" or email == 'galmar.commercial@disciplina.re':
            return 3
        if name.capitalize() == "Emile" or email == 'lebon.commercial@disciplina.re':
            return 4
        return 1
    except:
            return 1


def import_companies(filepath: str) -> int:
    conn = get_mysql_connection()
    cursor = conn.cursor()
    query = """
        INSERT IGNORE INTO companies (
            sale_person_id, legal_referent, name, phone, email,
            address, sector, main_activity, siret, idcc, notes, conclusion
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """
    count = 0
    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                cursor.execute(query, (
                    select_saler_id(row.get("Commercial"), row.get("Proprietaire du contact")),
                    row.get("Representant legale"),
                    row.get("Nom commercial"),
                    row.get("Numero de telephone"),
                    row.get("Adresse e-mail"),
                    row.get("ADRESSE"),
                    row.get("SECTEUR"),
                    row.get("METIER/Description"),
                    row.get("SIRET"),
                    row.get("IDCC"),
                    row.get("Note a moi meme"),
                    row.get("Conclusion"),
                ))
                count += 1
            except Exception as e:
                print(f"  [WARN] Skipping company row: {e}")
    conn.commit()
    cursor.close()
    conn.close()
    return count


# -- 2. Sales candidates -> MongoDB ----------------------------------------------


def import_sales_candidates(filepath: str) -> int:
    client = get_mongo_connection()
    collection = client["human_ressources"]["candidates"]
    count = 0

    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                city_raw = (row.get("VILLE") or '').strip()
                city = normalize_city(city_raw) if city_raw else ''

                desired_sectors = []
                for sector in SECTOR_SALES:
                    val = row.get(sector)
                    if val and val.strip().upper() == 'OUI':
                        normalized = sector.replace(" ", "_")
                        if normalized == "ENFANTS":
                            normalized = "ENFANT"
                        desired_sectors.append(normalized)

                geo_sectors = []
                for part in ((row.get("SECTEUR") or '')).split(", "):
                    part = part.strip()
                    if part:
                        geo_sectors.append(
                            remove_accents(part).upper().replace(" ", "_")
                        )

                disp = (row.get("Disponibilite") or '').strip()
                status = "SEEKING" if disp.startswith("Disponible") else "NOT_SEEKING"

                doc = {
                    "_id": str(uuid.uuid4()),
                    "training_site": "NORD_SAINTE_MARIE",
                    "formation_type": "VENTE",
                    "tp_type": (row.get("FORMATION") or '').strip(),
                    "status": status,
                    "identity": {
                        "sex": "GARCON" if (row.get("Sex") or '').strip() == "GARCON" else "FILLE",
                        "full_name": row.get("NOM - PRENOM"),
                        "city": city,
                        "age": int(row.get("AGE")) if (row.get("AGE") or '').strip() else 0,
                        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
                        "phone": (row.get("TELEPHONE") or '').replace(" ", ""),
                        "email": (row.get("ADRESSE MAIL") or '').strip(),
                        "driving_license_b": (row.get("PERMIS") or '').strip().upper() == "OUI",
                    },
                    "job_info": {
                        "geographic_mobility": geo_sectors,
                    },
                    "desired_sectors": desired_sectors,
                }
                collection.insert_one(doc)
                count += 1
            except Exception as e:
                print(f"  [WARN] Skipping sales candidate row: {e}")

    client.close()
    return count


# -- 3. Secretariat candidates -> MongoDB ----------------------------------------


def import_secretariat_candidates(filepath: str) -> int:
    client = get_mongo_connection()
    collection = client["human_ressources"]["candidates"]
    count = 0

    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                city_raw = (row.get("VILLE") or '').strip()
                city = normalize_city(city_raw) if city_raw else ''

                geo_sectors = []
                for part in ((row.get("SECTEUR GEOGRAPHIQUE") or '')).split(", "):
                    part = part.strip()
                    if part:
                        geo_sectors.append(
                            remove_accents(part).upper().replace(" ", "_").replace('"', '')
                        )

                disp_raw = row.get("DISPONIBILITE") or ''
                status = "SEEKING" if disp_raw.strip().startswith("Disponible") else "NOT_SEEKING"

                doc = {
                    "_id": str(uuid.uuid4()),
                    "training_site": "NORD_SAINTE_MARIE",
                    "formation_type": "SECRETARIAT",
                    "tp_type": "AD",
                    "status": status,
                    "identity": {
                        "sex": "GARCON" if (row.get("Genre") or '').strip() == "GARCON" else "FILLE",
                        "full_name": row.get("NOM - PRENOM"),
                        "city": city,
                        "age": int(row.get("AGE")) if (row.get("AGE") or '').strip() else 0,
                        "postal_code": POSTAL_CODE_MAP.get(city, '974'),
                        "phone": (row.get("TELEPHONE") or '').replace(" ", ""),
                        "email": (row.get("ADRESSE MAIL") or '').strip(),
                        "driving_license_b": (row.get("PERMIS") or '').strip().upper() == "OUI",
                    },
                    "job_info": {
                        "geographic_mobility": geo_sectors,
                    },
                }
                collection.insert_one(doc)
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
                    print('doc: ', doc)
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

    # 1. Companies
    print("\n[1/4] Importing companies -> MySQL ...")
    path = os.path.join(RESOURCE_DIR, 'suivi_client-contact.csv')
    if os.path.exists(path):
        try:
            n = import_companies(path)
            print(f"  OK -- {n} companies inserted")
        except Exception as e:
            print(f"  FAIL -- Companies: {e}")
            errors.append(f"Companies: {e}")
    else:
        print(f"  SKIP -- suivi_client-contact.csv not found")

    # 2. Sales candidates
    print("\n[2/4] Importing sales candidates -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidats_nord.csv')
    if os.path.exists(path):
        try:
            n = import_sales_candidates(path)
            print(f"  OK -- {n} sales candidates inserted")
        except Exception as e:
            print(f"  FAIL -- Sales candidates: {e}")
            errors.append(f"Sales candidates: {e}")
    else:
        print(f"  SKIP -- candidats_nord.csv not found")

    # 3. Secretariat candidates
    print("\n[3/4] Importing secretariat candidates -> MongoDB ...")
    path = os.path.join(RESOURCE_DIR, 'candidats_nord_AD.csv')
    if os.path.exists(path):
        try:
            n = import_secretariat_candidates(path)
            print(f"  OK -- {n} secretariat candidates inserted")
        except Exception as e:
            print(f"  FAIL -- Secretariat candidates: {e}")
            errors.append(f"Secretariat candidates: {e}")
    else:
        print(f"  SKIP -- candidats_nord_AD.csv not found")

    # 4. Jobs
    print("\n[4/4] Importing jobs -> MongoDB ...")
    job_files = sorted(glob.glob(os.path.join(RESOURCE_DIR, 'company_recruitement_nord*.csv')))
    if job_files:
        try:
            n = import_jobs(job_files)
            print(f"  OK -- {n} jobs inserted from {len(job_files)} file(s)")
        except Exception as e:
            print(f"  FAIL -- Jobs: {e}")
            errors.append(f"Jobs: {e}")
    else:
        print(f"  SKIP -- no company_recruitement_nord*.csv files found")

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
