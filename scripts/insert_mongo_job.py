import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

username = os.getenv("MONGO_ROOT_USERNAME")
password = os.getenv("MONGO_ROOT_PASSWORD")
port = os.getenv("MONGO_PORT", "27017")
host = "localhost"

if not username or not password:
    print("Error: MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD must be set in .env")
    exit(1)

mongo_uri = f"mongodb://{username}:{password}@{host}:{port}/?authSource=admin"

try:
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    client.server_info()
except ConnectionFailure:
    print("Error: Could not connect to MongoDB")
    exit(1)

db = client["human_ressources"]
jobs_collection = db["jobs"]

def get_enum_input(prompt, options):
    print(prompt)
    for i, opt in enumerate(options, 1):
        print(f"{i}. {opt}")
    while True:
        choice = input("Enter your choice (number or value): ").strip()
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
        elif choice in options:
            return choice
        print("Invalid choice, try again.")

def get_bool_input(prompt, default=False):
    default_str = "Y/n" if default else "y/N"
    while True:
        choice = input(f"{prompt} [{default_str}]: ").strip().lower()
        if not choice:
            return default
        if choice in ["y", "yes"]:
            return True
        if choice in ["n", "no"]:
            return False
        print("Please enter y/n.")

job = {}

id_input = input("Enter job ID (string, leave empty for auto-generation): ").strip()
if id_input:
    job["_id"] = id_input

company_name = input("Enter company name: ").strip()
if company_name:
    job["company_name"] = company_name

age_range = input("Enter age range (format: min-max, e.g., 18-30): ").strip()
if age_range:
    job["age_range"] = age_range

desired_tp_options = ["AD", "CC", "NTC", "REM", "SA"]
job["desired_tp"] = get_enum_input("Select desired TP type:", desired_tp_options)

desired_sex_options = ["MIXTE", "FILLE", "GARCON"]
job["desired_sex"] = get_enum_input("Select desired sex:", desired_sex_options)

job["driving_license_b"] = get_bool_input("Require driving license B?", default=False)

job["professional_experience"] = get_bool_input("Require professional experience?", default=False)

# status_options = ["NOT_MATCHED", "MATCHED", "ZERO_MATCHED", "CV_SEND", "IMMERSING", "CONTRACT"]
# job["status"] = get_enum_input("Select job status:", status_options)
job['status'] = "NOT_MATCHED"

loc_options = [
    "SAINT_DENIS", "SAINTE_MARIE", "SAINTE_SUZANNE", "SAINT_PAUL",
    "LA_POSSESSION", "LE_PORT", "TROIS_BASSINS", "SAINT_LEU",
    "SAINT_PIERRE", "CILAOS", "ETANG_SALE", "SAINT_LOUIS",
    "ENTRE_DEUX", "LES_AVIRONS", "LE_TAMPON", "SAINT_PHILLIPE",
    "SAINT_JOSEPH", "PETIT_ILE", "SAINTE_ROSE", "SAINT_BENOIT",
    "BRAS_PANON", "SAINT_ANDRE", "LA_PLAINE_DES_PALMISTES", "SALAZIE",
    "SAINTE_ANNE"
]
print("Select localisations (comma-separated, e.g., SAINT_DENIS,SAINT_PIERRE):")
for i, loc in enumerate(loc_options, 1):
    print(f"{i}. {loc}")
loc_input = input("Enter localisations: ").strip()
if loc_input:
    loc_list = [x.strip() for x in loc_input.split(",")]
    valid_loc = [x for x in loc_list if x in loc_options]
    if valid_loc:
        job["localisation"] = valid_loc

job["matched"] = False
job["matched_candidate"] = []

print("\nJob document to insert:")
for key, value in job.items():
    print(f"{key}: {value}")

confirm = input("Confirm insertion? (y/N): ").strip().lower()
if confirm == "y":
    try:
        result = jobs_collection.insert_one(job)
        print(f"✅ Job inserted successfully with _id: {result.inserted_id}")
    except Exception as e:
        print(f"❌ Error inserting job: {e}")
else:
    print("Insertion cancelled.")

client.close()
