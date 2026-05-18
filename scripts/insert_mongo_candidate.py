import os
from datetime import datetime
from dotenv import load_dotenv
# from pymongo import MongoClient
import requests as req

# Trouver le chemin du fichier .env à la racine du projet
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# def get_mongo_connection():
#     # Récupération des identifiants depuis le .env
#     username = os.getenv("MONGO_ROOT_USERNAME")
#     password = os.getenv("MONGO_ROOT_PASSWORD")
#     port = os.getenv("MONGO_PORT", "27017")
#     host = "localhost"

#     # Si le mot de passe est manquant, on gère l'erreur
#     if not username or not password:
#         raise ValueError("Les variables MONGO_ROOT_USERNAME et MONGO_ROOT_PASSWORD doivent être définies dans le fichier .env")

#     # Connexion à MongoDB avec authentification sur la base 'admin'
#     mongo_uri = f"mongodb://{username}:{password}@{host}:{port}/?authSource=admin"
#     return MongoClient(mongo_uri)

def insert_candidate():
    # client = get_mongo_connection()

    # Sélection de la BDD et de la collection
    # db = client["human_ressources"]
    # candidates_collection = db["candidates"]

    # Objet complet respectant parfaitement toutes les sous-sections de ton schéma mongo-init.js
    new_candidate = {
        "_id": "cand_python_full_002",
        "candidate_id": "CAND-PY-FULL-001",
        "status": "IMMERSING",  # Le nouveau statut que tu viens d'ajouter !
        "tp_type": "CC",
        # "created_at": datetime.now(),
        "created_by": "script_python",

        # ===========================
        # Identité du candidat
        # ===========================
        "identity": {
            "full_name": "Turing Alan",
            "date_of_birth": datetime(1912, 6, 23).strftime("%d/%m/%Y"),
            "place_of_birth": "Londres",
            "age": 30,
            "postal_code": "75001",
            "city": "Paris",
            "email": "alan.turing@example.com",
            "phone": "0601020304",
            "driving_license_b": True,
            "transport_means": "Transport en commun",
            "psh_referral_request": False
        },

        # ===========================
        # Parcours et prérequis
        # ===========================
        "education": {
            "school_level": "BAC_PLUS_3_PLUS",
            "justification": "Diplôme universitaire en mathématiques"
        },

        # ===========================
        # Positionnement
        # ===========================
        "training_site": "NORD_SAINTE_MARIE",

        # ===========================
        # Accompagnement
        # ===========================
        "support": {
            "france_travail_registered": True,
            "france_travail_agency": "Agence Paris Centre",
            "mission_locale_registered": False,
            "mission_locale_city": ""
        },

        # ===========================
        # Immersion
        # ===========================
        "immersion_agreement": True,

        # ===========================
        # Parcours antérieurs
        # ===========================
        "background": {
            "last_diploma": "Doctorat",
            "previous_trainings": "Cryptographie avancée",
            "professional_experiences": [
                {
                    "position": "Cryptanalyste",
                    "duration": "4 ans",
                    "responsibilities": "Décryptage d'Enigma",
                    "company": "Bletchley Park"
                }
            ]
        },

        # ===========================
        # Caractéristiques du profil
        # ===========================
        "profile": {
            "french_level": 8,
            "english_level": 10,
            "other_languages": ["Allemand"],
            "strengths_and_improvements": "Logique imparable, doit améliorer la vulgarisation",
            "qualities": ["Logique", "Persévérant", "Curieux"],
            "defects": ["Impatient"],
            "digital_skills": ["Programmation", "Algorithmique"],
            "ready_for_challenges": True,
            "hobbies": "Course de fond"
        },

        # ===========================
        # Projets professionnels
        # ===========================
        "professional_projects": {
            "career_objectives": "Créer l'intelligence artificielle",
            "desired_skills": "Développement logiciel",
            "apprenticeship_motivation": "Mettre en pratique des modèles mathématiques",
            "training_expectations": "Projets complexes"
        },

        # ===========================
        # Analyse des compétences
        # ===========================
        "skills_assessment": [
            {
                "competence": "Algorithmique",
                "level": "A"
            }
        ],

        # ===========================
        # Champs spécifiques au TP
        # ===========================
        "desired_sectors": ["Informatique", "Recherche"],
        "expected_company_skills": ["Innovation", "Rigueur"],

        # ===========================
        # Informations sur le poste
        # ===========================
        "job_info": {
            "domain_motivation": "Passion pour l'informatique",
            "questions_concerns": "Aucune",
            "availability_date": datetime.now().strftime("%d/%m/%Y"),
            "geographic_mobility": "Toute la France",
            "weekend_work": False,
            "discovery_source": "OTHER"
        },

        # ===========================
        # Synthèse (Chargé de recrutement)
        # ===========================
        "synthesis": {
            "feasibility_conclusion": "Excellent profil",
            "pathway_relevance": "Parfaite adéquation",
            "special_needs": "Aucun",
            "pedagogical_recommendations": {
                "office_tools_reinforcement": False,
                "written_communication_support": False,
                "oral_confidence_development": True,
                "time_management_support": False,
                "professional_posture_work": False,
                "enhanced_company_immersion": False,
                "psh_specific_support": False,
                "individual_follow_up": True,
                "language_training": False,
                "stress_management_follow_up": False
            },
            "other_recommendations": "Profil à fort potentiel",
            "location": "Paris",
            "date": datetime.now().strftime("%d/%m/%Y"),
            "recruiter_signature": "Signé Jean Recruteur",
            "candidate_signature": "Signé Alan Turing"
        }
    }

    try:
        # Insertion
        result_json = req.post("http://localhost:4000/api/graphql/candidates", json={
            'query': "mutation($input: CreateCandidateInput!) { createCandidate(input: $input) { id identity { fullName }}}",
            'variables': {
                'input': new_candidate
            }
        })
        print(f"✅ Succès ! Candidat complet inséré avec l'ID : {result_json.json()}")
    except Exception as e:
        print(f"❌ Erreur lors de l'insertion : {e}")

if __name__ == "__main__":
    insert_candidate()
