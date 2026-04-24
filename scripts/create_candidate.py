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
        "status": "IMMERSING",  # Le nouveau statut que tu viens d'ajouter !
        "tpType": "CC",
        # "created_at": datetime.now(),
        # "created_by": "script_python",
        
        # ===========================
        # Identité du candidat
        # ===========================
        "identity": {
            "fullName": "Turing Alan",
            "dateOfBirth": datetime(1912, 6, 23).strftime("%Y-%m-%d"),
            "placeOfBirth": "Londres",
            "age": 30,
            "postalCode": "75001",
            "city": "Paris",
            "email": "alan.turing@example.com",
            "phone": "0601020304",
            "drivingLicenseB": True,
            "transportMeans": "Transport en commun",
            "pshReferralRequest": False
        },
        
        # ===========================
        # Parcours et prérequis
        # ===========================
        "education": {
            "schoolLevel": "BAC_PLUS_3_PLUS",
            "justification": "Diplôme universitaire en mathématiques"
        },
        
        # ===========================
        # Positionnement
        # ===========================
        "trainingSite": "NORD_SAINTE_MARIE",
        
        # ===========================
        # Accompagnement
        # ===========================
        "support": {
            "franceTravailRegistered": True,
            "franceTravailAgency": "Agence Paris Centre",
            "missionLocaleRegistered": False,
            "missionLocaleCity": ""
        },
        
        # ===========================
        # Immersion
        # ===========================
        "immersionAgreement": True,
        
        # ===========================
        # Parcours antérieurs
        # ===========================
        "background": {
            "lastDiploma": "Doctorat",
            "previousTrainings": "Cryptographie avancée",
            "professionalExperiences": [
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
            "frenchLevel": 8,
            "englishLevel": 10,
            "otherLanguages": ["Allemand"],
            "strengthsAndImprovements": "Logique imparable, doit améliorer la vulgarisation",
            "qualities": ["Logique", "Persévérant", "Curieux"],
            "defects": ["Impatient"],
            "digitalSkills": ["Programmation", "Algorithmique"],
            "readyForChallenges": True,
            "hobbies": "Course de fond"
        },
        
        # ===========================
        # Projets professionnels
        # ===========================
        "professionalProjects": {
            "careerObjectives": "Créer l'intelligence artificielle",
            "desiredSkills": "Développement logiciel",
            "apprenticeshipMotivation": "Mettre en pratique des modèles mathématiques",
            "trainingExpectations": "Projets complexes"
        },
        
        # ===========================
        # Analyse des compétences
        # ===========================
        "skillsAssessment": [
            {
                "competence": "Algorithmique",
                "level": "A"
            }
        ],
        
        # ===========================
        # Champs spécifiques au TP
        # ===========================
        "desiredSectors": ["Informatique", "Recherche"],
        "expectedCompanySkills": ["Innovation", "Rigueur"],
        
        # ===========================
        # Informations sur le poste
        # ===========================
        "jobInfo": {
            "domainMotivation": "Passion pour l'informatique",
            "questionsConcerns": "Aucune",
            "availabilityDate": datetime.now().strftime("%Y-%m-%d"),
            "geographicMobility": "Toute la France",
            "weekendWork": False,
            "discoverySource": "OTHER"
        },
        
        # ===========================
        # Synthèse (Chargé de recrutement)
        # ===========================
        "synthesis": {
            "feasibilityConclusion": "Excellent profil",
            "pathwayRelevance": "Parfaite adéquation",
            "specialNeeds": "Aucun",
            "pedagogicalRecommendations": {
                "officeToolsReinforcement": False,
                "writtenCommunicationSupport": False,
                "oralConfidenceDevelopment": True,
                "timeManagementSupport": False,
                "professionalPostureWork": False,
                "enhancedCompanyImmersion": False,
                "pshSpecificSupport": False,
                "individualFollowUp": True,
                "languageTraining": False,
                "stressManagementFollowUp": False
            },
            "otherRecommendations": "Profil à fort potentiel",
            "location": "Paris",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "recruiterSignature": "Signé Jean Recruteur",
            "candidateSignature": "Signé Alan Turing"
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
