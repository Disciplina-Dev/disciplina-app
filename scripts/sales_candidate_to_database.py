import os
import csv
from sys import stderr
from dotenv import load_dotenv
from pymongo import MongoClient
import unicodedata
from bson.binary import UuidRepresentation
from uuid import uuid4
import sys

load_dotenv('../.env')
POSTAL_CODE = {
    "Saint-Denis".upper().replace("-", "_").replace(" ", "_") : '97400',
    "Saint-Paul".upper().replace("-", "_").replace(" ", "_") : '97460',
    "Saint-Pierre".upper().replace("-", "_").replace(" ", "_") : '97410',
    "Le Tampon".upper().replace("-", "_").replace(" ", "_") : '97430',
    "Saint-Andre".upper().replace("-", "_").replace(" ", "_") : '97440',
    "Saint-Louis".upper().replace("-", "_").replace(" ", "_") : '97450',
    "Saint-Benoit".upper().replace("-", "_").replace(" ", "_") : '97470',
    "Saint-Joseph".upper().replace("-", "_").replace(" ", "_") : '97480',
    "Le Port".upper().replace("-", "_").replace(" ", "_") : '97420',
    "Saint-Leu".upper().replace("-", "_").replace(" ", "_") : '97436',
    "Sainte-Marie".upper().replace("-", "_").replace(" ", "_") : '97438',
    "La Possession".upper().replace("-", "_").replace(" ", "_") : '97419',
    "Sainte-Suzanne".upper().replace("-", "_").replace(" ", "_") : '97441',
    "Etang-Sale".upper().replace("-", "_").replace(" ", "_") : '97427',
    "Bras-Panon".upper().replace("-", "_").replace(" ", "_") : '97412',
    "Petite-ile".upper().replace("-", "_").replace(" ", "_") : '97429',
    "Les Avirons".upper().replace("-", "_").replace(" ", "_") : '97425',
    "Les Trois-Bassins".upper().replace("-", "_").replace(" ", "_") : '97426',
    "Salazie".upper().replace("-", "_").replace(" ", "_") : '97433',
    "Sainte-Rose".upper().replace("-", "_").replace(" ", "_") : '97439',
    "Entre-Deux".upper().replace("-", "_").replace(" ", "_") : '97414',
    "La Plaine-des-Palmistes".upper().replace("-", "_").replace(" ", "_") : '97431',
    "Cilaos".upper().replace("-", "_").replace(" ", "_") : '97413',
    "Saint-Philippe".upper().replace("-", "_").replace(" ", "_") : '97442',
    "SAINTE_CLOTILDE": '97490',
    "SAINTE_ANNE": '97437'
}



def get_mongo_connection():
    # Récupération des identifiants depuis le .env
    username = os.getenv("MONGO_ROOT_USERNAME")
    password = os.getenv("MONGO_ROOT_PASSWORD")
    port = os.getenv("MONGO_PORT", "27017")
    host = "localhost"

    # Si le mot de passe est manquant, on gère l'erreur
    if not username or not password:
        raise ValueError("Les variables MONGO_ROOT_USERNAME et MONGO_ROOT_PASSWORD doivent être définies dans le fichier .env")

    # Connexion à MongoDB avec authentification sur la base 'admin'
    mongo_uri = f"mongodb://{username}:{password}@{host}:{port}/?authSource=admin"
    return MongoClient(mongo_uri, UuidRepresentation='standard')

def set_desired_sectors(row):
    sectors: list[str] = [
            "BOULANGERIE",
            "RESTAURATION",
            "STATION",
            "PAP",
            "LIBRE SERVICE",
            "TELEPHONIE",
            "AUTO",
            "COMMERCIAL",
            "BIJOUX",
            "COSMETIQUE",
            "IMMOBILIER",
            "ASSURANCE",
            "ANIMAUX",
            "SPORT",
            "ENFANT",
            "PHARMACIE",
            "BAZAR"
            ]
    desired_sectors: list[str] = []

    for sector in sectors:
        desired: str = row.get(sector)
        if desired == None:
            continue
        if desired.upper() == 'OUI':
            desired_sectors.append(sector.replace(" ", "_"))
    return desired_sectors

def noamilze_string(string: str):
    nfkd_form = unicodedata.normalize('NFD', string)
    desired: str = ''.join(char for char in nfkd_form if unicodedata.category(char) != "Mn")
    return desired

def set_geographical_sector(sectors: str) -> list[str]:
    desired_sectors: list[str] = []

    for sector in sectors.split(", "):
        if sector == '':
            continue
        nfkd_form = unicodedata.normalize('NFD', sector)
        desired: str = ''.join(char for char in nfkd_form if unicodedata.category(char) != "Mn").replace(" ", "_")
        desired_sectors.append(desired)
    return desired_sectors

def insert_candidate(file: str):
    client = get_mongo_connection()
    # Sélection de la BDD et de la collection
    db = client["human_ressources"]
    candidates_collection = db["candidates"]
    new_candidate: dict = {
        'training_site': "NORD_SAINTE_MARIE",
        'formation_type': 'VENTE',
        # 'created_at': datetime.now().strftime("%Y-%m-%d"),
        'identity': {},
        'job_info': {}
    }

    with open(file, "r") as candidate_file:
        reader = csv.DictReader(candidate_file)
        for row in reader:
            try:
                new_candidate['_id'] = str(uuid4())
                new_candidate['tp_type'] = row.get("FORMATION")
                new_candidate['identity']['sex'] = "GARCON" if row.get("Sex") == "GARCON" else "FILLE"
                new_candidate['identity']['full_name'] = row.get("NOM - PRENOM")
                new_candidate['identity']['city'] = noamilze_string(row.get("VILLE").upper().replace("-", "_").replace(" ", "_")) if row.get("VILLE") else ''
                new_candidate['identity']['age'] = int(row.get("AGE")) if row.get("AGE") != '' else 0
                new_candidate['identity']['postal_code'] = POSTAL_CODE[new_candidate["identity"]['city']] if new_candidate["identity"]['city'] else '974'
                new_candidate['identity']['phone'] = row.get("TELEPHONE").replace(" ", "")
                new_candidate['identity']['email'] = row.get("ADRESSE MAIL")
                new_candidate["job_info"]['geographic_mobility'] = set_geographical_sector(row.get("SECTEUR"))
                new_candidate['identity']['driving_license_b'] =  row.get("PERMIS").upper() == "OUI"
                new_candidate['desired_sectors'] = set_desired_sectors(row)
                new_candidate['status'] = "SEEKING" if row.get("Disponibilité").startswith('Disponible') else "NOT_SEEKING"
                x = candidates_collection.insert_one(new_candidate)
                print(x.inserted_id)
                # result_json = req.post("http://localhost:4000/api/graphql/candidates", json={
                #     'query': "mutation($input: CreateCandidateInput!) { createCandidate(input: $input) { id identity { fullName }}}",
                #     'variables': {
                #         'input': new_candidate
                #     }
                # })
            except Exception as error:
                print(f"Error while reading CSV: {error}", file=stderr)
                raise TypeError

if __name__ == '__main__':
    insert_candidate(sys.argv[1])
