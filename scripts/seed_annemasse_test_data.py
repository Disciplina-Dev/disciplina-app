#!/usr/bin/env python3
"""Seed de données de test pour le tenant « annemasse ».

Fixture réaliste (entreprises, candidats, AB, offres, historiques) destinée à
tester la fiabilité de l'assistant IA (Claude) adossé au CRM via ses outils MCP.
Le jeu de données recouvre les questions du plan de test `docs/qa/annemasse-claude-reliability.md`.

Contrat d'exécution :
    - idempotent sans purge : on ré-insère les clés naturelles (SIRET, email,
      _id d'AB/offre) et on ne modifie jamais un document existant
      (`INSERT IGNORE` côté MySQL, `$setOnInsert` côté MongoDB) ;
    - cible uniquement les bases locales `disciplina_annemasse` (garde-fou
      `db/guard.guard_local_target`, même protection que les autres seeds) ;
    - les identifiants (_id, ids MySQL) sont déterministes pour que la grille de
      correction du plan de test reste stable.

Usage:
    python seed_annemasse_test_data.py

Connexions lues depuis le `.env` racine comme les autres scripts
(MYSQL_ROOT_PASSWORD, MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD).
"""

import os
import uuid
from datetime import date, datetime, timedelta, time as dtime

from dotenv import load_dotenv

from db.guard import guard_local_target
from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection

load_dotenv()

# Tenant ciblé : bases annemasse.
MYSQL_DB = "disciplina_annemasse"
MONGO_DB = "disciplina_annemasse"

# Hash bcrypt dev versionné (même compte que root@example.com, cf.
# database/mysql/mysql-seed-dev.sql) : le mot de passe des comptes de test est
# identique à celui du compte administrateur de dev local.
DEV_PASSWORD_HASH = "$2a$10$3cXr1oA.UaFA44D4OjddWupCC3c4vFBoPZhewTxohLKUvMrHJ52nq"

# Identifiants déterministes (uuid v4 en forme) pour des références stables.
AB_IDS = {
    "a": "6f40f9a0-1111-4a01-8c01-a11111111101",  # BOULANGERIE LE CROISSANT D'ANNEMASSE (SIGNE)
    "b": "6f40f9a0-1111-4a02-8c02-a11111111102",  # PARFUMERIE BELLE ESSENCE (SIGNE)
    "c": "6f40f9a0-1111-4a03-8c03-a11111111103",  # BOUCHERIE DES TROIS FONTAINES (EN_ATTENTE_SIGNATURE)
    "d": "6f40f9a0-1111-4a04-8c04-a11111111104",  # OPTIQUE VISION CLAIRE (EN_ATTENTE_SIGNATURE)
    "e": "6f40f9a0-1111-4a05-8c05-a11111111105",  # BOULANGERIE LA FOURNÉE ANNEMASSIENNE (SIGNE)
}

CANDIDATE_IDS = {
    1: "7a11c000-0001-4001-8001-0001c0010001",  # Lucas Bernardi (CC, SEEKING, BOULANGERIE)
    2: "7a11c000-0002-4002-8002-0002c0020002",  # Sarah Moreau (CC, SEEKING, COSMETIQUE)
    3: "7a11c000-0003-4003-8003-0003c0030003",  # Théo Maillard (CC, CONTRACT)
    4: "7a11c000-0004-4004-8004-0004c0040004",  # Emma Bertrand (CC, IMMERSING)
    5: "7a11c000-0005-4005-8005-0005c0050005",  # Nathan Charvet (NTC, SEEKING, AUTO)
    6: "7a11c000-0006-4006-8006-0006c0060006",  # Léa Fontaine (CC, SEEKING, CV manquant)
    7: "7a11c000-0007-4007-8007-0007c0070007",  # Noah Perrin (CC, NOT_SEEKING)
    8: "7a11c000-0008-4008-8008-0008c0080008",  # Inès Lambert (CC, UNAVAILABLE)
    9: "7a11c000-0009-4009-8009-0009c0090009",  # Malik Diallo (CC, SEEKING, BOULANGERIE)
    10: "7a11c000-000a-400a-800a-000ac00a000a",  # Chloé Roussel (CC, SEEKING, MEDICAL)
}

OFFER_IDS = {
    1: "8a11c000-0001-4001-8001-0001d0010001",  # Croissant d'Annemasse — Conseiller Commercial
    2: "8a11c000-0002-4002-8002-0002d0020002",  # Parfumerie Belle Essence — Conseiller vente
    3: "8a11c000-0003-4003-8003-0003d0030003",  # Boucherie des Trois Fontaines — Employé vente
    4: "8a11c000-0004-4004-8004-0004d0040004",  # La Fournée Annemassienne — Vendeur
    5: "8a11c000-0005-4005-8005-0005d0050005",  # Optique Vision Claire — Conseiller optique
    6: "8a11c000-0006-4006-8006-0006d0060006",  # Le Pain d'Or — legacy offer (entreprise fermée)
}

TRAINING_DAYS = (
    '{"monday":["MATIN","APRES_MIDI"],"tuesday":["MATIN","APRES_MIDI"],'
    '"wednesday":["MATIN","APRES_MIDI"],"thursday":["MATIN","APRES_MIDI"],'
    '"friday":["MATIN","APRES_MIDI"]}'
)


def iso(dt):
    return dt.isoformat() + "Z"


def ts(dt):
    """Timestamp MySQL (YYYY-MM-DD HH:MM:SS)."""
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def uuid4():
    return str(uuid.uuid4())


# ── Users (MySQL) ────────────────────────────────────────────────────────────
USERS = [
    # id, email, prénom, nom, role_id, permission_id
    (1, "amandine.rossi@disciplina.fr", "Amandine", "Rossi", 1, 1),  # COMMERCIAL
    (2, "nicolas.gauthier@disciplina.fr", "Nicolas", "Gauthier", 2, 1),  # RH
    (3, "camille.laurent@disciplina.fr", "Camille", "Laurent", 5, 3),  # GESTION / ADMIN (connexion test plein périmètre)
]

# ── Companies (MySQL) ────────────────────────────────────────────────────────
# id, user_id, ab_id, legal_referent, name, phone, email, address, sector,
# main_activity, siret, idcc, ape, notes, conclusion, status, relance_date,
# relance_type, relance_channel
COMPANIES = [
    (
        1, 1, AB_IDS["a"], "Patrick Fuchs", "BOULANGERIE LE CROISSANT D'ANNEMASSE",
        "04 50 92 45 70", "contact@croissant-annemasse.fr",
        "18 Av. de la République, 74100 Annemasse", "Nord-Est", "Boulangerie-pâtisserie",
        "74293240500012", "8434", "1071C",
        "Besoins : 1 poste vente/conseil (CC). Interlocutrice : Capucine (adhérente du magasin).",
        "Besoin confirmé : alternant vente (CC) pour octobre 2026", "Oui", None, None, None,
    ),
    (
        2, 1, AB_IDS["b"], "Sonia Veyrat", "PARFUMERIE BELLE ESSENCE",
        "04 50 38 21 09", "contact@belle-essence.fr",
        "52 rue de Genève, 74100 Annemasse", "Nord-Est", "Parfumerie — cosmétique",
        "74320157500031", "8685", "4775Z",
        "Recrute via le magasin centre-ville. Demande un conseiller parfumerie.",
        "Besoin confirmé : conseiller·ère vente (CC)", "Oui", None, None, None,
    ),
    (
        3, 1, None, "M. Belhem", "GARAGE SAINT-CERGUE AUTO",
        "04 50 95 33 78", None,
        "5 route de Saint-Julien, 74240 Gaillard", "Nord-Est", "Réparation automobile",
        "74304500000021", "1090", "4520A",
        "Intéressé par un alternant accueil/facturation d'atelier. Attend l'accord du gérant avant d'ouvrir un poste.",
        "", "À Réfléchir", date(2026, 9, 18), 1, "PHONE",
    ),
    (
        4, 1, AB_IDS["c"], "Roger Bizzocchi", "BOUCHERIE DES TROIS FONTAINES",
        "04 50 20 47 51", "boucherie3fontaines@orange.fr",
        "3 rue des Trois Fontaines, 74100 Annemasse", "Nord-Est", "Boucherie-charcuterie",
        "74293318000078", "8434", "4722Z",
        "Convention envoyée le 02/09 — signature entreprise attendue.",
        "Poste CC validé, convention en attente de signature", "Oui", None, None, None,
    ),
    (
        5, 1, None, "Jean-Pierre Vaudaux", "RESTAURANT LE CASINO DES ALPES",
        "04 50 87 11 26", None,
        "7 place de l'Hôtel de Ville, 74100 Annemasse", "Nord-Est", "Restauration traditionnelle",
        "74291578000034", "1505", "5610A",
        "Équipe complète — ne recrute pas d'alternant cette année.",
        "Besoin non retenu cette année", "Non", None, None, None,
    ),
    (
        6, 1, AB_IDS["d"], "Hélène Charvin", "OPTIQUE VISION CLAIRE",
        "04 50 71 84 30", "hl.optique74@gmail.com",
        "27 rue de Chêne-roux, 74200 Thonon-les-Bains", "Nord-Est", "Optique — lunetterie",
        "74320157500055", "1730", "4778A",
        "Plusieurs relances sans retour. Proposer un créneau le samedi matin.",
        "", "Réponds pas", date(2026, 8, 26), 2, "MAIL",
    ),
    (
        7, 1, AB_IDS["e"], "Carine Mugnier", "BOULANGERIE LA FOURNÉE ANNEMASSIENNE",
        "04 50 36 78 90", "fournee.annemasse@gmail.com",
        "9 rue du Commerce, 74380 Cranves-Sales", "Nord-Est", "Boulangerie",
        "74304500000050", "8434", "1071C",
        "2 postes ouverts. Un candidat embauché, un candidat en immersion.",
        "Besoin couvert (contrat + immersion en cours)", "Oui", None, None, None,
    ),
    (
        8, 2, None, "Gérard Besson", "BOULANGERIE LE PAIN D'OR",
        "04 50 42 60 81", None,
        "22 route des Genévriers, 74100 Annemasse", "Nord-Est", "Boulangerie",
        "74304500000080", "8434", "1071C",
        "Cessation d'activité prévue fin d'année.",
        "Entreprise fermée", "Fermé", None, None, None,
    ),
]

# ── Blacklist (MySQL) ────────────────────────────────────────────────────────
BLACKLIST = [
    # user_id, name, phone, email, address, sector, activity, siret, idcc, ape, notes, conclusion, status, all_blacklist
    (1, "SNACK LE POINT CHAUD", "04 50 60 12 34", None,
     "14 rue de la Gare, 74100 Annemasse", "Nord-Est", "Restauration rapide",
     "74320041000019", "1634", "5610C",
     "Aucune réponse après 3 relances ; sollicitations abusives.",
     "Blacklistée — ne pas recontacter", "Fermé", 1),
    (1, "AGENCE IMMO DU LÉMAN", "04 50 70 12 12", None,
     "6 quai des Pêcheurs, 74500 Évian-les-Bains", "Nord-Est", "Immobilier",
     "74320041000035", "1520", "6831Z",
     "Sollicite des alternants pour des missions hors convention (type intérim).",
     "Blacklistée", "Non", 1),
]

# ── Contact logs / relances / historique (MySQL) ─────────────────────────────
CONTACT_LOGS = [
    (3, 1, "Premier contact téléphonique : intéressé par un alternant accueil/facturation atelier. À recontacter après l'accord du gérant.", datetime(2026, 8, 28, 9, 0)),
    (4, 1, "Envoi de la convention pour signature (mail du 02/09). Relance prévue à J+7.", datetime(2026, 9, 2, 11, 30)),
    (5, 1, "Rebond après AB : équipe complète, pas de besoin en alternance pour 2026.", datetime(2026, 7, 4, 14, 0)),
    (6, 1, "Essai de contact téléphonique — pas de réponse, ligne occupée.", datetime(2026, 8, 5, 14, 20)),
    (6, 1, "Mail de relance envoyé avec une proposition de créneau le samedi — sans retour.", datetime(2026, 8, 26, 11, 0)),
    (8, 2, "Prévenu de la cessation d'activité — dossier clôturé.", datetime(2026, 7, 18, 10, 15)),
]

RELANCE_HISTORY = [
    (3, 1, 1, "PHONE", "Prise de contact atelier", "Rappel : l'exploitant n'a pas encore tranché sur le besoin.", datetime(2026, 9, 4, 16, 0)),
    (5, 1, 2, "MAIL", "Remerciements pour l'échange", "Pas de besoin actuellement, garder le contact.", datetime(2026, 7, 8, 9, 30)),
    (6, 1, 2, "MAIL", "Proposition de profil alternant (conseil en optique)", "Aucun retour à ce jour.", datetime(2026, 8, 5, 11, 0)),
    (6, 1, 2, "MAIL", "Relance — créneau de présentation le samedi", "Envoyé, toujours pas de réponse.", datetime(2026, 8, 26, 11, 0)),
]

COMPANY_HISTORY = [
    (3, "status", "À Réfléchir", None, datetime(2026, 8, 28, 9, 0)),
    (6, "status", "Réponds pas", "À Réfléchir", datetime(2026, 8, 26, 11, 0)),
]

# ── Candidats (MongoDB) ──────────────────────────────────────────────────────
# helper de construction pour rester lisible
def candidate(
    cid, full_name, sex, age, city, postal, email, phone, tp, status, sector,
    mobility, avail, description, cv=True, contract=None, immersion=None,
    education="BAC", created=None, no_cv=None, discovery="SALON",
):
    doc = {
        "_id": CANDIDATE_IDS[cid],
        "candidate_id": CANDIDATE_IDS[cid],
        "owner": {"user_id": 2, "name": "Nicolas Gauthier"},
        "tp_types": [tp],
        "identity": {
            "full_name": full_name,
            "sex": sex,
            "age": age,
            "city": city,
            "postal_code": postal,
            "email": email,
            "phone": phone,
            "address": f"{postal}, {city}",
            "driving_license_b": True,
            "has_vehicle": False,
            "description": description,
        },
        "consentments": {
            "data_processing": True,
            "data_sharing": True,
            "ai_processing": True,
            "photo_processing": True,
            "consent_date": iso(created or datetime(2026, 1, 1)),
            "consent_version": "2026-v1",
        },
        "status": status,
        "training_site": "NORD_SAINTE_MARIE",
        "training_sites": [],
        "desired_sectors": [sector] if sector else [],
        "expected_company_skills": [],
        "background": {"professional_experiences": []},
        "profile": {"other_languages": [], "qualities": [], "defects": [], "digital_skills": []},
        "skills_assessment": [],
        "education": {"school_level": education, "justification": "niveau déclaré en entretien"},
        "support": {"comments": ""},
        "job_info": {
            "geographic_mobility": mobility,
            "weekend_work": False,
            "discovery_source": discovery if discovery in ("SALON", "FRANCE_TRAVAIL", "OTHER", "WORD_OF_MOUTH") else "OTHER",
        },
        "synthesis": {
            "pedagogical_recommendations": {
                "office_tools_reinforcement": False,
                "written_communication_support": False,
                "oral_confidence_development": False,
                "time_management_support": False,
                "professional_posture_work": False,
                "enhanced_company_immersion": False,
                "psh_specific_support": False,
                "individual_follow_up": False,
                "language_training": False,
                "stress_management_follow_up": False,
            }
        },
        "created_at": created,
        "updated_at": created,
    }
    if avail:
        doc["job_info"]["availability_date"] = datetime.combine(avail, dtime.min)
    if no_cv is not None:
        doc["cv_link"] = None
        doc["pdf_link"] = None
        doc["drive_folder_link"] = None
        doc["filiz_folder_id"] = None
    elif cv:
        doc["cv_link"] = f"https://drive.google.com/file/d/qa{address_zero(cid)}/view?usp=drivesdk"
        doc["pdf_link"] = doc["cv_link"]
        doc["drive_folder_id"] = f"1qa{cid:x}"
        doc["drive_folder_link"] = f"https://drive.google.com/drive/folders/1qa{cid:x}"
        doc["filiz_folder_id"] = f"FILIZ-{cid:04d}"
    else:
        doc["drive_folder_id"] = f"1qa{cid:x}"
        doc["drive_folder_link"] = f"https://drive.google.com/drive/folders/1qa{cid:x}"
    if contract:
        doc.update({
            "contract_company_id": contract["company_id"],
            "contract_company_name": contract["company_name"],
            "contract_start_date": contract["start"],
            "contract_offer_id": contract["offer_id"],
        })
    if immersion:
        doc.update({
            "immersion_agreement": True,
            "immersion_start_date": immersion["start"],
            "immersion_end_date": immersion["end"],
            "immersion_company_id": immersion["company_id"],
            "immersion_company_name": immersion["company_name"],
        })
    # Supprime les clés à None (le $jsonSchema du tenant annemasse impose un type
    # bson pour les champs présents : mieux vaut les omettre qu'envoyer null).
    doc = {k: v for k, v in doc.items() if v is not None}
    return doc


def address_zero(cid):
    return f"{cid:012d}"

CANDIDATES = [
    candidate(
        1, "Lucas Bernardi", "GARCON", 19, "ANNEMASSE", "74100",
        "lucas.bernardi@mail.fr", "06 12 45 78 90", "CC", "SEEKING", "BOULANGERIE",
        ["SAINT_DENIS"], date(2026, 9, 1),
        "Lucas Bernardi — vise CC. Mobilité : St-Denis / Genève. Disponible immédiatement.",
        created=datetime(2026, 6, 12, 9, 0), discovery="SALON",
    ),
    candidate(
        2, "Sarah Moreau", "FILLE", 21, "ANNEMASSE", "74100",
        "sarah.moreau@mail.fr", "06 22 33 44 55", "CC", "SEEKING", "COSMETIQUE",
        ["SAINT_DENIS"], date(2026, 8, 1),
        "Sarah Moreau — vise CC. Expérience boutique (été). Sérieuse, disponible.",
        created=datetime(2026, 7, 20, 10, 0),
    ),
    candidate(
        3, "Théo Maillard", "GARCON", 20, "GAILARD", "74240",
        "theo.maillard@mail.fr", "06 54 33 22 11", "CC", "CONTRACT", "BOULANGERIE",
        ["SAINT_DENIS"], None,
        "Théo Maillard — vise CC. Embauché en boulangerie (contrat signé).",
        contract={
            "company_id": 7,
            "company_name": "BOULANGERIE LA FOURNÉE ANNEMASSIENNE",
            "start": "2026-09-14",
            "offer_id": OFFER_IDS[4],
        },
        created=datetime(2026, 7, 2, 9, 0),
    ),
    candidate(
        4, "Emma Bertrand", "FILLE", 22, "CRANVES-SALES", "74380",
        "emma.bertrand@mail.fr", "06 77 88 99 00", "CC", "IMMERSING", "BOULANGERIE",
        ["SAINT_DENIS"], None,
        "Emma Bertrand — vise CC. En immersion en boulangerie (validation contrat attendue).",
        immersion={
            "company_id": 7,
            "company_name": "BOULANGERIE LA FOURNÉE ANNEMASSIENNE",
            "start": "2026-08-24",
            "end": "2026-09-18",
        },
        created=datetime(2026, 7, 15, 16, 0),
    ),
    candidate(
        5, "Nathan Charvet", "GARCON", 18, "ANNEMASSE", "74100",
        "nathan.charvet@mail.fr", "06 11 22 33 44", "NTC", "SEEKING", "AUTO",
        ["SAINT_DENIS"], date(2026, 10, 1),
        "Nathan Charvet — vise NTC. Projet : commerce/mécanique. Pas d'expérience.",
        created=datetime(2026, 8, 1, 9, 30), education="CAP_BEP_WITH_1Y_EXP",
    ),
    candidate(
        6, "Léa Fontaine", "FILLE", 20, "AMBILY", "74100",
        "lea.fontaine@mail.fr", "06 98 76 54 32", "CC", "SEEKING", "COMMERCIAL",
        ["SAINT_DENIS"], date(2026, 9, 1),
        "Léa Fontaine — vise CC. Positionnée en boucherie : CV non fourni à ce jour.",
        cv=False, no_cv=True, created=datetime(2026, 8, 10, 14, 0),
    ),
    candidate(
        7, "Noah Perrin", "GARCON", 18, "VILLAZ", "74370",
        "noah.perrin@mail.fr", "06 45 67 89 01", "CC", "NOT_SEEKING", "BOULANGERIE",
        ["SAINT_DENIS"], None,
        "Noah Perrin — vise CC. Se réoriente vers une autre formation (pas d'alternance 2026).",
        created=datetime(2026, 6, 25, 11, 0),
    ),
    candidate(
        8, "Inès Lambert", "FILLE", 24, "THONON-LES-BAINS", "74200",
        "ines.lambert@mail.fr", "06 20 30 40 50", "CC", "UNAVAILABLE", "MEDICAL",
        ["SAINT_DENIS"], None,
        "Inès Lambert — vise CC. Indisponible jusqu'à début 2027 (réorganisation familiale).",
        created=datetime(2026, 8, 15, 17, 0),
    ),
    candidate(
        9, "Malik Diallo", "GARCON", 19, "ANNEMASSE", "74100",
        "malik.diallo@mail.fr", "06 61 71 81 91", "CC", "SEEKING", "BOULANGERIE",
        ["SAINT_DENIS"], date(2026, 9, 5),
        "Malik Diallo — vise CC. Permis B. Disponible, forte motivation vente.",
        created=datetime(2026, 6, 20, 10, 30), discovery="SALON",
    ),
    candidate(
        10, "Chloé Roussel", "FILLE", 21, "ANNEMASSE", "74100",
        "chloe.roussel@mail.fr", "06 12 98 76 43", "CC", "SEEKING", "MEDICAL",
        ["SAINT_DENIS"], date(2026, 9, 1),
        "Chloé Roussel — vise CC. Proposition en attente de réponse chez un opticien.",
        created=datetime(2026, 8, 15, 15, 0),
    ),
]

# ── Historique candidats (MongoDB) ───────────────────────────────────────────
CANDIDATE_HISTORY = {
    1: [
        ("Inscrit lors du salon de l'alternance d'Annecy — profil CC confirmé.", "SALON", datetime(2026, 6, 12, 9, 0)),
        ("Relance candidat — toujours disponible, mobilité OK.", "RH", datetime(2026, 8, 20, 10, 0)),
    ],
    2: [
        ("Positionnée chez PARFUMERIE BELLE ESSENCE.", "RH", datetime(2026, 8, 12, 9, 30)),
        ("CV transmis à l'entreprise (Amandine).", "RH", datetime(2026, 8, 15, 11, 0)),
    ],
    3: [
        ("Entretien programmé avec BOULANGERIE LA FOURNÉE ANNEMASSIENNE le 2026-08-28.", "RH", datetime(2026, 8, 21, 9, 0)),
        ("L'entretien c'est soldé par un contrat avec BOULANGERIE LA FOURNÉE ANNEMASSIENNE.", "RH", datetime(2026, 9, 2, 16, 0)),
    ],
    4: [
        ("Le candidat.e est en immersion chez BOULANGERIE LA FOURNÉE ANNEMASSIENNE du 2026-08-24 au 2026-09-18.", "RH", datetime(2026, 8, 24, 9, 0)),
    ],
    5: [
        ("Positionné sur BOULANGERIE LA FOURNÉE ANNEMASSIENNE (profil CC).", "RH", datetime(2026, 8, 18, 14, 0)),
        ("Refusé par l'entreprise — profil NTC ne correspond pas au poste CC.", "RH", datetime(2026, 8, 28, 10, 0)),
    ],
    6: [
        ("Positionnée chez BOUCHERIE DES TROIS FONTAINES.", "RH", datetime(2026, 8, 25, 9, 30)),
        ("CV manquant — relancé le 30/08, document non fourni à ce jour.", "RH", datetime(2026, 8, 30, 11, 0)),
    ],
    7: [
        ("Réoriente son projet vers une autre formation (pas d'alternance 2026).", "RH", datetime(2026, 8, 10, 10, 0)),
    ],
    8: [
        ("Indisponible jusqu'à début 2027 — réorganisation familiale.", "RH", datetime(2026, 8, 15, 9, 0)),
    ],
    9: [
        ("Fiche créée depuis le salon (TP CC — secteur BOULANGERIE).", "SALON", datetime(2026, 6, 20, 10, 30)),
        ("Disponible immédiatement, permis B.", "RH", datetime(2026, 7, 1, 9, 0)),
    ],
    10: [
        ("Proposition envoyée à OPTIQUE VISION CLAIRE (poste conseiller optique).", "RH", datetime(2026, 8, 27, 11, 0)),
    ],
}

# ── Analyses du besoin (MongoDB) ─────────────────────────────────────────────
def ab(ab_key, company_id, company_name, siret, ape, idcc, main_activity, opco,
       sector, activities, commune, postal, referent, saler_email, positions,
       status, signature_request_id, signature_sent_at, signature_url,
       created, last_relance_at=None, training_days=TRAINING_DAYS):
    return {
        "_id": AB_IDS[ab_key],
        "company_infos": {
            "id": company_id,
            "name": company_name,
            "ape": ape,
            "idcc": idcc,
            "siret": siret,
            "main_activity": main_activity,
            "opco": opco,
            "referral_source": "BOUCHE_A_OREILLE",
            "sector": sector,
            "activities": activities,
            "description": None,
            "postal_code": postal,
            "commune": commune,
        },
        "saler_info": {"id": 1, "email": saler_email},
        "referents": {
            "is_same": True,
            "legal_referents": {"name": referent, "phone": None, "email": None, "function": "Gérant(e)"},
            "recruitment_referents": {"name": referent, "phone": None, "email": None, "function": None},
        },
        "positions": positions,
        "recruitment_method": "ALL_CV",
        "immersion_period": "OUI",
        "training_days": training_days,
        "signature_request_id": signature_request_id,
        "signature_sent_at": iso(signature_sent_at),
        "signature_url": signature_url,
        "last_relance_at": iso(last_relance_at) if last_relance_at else None,
        "is_relance_disabled": False,
        "status": status,
        "tags": [],
        "ab_status": None,
        "is_deleted": False,
        "administration_type": "NON_RENSEIGNE",
        "created_at": iso(created),
        "updated_at": iso(created),
    }


def position(tp, title, role, domain, sector, missions, age_min=18, age_max=29, soft_skills="Polie et souriante, aisance relationnelle"):
    return {
        "localisation": ["SAINT_DENIS"],
        "desired_tp": [
            {
                "tp_type": tp,
                "missions": missions,
                "description_missions": [],
                "other_missions": None,
                "other_description_missions": None,
            }
        ],
        "training_domain": domain,
        "job_role": role,
        "title": title,
        "count": 1,
        "criteria": {
            "education_level": "BAC",
            "driving_license": False,
            "has_vehicle": False,
            "experience_required": False,
            "training_domain": domain,
            "age_min": age_min,
            "age_max": age_max,
            "desired_sex": None,
            "soft_skills": soft_skills,
            "schedule_options": [],
            "conditions": None,
            "additional_comments": None,
        },
    }


AB_CATALOG = [
    ab(
        "a", 1, "BOULANGERIE LE CROISSANT D'ANNEMASSE", "74293240500012", "1071C", "8434",
        "Boulangerie-pâtisserie", "OPCOMMERCE", "NORD", ["BOULANGERIE"], "Annemasse", "74100",
        "Patrick Fuchs", "amandine.rossi@disciplina.fr",
        [position("CC", "Conseiller Commercial", "employé polyvalent", "VENTE", "BOULANGERIE", [
            "Accueil des clients (physique/téléphonique)",
            "Identifier les besoins",
            "Conseiller et vendre en rayon",
            "Tenir le poste de caisse",
            "Mise en avant des produits",
        ])],
        "SIGNE", "10615001", datetime(2026, 8, 20, 10, 0), "https://docuseal.com/s/qaC0001",
        datetime(2026, 8, 10, 9, 0),
    ),
    ab(
        "b", 2, "PARFUMERIE BELLE ESSENCE", "74320157500031", "4775Z", "8685",
        "Parfumerie — cosmétique", "AKTO", "NORD", ["COSMETIQUE"], "Annemasse", "74100",
        "Sonia Veyrat", "amandine.rossi@disciplina.fr",
        [position("CC", "Conseiller·ère vente parfumerie", "vendeur·se", "VENTE", "COSMETIQUE", [
            "Accueil et conseil client en parfumerie",
            "Démonstration des produits",
            "Gestion des stocks et vitrines",
            "Encaissement",
        ])],
        "SIGNE", "10615002", datetime(2026, 8, 25, 10, 30), "https://docuseal.com/s/qaC0002",
        datetime(2026, 8, 15, 9, 0),
    ),
    ab(
        "c", 4, "BOUCHERIE DES TROIS FONTAINES", "74293318000078", "4722Z", "8434",
        "Boucherie-charcuterie", "UNIFORMATION", "NORD", ["COMMERCIAL"], "Annemasse", "74100",
        "Roger Bizzocchi", "amandine.rossi@disciplina.fr",
        [position("CC", "Employé·e vente en boucherie", "employé polyvalent", "VENTE", "COMMERCIAL", [
            "Accueil et conseil à la clientèle",
            "Vente au rayon traditionnel",
            "Mise en rayon et facing",
            "Encaissement",
        ], soft_skills="Rigueur, hygiène et relation client")],
        "EN_ATTENTE_SIGNATURE", "10615003", datetime(2026, 9, 2, 10, 0), "https://docuseal.com/s/qaC0003",
        datetime(2026, 8, 25, 9, 0),
    ),
    ab(
        "d", 6, "OPTIQUE VISION CLAIRE", "74320157500055", "4778A", "1730",
        "Optique — lunetterie", "OPCO_SANTE", "NORD", ["MEDICAL"], "Thonon-les-Bains", "74200",
        "Hélène Charvin", "amandine.rossi@disciplina.fr",
        [position("CC", "Conseiller·ère optique", "vendeur·se conseil", "VENTE", "MEDICAL", [
            "Accueil et conseil en magasin d'optique",
            "Montage et mise en forme des montures",
            "Gestion des rendez-vous",
            "Prise de mesures de montures",
        ])],
        "EN_ATTENTE_SIGNATURE", "10615004", datetime(2026, 8, 22, 9, 0), "https://docuseal.com/s/qaC0004",
        datetime(2026, 8, 15, 9, 0), last_relance_at=datetime(2026, 8, 26, 11, 0),
    ),
    ab(
        "e", 7, "BOULANGERIE LA FOURNÉE ANNEMASSIENNE", "74304500000050", "1071C", "8434",
        "Boulangerie", "OPCOMMERCE", "NORD", ["BOULANGERIE"], "Cranves-Sales", "74380",
        "Carine Mugnier", "amandine.rossi@disciplina.fr",
        [position("CC", "Vendeur·se boulangerie", "employé polyvalent", "VENTE", "BOULANGERIE", [
            "Vente et encaissement",
            "Mise en avant des produits",
            "Maintenance du laboratoire en magasin",
        ])],
        "SIGNE", "10615005", datetime(2026, 7, 30, 9, 0), "https://docuseal.com/s/qaC0005",
        datetime(2026, 7, 28, 9, 0),
    ),
]

# ── Offres (MongoDB) ─────────────────────────────────────────────────────────
def offer(offer_key, ab_key, company_id, company_name, sector, activities, title,
          role, domain, candidates, matching_status, created, localisation=None,
          needs_analysis_id=None, interview_slots=None, interview_location=None):
    return {
        "_id": OFFER_IDS[offer_key],
        "needs_analysis_id": needs_analysis_id if needs_analysis_id is not None else AB_IDS.get(ab_key),
        "company_infos": {"id": company_id, "name": company_name, "sector": sector, "activities": activities},
        "saler_info": {"id": 1, "email": "amandine.rossi@disciplina.fr"},
        "referents": {"is_same": True, "legal_referents": {"name": None, "phone": None, "email": None, "function": None}, "recruitment_referents": {}},
        "localisation": localisation or ["SAINT_DENIS"],
        "desired_tp": [{"tp_type": "CC", "missions": ["Accueil client (physique/téléphonique)"], "description_missions": [], "other_missions": None, "other_description_missions": None}],
        "training_domain": domain,
        "job_role": role,
        "title": title,
        "count": 1,
        "criteria": {
            "education_level": "BAC",
            "driving_license": False,
            "has_vehicle": False,
            "experience_required": False,
            "training_domain": domain,
            "age_min": 18,
            "age_max": 29,
            "desired_sex": None,
            "soft_skills": "Aisance relationnelle",
            "schedule_options": [],
            "conditions": None,
            "additional_comments": None,
        },
        "matching": {
            "status": matching_status,
            "candidates": candidates,
            "interview_slots": interview_slots or [],
            "interview_location": interview_location or None,
        },
        "created_at": iso(created),
        "updated_at": iso(created),
    }


def mc(cid, status, extra=None):
    c = CANDIDATES[cid - 1]
    base = {
        "id": CANDIDATE_IDS[cid],
        "full_name": c["identity"]["full_name"],
        "age": c["identity"]["age"],
        "sex": c["identity"]["sex"],
        "city": c["identity"]["city"],
        "email": c["identity"]["email"],
        "phone": c["identity"]["phone"],
        "status": status,
        "description": c["identity"]["description"],
        "identity_description": c["identity"]["description"],
        "has_cv": c.get("cv_link") is not None,
        "interview_conclusion": None,
        "immersion_conclusion": None,
    }
    if extra:
        base.update(extra)
    return base


OFFERS = [
    offer(1, "a", 1, "BOULANGERIE LE CROISSANT D'ANNEMASSE", "NORD", ["BOULANGERIE"],
          "Conseiller Commercial", "employé polyvalent", "VENTE", [], "NOT_MATCHED",
          datetime(2026, 8, 10, 9, 0)),
    offer(2, "b", 2, "PARFUMERIE BELLE ESSENCE", "NORD", ["COSMETIQUE"],
          "Conseiller·ère vente parfumerie", "vendeur·se", "VENTE",
          [mc(2, "SEND", {"comment": "CV transmis, en attente de retour entreprise"})], "CV_SEND",
          datetime(2026, 8, 15, 9, 0)),
    offer(3, "c", 4, "BOUCHERIE DES TROIS FONTAINES", "NORD", ["COMMERCIAL"],
          "Employé·e vente en boucherie", "employé polyvalent", "VENTE",
          [mc(6, "CV_SEND", {"comment": "CV non fourni — blocage de l'envoi"})], "CV_SEND",
          datetime(2026, 8, 25, 9, 0), interview_location="3 rue des Trois Fontaines, 74100 Annemasse"),
    offer(
        4, "e", 7, "BOULANGERIE LA FOURNÉE ANNEMASSIENNE", "NORD", ["BOULANGERIE"],
        "Vendeur·se boulangerie", "employé polyvalent", "VENTE",
        [
            mc(3, "CONTRACT", {
                "booked_interview_slot": "2026-08-28T09:00:00.000Z",
                "interview_conclusion": "CONTRACT",
                "comment": "Embauche validée — contrat signé",
            }),
            mc(4, "IMMERSING", {
                "booked_interview_slot": "2026-08-05T10:00:00.000Z",
                "interview_conclusion": "IMMERSING",
                "immersion_start_date": "2026-08-24",
                "immersion_end_date": "2026-09-18",
                "immersion_location": "74380 Cranves-Sales",
                "comment": "Immersion en cours — validation contrat attendue",
            }),
            mc(5, "REFUSED", {"comment": "Profil NTC — poste CC requis"}),
        ],
        "CONTRACT", datetime(2026, 7, 28, 9, 0),
    ),
    offer(5, "d", 6, "OPTIQUE VISION CLAIRE", "NORD", ["MEDICAL"],
          "Conseiller·ère optique", "vendeur·se conseil", "VENTE",
          [mc(10, "PRE_SELECTED", {"comment": "Proposition à envoyer"})], "MATCHED",
          datetime(2026, 8, 15, 9, 0)),
    offer(6, None, 8, "BOULANGERIE LE PAIN D'OR", "NORD", ["BOULANGERIE"],
          "Vendeur·se boulangerie", "employé polyvalent", "VENTE", [], "NOT_MATCHED",
          datetime(2026, 4, 1, 9, 0), needs_analysis_id=None),
]


def insert_mysql(conn, sql, params):
    cur = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    cur.close()


def add_row_if_absent(conn, table, where_sql, where_params, insert_sql, insert_params):
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {where_sql}", where_params)
    (count,) = cur.fetchone()
    cur.close()
    if count == 0:
        insert_mysql(conn, insert_sql, insert_params)


def seed_users(conn):
    for uid, email, fn, ln, role, perm in USERS:
        add_row_if_absent(
            conn, "users", "email = %s", (email,),
            "INSERT IGNORE INTO users (id, email, first_name, last_name, password, role_id, permission_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (uid, email, fn, ln, DEV_PASSWORD_HASH, role, perm),
        )
    print(f"[users] {len(USERS)} comptes OK")


def seed_companies(conn):
    for row in COMPANIES:
        cid, uid, ab_id, referent, name, phone, email, address, sector, activity, siret, idcc, ape, notes, conclusion, status, relance_date, relance_type, relance_channel = row
        add_row_if_absent(
            conn, "companies", "siret = %s", (siret,),
            """INSERT IGNORE INTO companies
               (id, user_id, ab_id, legal_referent, name, phone, email, address, sector,
                main_activity, siret, idcc, ape, notes, conclusion, status, relance_date,
                relance_type, relance_channel)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (cid, uid, ab_id, referent, name, phone, email, address, sector,
             activity, siret, idcc, ape, notes, conclusion, status, relance_date,
             relance_type, relance_channel),
        )
    print(f"[companies] {len(COMPANIES)} fiches OK")


def seed_blacklist(conn):
    for row in BLACKLIST:
        uid, name, phone, email, address, sector, activity, siret, idcc, ape, notes, conclusion, status, all_blacklist = row
        add_row_if_absent(
            conn, "companies_blacklist", "siret = %s", (siret,),
            """INSERT IGNORE INTO companies_blacklist
               (user_id, legal_referent, name, phone, email, address, sector,
                main_activity, siret, idcc, ape, notes, conclusion, status, all_blacklist)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (uid, None, name, phone, email, address, sector,
             activity, siret, idcc, ape, notes, conclusion, status, all_blacklist),
        )
    print(f"[blacklist] {len(BLACKLIST)} fiches OK")


def seed_contact_logs(conn):
    for company_id, user_id, comment, created in CONTACT_LOGS:
        add_row_if_absent(
            conn, "contact_logs", "company_id = %s AND comment = %s", (company_id, comment),
            "INSERT INTO contact_logs (company_id, user_id, comment, created_at) VALUES (%s,%s,%s,%s)",
            (company_id, user_id, comment, ts(created)),
        )
    print(f"[contact_logs] {len(CONTACT_LOGS)} journaux OK")


def seed_relance_history(conn):
    for company_id, user_id, type_relance, channel, subject, note, created in RELANCE_HISTORY:
        add_row_if_absent(
            conn, "relance_history",
            "company_id = %s AND subject = %s AND created_at = %s",
            (company_id, subject, ts(created)),
            "INSERT INTO relance_history (company_id, user_id, type_relance, channel, subject, note, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (company_id, user_id, type_relance, channel, subject, note, ts(created)),
        )
    print(f"[relance_history] {len(RELANCE_HISTORY)} relances OK")


def seed_company_history(conn):
    for company_id, column, status, previous, created in COMPANY_HISTORY:
        add_row_if_absent(
            conn, "company_history",
            "company_id = %s AND updated_column = %s AND updated_at = %s",
            (company_id, column, ts(created)),
            "INSERT INTO company_history (company_id, updated_at, updated_column, status, previous_status, modified_by, changes) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (company_id, ts(created), column, status, previous, 1,
             '[{"to": "%s", "from": "%s", "column": "%s"}]' % (status, previous or "", column)),
        )
    print(f"[company_history] {len(COMPANY_HISTORY)} modifications OK")


def seed_candidates(db):
    col = db["candidates"]
    for c in CANDIDATES:
        col.update_one(
            {"_id": c["_id"]},
            {"$setOnInsert": c},
            upsert=True,
        )
    print(f"[candidates] {len(CANDIDATES)} fiches OK")


def seed_candidate_history(db):
    col = db["candidate_history"]
    for cid, entries in CANDIDATE_HISTORY.items():
        for description, htype, created in entries:
            doc = {
                "_id": uuid4(),
                "candidate_id": CANDIDATE_IDS[cid],
                "type": htype,
                "description": description,
                "owner_email": "nicolas.gauthier@disciplina.fr",
                "created_at": iso(created),
            }
            col.update_one(
                {"candidate_id": doc["candidate_id"], "description": doc["description"], "created_at": doc["created_at"]},
                {"$setOnInsert": doc},
                upsert=True,
            )
    print(f"[candidate_history] {sum(len(v) for v in CANDIDATE_HISTORY.values())} événements OK")


def seed_needs_analysis(db):
    col = db["needs_analysis"]
    for ab_doc in AB_CATALOG:
        col.update_one({"_id": ab_doc["_id"]}, {"$setOnInsert": ab_doc}, upsert=True)
    print(f"[needs_analysis] {len(AB_CATALOG)} AB OK")


def seed_offers(db):
    col = db["offers"]
    for o in OFFERS:
        col.update_one({"_id": o["_id"]}, {"$setOnInsert": o}, upsert=True)
    print(f"[offers] {len(OFFERS)} offres OK")


def main():
    guard_local_target("Seed tenant annemasse")

    # Tenant annemasse : on force la base MySQL cible.
    os.environ["MYSQL_DATABASE"] = MYSQL_DB

    conn = get_mysql_connection()
    mongo_client = get_mongo_connection()
    db = mongo_client[MONGO_DB]

    seed_users(conn)
    seed_companies(conn)
    seed_blacklist(conn)
    seed_contact_logs(conn)
    seed_relance_history(conn)
    seed_company_history(conn)
    seed_candidates(db)
    seed_candidate_history(db)
    seed_needs_analysis(db)
    seed_offers(db)

    conn.close()
    mongo_client.close()
    print("Seed annemasse terminé (idempotent, sans purge).")


if __name__ == "__main__":
    main()