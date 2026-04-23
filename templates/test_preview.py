#!/usr/bin/env python3
"""Génère un PDF de prévisualisation à partir du template proposé avec des données de test."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

template_dir = os.path.dirname(os.path.abspath(__file__))
env = Environment(loader=FileSystemLoader(template_dir))
template = env.get_template('ab_template_proposed.html')

data = {
    "raison_sociale": "Tech Innovators Réunion",
    "siret": "12345678901234",
    "adresse_siege": "12 rue de l'Innovation",
    "code_postal": "97400",
    "commune": "Saint-Denis",
    "rl_nom": "Jean Dupont",
    "rl_fonction": "Gérant",
    "rl_telephone": "0692 12 34 56",
    "rl_email": "jean.dupont@techinnovators.re",
    "rr_same_as_rl": False,
    "rr_nom": "Marie Durand",
    "rr_fonction": "DRH",
    "rr_telephone": "0692 98 76 54",
    "rr_email": "marie.durand@techinnovators.re",
    "presentation_activite": "Entreprise spécialisée dans le commerce et les nouvelles technologies, proposant des solutions innovantes aux entreprises de La Réunion.",
    "nb_postes": 2,
    "localisation_poste": "Saint-Denis",
    "domaine": "Vente",
    "intitule_poste": "Conseiller Commercial",
    "missions": [
        "Accueil physique, téléphonique et digital",
        "Identifier les besoins du client par un questionnement adapté",
        "Présenter et mettre en valeur les produits ou services",
        "Conseiller le client et proposer des solutions adaptées",
        "Argumenter et répondre aux objections du client",
        "Réaliser des ventes et conclure les transactions",
    ],
    "autres_missions": "Participation active aux réunions commerciales hebdomadaires.",
    "profils_recherches": "Nous recherchons un étudiant passionné et rigoureux, avec un bon sens du contact client.",
    "competences": "Bon relationnel, gestion du stress, esprit d'analyse, maîtrise des outils bureautiques.",
    "commentaires": "Avantages : Tickets Restaurant, mutuelle d'entreprise.",
    "niveau_formation": "Niveau Bac+3",
    "permis": "Optionnel",
    "experience": "Débutant",
    "age_exige": "21 à 25 ans",
    "methode_recrutement": "Présélection des CV par le centre de formation",
    "pmsmp": "Oui",
    "jours_formation": {
        "Lundi": "Oui",
        "Mardi": "Oui",
        "Mercredi": "Préféré",
        "Jeudi": "Non",
        "Vendredi": "Non",
    },
    "fait_a": "Saint-Denis",
    "fait_le": "22/04/2026",
}

html_content = template.render(**data)
output_path = os.path.join(template_dir, 'preview_proposed.pdf')
HTML(string=html_content, base_url=template_dir).write_pdf(output_path)
print(f"PDF généré : {output_path}")
