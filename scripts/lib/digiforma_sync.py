"""Business logic for syncing Digiforma companies with the local database.

Digiforma is the source of truth. This module fetches, matches, diffs, and
detects conflicts; the CLI in scripts/sync_digiforma.py decides what to do
with the results (print, write JSON, or write to the database).
"""

import json
import os
import unicodedata

import requests

FALLBACK_USER_FIRST_NAME = "Disciplina"

GRAPHQL_QUERY = """
query GetCompanies {
  companies {
    accountingNumber
    ape
    city
    cityCode
    code
    country
    countryCode
    draft
    eInvoicingAddress
    email
    employeesCount
    group
    idcc
    id
    insertedAt
    legalName
    locale
    nace
    note
    opca
    phone
    roadAddress
    siret
    updatedAt
    website
    contacts {
      birthdate
      civility
      email
      fax
      firstname
      lastname
      phone
      position
      secondLastname
      tags
      title
    }
  }
}
"""

INSERT_QUERY = """
    INSERT INTO companies (
        user_id, legal_referent, name, phone, email, address, sector,
        main_activity, siret, idcc, ape, notes, conclusion, status, relance_date
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

UPDATABLE_FIELDS = ("name", "phone", "email", "address", "main_activity", "idcc", "ape")

CONFLICT_INSERT_QUERY = """
    INSERT INTO company_conflict (
        user_id, legal_referent, name, phone, email, address, sector,
        main_activity, siret, idcc, ape, notes, conclusion, candidate_user_ids
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

CREATE_COMPANY_CONFLICT_TABLE = """
    CREATE TABLE IF NOT EXISTS company_conflict (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT DEFAULT NULL,
        ab_id VARCHAR(36) DEFAULT NULL,
        legal_referent VARCHAR(255) DEFAULT NULL,
        name VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        address VARCHAR(255) DEFAULT NULL,
        sector VARCHAR(255) DEFAULT NULL,
        main_activity VARCHAR(255) DEFAULT NULL,
        siret CHAR(14) DEFAULT NULL,
        idcc CHAR(4) DEFAULT NULL,
        ape CHAR(5) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        conclusion VARCHAR(255) DEFAULT NULL,
        status VARCHAR(50) DEFAULT NULL,
        relance_date DATE DEFAULT NULL,
        relance_type TINYINT DEFAULT NULL,
        relance_template_id VARCHAR(64) DEFAULT NULL,
        relance_channel ENUM('PHONE', 'MAIL') DEFAULT NULL,
        candidate_user_ids TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_company_conflict_siret (siret),
        CONSTRAINT fk_company_conflict_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
"""


def fetch_digiforma_companies(base_url, api_key):
    response = requests.post(
        base_url,
        json={"query": GRAPHQL_QUERY},
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    return [c for c in data["data"]["companies"] if not c.get("draft")]


def fetch_local_users(cursor):
    cursor.execute("SELECT id, first_name FROM users")
    return {row[0]: {"id": row[0], "first_name": row[1]} for row in cursor.fetchall()}


def fetch_local_companies_by_siren(cursor, siren):
    cursor.execute(
        """
        SELECT id, user_id, name, siret, phone, email, address,
               main_activity, idcc, ape, notes
        FROM companies WHERE SUBSTRING(siret, 1, 9) = %s
        """,
        (siren,),
    )
    columns = ("id", "user_id", "name", "siret", "phone", "email", "address",
               "main_activity", "idcc", "ape", "notes")
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def extract_siren(siret):
    if not siret:
        return None
    digits = "".join(c for c in siret if c.isdigit())
    if len(digits) < 9:
        return None
    return digits[:9]


def is_placeholder_siret(siret):
    """Detect a fake SIRET made of nothing but zeros (e.g. '00000000000000')."""
    digits = "".join(c for c in siret if c.isdigit()) if siret else ""
    return digits != "" and digits == "0" * len(digits)


def normalize_accounting(raw):
    """Take the first word before a space."""
    if not raw:
        return ""
    return normalize_name_for_matching(raw.strip().split(" ")[0])


def normalize_ape(raw):
    """Strip separators Digiforma sometimes adds around the APE code (dots, parens, commas)."""
    if not raw:
        return None
    cleaned = "".join(c for c in raw if c.isalnum())
    return cleaned[:5] or None


def normalize_idcc(raw):
    """Strip stray whitespace Digiforma sometimes adds around the IDCC code."""
    if not raw:
        return None
    cleaned = raw.strip()
    return cleaned[:4] or None


def normalize_phone(raw):
    """Truncate to the column's max length; some Digiforma phone fields hold free text."""
    if not raw:
        return None
    return raw.strip()[:50] or None


def normalize_name_for_matching(name):
    """Accent/case-insensitive fold, e.g. 'Émilie' == 'emilie' == 'EMILIE'."""
    if not name:
        return ""
    stripped = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return stripped.casefold()


def group_companies_by_siren(digiforma_companies):
    """Split into (siren_groups, no_siret, invalid_siret)."""
    siren_groups = {}
    no_siret = []
    invalid_siret = []
    for company in digiforma_companies:
        siret = company.get("siret")
        if siret is None or siret.strip() == "":
            no_siret.append(company)
            continue
        if is_placeholder_siret(siret):
            invalid_siret.append(company)
            continue
        siren = extract_siren(siret)
        if siren is None:
            invalid_siret.append(company)
            continue
        siren_groups.setdefault(siren, []).append(company)
    return siren_groups, no_siret, invalid_siret


def build_user_index_by_normalized_name(users):
    index = {}
    for user in users.values():
        index[normalize_name_for_matching(user["first_name"])] = user
    return index


def resolve_commercial_for_group(dig_companies, user_index, fallback_user):
    """Try each distinct normalized accountingNumber against the user index."""
    for company in dig_companies:
        normalized = normalize_accounting(company.get("accountingNumber"))
        if normalized and normalized in user_index:
            return user_index[normalized]
    return fallback_user


def detect_missing_siret(company):
    return {
        "type": "missing_siret",
        "digiforma_id": company["id"],
        "digiforma_name": company.get("legalName") or "",
        "message": f"L'entreprise '{company.get('legalName') or '?'}' n'a pas de SIRET.",
    }


def detect_invalid_siret(company):
    siret = company.get("siret") or ""
    reason = "c'est un SIRET factice (que des zéros)" if is_placeholder_siret(siret) else "moins de 9 chiffres"
    return {
        "type": "invalid_siret",
        "digiforma_id": company["id"],
        "digiforma_name": company.get("legalName") or "",
        "siret": siret,
        "message": f"Le SIRET '{siret}' est invalide ({reason}).",
    }


def detect_duplicate_digiforma_siret(dig_company):
    return {
        "type": "duplicate_digiforma_siret",
        "digiforma_id": dig_company["id"],
        "siret": dig_company.get("siret") or "",
        "message": f"Le SIRET '{dig_company.get('siret')}' apparaît plusieurs fois côté Digiforma "
                   f"(id {dig_company['id']} ignoré, doublon).",
    }


def detect_multiple_commercials(siren, local_companies, users):
    local_user_ids = {lc["user_id"] for lc in local_companies if lc["user_id"] is not None}
    if len(local_user_ids) <= 1:
        return None
    names = [users[uid]["first_name"] if uid in users else f"ID {uid}" for uid in sorted(local_user_ids)]
    return {
        "type": "multiple_commercials_same_siren",
        "siren": siren,
        "user_ids": sorted(local_user_ids),
        "message": f"Le SIREN {siren} est rattaché à plusieurs commerciaux : {', '.join(names)}.",
    }


def resolve_company_commercial(dig_company, effective_user, user_index):
    """Resolve the commercial for one Digiforma company. Returns (chosen_user, conflict_or_None).

    Digiforma wins on mismatch: if the accounting number matches a different
    known user than the group's effective one, that matched user is used.
    """
    accounting_raw = (dig_company.get("accountingNumber") or "").strip()
    normalized = normalize_accounting(dig_company.get("accountingNumber"))
    if not normalized or not effective_user:
        return effective_user, None

    matched_user = user_index.get(normalized)
    if matched_user is None:
        return effective_user, {
            "type": "unknown_commercial",
            "digiforma_id": dig_company["id"],
            "accounting_number": accounting_raw,
            "message": (
                f"Numéro comptable '{accounting_raw}' ne correspond à aucun commercial "
                f"connu ; rattaché au fallback '{effective_user['first_name']}'."
            ),
        }

    if matched_user["id"] == effective_user["id"]:
        return effective_user, None

    return matched_user, {
        "type": "commercial_mismatch",
        "digiforma_id": dig_company["id"],
        "accounting_number": accounting_raw,
        "message": (
            f"Le numéro comptable '{accounting_raw}' correspond à "
            f"'{matched_user['first_name']}' alors que l'entreprise était rattachée à "
            f"'{effective_user['first_name']}' ; Digiforma fait foi, commercial mis à jour."
        ),
    }


def build_field_diff(local_row, dig_company):
    """Return {field: (old, new)} for fields where Digiforma differs from local."""
    candidate_values = {
        "name": dig_company.get("legalName") or local_row["name"],
        "phone": normalize_phone(dig_company.get("phone")),
        "email": dig_company.get("email") or None,
        "address": build_address(dig_company) or local_row["address"],
        "main_activity": dig_company.get("nace") or None,
        "idcc": normalize_idcc(dig_company.get("idcc")),
        "ape": normalize_ape(dig_company.get("ape")),
    }
    diff = {}
    for field in UPDATABLE_FIELDS:
        new_value = candidate_values[field]
        old_value = local_row.get(field)
        if new_value and new_value != old_value:
            diff[field] = (old_value, new_value)
    return diff


def build_contact_name(contacts):
    if not contacts:
        return None
    firstname = (contacts[0].get("firstname") or "").strip()
    lastname = (contacts[0].get("lastname") or "").strip()
    full = f"{firstname} {lastname}".strip()
    return full if full else contacts[0].get("title") or None


def build_address(dig_company):
    parts = []
    road = (dig_company.get("roadAddress") or "").strip()
    city = (dig_company.get("city") or "").strip()
    if road:
        parts.append(road)
    if city:
        parts.append(city)
    return ", ".join(parts) if parts else ""


def build_notes(dig_company):
    notes_parts = []
    if dig_company.get("note"):
        notes_parts.append(dig_company["note"])
    extras = []
    if dig_company.get("website"):
        extras.append(f"Site web: {dig_company['website']}")
    if dig_company.get("employeesCount"):
        extras.append(f"Effectif: {dig_company['employeesCount']}")
    if dig_company.get("group"):
        extras.append(f"Groupe: {dig_company['group']}")
    if dig_company.get("code"):
        extras.append(f"Code Digiforma: {dig_company['code']}")
    if extras:
        notes_parts.append(" | ".join(extras))
    return "\n".join(notes_parts) if notes_parts else ""


def insert_company(cursor, dig_company, effective_user):
    dig_siret = dig_company["siret"]
    dig_name = dig_company.get("legalName") or ""
    contact_name = build_contact_name(dig_company.get("contacts"))
    cursor.execute(INSERT_QUERY, (
        effective_user["id"],
        contact_name,
        dig_name,
        normalize_phone(dig_company.get("phone")),
        dig_company.get("email") or None,
        build_address(dig_company),
        "Nord-Est",
        dig_company.get("nace") or None,
        dig_siret,
        normalize_idcc(dig_company.get("idcc")),
        normalize_ape(dig_company.get("ape")),
        build_notes(dig_company),
        "",
        "À Réfléchir",
        None,
    ))


def update_company_fields(cursor, company_id, diff):
    set_clause = ", ".join(f"{field} = %s" for field in diff)
    values = [new for _old, new in diff.values()] + [company_id]
    cursor.execute(f"UPDATE companies SET {set_clause} WHERE id = %s", values)


def ensure_company_conflict_table(cursor):
    cursor.execute(CREATE_COMPANY_CONFLICT_TABLE)


def insert_company_conflict(cursor, dig_company, conflict_type, message, user_id=None, candidate_user_ids=None):
    cursor.execute(CONFLICT_INSERT_QUERY, (
        user_id,
        build_contact_name(dig_company.get("contacts")),
        dig_company.get("legalName") or None,
        normalize_phone(dig_company.get("phone")),
        dig_company.get("email") or None,
        build_address(dig_company) or None,
        "Nord-Est",
        dig_company.get("nace") or None,
        dig_company.get("siret") or None,
        normalize_idcc(dig_company.get("idcc")),
        normalize_ape(dig_company.get("ape")),
        message,
        f"Conflit : {conflict_type}",
        json.dumps(candidate_user_ids) if candidate_user_ids else None,
    ))


def write_json_report(report, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


def process_siren_group(cursor, siren, dig_companies, users, user_index, fallback_user, apply_changes):
    """Analyze one SIREN group, optionally writing inserts/updates. Returns (conflicts, counts)."""
    local_companies = fetch_local_companies_by_siren(cursor, siren)
    conflicts = []
    counts = {"to_insert": 0, "to_update": 0, "to_conflict": 0}

    multi_conflict = detect_multiple_commercials(siren, local_companies, users)
    if multi_conflict:
        conflicts.append(multi_conflict)
        counts["to_conflict"] += len(dig_companies)
        if apply_changes:
            for dig_company in dig_companies:
                insert_company_conflict(cursor, dig_company, multi_conflict["type"], multi_conflict["message"],
                                         candidate_user_ids=multi_conflict["user_ids"])
        return conflicts, counts, set(), local_companies

    effective_user = resolve_local_user(local_companies, users) or \
        resolve_commercial_for_group(dig_companies, user_index, fallback_user)

    matched_local_ids = set()
    seen_sirets = set()
    for dig_company in dig_companies:
        siret = dig_company["siret"]
        matched = [lc for lc in local_companies if lc["siret"] == siret]
        if matched:
            matched_local_ids.add(matched[0]["id"])
            _process_existing_company(cursor, matched[0], dig_company, effective_user,
                                       user_index, conflicts, counts, apply_changes)
            seen_sirets.add(siret)
        elif siret in seen_sirets:
            duplicate = detect_duplicate_digiforma_siret(dig_company)
            conflicts.append(duplicate)
            counts["to_conflict"] += 1
            if apply_changes:
                insert_company_conflict(cursor, dig_company, duplicate["type"], duplicate["message"])
        else:
            _process_new_company(cursor, dig_company, effective_user, user_index,
                                  conflicts, counts, apply_changes)
            seen_sirets.add(siret)

    return conflicts, counts, matched_local_ids, local_companies


def resolve_local_user(local_companies, users):
    local_user_ids = {lc["user_id"] for lc in local_companies if lc["user_id"] is not None}
    if len(local_user_ids) != 1:
        return None
    return users.get(next(iter(local_user_ids)))


def _process_existing_company(cursor, local_row, dig_company, effective_user, user_index,
                                conflicts, counts, apply_changes):
    chosen_user, conflict = resolve_company_commercial(dig_company, effective_user, user_index)
    if conflict:
        conflicts.append(conflict)
        counts["to_conflict"] += 1
        if apply_changes:
            insert_company_conflict(cursor, dig_company, conflict["type"], conflict["message"],
                                     user_id=chosen_user["id"] if chosen_user else None)

    diff = build_field_diff(local_row, dig_company)
    if chosen_user and chosen_user["id"] != local_row["user_id"]:
        diff["user_id"] = (local_row["user_id"], chosen_user["id"])

    if diff:
        counts["to_update"] += 1
        if apply_changes:
            update_company_fields(cursor, local_row["id"], diff)


def _process_new_company(cursor, dig_company, effective_user, user_index,
                          conflicts, counts, apply_changes):
    chosen_user, conflict = resolve_company_commercial(dig_company, effective_user, user_index)
    if conflict:
        conflicts.append(conflict)
        counts["to_conflict"] += 1
        if apply_changes:
            insert_company_conflict(cursor, dig_company, conflict["type"], conflict["message"],
                                     user_id=chosen_user["id"] if chosen_user else None)

    counts["to_insert"] += 1
    if apply_changes:
        insert_company(cursor, dig_company, chosen_user)


def find_local_only_companies(local_companies, matched_local_ids, users):
    orphans = []
    for lc in local_companies:
        if lc["id"] in matched_local_ids:
            continue
        user = users.get(lc["user_id"]) if lc["user_id"] else None
        orphans.append({
            "type": "local_only",
            "local_siret": lc["siret"],
            "local_name": lc["name"],
            "user_firstname": user["first_name"] if user else None,
            "message": f"Entreprise locale '{lc['name']}' (SIRET: {lc['siret']}) absente de Digiforma.",
        })
    return orphans


def run_sync(cursor, digiforma_companies, users, fallback_user, apply_changes):
    """Analyze all Digiforma companies against the local DB, optionally writing changes."""
    siren_groups, no_siret, invalid_siret = group_companies_by_siren(digiforma_companies)
    user_index = build_user_index_by_normalized_name(users)

    missing_siret_conflicts = [detect_missing_siret(c) for c in no_siret]
    invalid_siret_conflicts = [detect_invalid_siret(c) for c in invalid_siret]
    conflicts = missing_siret_conflicts + invalid_siret_conflicts
    to_insert = 0
    to_update = 0
    to_conflict = len(no_siret) + len(invalid_siret)
    local_only = []

    if apply_changes:
        for dig_company, conflict in zip(no_siret, missing_siret_conflicts):
            insert_company_conflict(cursor, dig_company, conflict["type"], conflict["message"])
        for dig_company, conflict in zip(invalid_siret, invalid_siret_conflicts):
            insert_company_conflict(cursor, dig_company, conflict["type"], conflict["message"])

    for siren, dig_companies in sorted(siren_groups.items()):
        group_conflicts, counts, matched_ids, local_companies = process_siren_group(
            cursor, siren, dig_companies, users, user_index, fallback_user, apply_changes,
        )
        conflicts.extend(group_conflicts)
        to_insert += counts["to_insert"]
        to_update += counts["to_update"]
        to_conflict += counts["to_conflict"]
        local_only.extend(find_local_only_companies(local_companies, matched_ids, users))

    blocking_types = {"missing_siret", "invalid_siret", "multiple_commercials_same_siren"}
    blocking = [c for c in conflicts if c["type"] in blocking_types]
    info = [c for c in conflicts if c["type"] not in blocking_types]

    return {
        "summary": {
            "total_digiforma_companies": len(digiforma_companies),
            "siren_groups": len(siren_groups),
            "blocking_conflicts": len(blocking),
            "info_conflicts": len(info),
            "to_insert": to_insert,
            "to_update": to_update,
            "to_conflict": to_conflict,
            "local_only": len(local_only),
        },
        "conflicts": conflicts,
        "local_only": local_only,
    }


def print_human_summary(report):
    summary = report["summary"]
    print("\nRésumé")
    print(f"  Entreprises Digiforma       : {summary['total_digiforma_companies']}")
    print(f"  Groupes SIREN               : {summary['siren_groups']}")
    print(f"  Conflits bloquants          : {summary['blocking_conflicts']}")
    print(f"  Conflits informatifs        : {summary['info_conflicts']}")
    print(f"  Entreprises à insérer       : {summary['to_insert']}")
    print(f"  Entreprises à mettre à jour : {summary['to_update']}")
    print(f"  Entreprises en quarantaine (company_conflict) : {summary['to_conflict']}")
    print(f"  Entreprises locales orphelines (absentes de Digiforma) : {summary['local_only']}")

    if report["conflicts"]:
        print("\nConflits détectés :")
        for conflict in report["conflicts"]:
            print(f"  [{conflict['type']}] {conflict['message']}")
