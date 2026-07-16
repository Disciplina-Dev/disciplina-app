#!/usr/bin/env python3
"""Sync Digiforma companies with local MySQL database.

Fetches companies from Digiforma API, groups by SIREN, resolves the matching
user by accountingNumber ↔ user.first_name, checks consistency, inserts new
companies under the matched user (or a fallback), and generates CSV reports.
"""

import csv
import os
import sys
from datetime import datetime

import requests
from dotenv import load_dotenv

from db.mysql import get_mysql_connection

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DIGIFORMA_API_KEY = os.getenv("DIGIFORMA_API_KEY")
DIGIFORMA_BASE_API_URL = os.getenv("DIGIFORMA_BASE_API_URL")
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

REPORT_HEADERS = [
    "siren",
    "digiforma_id",
    "digiforma_name",
    "local_siret",
    "local_name",
    "user_id",
    "user_firstname",
    "accounting_number",
    "status",
    "notes",
]

INSERT_QUERY = """
    INSERT INTO companies (
        user_id, legal_referent, name, phone, email, address, sector,
        main_activity, siret, idcc, ape, notes, conclusion, status, relance_date
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


def extract_siren(siret):
    if not siret:
        return None
    digits = "".join(c for c in siret if c.isdigit())
    if len(digits) < 9:
        return None
    return digits[:9]


def normalize_accounting(raw):
    """Take the first word before a space, uppercase."""
    if not raw:
        return ""
    return raw.strip().split(" ")[0].upper()


def fetch_digiforma_companies():
    response = requests.post(
        DIGIFORMA_BASE_API_URL,
        json={"query": GRAPHQL_QUERY},
        headers={
            "Authorization": f"Bearer {DIGIFORMA_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    return [c for c in data["data"]["companies"] if not c.get("draft")]


def fetch_all_users(cursor):
    cursor.execute("SELECT id, first_name FROM users")
    return {row[0]: {"id": row[0], "first_name": row[1]} for row in cursor.fetchall()}


def fetch_local_companies_by_siren(cursor, siren):
    cursor.execute(
        "SELECT id, user_id, name, siret FROM companies WHERE siret LIKE %s",
        (f"{siren}%",),
    )
    return [
        {"id": row[0], "user_id": row[1], "name": row[2], "siret": row[3]}
        for row in cursor.fetchall()
    ]


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


def main():
    if not DIGIFORMA_API_KEY or not DIGIFORMA_BASE_API_URL:
        print("ERROR: DIGIFORMA_API_KEY and DIGIFORMA_BASE_API_URL must be set in .env")
        return 1

    print("Fetching Digiforma companies...")
    digiforma_companies = fetch_digiforma_companies()
    print(f"  Found {len(digiforma_companies)} non-draft companies")

    print("Connecting to MySQL...")
    conn = get_mysql_connection()
    cursor = conn.cursor()

    try:
        all_users = fetch_all_users(cursor)
        all_users_by_firstname_upper = {}
        for uid, u in all_users.items():
            key = u["first_name"].upper()
            all_users_by_firstname_upper[key] = u
        print(f"  Found {len(all_users)} users in database")

        fallback_user = all_users_by_firstname_upper.get(FALLBACK_USER_FIRST_NAME.upper())
        if not fallback_user:
            print(f"WARNING: Fallback user '{FALLBACK_USER_FIRST_NAME}' not found. "
                  f"New companies without a matching user will not be inserted.")
        else:
            print(f"  Fallback user: '{FALLBACK_USER_FIRST_NAME}' (ID: {fallback_user['id']})")

        siren_groups = {}
        no_siret = []
        invalid_siret = []

        for company in digiforma_companies:
            siret = company.get("siret")
            siren = extract_siren(siret)
            if siret is None or siret.strip() == "":
                no_siret.append(company)
                continue
            if siren is None:
                invalid_siret.append(company)
                continue
            siren_groups.setdefault(siren, []).append(company)

        print(f"  Grouped into {len(siren_groups)} SIREN groups")
        print(f"  {len(no_siret)} companies without SIRET")
        print(f"  {len(invalid_siret)} companies with invalid SIRET")

        all_rows = []
        inserted_rows = []
        error_rows = []
        inserted_count = 0
        error_count = 0

        for company in no_siret:
            row = {
                "siren": "",
                "digiforma_id": company["id"],
                "digiforma_name": company.get("legalName") or "",
                "local_siret": "",
                "local_name": "",
                "user_id": "",
                "user_firstname": "",
                "accounting_number": company.get("accountingNumber") or "",
                "status": "ERREUR",
                "notes": (
                    f"L'entreprise '{company.get('legalName') or '?'}' "
                    f"(ID Digiforma: {company['id']}) n'a pas de SIRET. "
                    f"Rapprochement impossible."
                ),
            }
            all_rows.append(row)
            error_rows.append(row)
            error_count += 1

        for company in invalid_siret:
            row = {
                "siren": "",
                "digiforma_id": company["id"],
                "digiforma_name": company.get("legalName") or "",
                "local_siret": company.get("siret") or "",
                "local_name": "",
                "user_id": "",
                "user_firstname": "",
                "accounting_number": company.get("accountingNumber") or "",
                "status": "ERREUR",
                "notes": (
                    f"Le SIRET '{company.get('siret')}' de "
                    f"'{company.get('legalName') or '?'}' "
                    f"est invalide (moins de 9 chiffres). "
                    f"Impossible d'extraire le SIREN."
                ),
            }
            all_rows.append(row)
            error_rows.append(row)
            error_count += 1

        for siren, dig_companies in sorted(siren_groups.items()):
            local_companies = fetch_local_companies_by_siren(cursor, siren)

            # Collect normalized accountingNumbers from Digiforma companies
            dig_accounting_norm = set()
            for dc in dig_companies:
                acct = normalize_accounting(dc.get("accountingNumber"))
                if acct:
                    dig_accounting_norm.add(acct)

            # Resolve matching user: try each normalized accountingNumber
            matched_user = None
            matched_user_from_acct = None
            for acct_upper in dig_accounting_norm:
                user = all_users_by_firstname_upper.get(acct_upper)
                if user:
                    matched_user = user
                    matched_user_from_acct = acct_upper
                    break

            # Check local companies user consistency
            local_user_ids = {
                lc["user_id"] for lc in local_companies if lc["user_id"] is not None
            }

            multiple_users = len(local_user_ids) > 1

            if multiple_users:
                user_names = []
                for uid in sorted(local_user_ids):
                    u = all_users.get(uid)
                    user_names.append(u["first_name"] if u else f"ID {uid}")
                siren_error_note = (
                    f"Le SIREN {siren} est rattaché à plusieurs commerciaux : "
                    f"{', '.join(user_names)}. "
                    f"Toutes les entreprises avec ce SIREN devraient "
                    f"appartenir au même commercial."
                )
            else:
                siren_error_note = None

            # Determine effective user for this SIREN group
            effective_user = None
            siren_blocking_errors = []

            if local_user_ids:
                local_user_id = next(iter(local_user_ids))
                local_user = all_users.get(local_user_id)

                if multiple_users:
                    siren_blocking_errors.append(siren_error_note)
                elif local_user:
                    effective_user = local_user
                else:
                    siren_blocking_errors.append(
                        f"L'utilisateur ID {local_user_id} des entreprises "
                        f"avec SIREN {siren} n'existe pas dans la table users."
                    )
            else:
                # No local companies → use matched user or fallback
                effective_user = matched_user or fallback_user

            # If we still have blocking errors, no insert for this SIREN
            if siren_blocking_errors:
                effective_user = None

            matched_local_ids = set()

            for dig_company in dig_companies:
                dig_siret = dig_company["siret"]
                dig_name = dig_company.get("legalName") or ""
                dig_accounting_raw = (dig_company.get("accountingNumber") or "").strip()
                dig_accounting_norm = normalize_accounting(dig_company.get("accountingNumber"))
                dig_id = dig_company["id"]

                matching_locals = [lc for lc in local_companies if lc["siret"] == dig_siret]

                if matching_locals:
                    local = matching_locals[0]
                    matched_local_ids.add(local["id"])

                    if not dig_name:
                        dig_name = local["name"]

                    notes_parts = []
                    is_error = False

                    if len(matching_locals) > 1:
                        notes_parts.append(
                            f"Plusieurs entreprises partagent le même SIRET "
                            f"{dig_siret} en base locale."
                        )
                        is_error = True

                    if effective_user:
                        if dig_accounting_norm:
                            if dig_accounting_norm != effective_user["first_name"].upper():
                                # Check if normalized accounting matches ANY user
                                if dig_accounting_norm not in all_users_by_firstname_upper:
                                    # Not in any user → not an error, just a note
                                    notes_parts.append(
                                        f"Numéro comptable '{dig_accounting_raw}' "
                                        f"(normalisé: '{dig_accounting_norm}') "
                                        f"≠ '{effective_user['first_name']}' — ignoré."
                                    )
                                else:
                                    # Matches a different user → error
                                    other_user = all_users_by_firstname_upper[dig_accounting_norm]
                                    notes_parts.append(
                                        f"Le numéro comptable '{dig_accounting_raw}' "
                                        f"correspond à '{other_user['first_name']}' "
                                        f"mais l'entreprise est rattachée à "
                                        f"'{effective_user['first_name']}'."
                                    )
                                    is_error = True
                    else:
                        notes_parts.extend(siren_blocking_errors)
                        is_error = True

                    notes = " | ".join(notes_parts) if notes_parts else ""
                    status = "ERREUR" if is_error else "OK"

                    if is_error:
                        error_count += 1

                    row = {
                        "siren": siren,
                        "digiforma_id": dig_id,
                        "digiforma_name": dig_name,
                        "local_siret": local["siret"],
                        "local_name": local["name"],
                        "user_id": effective_user["id"] if effective_user else (local["user_id"] or ""),
                        "user_firstname": effective_user["first_name"] if effective_user else "",
                        "accounting_number": dig_accounting_raw,
                        "status": status,
                        "notes": notes,
                    }
                    all_rows.append(row)
                    if status == "ERREUR":
                        error_rows.append(row)

                else:
                    # No local match → insert if possible
                    if not dig_name and local_companies:
                        dig_name = local_companies[0]["name"]

                    if effective_user and not siren_blocking_errors:
                        contact_name = build_contact_name(dig_company.get("contacts"))
                        address = build_address(dig_company)
                        dig_notes = build_notes(dig_company)
                        ape = dig_company.get("ape") or None
                        idcc = dig_company.get("idcc") or None

                        try:
                            cursor.execute(INSERT_QUERY, (
                                effective_user["id"],
                                contact_name,
                                dig_name,
                                dig_company.get("phone") or None,
                                dig_company.get("email") or None,
                                address,
                                "Nord-Est",
                                dig_company.get("nace") or None,
                                dig_siret,
                                idcc,
                                ape,
                                dig_notes,
                                "",
                                "À Réfléchir",
                                None,
                            ))
                            conn.commit()
                            inserted_count += 1

                            row = {
                                "siren": siren,
                                "digiforma_id": dig_id,
                                "digiforma_name": dig_name,
                                "local_siret": dig_siret,
                                "local_name": "",
                                "user_id": effective_user["id"],
                                "user_firstname": effective_user["first_name"],
                                "accounting_number": dig_accounting_raw,
                                "status": "INSÉRÉE",
                                "notes": (
                                    f"Nouvelle entreprise insérée avec le commercial "
                                    f"'{effective_user['first_name']}' (ID: {effective_user['id']})."
                                ),
                            }
                            all_rows.append(row)
                            inserted_rows.append(row)
                        except Exception as e:
                            row = {
                                "siren": siren,
                                "digiforma_id": dig_id,
                                "digiforma_name": dig_name,
                                "local_siret": dig_siret,
                                "local_name": "",
                                "user_id": effective_user["id"],
                                "user_firstname": effective_user["first_name"],
                                "accounting_number": dig_accounting_raw,
                                "status": "ERREUR",
                                "notes": f"Erreur lors de l'insertion : {e}",
                            }
                            all_rows.append(row)
                            error_rows.append(row)
                            error_count += 1
                    else:
                        notes_parts = list(siren_blocking_errors)

                        row = {
                            "siren": siren,
                            "digiforma_id": dig_id,
                            "digiforma_name": dig_name,
                            "local_siret": dig_siret,
                            "local_name": "",
                            "user_id": "",
                            "user_firstname": "",
                            "accounting_number": dig_accounting_raw,
                            "status": "ERREUR",
                            "notes": " | ".join(notes_parts),
                        }
                        all_rows.append(row)
                        error_rows.append(row)
                        error_count += 1

            for lc in local_companies:
                if lc["id"] not in matched_local_ids:
                    user = all_users.get(lc["user_id"]) if lc["user_id"] else None
                    all_rows.append({
                        "siren": siren,
                        "digiforma_id": "",
                        "digiforma_name": lc["name"],
                        "local_siret": lc["siret"],
                        "local_name": lc["name"],
                        "user_id": lc["user_id"] or "",
                        "user_firstname": user["first_name"] if user else "",
                        "accounting_number": "",
                        "status": "INFO",
                        "notes": (
                            f"Entreprise locale '{lc['name']}' "
                            f"(SIRET: {lc['siret']}) présente en base "
                            f"mais pas dans Digiforma."
                        ),
                    })

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = os.path.join(os.path.dirname(__file__), "resources")
        os.makedirs(report_dir, exist_ok=True)

        errors_path = os.path.join(
            report_dir, f"sync_digiforma_errors_{timestamp}.csv",
        )
        with open(errors_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=REPORT_HEADERS)
            writer.writeheader()
            writer.writerows(error_rows)
        print(f"Erreurs : {errors_path} ({len(error_rows)} lignes)")

        inserted_path = os.path.join(
            report_dir, f"sync_digiforma_inserted_{timestamp}.csv",
        )
        with open(inserted_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=REPORT_HEADERS)
            writer.writeheader()
            writer.writerows(inserted_rows)
        print(f"Insérées : {inserted_path} ({len(inserted_rows)} lignes)")

        total = len(all_rows)
        ok_count = sum(1 for r in all_rows if r["status"] == "OK")
        ins_count = len(inserted_rows)
        err_count = len(error_rows)
        infos = sum(1 for r in all_rows if r["status"] == "INFO")
        print(f"\nRésumé")
        print(f"  Total    : {total}")
        print(f"  OK       : {ok_count}")
        print(f"  INSÉRÉE  : {ins_count}")
        print(f"  ERREUR   : {err_count}")
        print(f"  INFO     : {infos}")
        print(f"Insertions : {inserted_count}")
        print(f"Erreurs    : {error_count}")

    finally:
        cursor.close()
        conn.close()

    return 0 if error_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
