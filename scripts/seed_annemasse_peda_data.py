#!/usr/bin/env python3
"""Seed de données fictives de l'espace pédagogique (tenant « annemasse »).

Sert à tester les outils MCP péda (`list_alternants`, `list_ruptures`,
`rupture_stats`, `list_sequences_overdue`, …) et leurs garde-fous RGPD :
    - alternants liés à un candidat consentant (visibles) ;
    - 1 alternant lié à un candidat SANS `ai_processing` (masqué) ;
    - 1 alternant sans `candidate_id` (invisible) ;
    - groupes ≥ 5 et < 5 (seuil de k-anonymat) ;
    - SA en retard / à venir calculées relativement à la date du jour.

Contrat d'exécution (idem seed_annemasse_test_data.py) :
    - idempotent sans purge : upsert par id déterministe (rejouer resynchronise les docs
      du seed, y compris les dates relatives d'aujourd'hui) ;
    - cible uniquement la base locale `disciplina_annemasse`
      (`db/guard.guard_local_target`) ;
    - 100 % fictif : noms/emails générés, domaine `example.test`.

Usage:
    python seed_annemasse_peda_data.py
"""

import uuid
from datetime import datetime, timedelta

from dotenv import load_dotenv

from db.guard import guard_local_target
from db.mongo import get_mongo_connection

load_dotenv()

MONGO_DB = "disciplina_annemasse"
NS = uuid.UUID("5e5a0000-0000-4000-8000-00000000d15c")

SESSIONS = {
    "a": {"id": str(uuid.uuid5(NS, "session-a")), "nom": "BTS MCO 2025-2027", "filiere": "BTS MCO",
          "jour_cours": "Lundi", "debut": datetime(2025, 9, 1), "fin": datetime(2027, 6, 30)},
    "b": {"id": str(uuid.uuid5(NS, "session-b")), "nom": "NDRC 2026-2028", "filiere": "BTS NDRC",
          "jour_cours": "Jeudi", "debut": datetime(2026, 9, 1), "fin": datetime(2028, 6, 30)},
}

FIRST = ["Camille", "Hugo", "Manon", "Jules", "Alice", "Louis", "Jade", "Adam", "Zoé", "Gabin", "Lina",
         "Tom", "Mila", "Enzo", "Clara", "Nolan", "Anaïs", "Ruben", "Elsa", "Yanis", "Maëlle", "Axel"]
LAST = ["Durand", "Martin", "Petit", "Roux", "Blanc", "Garnier", "Faure", "Girard", "Andre", "Lefort",
        "Mercier", "Dupuis", "Lambert", "Fontaine", "Chevalier", "Robin", "Masson", "Henry", "Perret",
        "Vidal", "Colin", "Giraud"]
COMPANIES = ["Boulangerie Fictive Alpes", "Optique Démo Léman", "Parfumerie Test Salève",
             "Garage Exemple Arve", "Boucherie Modèle Mont-Blanc", "Librairie Factice Genevois"]

# Index → session ("a" ×14, "b" ×4, puis cas particuliers).
SESSION_OF = {i: "a" for i in range(14)} | {i: "b" for i in range(14, 18)} | {18: "a", 19: "b", 20: "a", 21: "a"}
NO_CONSENT = 18  # candidat sans ai_processing
UNLINKED = 19  # pas de candidate_id
# Ruptures : index → (date, motif, détail libre, poursuite de formation). Motifs = RUPTURE_MOTIFS[n].
MOTIFS = {
    "essai": "Rupture pendant les 45 premiers jours en emploi, consécutifs ou non, de l'apprenti, par ce dernier ou l'employeur (art. L. 6222-18)",
    "accord": "Rupture d'un commun accord entre l'apprenti et l'employeur — aucune faute ne peut motiver un tel accord (art. L. 6222-18)",
    "faute": "Rupture en cas de faute grave ou de manquements répétés à ses obligations, de la part de l'employeur ou de l'apprenti — résiliation prononcée par le Conseil des Prud'hommes ou le juge d'instance (art. L. 6222-18)",
    "inaptitude": "Rupture en cas d'inaptitude de l'apprenti à exercer le métier auquel il voulait se préparer, prononcée par le Conseil des Prud'hommes (art. L. 6222-18)",
    "diplome": "Rupture en cas d'obtention du diplôme ou du titre de l'enseignement technologique préparé par l'apprenti — le contrat peut prendre fin de plein droit à l'initiative de l'apprenti (art. L. 6222-19)",
}
RUPTURES = {
    **{i: (datetime(2026, 2 + i, 10), "accord", "FICTIF — détail libre à ne jamais exposer", True) for i in range(6)},
    6: (datetime(2026, 3, 3), "essai", "FICTIF — période d'essai", False),
    7: (datetime(2026, 5, 20), "faute", "FICTIF — litige employeur", False),
    17: (datetime(2026, 9, 25), "essai", "FICTIF — rupture NDRC", False),
    20: (datetime(2026, 6, 15), "inaptitude", "FICTIF — avis médical (donnée de santé)", False),
    21: (datetime(2026, 7, 1), "diplome", "FICTIF — diplôme obtenu", True),
}
# Comme l'app (RuptureService.syncArchiveStatus) : archivé seulement si l'apprenti quitte la formation.
ARCHIVED = {i for i, r in RUPTURES.items() if not r[3]}
# Contrat terminé dans le passé sans rupture (index → date de fin). Ses SA postérieures restent seedées :
# le MCP doit les exclure des SA en retard / à venir.
CONTRACT_ENDED = {12: datetime(2026, 8, 31)}
# SA n°1 non réalisée (statut not_done), pour couvrir ce statut.
NOT_DONE_SA1 = {2, 3}


def uid(kind, i):
    return str(uuid.uuid5(NS, f"{kind}-{i}"))


def candidate_doc(i, now):
    consent = i != NO_CONSENT
    return {
        "_id": uid("cand", i),
        "candidate_id": uid("cand", i),
        "identity": {"full_name": f"{FIRST[i]} {LAST[i]}", "email": f"{FIRST[i].lower()}.{LAST[i].lower()}@example.test", "phone": f"06000000{i:02d}"},
        "consentments": {
            "data_processing": True, "data_sharing": True, "ai_processing": consent, "photo_processing": False,
            "consent_date": now.isoformat() + "Z", "consent_version": "2026-v1",
        },
        "status": "CONTRACT",
    }


def alternant_doc(i, now):
    sess = SESSIONS[SESSION_OF[i]]
    return {
        "_id": uid("alt", i),
        "first_name": FIRST[i],
        "last_name": LAST[i],
        "session": sess["nom"],
        "session_id": sess["id"],
        "email": f"{FIRST[i].lower()}.{LAST[i].lower()}@example.test",
        "phone": f"06000000{i:02d}",
        "candidate_id": None if i == UNLINKED else uid("cand", i),
        "company": {
            "name": COMPANIES[i % len(COMPANIES)],
            "address": "1 rue de l'Exemple, 74100 Annemasse",
            "mentor_name": f"Tuteur Fictif {i}",
            "start_date": sess["debut"],
            # Rupture « quitte la formation » ou contrat échu : fin de contrat renseignée.
            "end_date": RUPTURES[i][0] if i in ARCHIVED else CONTRACT_ENDED.get(i),
        },
        "linked_alternant_ids": [],
        "archived_at": RUPTURES[i][0] if i in ARCHIVED else None,
        "created_at": now,
        "updated_at": now,
    }


def sequence_docs(i, now, today):
    """3 SA : 1 réalisée, 2 en retard (i pair) ou à venir (i impair), 3 lointaine."""
    if i in ARCHIVED:
        return []
    start = SESSIONS[SESSION_OF[i]]["debut"]
    # SA 1 : ~15 j après le début de contrat (jamais avant), sinon J-90 ; réalisée ou non selon l'index.
    first = max(today - timedelta(days=90), start + timedelta(days=15))
    first_status = "not_done" if i in NOT_DONE_SA1 else "done"
    first_done = None if i in NOT_DONE_SA1 else first + timedelta(days=2)
    second = today - timedelta(days=5 + i % 20) if i % 2 == 0 else today + timedelta(days=3 + i % 10)
    second = max(second, first + timedelta(days=60))  # périodicité ~ trimestrielle, même pour un contrat récent
    plan = [
        (1, first, first_status, first_done, first_status == "done"),
        (2, second, "pending", None, i % 3 == 0),
        (3, today + timedelta(days=75), "pending", None, False),
    ]
    return [{
        "_id": uid("seq", f"{i}-{n}"),
        "alternant_id": uid("alt", i),
        "numero": n,
        "prevue_le": prevue,
        "status": status,
        "realisee_le": done,
        "contacts": {"mentor": c, "alternant": c, "formateur": c},
        "auto_generated": True,
        "soon_notified_at": None,
        "late_notified_at": None,
        "archived_at": None,
        "created_at": now,
        "updated_at": now,
    } for n, prevue, status, done, c in plan]


def upsert(col, doc):
    col.replace_one({"_id": doc["_id"]}, doc, upsert=True)


def main():
    guard_local_target("Seed péda annemasse")
    client = get_mongo_connection()
    db = client[MONGO_DB]
    now = datetime.utcnow()
    today = datetime(now.year, now.month, now.day)

    for s in SESSIONS.values():
        upsert(db["sessions"], {"_id": s["id"], "nom": s["nom"], "filiere": s["filiere"], "jour_cours": s["jour_cours"],
                                "date_debut": s["debut"], "date_fin": s["fin"], "created_at": now, "updated_at": now})
    # Archivés : pas de SA (purge d'éventuelles SA d'un run précédent, ids du seed uniquement).
    db["alternant_sequences"].delete_many({"alternant_id": {"$in": [uid("alt", i) for i in ARCHIVED]}})
    for i in SESSION_OF:
        if i != UNLINKED:
            upsert(db["candidates"], candidate_doc(i, now))
        upsert(db["alternants"], alternant_doc(i, now))
        for seq in sequence_docs(i, now, today):
            upsert(db["alternant_sequences"], seq)
    for i, (date, motif, detail, poursuit) in RUPTURES.items():
        a = alternant_doc(i, now)
        upsert(db["ruptures"], {"_id": uid("rup", i), "alternant_id": a["_id"], "date_rupture": date,
                                "entreprise": a["company"]["name"], "motif": MOTIFS[motif], "detail": detail,
                                "poursuit_formation": poursuit, "created_at": now, "updated_at": now})
    client.close()
    print(f"Seed péda annemasse terminé : {len(SESSIONS)} sessions, {len(SESSION_OF)} alternants (idempotent, sans purge).")


if __name__ == "__main__":
    main()
