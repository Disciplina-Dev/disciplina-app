"""Pure helpers to map raw recrutment-<zone>-<theme>.csv rows into `jobs` documents.

Headers across the files are inconsistent (empty/duplicate/mislabelled), so
columns are addressed by position through a per-zone, per-theme FILE_CONFIG. One row
can yield several jobs: the Formation cell holds the desired TP and a value like
"NTC/REM" produces one job per TP (the collection stores a single `desired_tp` per
document).
"""

import os
import re

from lib.company_csv import clean_text, remove_accents

VALID_TP = {"AD", "CC", "NTC", "REM", "SA"}

# zone -> theme -> {field: column index}. `activite` and `exp` are optional per file.
FILE_CONFIG = {
    "nord": {
        "AD": {
            "sector": "NONE", "data_start": 2,
            "cols": {"tp": 0, "company": 1, "age": 2, "sex": 3, "permis": 4,
                     "exp": 5, "loc": 7, "envoyer": [9, 10]},
        },
        "commercial": {
            "sector": "COMMERCIAL", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
        "boulangerie": {
            "sector": "BOULANGERIE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [8, 9]},
        },
        "libre_service": {
            "sector": "LIBRE_SERVICE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
        "station": {
            "sector": "STATION", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "loc": 6, "envoyer": [7, 8]},
        },
        "vente": {
            "sector": "FROM_ACTIVITE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "activite": 8, "envoyer": [9, 10]},
        },
        "resto": {
            "sector": "RESTAURATION", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
    },
    "sud": {
        "AD": {
            "sector": "NONE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "loc": 6, "envoyer": [8, 9]},
        },
        "commercial": {
            "sector": "COMMERCIAL", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
        "boulangerie": {
            "sector": "BOULANGERIE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
        "libre_service": {
            "sector": "LIBRE_SERVICE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [11, 12]},
        },
        "station": {
            "sector": "STATION", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
        "vente": {
            "sector": "FROM_ACTIVITE", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "activite": 8, "envoyer": [9, 10]},
        },
        "resto": {
            "sector": "RESTAURATION", "data_start": 1,
            "cols": {"tp": 3, "company": 1, "age": 2, "sex": 4, "permis": 5,
                     "exp": 6, "loc": 7, "envoyer": [9, 10]},
        },
    },
}

SEX_MAP = {"mixte": "MIXTE", "garcon": "GARCON", "fille": "FILLE"}

LOCALISATION_KEYWORDS = [
    ("denis", "SAINT_DENIS"),
    ("clotilde", "SAINT_DENIS"),
    ("montagne", "SAINT_DENIS"),
    ("bellepierre", "SAINT_DENIS"),
    ("andre", "SAINT_ANDRE"),
    ("marie", "SAINTE_MARIE"),
    ("suzanne", "SAINTE_SUZANNE"),
    ("benoit", "SAINT_BENOIT"),
    ("paul", "SAINT_PAUL"),
    ("possession", "LA_POSSESSION"),
    ("port", "LE_PORT"),
    ("pierre", "SAINT_PIERRE"),
    ("tampon", "LE_TAMPON"),
    ("louis", "SAINT_LOUIS"),
    ("leu", "SAINT_LEU"),
]

SECTOR_KEYWORDS = [
    ("enfant", "ENFANT"),
    ("piece auto", "AUTO"),
    ("automobile", "AUTO"),
    ("auto", "AUTO"),
    ("moto", "AUTO"),
    ("scoot", "AUTO"),
    ("vehicule", "AUTO"),
    ("animal", "ANIMAUX"),
    ("capillaire", "COSMETIQUE"),
    ("coiffure", "COSMETIQUE"),
    ("beaute", "COSMETIQUE"),
    ("cosmet", "COSMETIQUE"),
    ("sport", "SPORT"),
    ("bijou", "BIJOUX"),
    ("pharma", "PHARMACIE"),
    ("immobil", "IMMOBILIER"),
    ("assurance", "ASSURANCE"),
    ("telephon", "TELEPHONIE"),
    ("deco", "BAZAR"),
    ("bazar", "BAZAR"),
    ("pap", "PAP"),
]


def zone_theme_from_path(path):
    name = os.path.basename(path)
    match = re.match(r"recrutment-(\w+)-(.+)\.csv$", name)
    if not match:
        return None, None
    zone, theme = match.group(1), match.group(2)
    if zone not in FILE_CONFIG or theme not in FILE_CONFIG[zone]:
        return None, None
    return zone, theme


def cell(values, index):
    return values[index] if index is not None and index < len(values) else ""


def split_tps(raw):
    tokens = re.split(r"[/\s]+", (raw or "").upper())
    seen = []
    for token in tokens:
        if token in VALID_TP and token not in seen:
            seen.append(token)
    return seen


def map_sex(raw):
    return SEX_MAP.get(remove_accents(clean_text(raw)).lower())


def map_driving_license(raw):
    return remove_accents(clean_text(raw)).lower() == "oui"


def map_experience(raw):
    return remove_accents(clean_text(raw)).lower() == "oui"


def map_localisations(raw):
    known, unknown = [], []
    for part in re.split(r"[-/]", raw or ""):
        normalized = remove_accents(clean_text(part)).lower()
        if not normalized:
            continue
        match = next((enum for keyword, enum in LOCALISATION_KEYWORDS if keyword in normalized), None)
        if match is None:
            unknown.append(clean_text(part))
        elif match not in known:
            known.append(match)
    return known, unknown


def map_sector(zone, theme, activite):
    config = FILE_CONFIG[zone][theme]["sector"]
    if config != "FROM_ACTIVITE":
        return config
    normalized = remove_accents(clean_text(activite)).lower()
    return next((enum for keyword, enum in SECTOR_KEYWORDS if keyword in normalized), "NONE")


def extract_candidate_names(*cells):
    fragments = []
    for raw in cells:
        for line in (raw or "").splitlines():
            for fragment in line.split("/"):
                cleaned = clean_text(re.sub(r"\([^)]*\)", "", fragment))
                if cleaned:
                    fragments.append(cleaned)
    return fragments


def build_jobs(zone, theme, values):
    """Return (jobs, candidate_names, unknown_localisations) for one CSV row.

    `jobs` is one dict per valid TP; candidate names and unknown localisations are
    shared across those jobs and surfaced for the import report.
    """
    cols = FILE_CONFIG[zone][theme]["cols"]
    tps = split_tps(cell(values, cols["tp"]))
    localisations, unknown_loc = map_localisations(cell(values, cols["loc"]))
    names = extract_candidate_names(*(cell(values, i) for i in cols["envoyer"]))
    base = {
        "zone": zone,
        "company_name": clean_text(cell(values, cols["company"])),
        "age_range": clean_text(cell(values, cols["age"])),
        "desired_sex": map_sex(cell(values, cols["sex"])),
        "driving_license_b": map_driving_license(cell(values, cols["permis"])),
        "professional_experience": map_experience(cell(values, cols.get("exp"))),
        "localisation": localisations,
        "sector": map_sector(zone, theme, cell(values, cols.get("activite"))),
    }
    jobs = [dict(base, desired_tp=tp) for tp in tps]
    return jobs, names, unknown_loc
