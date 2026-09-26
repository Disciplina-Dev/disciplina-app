"""Pure helpers to map raw candidat-*.csv rows into `candidates` documents.

The 23 recruitment files come from as many hand-maintained spreadsheets: headers
are spelled three different ways for the same field (AGE / ÂGE / Âge), sector
columns sit at different indexes, and the TP is sometimes carried by the file and
sometimes by the row. Columns are therefore resolved by **header alias**, not by
position, so a shifted column costs nothing. The two files whose header is
unusable (no header at all, or truncated to four cells) fall back to an explicit
positional map.
"""

import csv
import re
from datetime import datetime

from lib.company_csv import remove_accents

# -- Enums ------------------------------------------------------------------------

TP_ENUM = ("AD", "CC", "NTC", "REM", "SA")
DEFAULT_TP = "CC"

TRAINING_SITES = {
    "nord": "NORD_SAINTE_MARIE",
    "ouest": "OUEST_SAINT_PAUL",
    "sud": "SUD_SAINT_PIERRE",
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

LOCALISATION_ALIASES = {"SAINT_ANNE": "SAINTE_ANNE"}

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

FRENCH_MONTHS = {
    "JANVIER": 1, "FEVRIER": 2, "MARS": 3, "AVRIL": 4, "MAI": 5, "JUIN": 6,
    "JUILLET": 7, "AOUT": 8, "SEPTEMBRE": 9, "OCTOBRE": 10, "NOVEMBRE": 11,
    "DECEMBRE": 12,
}

# Statut le plus avancé = le plus fort. Sert à ne jamais faire régresser un
# candidat déjà en base lorsqu'un fichier plus pauvre le mentionne à nouveau.
STATUS_RANK = {
    "TEST_FAILED": 0, "BANNED": 0, "NOT_SEEKING": 1, "SEEKING": 2,
    "UNAVAILABLE": 3, "CANCELLED": 4, "MATCHED": 5, "IMMERSING": 6, "CONTRACT": 7,
}

# -- Alias d'en-têtes -------------------------------------------------------------

# Un champ est résolu par le premier alias trouvé dans l'en-tête, comparé sans
# accent, sans casse et espaces normalisés.
FIELD_ALIASES = {
    "name": ("NOM - PRENOM", "NOM PRENOM", "NOM / PRENOM", "NOM", "PRENOM NOM"),
    "sex": ("GENRE",),
    "email": ("ADRESSE MAIL", "MAIL", "EMAIL", "E-MAIL"),
    "phone": ("TELEPHONE", "TEL", "PORTABLE"),
    "age": ("AGE",),
    "city": ("VILLE",),
    "mobility": ("SECTEUR GEOGRAPHIQUE", "SECTEUR", "SAINT PAUL"),
    "formation": ("FORMATION", "FORMATIONS"),
    "licence": ("PERMIS",),
    "vehicle": ("VEHICULE",),
    "speciality": ("SPECIALITE",),
    "availability": ("DISPONIBILITE",),
    "interview_date": ("DATE 1ER ENTRETIEN", "DATE ENTRETIEN", "DATE D'ENTRETIEN", "DATE"),
    "birth_date": ("DATE DE NAISSANCE",),
    "description": ("DESCRIPTION", "DESCRIPTIF", "INFOS COMPLEMENTAIRES", "COMMENTAIRE"),
    "salon": ("CANDIDATS SALON NORDEV", "CANDIDATS HALLE MANIF"),
    "mission_locale": ("CANDIDATS MISSION LOCALE", "CANDIDATS MISSION LOCAL"),
    "orientation": ("A ORIENTER VERS",),
}

# Les colonnes de secteurs souhaités : réunion des trois listes historiquement
# positionnelles (vente nord / ouest / sud), désormais reconnues par en-tête.
SECTOR_VOCAB = {
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "COMMERCIAL TERRAIN", "BIJOUX",
    "COSMETIQUE", "COSMETIQUE PARFUMERIE", "IMMOBILIER", "ASSURANCE",
    "ANIMAUX", "SPORT", "ENFANTS", "ENFANT", "PHARMACIE", "BAZAR",
    "JARDINNERIE / ESPACES VERTS",
}

# Un en-tête de secteur ne doit pas être capté comme champ : "COMMERCIAL" est un
# secteur, pas une donnée de mobilité.
MOBILITY_EXCLUDE = SECTOR_VOCAB

# `job_info.discovery_source` (validateur Mongo). Déduit des colonnes de
# provenance quand elles sont cochées.
SOURCE_SALON = "SALON"
SOURCE_MISSION_LOCALE = "MISSION_LOCALE"
ORIENTATION_SOURCES = {
    "MIO": "MISSION_LOCALE", "ML": "MISSION_LOCALE", "MISSION LOCALE": "MISSION_LOCALE",
    "FT": "FRANCE_TRAVAIL", "POLE EMPLOI": "FRANCE_TRAVAIL",
    "E2C": "E2CR", "E2CR": "E2CR", "RSMA": "RSMA",
}

# -- Normalisation ---------------------------------------------------------------


def norm_header(cell):
    """Uppercase, accent-free, whitespace-collapsed header, ready for alias lookup."""
    return re.sub(r"\s+", " ", remove_accents(cell or "").upper()).strip()


def clean_cell(value):
    """Trim including the non-breaking spaces the spreadsheets are full of."""
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def normalize_city(city):
    return remove_accents(clean_cell(city).upper().replace("-", "_").replace(" ", "_"))


def normalize_token(value):
    cleaned = remove_accents(value or "").upper().replace('"', " ").replace("'", " ").replace("-", " ")
    return "_".join(cleaned.split())


def normalize_loc_part(part):
    s = remove_accents(clean_cell(part)).upper()
    if s.startswith("STE "):
        s = "SAINTE_" + s[4:]
    elif s.startswith("ST "):
        s = "SAINT_" + s[3:]
    return s.replace(" ", "_")


def clean_name(raw):
    """Strip the free-text noise glued to names in the archive files.

    'MEGARUS Josué (actuellement au RSMA) - aime beaucoup automobile' -> 'MEGARUS Josué'
    """
    name = clean_cell(raw)
    name = re.sub(r"\([^)]*\)", " ", name)
    name = re.split(r"\s+-\s+", name)[0]
    return re.sub(r"\s+", " ", name).strip()


def parse_fr_date(value):
    """Parse a French date; accepts 2-digit years ('30/04/26' exists in sud-REM)."""
    value = clean_cell(value)
    if not value:
        return None
    # Les cellules mêlent parfois date et commentaire ("07/08/2025  2ème entretien").
    match = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b", value)
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    if year < 100:
        year += 2000
    try:
        return datetime(year, month, day)
    except ValueError:
        return None


def parse_age(value):
    """'25 ans ' -> 25, '' -> 0."""
    match = re.search(r"\d{1,2}", clean_cell(value))
    return int(match.group(0)) if match else 0


def birth_date_from_age(age, reference_year):
    """Approximate birth date from an age captured on `reference_year`."""
    return datetime(reference_year - age, 1, 1) if age else None


EMAIL_RE = re.compile(r"[^@\s,;]+@[^@\s,;]+\.[A-Za-z]{2,}")


def parse_email(value):
    """Keep the cell only if it really holds an address.

    Some rows are shifted, so the mail column can hold a city name. Storing that
    would be worse than storing nothing: e-mail is the deduplication key, and two
    rows sharing the same junk value would collapse into one candidate.
    """
    match = EMAIL_RE.search(clean_cell(value))
    return match.group(0).lower() if match else ""


def is_yes(value):
    return clean_cell(value).upper().startswith("OUI")


def is_checked(value):
    """Provenance columns are ticked with an 'X' as often as with 'Oui'."""
    return clean_cell(value).upper() in {"X", "OUI", "O", "1"}


# -- Champs dérivés ---------------------------------------------------------------


def parse_formation(raw, default_tp=DEFAULT_TP):
    """Return (tp_type, tp_types, formation_type) from a free-text formation cell.

    Handles the promo codes of the contract file ('CC6' -> CC), the multi-TP
    notations of the salon files ('AD/NTC', 'AD et SA', 'TOUTES FORMATIONS') and
    the empty cells, which keep the file default.
    """
    text = remove_accents(clean_cell(raw)).upper()
    if "TOUTE" in text:
        found = ["AD", "CC", "NTC", "REM"]
    else:
        found = []
        for token in re.split(r"[/,;+&]|\bET\b|\s+", text):
            tp = re.sub(r"[^A-Z]", "", token)
            if tp in TP_ENUM and tp not in found:
                found.append(tp)
    if not found:
        found = [default_tp]
    formation_type = "SECRETARIAT" if found[0] == "AD" else "VENTE"
    return found[0], found, formation_type


def parse_mobility(raw):
    result = []
    for part in (raw or "").split(","):
        norm = normalize_loc_part(part)
        norm = LOCALISATION_ALIASES.get(norm, norm)
        if norm in LOCALISATION_ENUM and norm not in result:
            result.append(norm)
    return result


def parse_expected_skills(raw):
    skills = []
    for part in (raw or "").split(","):
        token = normalize_token(part)
        if token and token != "PAS_D_EXPERIENCE" and token not in skills:
            skills.append(token)
    return skills


def parse_availability(dispo, interview_date):
    """Return (status, availability_date) from a free-text availability cell."""
    value = clean_cell(dispo)
    if not value or normalize_token(value) == "DISPONIBLE":
        return "SEEKING", None
    month = next((m for name, m in FRENCH_MONTHS.items() if name in normalize_token(value)), None)
    if not month:
        return "UNAVAILABLE", None
    base = interview_date or datetime(2026, 1, 1)
    year = base.year + 1 if month < base.month else base.year
    return "UNAVAILABLE", datetime(year, month, 1)


def parse_discovery_source(values, config):
    """Provenance: explicit config first, then the per-row provenance columns."""
    if is_checked(values.get("salon")):
        return SOURCE_SALON
    if is_checked(values.get("mission_locale")):
        return SOURCE_MISSION_LOCALE
    orientation = remove_accents(clean_cell(values.get("orientation"))).upper()
    if orientation:
        for key, source in ORIENTATION_SOURCES.items():
            if key in orientation:
                return source
    return config.get("discovery_source")


# -- Résolution des colonnes ------------------------------------------------------


def _column_values(rows, index):
    return [clean_cell(row[index]) for row in rows if index < len(row) and clean_cell(row[index])]


def _detect_by_content(rows, width, taken, predicate, threshold=0.8):
    """Index of the first unassigned column whose filled cells mostly satisfy `predicate`."""
    for index in range(width):
        if index in taken:
            continue
        values = _column_values(rows, index)
        if len(values) < 2:
            continue
        if sum(1 for value in values if predicate(value)) / len(values) >= threshold:
            return index
    return None


def resolve_columns(header, rows):
    """Map each known field to its column index, by header alias then by content.

    The earliest alias wins, so 'SECTEUR GEOGRAPHIQUE' is never captured by
    'SECTEUR'. Three fields survive a blank or garbage header and are recovered
    from the cell values instead: the genre column, the per-row TP column (blank
    header in candidat-nord-vente.csv) and the description column (header
    overwritten by a stray sentence in candidat-nord-vente-archives.csv).
    """
    normalized = [norm_header(cell) for cell in header]
    width = max([len(header)] + [len(row) for row in rows]) if rows else len(header)
    columns = {}
    sectors = {}

    for index, cell in enumerate(normalized):
        if cell in SECTOR_VOCAB:
            sectors.setdefault(cell.replace(" ", "_").replace("/", "_"), index)

    for field, aliases in FIELD_ALIASES.items():
        best = None
        for index, cell in enumerate(normalized):
            if index in sectors.values():
                continue
            for rank, alias in enumerate(aliases):
                if alias in cell and (best is None or rank < best[0]):
                    best = (rank, index)
        if best is not None:
            columns[field] = best[1]

    # TP porté par la ligne : l'en-tête vaut littéralement CC / NTC / REM / AD.
    for index, cell in enumerate(normalized):
        if cell in TP_ENUM:
            columns.setdefault("formation", index)
            break

    if "name" not in columns and normalized and not normalized[0]:
        columns["name"] = 0

    taken = set(columns.values()) | set(sectors.values())
    if "sex" not in columns:
        index = _detect_by_content(
            rows, width, taken, lambda v: normalize_token(v) in ("GARCON", "FILLE")
        )
        if index is not None:
            columns["sex"] = index
            taken.add(index)
    if "formation" not in columns:
        index = _detect_by_content(
            rows, width, taken, lambda v: remove_accents(v).upper() in TP_ENUM
        )
        if index is not None:
            columns["formation"] = index
            taken.add(index)
    if "age" not in columns:
        index = _detect_by_content(rows, width, taken, lambda v: re.fullmatch(r"\d{1,2}( ans)?", v))
        if index is not None:
            columns["age"] = index
            taken.add(index)
    if "mobility" not in columns:
        index = _detect_by_content(rows, width, taken, lambda v: bool(parse_mobility(v)), 0.6)
        if index is not None:
            columns["mobility"] = index
            taken.add(index)
    if "description" not in columns:
        index = _detect_by_content(rows, width, taken, lambda v: len(v) > 60, threshold=0.5)
        if index is not None:
            columns["description"] = index

    columns["_sectors"] = sectors
    return columns


# Fichiers dont l'en-tête est inexploitable : `sud-vente-archives` (en-tête
# tronqué à 4 cellules pour 30 colonnes de données) et `ouest-vente-archives`
# (aucun en-tête, la ligne 0 est une donnée, le TP est en colonne 0).
# Ces deux fichiers n'ayant pas d'en-tête, l'ordre des colonnes de secteurs est
# celui des fichiers vente de la même zone (seul ordre observable).
_SUD_SECTORS = (
    "BOULANGERIE", "RESTAURATION", "STATION", "PAP", "LIBRE_SERVICE",
    "TELEPHONIE", "AUTO", "COMMERCIAL", "COMMERCIAL_TERRAIN",
    "COSMETIQUE_PARFUMERIE", "JARDINNERIE___ESPACES_VERTS", "IMMOBILIER",
    "ASSURANCE", "ANIMAUX", "SPORT", "BAZAR",
)
_OUEST_SECTORS = _SUD_SECTORS + ("ENFANT",)

POSITIONAL_MAPS = {
    "candidat-sud-vente-archives.csv": {
        "sex": 0, "name": 1, "interview_date": 3, "city": 6, "email": 7,
        "phone": 8, "age": 9, "mobility": 10, "formation": 11, "licence": 12,
        "availability": 29, "description": 30,
        "_sectors": {name: 13 + offset for offset, name in enumerate(_SUD_SECTORS)},
    },
    "candidat-ouest-vente-archives.csv": {
        "formation": 0, "sex": 1, "name": 2, "interview_date": 4, "city": 7,
        "email": 8, "phone": 9, "age": 10, "mobility": 11, "licence": 13,
        "availability": 31, "description": 32,
        "_sectors": {name: 14 + offset for offset, name in enumerate(_OUEST_SECTORS)},
    },
}

def read_rows(path, config):
    """Return (columns, data rows) for one candidate CSV.

    Empty lines are dropped, the header line is consumed unless the file has none
    (`no_header`), and files listed in POSITIONAL_MAPS bypass alias resolution.
    """
    with open(path, "r", encoding="utf-8", newline="") as handle:
        all_rows = [row for row in csv.reader(handle) if any(clean_cell(c) for c in row)]
    if not all_rows:
        return {}, []

    if config.get("no_header"):
        header, rows = [], all_rows
    else:
        header, rows = all_rows[0], all_rows[1:]

    columns = POSITIONAL_MAPS.get(config["filename"])
    return (dict(columns) if columns else resolve_columns(header, rows)), rows


# -- Construction du document -----------------------------------------------------


def cell(row, columns, field):
    index = columns.get(field)
    if index is None or index >= len(row):
        return ""
    return clean_cell(row[index])


def read_values(row, columns):
    return {field: cell(row, columns, field) for field in FIELD_ALIASES}


def build_candidate(row, columns, config, run_date):
    """Build a candidate document from one CSV row, or None if unusable.

    `run_date` is the insertion date: it dates the document when the file carries
    no business date, and it is the reference year for ages (the previous code
    hardcoded 2026).
    """
    values = read_values(row, columns)
    full_name = clean_name(values["name"])
    if not full_name or not re.search(r"[A-Za-z]", full_name):
        return None

    interview_date = parse_fr_date(values["interview_date"])
    # Une date d'entretien future (typo d'année dans la source) fausserait le tri
    # « plus récent d'abord » : on ne date jamais une fiche dans le futur.
    inserted_at = interview_date if interview_date and interview_date <= run_date else run_date
    age = parse_age(values["age"])
    city = normalize_city(values["city"])
    _tp_type, tp_types, formation_type = parse_formation(
        values["formation"], config.get("tp_default", DEFAULT_TP)
    )

    status, availability_date = parse_availability(values["availability"], interview_date)
    if config.get("status"):
        status = config["status"]

    identity = {
        "sex": "GARCON" if normalize_token(values["sex"]) == "GARCON" else "FILLE",
        "full_name": full_name,
        "city": city,
        "age": age,
        "postal_code": POSTAL_CODE_MAP.get(city, "974"),
        "phone": values["phone"].replace(" ", ""),
        "email": parse_email(values["email"]),
        "driving_license_b": is_yes(values["licence"]),
        "has_vehicle": is_yes(values["vehicle"]),
        "description": values["description"],
    }
    birth_date = parse_fr_date(values["birth_date"]) or birth_date_from_age(age, inserted_at.year)
    if birth_date:
        identity["date_of_birth"] = birth_date

    job_info = {"geographic_mobility": parse_mobility(values["mobility"])}
    if availability_date:
        job_info["availability_date"] = availability_date
    discovery_source = parse_discovery_source(values, config)
    if discovery_source:
        job_info["discovery_source"] = discovery_source

    sectors = [
        name for name, index in columns.get("_sectors", {}).items()
        if index < len(row) and is_yes(row[index])
    ]

    return {
        "training_site": config["training_site"],
        "training_sites": [config["training_site"]],
        "formation_type": formation_type,
        "tp_types": tp_types,
        "status": status,
        "identity": identity,
        "job_info": job_info,
        "desired_sectors": sectors,
        "expected_company_skills": parse_expected_skills(values["speciality"]),
        "created_at": inserted_at,
    }


# -- Fichier contrats -------------------------------------------------------------

CONTRACT_COLUMNS = {
    "name": 0, "formation": 1, "company": 2, "position": 3, "project": 4,
    "interview_date": 5, "company_interview": 6, "immersion": 7, "follow_up": 8,
}


def build_contract_candidate(row, config, run_date):
    """Build a candidate from candidat-nord-contrat.csv.

    That file only holds a name, a promo code ('CC6'), the company, the job title
    and follow-up dates — no email, phone, city or age. Email and phone are
    required by the Mongo validator, hence the empty strings.
    """
    def contract_cell(field):
        index = CONTRACT_COLUMNS[field]
        return clean_cell(row[index]) if index < len(row) else ""

    full_name = clean_name(contract_cell("name"))
    if not full_name or not re.search(r"[A-Za-z]", full_name):
        return None

    _tp_type, tp_types, formation_type = parse_formation(contract_cell("formation"))
    entry_date = parse_fr_date(contract_cell("interview_date"))
    inserted_at = entry_date if entry_date and entry_date <= run_date else run_date

    company = contract_cell("company")
    position = contract_cell("position")
    description = " | ".join(
        part for part in (
            f"Contrat : {company}" if company else "",
            f"Poste : {position}" if position else "",
            f"Projet emploi : {contract_cell('project')}" if contract_cell("project") else "",
            f"Suivi : {contract_cell('follow_up')}" if contract_cell("follow_up") else "",
        ) if part
    )

    document = {
        "training_site": config["training_site"],
        "training_sites": [config["training_site"]],
        "formation_type": formation_type,
        "tp_types": tp_types,
        "status": config["status"],
        "identity": {
            "full_name": full_name,
            "email": "",
            "phone": "",
            "description": description,
        },
        "created_at": inserted_at,
    }
    if company or position:
        experience = {}
        if company:
            experience["company"] = company
            document["_company_name"] = company
        if position:
            experience["position"] = position
        document["background"] = {"professional_experiences": [experience]}
    return document


# -- Registre des fichiers --------------------------------------------------------

# `priority` : les fiches riches d'abord, pour que les lignes pauvres (salons,
# contrats) enrichissent un document complet au lieu de le créer à moitié vide.
def _entry(filename, sector, tp_default=DEFAULT_TP, **extra):
    entry = {
        "filename": filename,
        "training_site": TRAINING_SITES[sector],
        "sector": sector,
        "tp_default": tp_default,
        "priority": 0,
    }
    entry.update(extra)
    return entry


CANDIDATE_FILES = [
    # Fiches complètes issues du recrutement courant.
    _entry("candidat-nord-vente.csv", "nord"),
    _entry("candidat-nord-secretariat.csv", "nord", "AD"),
    _entry("candidat-ouest-vente-CC.csv", "ouest", "CC"),
    _entry("candidat-ouest-vente-NTC.csv", "ouest", "NTC"),
    _entry("candidat-ouest-vente-REM.csv", "ouest", "REM"),
    _entry("candidat-ouest-vente-mixte.csv", "ouest"),
    _entry("candidat-ouest-secretariat-AD.csv", "ouest", "AD"),
    _entry("candidat-sud-vente-CC.csv", "sud", "CC"),
    _entry("candidat-sud-vente-NTC.csv", "sud", "NTC"),
    _entry("candidat-sud-vente-REM.csv", "sud", "REM"),
    _entry("candidat-sud-secretariat-AD.csv", "sud", "AD"),
    _entry("candidat-ouest-vente-rqth.csv", "ouest"),
    # Archives : le nord est demandé en rupture (CANCELLED), l'ouest et le sud
    # restent des candidats à traiter.
    _entry("candidat-nord-vente-archives.csv", "nord", priority=1, status="CANCELLED"),
    _entry("candidat-ouest-vente-archives.csv", "ouest", priority=1, no_header=True),
    _entry("candidat-sud-vente-archives.csv", "sud", priority=1),
    # Mineurs : indisponibles jusqu'à leur majorité.
    _entry("candidat-ouest-vente-mineurs.csv", "ouest", priority=1, status="UNAVAILABLE"),
    # Salons : fiches pauvres, importées après les fiches complètes.
    _entry("candidat-nord-salon-02_26.csv", "nord", priority=2, discovery_source=SOURCE_SALON),
    _entry("candidat-nord-salon-03_26.csv", "nord", priority=2, discovery_source=SOURCE_SALON),
    _entry("candidat-nord-salon-06_26.csv", "nord", priority=2, discovery_source=SOURCE_SALON),
    _entry("candidat-ouest-salon-nordev.csv", "ouest", priority=2, discovery_source=SOURCE_SALON),
    _entry("candidat-ouest-salon-halle_manif.csv", "ouest", priority=2, discovery_source=SOURCE_SALON),
    _entry("candidat-sud-salon-nordev.csv", "sud", priority=2, discovery_source=SOURCE_SALON),
    # Contrats : format à part, en dernier (statut le plus avancé).
    _entry("candidat-nord-contrat.csv", "nord", priority=3, status="CONTRACT", contract=True),
]
