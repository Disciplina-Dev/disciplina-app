#!/usr/bin/env python3
"""Delete a list of companies (by SIRET) from one tenant, MySQL + MongoDB.

Input: a text file with one SIRET per line. Blank lines, surrounding whitespace,
spaces inside the number ("123 456 789 00012"), CRLF endings and a UTF-8 BOM are
tolerated; lines starting with '#' are comments. Anything that is not exactly 14
digits after cleanup is reported and ignored — never guessed.

DRY RUN BY DEFAULT: nothing is written unless --execute is passed.

What is deleted, per matched company (tenant = one MySQL db + one Mongo db):
  MySQL  companies row, plus its company_history / contact_logs / relance_history
         rows (deleted explicitly: the ON DELETE CASCADE FKs may be missing on
         databases where `CREATE TABLE ... LIKE` was used without the ALTERs), and
         the SYSTEM todos generated for it (source_ref 'relance:<id>:...').
  Mongo  only with --cascade, see below.

Companies still linked to live MongoDB data (non-deleted needs_analysis, offers,
candidates with immersion/contract pointing at them) are SKIPPED by default and
listed in the report. With --cascade they are deleted too, mirroring the backend's
deleteAndBlacklistCompany path (NeedsAnalysisService.delete):
  - needs_analysis   soft-deleted (is_deleted: true), like the backend
  - offers           hard-deleted, with their offer_history and the COMPANY
                     external_access links (external_id = offer id)
  - candidates       immersion_company_id / contract_company_id / contract_offer_id
                     are $unset; the *_company_name fields are kept for history
  - todos 'ab:<needs_analysis_id>' are deleted

NOT touched (do it separately if needed): DocuSeal submissions and Google Drive
PDFs of signed needs analyses, companies_blacklist, company_conflict. Deleted
companies are NOT blacklisted, so a later Digiforma sync (sync_digiforma.py
--import) or a local seed (startup.py, dev only) may re-insert them.

Before any write, every row/document that will be deleted or modified is dumped
to scripts/backups/deleted_companies_<tenant>_<timestamp>.json (contains personal
data — keep it private, delete it once no longer needed). The script is
idempotent: re-running it on the same file after a partial failure is safe.

──────────────────────────────────────────────────────────────────────────────
SAFE EXECUTION — PRODUCTION
──────────────────────────────────────────────────────────────────────────────
 1. Databases MUST be running (sql-db / nosql-db, or the remote MYSQL_URI /
    MONGO_URI targets). The startup-script container is not needed.
 2. Full backup first:  ./scripts/backup-db.sh   (check the dump is non-empty)
 3. Stop the backend so nobody edits/creates a listed company or its needs
    analyses mid-run (the MySQL part is one transaction, but the Mongo part runs
    before it and the two are not atomic together). The frontend can stay up.
       docker compose -f docker-compose.yaml -f docker-compose.prod.yaml stop backend
 4. Dry run (default). The DBs are not published on the host in prod, so run it
    inside the compose network by reusing the startup-script image (it loads the
    root .env, which holds MYSQL_URI / MONGO_URI and the *_ANNEMASSE_URI, and
    forces NODE_ENV=production) with the scripts folder and SIRET file mounted.
    Run from the repo root; --no-deps keeps sql-db/nosql-db untouched.
       docker compose -f docker-compose.yaml -f docker-compose.prod.yaml run --rm --no-deps \\
         -v "$PWD/scripts:/app" -v "$PWD/temp_siretfile:/data/sirets.txt:ro" \\
         startup-script python -u delete_companies.py /data/sirets.txt --tenant reunion
    Read the report: invalid lines, SIRETs not found, companies skipped because of
    Mongo links. Rerun with --tenant annemasse if the list concerns both tenants.
 5. Execute: same command + --execute (add --cascade only if the skipped
    companies must go too). Type 'y' at the prompt.
 6. Restart the backend and smoke-test the companies list:
       docker compose -f docker-compose.yaml -f docker-compose.prod.yaml start backend
 Rollback: restore the step-2 dump (the JSON backup is for inspection or
 targeted re-insertion, not an automatic restore).

LOCAL (dev): `docker compose up -d sql-db nosql-db`, then from scripts/:
       LOCAL_MYSQL_PORT=4010 MONGO_PORT=4011 python delete_companies.py ../temp_siretfile --tenant reunion
 (ports = the host-published ones from docker-compose.yaml; MYSQL_USER must be
 root locally since the helper uses MYSQL_ROOT_PASSWORD.)
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

from db.mongo import get_mongo_connection
from db.mysql import get_mysql_connection

BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")
CHUNK_SIZE = 500
SIRET_RE = re.compile(r"^\d{14}$")
REPORT_PREVIEW = 20

# MySQL children of companies, keyed by company_id.
CHILD_TABLES = ("company_history", "contact_logs", "relance_history")


def connect(tenant: str, mysql_db: str, mongo_db: str):
    """Return (mysql conn, mongo client, mongo db) for the tenant.

    Like the backend, Annemasse uses MYSQL_ANNEMASSE_URI / MONGO_ANNEMASSE_URI when
    set (production); otherwise the Réunion connection with the Annemasse db names.
    """
    if tenant == "annemasse" and os.getenv("NODE_ENV") == "production":
        for key in ("MYSQL_URI", "MONGO_URI"):
            override = os.getenv(key.replace("_URI", "_ANNEMASSE_URI"))
            if override:
                os.environ[key] = override
    conn = get_mysql_connection()
    conn.database = mysql_db
    client = get_mongo_connection()
    return conn, client, client[mongo_db]


def tenant_databases(tenant: str) -> tuple[str, str]:
    if tenant == "annemasse":
        return (
            os.getenv("MYSQL_ANNEMASSE_DATABASE", "disciplina_annemasse"),
            os.getenv("MONGO_ANNEMASSE_DATABASE", "disciplina_annemasse"),
        )
    return (
        os.getenv("MYSQL_DATABASE", "disciplina"),
        os.getenv("MONGO_DB_NAME", "human_ressources"),
    )


# ── Input ────────────────────────────────────────────────────────────────────


def read_sirets(path: str):
    """Return (unique sirets in file order, invalid [(line_no, raw)], duplicate count)."""
    sirets, seen, invalid, duplicates = [], set(), [], 0
    with open(path, encoding="utf-8-sig") as file:
        for line_no, raw in enumerate(file, start=1):
            value = re.sub(r"\s+", "", raw)  # also strips \r, tabs, NBSP
            if not value or value.startswith("#"):
                continue
            if not SIRET_RE.match(value):
                invalid.append((line_no, raw.strip()))
                continue
            if value in seen:
                duplicates += 1
                continue
            seen.add(value)
            sirets.append(value)
    return sirets, invalid, duplicates


def chunks(items: list, size: int = CHUNK_SIZE):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def placeholders(items: list) -> str:
    return ", ".join(["%s"] * len(items))


# ── Lookup ───────────────────────────────────────────────────────────────────


def fetch_companies(cursor, sirets: list[str]) -> list[dict]:
    rows = []
    for chunk in chunks(sirets):
        cursor.execute(f"SELECT * FROM companies WHERE siret IN ({placeholders(chunk)})", chunk)
        rows.extend(cursor.fetchall())
    return rows


def existing_tables(cursor, names) -> set[str]:
    cursor.execute(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()"
    )
    present = {row["name"] for row in cursor.fetchall()}
    return {name for name in names if name in present}


def as_int(value):
    """Mongo Number fields may come back as float; MySQL ids are int."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return int(value)
    return None


def find_mongo_links(db, companies: list[dict]) -> dict[int, dict]:
    """Map company id -> {needs_analysis, offers, candidates} live Mongo documents."""
    ids = [c["id"] for c in companies]
    by_siret = {c["siret"]: c["id"] for c in companies}
    by_ab = {c["ab_id"]: c["id"] for c in companies if c.get("ab_id")}
    links = {cid: {"needs_analysis": [], "offers": [], "candidates": []} for cid in ids}

    na_owner = {}
    na_query = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"company_infos.id": {"$in": ids}},
            {"company_infos.siret": {"$in": list(by_siret)}},
            {"_id": {"$in": list(by_ab)}},
        ],
    }
    for doc in db["needs_analysis"].find(na_query):
        infos = doc.get("company_infos") or {}
        owner = as_int(infos.get("id")) if as_int(infos.get("id")) in links else None
        owner = owner or by_siret.get(infos.get("siret")) or by_ab.get(doc["_id"])
        if owner is not None:
            na_owner[doc["_id"]] = owner
            links[owner]["needs_analysis"].append(doc)

    offer_owner = {}
    offer_query = {
        "$or": [
            {"company_infos.id": {"$in": ids}},
            {"needs_analysis_id": {"$in": list(na_owner)}},
        ]
    }
    for doc in db["offers"].find(offer_query):
        infos = doc.get("company_infos") or {}
        company_id = as_int(infos.get("id"))
        owner = company_id if company_id in links else na_owner.get(doc.get("needs_analysis_id"))
        if owner is not None:
            offer_owner[doc["_id"]] = owner
            links[owner]["offers"].append(doc)

    candidate_query = {
        "$or": [
            {"immersion_company_id": {"$in": ids}},
            {"contract_company_id": {"$in": ids}},
            {"contract_offer_id": {"$in": list(offer_owner)}},
        ]
    }
    for doc in db["candidates"].find(candidate_query):
        owners = {
            as_int(doc.get("immersion_company_id")),
            as_int(doc.get("contract_company_id")),
            offer_owner.get(doc.get("contract_offer_id")),
        }
        for owner in owners & set(links):
            links[owner]["candidates"].append(doc)
    return links


def has_links(entry: dict) -> bool:
    return any(entry[key] for key in ("needs_analysis", "offers", "candidates"))


# ── Backup ───────────────────────────────────────────────────────────────────


def collect_mysql_backup(cursor, tables: set[str], company_ids: list[int], todo_refs: list[str]):
    backup = {}
    for table in CHILD_TABLES:
        if table not in tables:
            continue
        backup[table] = []
        for chunk in chunks(company_ids):
            cursor.execute(f"SELECT * FROM {table} WHERE company_id IN ({placeholders(chunk)})", chunk)
            backup[table].extend(cursor.fetchall())
    if "todos" in tables:
        backup["todos"] = []
        for chunk in chunks(todo_refs):
            cursor.execute(
                f"SELECT * FROM todos WHERE source = 'SYSTEM' AND {todo_ref_clause(chunk)}",
                todo_ref_params(chunk),
            )
            backup["todos"].extend(cursor.fetchall())
    return backup


def todo_ref_clause(chunk: list[str]) -> str:
    # 'relance:<id>' matches 'relance:<id>:<date>'; 'ab:<id>' matches exactly.
    return (
        f"(SUBSTRING_INDEX(source_ref, ':', 2) IN ({placeholders(chunk)}) "
        f"OR source_ref IN ({placeholders(chunk)}))"
    )


def todo_ref_params(chunk: list[str]) -> list[str]:
    return chunk + chunk


def write_backup(tenant: str, payload: dict) -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(BACKUP_DIR, f"deleted_companies_{tenant}_{stamp}.json")
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2, default=str)
    return path


# ── Delete ───────────────────────────────────────────────────────────────────


def cascade_mongo(db, na_ids: list[str], offer_ids: list[str], company_ids: list[int]) -> dict:
    counts = {"needs_analysis_soft_deleted": 0, "offers": 0, "offer_history": 0, "candidates_unlinked": 0}
    for chunk in chunks(offer_ids):
        counts["offer_history"] += db["offer_history"].delete_many({"offer_id": {"$in": chunk}}).deleted_count
        counts["offers"] += db["offers"].delete_many({"_id": {"$in": chunk}}).deleted_count
    for chunk in chunks(na_ids):
        counts["needs_analysis_soft_deleted"] += (
            db["needs_analysis"].update_many({"_id": {"$in": chunk}}, {"$set": {"is_deleted": True}}).modified_count
        )
    for field, values in (
        ("immersion_company_id", company_ids),
        ("contract_company_id", company_ids),
        ("contract_offer_id", offer_ids),
    ):
        for chunk in chunks(values):
            counts["candidates_unlinked"] += (
                db["candidates"].update_many({field: {"$in": chunk}}, {"$unset": {field: ""}}).modified_count
            )
    return counts


def delete_mysql(conn, cursor, tables: set[str], company_ids: list[int], todo_refs: list[str], offer_ids: list[str]):
    """Single transaction: either every listed company goes, or none does."""
    counts = {}
    # autocommit is off (connector default): the earlier SELECTs already opened the
    # transaction, so no start_transaction() here — everything below lands in it.
    try:
        if offer_ids and "external_access" in tables:
            counts["external_access"] = 0
            for chunk in chunks(offer_ids):
                cursor.execute(
                    f"DELETE FROM external_access WHERE external_type = 'COMPANY' "
                    f"AND external_id IN ({placeholders(chunk)})",
                    chunk,
                )
                counts["external_access"] += cursor.rowcount
        if "todos" in tables:
            counts["todos"] = 0
            for chunk in chunks(todo_refs):
                cursor.execute(
                    f"DELETE FROM todos WHERE source = 'SYSTEM' AND {todo_ref_clause(chunk)}",
                    todo_ref_params(chunk),
                )
                counts["todos"] += cursor.rowcount
        for table in CHILD_TABLES:
            if table not in tables:
                continue
            counts[table] = 0
            for chunk in chunks(company_ids):
                cursor.execute(f"DELETE FROM {table} WHERE company_id IN ({placeholders(chunk)})", chunk)
                counts[table] += cursor.rowcount
        counts["companies"] = 0
        for chunk in chunks(company_ids):
            cursor.execute(f"DELETE FROM companies WHERE id IN ({placeholders(chunk)})", chunk)
            counts["companies"] += cursor.rowcount
        if counts["companies"] != len(company_ids):
            raise RuntimeError(
                f"expected to delete {len(company_ids)} companies, deleted {counts['companies']} — rolled back"
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return counts


# ── Report ───────────────────────────────────────────────────────────────────


def print_list(title: str, items: list[str]) -> None:
    if not items:
        return
    print(f"\n{title} ({len(items)}):")
    for item in items[:REPORT_PREVIEW]:
        print(f"  {item}")
    if len(items) > REPORT_PREVIEW:
        print(f"  ... {len(items) - REPORT_PREVIEW} more (full list in the report/backup file)")


def describe_links(company: dict, entry: dict) -> str:
    signed = sum(1 for na in entry["needs_analysis"] if na.get("signature_request_id"))
    parts = [
        f"{len(entry['needs_analysis'])} needs_analysis" + (f" ({signed} signed)" if signed else ""),
        f"{len(entry['offers'])} offers",
        f"{len(entry['candidates'])} candidates",
    ]
    return f"{company['siret']}  id={company['id']}  {company.get('name')!r}: " + ", ".join(parts)


def confirm(prompt: str) -> bool:
    return input(f"{prompt} [y/N] ").strip().lower() == "y"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Delete companies listed by SIRET (dry run by default).")
    parser.add_argument("siret_file", help="Text file, one SIRET per line")
    parser.add_argument("--tenant", required=True, choices=("reunion", "annemasse"))
    parser.add_argument("--execute", action="store_true", help="Actually delete (default: dry run)")
    parser.add_argument(
        "--cascade",
        action="store_true",
        help="Also delete companies linked to Mongo data, cleaning that data (default: skip them)",
    )
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    return parser.parse_args()


def main() -> int:
    load_dotenv()
    args = parse_args()
    mysql_db, mongo_db = tenant_databases(args.tenant)

    sirets, invalid, duplicates = read_sirets(args.siret_file)
    print(f"Tenant           : {args.tenant} (MySQL `{mysql_db}`, Mongo `{mongo_db}`)")
    print(f"Mode             : {'EXECUTE' if args.execute else 'DRY RUN'}{' + cascade' if args.cascade else ''}")
    print(f"Valid SIRETs     : {len(sirets)}  (duplicates ignored: {duplicates}, invalid lines: {len(invalid)})")
    print_list(
        "Invalid lines — ignored, fix them in the file if they are real SIRETs",
        [
            f"line {n}: {raw!r}" + (f"  (13 digits: missing leading zero? 0{raw})" if re.fullmatch(r"\d{13}", raw) else "")
            for n, raw in invalid
        ],
    )
    if not sirets:
        print("\nNothing to do.")
        return 0

    conn, client, db = connect(args.tenant, mysql_db, mongo_db)
    try:
        cursor = conn.cursor(dictionary=True)

        companies = fetch_companies(cursor, sirets)
        found = {c["siret"] for c in companies}
        not_found = [s for s in sirets if s not in found]
        links = find_mongo_links(db, companies)
        linked = [c for c in companies if has_links(links[c["id"]])]
        targets = companies if args.cascade else [c for c in companies if not has_links(links[c["id"]])]

        print(f"Found in DB      : {len(companies)}")
        print(f"Not found        : {len(not_found)}")
        print(f"With Mongo links : {len(linked)}  ({'deleted with cleanup' if args.cascade else 'SKIPPED, use --cascade'})")
        print(f"To delete        : {len(targets)}")
        print_list("Not found in this tenant", not_found)
        print_list("Linked to MongoDB data", [describe_links(c, links[c["id"]]) for c in linked])

        target_ids = [c["id"] for c in targets]
        na_docs = [d for c in targets for d in links[c["id"]]["needs_analysis"]] if args.cascade else []
        offer_docs = [d for c in targets for d in links[c["id"]]["offers"]] if args.cascade else []
        candidate_docs = {d["_id"]: d for c in targets for d in links[c["id"]]["candidates"]} if args.cascade else {}
        na_ids = [d["_id"] for d in na_docs]
        offer_ids = [d["_id"] for d in offer_docs]
        todo_refs = [f"relance:{cid}" for cid in target_ids] + [f"ab:{na_id}" for na_id in na_ids]
        if na_docs and any(d.get("signature_request_id") for d in na_docs):
            print("\nWARNING: some needs analyses are signed — DocuSeal/Drive documents are NOT removed.")

        if not targets:
            print("\nNothing to delete.")
            return 0

        tables = existing_tables(cursor, CHILD_TABLES + ("todos", "external_access"))
        backup = {
            "tenant": args.tenant,
            "siret_file": os.path.abspath(args.siret_file),
            "invalid_lines": invalid,
            "not_found": not_found,
            "skipped_linked": [c["siret"] for c in linked] if not args.cascade else [],
            "mysql": {"companies": targets, **collect_mysql_backup(cursor, tables, target_ids, todo_refs)},
            "mongo": {"needs_analysis": na_docs, "offers": offer_docs, "candidates": list(candidate_docs.values())},
        }
        if offer_ids and "external_access" in tables:
            rows = []
            for chunk in chunks(offer_ids):
                cursor.execute(
                    f"SELECT * FROM external_access WHERE external_type = 'COMPANY' "
                    f"AND external_id IN ({placeholders(chunk)})",
                    chunk,
                )
                rows.extend(cursor.fetchall())
            backup["mysql"]["external_access"] = rows
        if offer_ids:
            backup["mongo"]["offer_history"] = [
                d for chunk in chunks(offer_ids) for d in db["offer_history"].find({"offer_id": {"$in": chunk}})
            ]
        backup_path = write_backup(args.tenant, backup)
        print(f"\nBackup/report written to {backup_path}")
        print("Rows that would be removed: " + ", ".join(
            f"{table}={len(rows)}" for table, rows in backup["mysql"].items()
        ))

        if not args.execute:
            print("\nDry run — nothing deleted. Re-run with --execute to apply.")
            return 0
        if not args.yes and not confirm(f"Delete {len(targets)} companies from tenant '{args.tenant}'?"):
            print("Aborted.")
            return 1

        # Mongo first: its operations are idempotent, so if the MySQL transaction
        # then fails and rolls back, a re-run simply finds nothing left to clean.
        if args.cascade:
            print(f"Mongo cleanup    : {cascade_mongo(db, na_ids, offer_ids, target_ids)}")
        print(f"MySQL deleted    : {delete_mysql(conn, cursor, tables, target_ids, todo_refs, offer_ids)}")

        remaining = fetch_companies(cursor, [c["siret"] for c in targets])
        if remaining:
            print(f"ERROR: {len(remaining)} companies still present after deletion", file=sys.stderr)
            return 1
        print("Verified: none of the deleted SIRETs remain.")
        return 0
    finally:
        conn.close()
        client.close()


if __name__ == "__main__":
    sys.exit(main())
