"""Pure helpers to map the raw blacklist-<zone>.csv rows into the
companies_blacklist schema.

The files only carry Entreprise/SIRET/Motif, so the commercial zone comes from
the filename and the SIRET falls back to a placeholder derived from the company
name (shared across files) so INSERT IGNORE deduplicates name-only duplicates.
"""

import os
import re

from lib.company_csv import clean_text, remove_accents

FILENAME_TO_ZONE = {"nord": "Nord-Est", "ouest": "Ouest"}

NAME_MAX_LENGTH = 255


def zone_from_path(path):
    name = os.path.basename(path)
    match = re.match(r"blacklist-(\w+)\.csv$", name)
    if not match:
        return ""
    return FILENAME_TO_ZONE.get(match.group(1).lower(), "")


def split_name(raw):
    lines = [line.strip() for line in (raw or "").splitlines() if line.strip()]
    if not lines:
        return "", ""
    return lines[0][:NAME_MAX_LENGTH], "\n".join(lines[1:])


def blacklist_siret(raw, name, placeholder_by_name):
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 14:
        return digits
    key = remove_accents(name).lower()
    if key not in placeholder_by_name:
        placeholder_by_name[key] = str(len(placeholder_by_name) + 1).zfill(14)
    return placeholder_by_name[key]


def build_blacklist_row(values, zone, placeholder_by_name):
    entreprise, siret, motif = (values + ["", "", ""])[:3]
    name, notes = split_name(entreprise)
    return {
        "name": name,
        "notes": notes,
        "address": "",
        "sector": zone,
        "siret": blacklist_siret(siret, name, placeholder_by_name),
        "conclusion": clean_text(motif),
    }
