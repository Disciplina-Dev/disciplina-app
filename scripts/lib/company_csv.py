"""Pure helpers to clean raw commercial CSV rows into the companies schema.

Handles heterogeneous headers across the *-company.csv files, derives the
commercial zone from the postal code, classifies a free-text status into one of
the six allowed values, and normalizes the SIRET (with a unique zero-padded
placeholder when missing).
"""

import re
import unicodedata

ZONE_NORD_EST = "Nord-Est"
ZONE_OUEST = "Ouest"
ZONE_SUD = "Sud"
DEFAULT_ZONE = ZONE_NORD_EST

# Postal code -> commercial zone (validated against the data actually present in
# the CSVs). Unknown/absent codes fall back to Nord-Est.
POSTAL_TO_ZONE = {
    "97400": ZONE_NORD_EST, "97417": ZONE_NORD_EST, "97489": ZONE_NORD_EST,
    "97490": ZONE_NORD_EST, "97438": ZONE_NORD_EST, "97441": ZONE_NORD_EST,
    "97440": ZONE_NORD_EST, "97412": ZONE_NORD_EST, "97433": ZONE_NORD_EST,
    "97470": ZONE_NORD_EST, "97437": ZONE_NORD_EST, "97431": ZONE_NORD_EST,
    "97439": ZONE_NORD_EST,
    "97460": ZONE_OUEST, "97411": ZONE_OUEST, "97434": ZONE_OUEST,
    "97435": ZONE_OUEST, "97419": ZONE_OUEST, "97420": ZONE_OUEST,
    "97426": ZONE_OUEST, "97436": ZONE_OUEST, "97416": ZONE_OUEST,
    "97410": ZONE_SUD, "97432": ZONE_SUD, "97430": ZONE_SUD,
    "97418": ZONE_SUD, "97450": ZONE_SUD, "97421": ZONE_SUD,
    "97415": ZONE_OUEST, "97422": ZONE_OUEST, "97423": ZONE_OUEST,
    "97424": ZONE_OUEST,
    "97425": ZONE_SUD, "97427": ZONE_SUD, "97442": ZONE_SUD,
    "97480": ZONE_SUD,
}

# Raw header (accent/case-insensitive) -> canonical source key.
HEADER_ALIASES = {
    "gerant": "legal_referent",
    "nom commercial": "name",
    "tel": "phone",
    "email": "email",
    "adresse": "address",
    "secteur": "secteur",
    "metier/description": "main_activity",
    "metier": "main_activity",
    "siret": "siret",
    "note a moi meme": "note",
    "conclusion": "conclusion",
    "ville / adresse": "address",
    "e-mail": "email",
    "reponse": "reponse",
    "date de relance": "relance_date",
}

CLEAN_FIELDNAMES = [
    "legal_referent", "name", "phone", "email", "address", "sector",
    "main_activity", "siret", "notes", "conclusion", "status", "relance_date",
]

DEFAULT_STATUS = "À Réfléchir"

# Ordered by priority: the first family whose keyword appears wins.
STATUS_KEYWORDS = [
    ("Fermé", ("ferme", "cessation", "liquidation", "radie")),
    ("Réponds pas", ("ne repond pas", "ne rpd pas", "repond pas", "rpd pas",
                     "rep pas", "injoignable", "ne prend pas", "pas de reponse",
                     "ne decroche")),
    ("Oui", ("ab ok", "oui", "ok", "accepte", "partenariat", "partenaire",
             "mandat", "d accord", "interesse")),
    ("Non", ("non", "refus", "ne recrute pas", "pas interesse", "ne souhaite pas",
             "pas besoin", "ne recherche pas")),
    ("Relance", ("relance", "a rappeler", "rappeler", "recontacter", "a revoir")),
    ("À Réfléchir", ("mail", "patron absent", "reflechir", "ne s occupe pas",
                     "absent", "attente", "revoir")),
]


def remove_accents(text):
    return "".join(
        c for c in unicodedata.normalize("NFD", text or "")
        if unicodedata.category(c) != "Mn"
    )


def clean_text(value):
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_header(header):
    """Map a raw CSV header to a canonical source key, or None if it is noise."""
    collapsed = re.sub(r"\s+", " ", remove_accents(header)).strip().lower()
    return HEADER_ALIASES.get(collapsed)


def extract_fields(headers, values):
    """Collapse a raw CSV row into canonical source keys (first non-empty wins)."""
    fields = {}
    for header, value in zip(headers, values):
        key = normalize_header(header)
        if not key:
            continue
        cleaned = clean_text(value)
        if cleaned and not fields.get(key):
            fields[key] = cleaned
    return fields


def postal_to_zone(secteur_raw):
    match = re.search(r"\b(974\d{2})\b", secteur_raw or "")
    if not match:
        return DEFAULT_ZONE
    return POSTAL_TO_ZONE.get(match.group(1), DEFAULT_ZONE)


def build_company_notes(secteur_raw, note_raw):
    """Keep the original commune in the notes since `sector` becomes a zone."""
    parts = []
    if secteur_raw and secteur_raw.strip():
        parts.append(f"Commune: {secteur_raw.strip()}")
    if note_raw and note_raw.strip():
        parts.append(note_raw.strip())
    return "\n".join(parts)


def clean_siret(raw, placeholder_counter):
    """Return a 14-digit SIRET, or a unique zero-padded placeholder when invalid."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 14:
        return digits
    return str(next(placeholder_counter)).zfill(14)


def match_status(text):
    normalized = remove_accents(text).lower()
    if not normalized.strip():
        return None
    for status, keywords in STATUS_KEYWORDS:
        if any(keyword in normalized for keyword in keywords):
            return status
    return None


def classify_status(note, conclusion, reponse=""):
    """Derive a single company status: Conclusion > Note > Réponse, else default."""
    return (
        match_status(conclusion)
        or match_status(note)
        or match_status(reponse)
        or DEFAULT_STATUS
    )


def parse_relance_date(raw):
    """Convert a DD/MM/YYYY relance date to ISO (YYYY-MM-DD), or '' when invalid."""
    match = re.match(r"\s*(\d{2})/(\d{2})/(\d{4})\s*$", raw or "")
    if not match:
        return ""
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


def build_clean_row(headers, values, placeholder_counter):
    fields = extract_fields(headers, values)
    secteur_raw = fields.get("secteur", "")
    address_raw = fields.get("address", "")
    return {
        "legal_referent": fields.get("legal_referent", ""),
        "name": fields.get("name", ""),
        "phone": fields.get("phone", ""),
        "email": fields.get("email", ""),
        "address": address_raw,
        "sector": postal_to_zone(secteur_raw or address_raw),
        "main_activity": fields.get("main_activity", ""),
        "siret": clean_siret(fields.get("siret", ""), placeholder_counter),
        "notes": build_company_notes(secteur_raw, fields.get("note", "")),
        "conclusion": fields.get("conclusion", ""),
        "status": classify_status(
            fields.get("note", ""), fields.get("conclusion", ""), fields.get("reponse", "")
        ),
        "relance_date": parse_relance_date(fields.get("relance_date", "")),
    }
