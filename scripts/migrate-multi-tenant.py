#!/usr/bin/env python3
"""Migration multi-tenant : bascule des volumes locaux vers 2 bases par conteneur.

Contexte : `disciplina` + `disciplina_annemasse` (MySQL) et `human_ressources`
+ `disciplina_annemasse` (MongoDB) cohabitent désormais dans les MÊMES conteneurs.
Les scripts docker-entrypoint-initdb.d ne s'exécutent que sur volume vierge : une
base locale déjà peuplée doit donc être sauvée puis rejouée.

Pipeline (côté hôte, nécessite docker + docker compose) :
  1. Dump `disciplina` (MySQL) et `human_ressources` (MongoDB) via docker exec
  2. `docker compose down` puis purge des répertoires de données (bind mounts)
  3. `docker compose up -d sql-db nosql-db` -> init scripts créent les 2 bases
  4. Restore des dumps dans leurs bases d'origine
  5. Vérification finale (tables/collections/documents des 4 bases)

Garde-fou : refuse toute cible non-locale ou NODE_ENV=production (règle du repo,
cf. db/guard.py). Utilisez --dry-run pour visualiser les commandes sans agir.
Les étapes destructives demandent une confirmation explicite.

Usage :
  python scripts/migrate-multi-tenant.py [--dry-run]
  python scripts/migrate-multi-tenant.py --backup-dir /tmp/backups
"""

import argparse
import datetime
import os
import subprocess
import sys
import time
from pathlib import Path

from db.guard import guard_local_target

REPO_ROOT = Path(__file__).resolve().parent.parent
MYSQL_DATA = REPO_ROOT / "database" / "mysql" / "mysql-data"
MONGO_DATA = REPO_ROOT / "database" / "mongodb" / "mongo-data"
DEFAULT_BACKUP_DIR = REPO_ROOT / "scripts" / "backups"
COMPOSE_FILE = REPO_ROOT / "docker-compose.yaml"

MYSQL_DB = "disciplina"
MONGO_DB = "human_ressources"
MONGO_ANNEMASSE_DB = "disciplina_annemasse"


def compose_ps(service):
    """ID (court) du conteneur du service, ou chaîne vide si arrêté."""
    out = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "ps", "-q", service],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    return out.stdout.strip()


def load_dotenv():
    """Charge la racine .env avec la même logique que scripts/startup.py."""
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def require_env(*names):
    missing = [n for n in names if not os.getenv(n)]
    if missing:
        sys.exit(f"Variables manquantes dans le .env racine : {', '.join(missing)}")


def wait_mysql_ready(container_id, password):
    print("[wait] MySQL prêt (ping)...")
    for _ in range(30):
        probe = subprocess.run(
            ["docker", "exec", container_id, "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p" + password],
            capture_output=True, text=True,
        )
        if "mysqld is alive" in probe.stdout:
            print("[wait] MySQL est vivant.")
            return
        time.sleep(3)
    sys.exit("Abandon : MySQL pas prêt après 90s.")


def wait_mongo_ready():
    print("[wait] MongoDB prêt (ping)...")
    from pymongo import MongoClient
    uri = f"mongodb://{os.getenv('MONGO_ROOT_USERNAME')}:{os.getenv('MONGO_ROOT_PASSWORD')}@localhost:{os.getenv('MONGO_PORT', '27017')}/?authSource=admin"
    for _ in range(30):
        try:
            MongoClient(uri, serverSelectionTimeoutMS=3000).admin.command("ping")
            print("[wait] MongoDB est vivant.")
            return
        except Exception:
            time.sleep(3)
    sys.exit("Abandon : MongoDB pas prêt après 90s.")


def dump_mysql(container_id, password, target: Path):
    cmd = ["docker", "exec", container_id, "sh", "-c",
           f'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers {MYSQL_DB}']
    print(f"  $ {' '.join(cmd)}  >  {target}")
    with open(target, "w", encoding="utf-8") as f:
        subprocess.run(cmd, stdout=f, check=True, env={"MYSQL_ROOT_PASSWORD": password, "PATH": os.environ.get("PATH", "")})
    print(f"  OK -- MySQL → {target}")


def dump_mongo(container_id, target: Path):
    cmd = ["docker", "exec", container_id, "sh", "-c",
           f'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" '
           f'--authenticationDatabase admin --db {MONGO_DB} --archive --gzip > /tmp/{target.name}']
    print(f"  $ {' '.join(cmd)}  puis docker cp")
    subprocess.run(cmd, check=True)
    subprocess.run(["docker", "cp", f"{container_id}:/tmp/{target.name}", str(target)], check=True)
    print(f"  OK -- MongoDB → {target}")


def restore_mysql(container_id, password, source: Path):
    print(f"  $ docker exec {container_id} mysql -uroot -p*** {MYSQL_DB}  <<  {source}")
    subprocess.run(
        ["docker", "exec", "-i", container_id, "mysql", "-uroot", "-p" + password, MYSQL_DB],
        stdin=open(source, "r", encoding="utf-8"), check=True,
    )
    print("  OK -- MySQL restauré")


def restore_mongo(container_id, source: Path):
    """Restore en docs-only. Les index sont déjà créés par mongo-init.js (dont le
    text index canonique) : --noIndexRestore évite le conflit avec l'index legacy
    de l'archive. Le vidage d'abord rend le restore rejouable (mongorestore n'est
    pas idempotent)."""
    print(f"  $ docker exec {container_id} mongosh --eval wipe.inhuman_ressources")
    subprocess.run(
        ["docker", "exec", container_id, "mongosh", "-u", os.getenv("MONGO_ROOT_USERNAME", ""),
         "-p", os.getenv("MONGO_ROOT_PASSWORD", ""), "--authenticationDatabase", "admin", "--quiet", "--eval",
         f"db.getSiblingDB('{MONGO_DB}').getCollectionNames().forEach(c => "
         f"db.getSiblingDB('{MONGO_DB}').getCollection(c).deleteMany({{}}))"],
        check=True,
    )
    print(f"  $ docker exec {container_id} mongorestore --noIndexRestore --archive  <<  {source}")
    with open(source, "rb") as f:
        subprocess.run(
            ["docker", "exec", "-i", container_id, "mongorestore",
             "--username", os.getenv("MONGO_ROOT_USERNAME", ""),
             "--password", os.getenv("MONGO_ROOT_PASSWORD", ""),
             "--authenticationDatabase", "admin",
             f"--nsInclude={MONGO_DB}.*", "--gzip", "--noIndexRestore", "--archive"],
            input=f.read(), check=True,
        )
    print("  OK -- MongoDB restauré")


def purge_data_dir():
    """Vide les répertoires de données. Les fichiers des conteneurs MySQL/Mongo
    sont root-ouverts : un rm hôte échouerait, on purge donc via un conteneur root."""
    print(f"  $ docker run --rm -v {MYSQL_DATA}:/d/mysql -v {MONGO_DATA}:/d/mongo alpine rm -rf /d/mysql/* /d/mongo/*")
    subprocess.run(
        ["docker", "run", "--rm", "-v", f"{MYSQL_DATA}:/d/mysql", "-v", f"{MONGO_DATA}:/d/mongo",
         "alpine", "sh", "-c", "rm -rf /d/mysql/* /d/mongo/* /d/mysql/.??* /d/mongo/.??*"],
        check=True,
    )
    for d in (MYSQL_DATA, MONGO_DATA):
        d.mkdir(parents=True, exist_ok=True)
    print("  OK -- répertoires vidés")


def mysql_table_counts(container_id, password):
    out = subprocess.run(
        ["docker", "exec", container_id, "mysql", "-uroot", "-p" + password, "-N", "-e",
         "SELECT CONCAT('disciplina tables:', COUNT(*)) FROM information_schema.tables WHERE table_schema='disciplina' "
         "UNION ALL SELECT CONCAT('annemasse tables:', COUNT(*)) FROM information_schema.tables WHERE table_schema='disciplina_annemasse' "
         "AND table_name NOT IN ('interview_access','match_link','external_link')"],
        capture_output=True, text=True,
    )
    return out.stdout.strip().splitlines()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="affiche le plan sans rien exécuter")
    parser.add_argument("--backup-dir", default=str(DEFAULT_BACKUP_DIR), help="répertoire racine des dumps")
    parser.add_argument("--resume-dir", default=None,
                        help="répertoire contenant DÉJÀ disciplina-*.sql et human_ressources-*.archive : "
                             "saute le dump (reprendre après un échec) ; --backup-dir est alors ignoré")
    args = parser.parse_args()
    dry = args.dry_run

    load_dotenv()
    guard_local_target(action="Migration multi-tenant")
    require_env("MYSQL_ROOT_PASSWORD", "MONGO_ROOT_USERNAME", "MONGO_ROOT_PASSWORD")

    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    if args.resume_dir:
        backup_dir = Path(args.resume_dir)
        mysql_dumps = list(backup_dir.glob("disciplina-*.sql"))
        mongo_dumps = list(backup_dir.glob("human_ressources-*.archive"))
        if not (mysql_dumps and mongo_dumps):
            sys.exit(f"--resume-dir {backup_dir} doit contenir un dump disciplina-*.sql ET human_ressources-*.archive")
        mysql_dump, mongo_dump = mysql_dumps[0], mongo_dumps[0]
        print(f"  mode reprise : dumps trouvés dans {backup_dir}")
    else:
        backup_dir = Path(args.backup_dir) / ts
        mysql_dump = backup_dir / f"{MYSQL_DB}-{ts}.sql"
        mongo_dump = backup_dir / f"{MONGO_DB}-{ts}.archive"
    resume = args.resume_dir is not None

    if not dry and not resume:
        sql_id = compose_ps("sql-db")
        nosql_id = compose_ps("nosql-db")
        if not (sql_id and nosql_id):
            sys.exit("Les conteneurs sql-db / nosql-db doivent être up avant de sauvegarder : docker compose up -d sql-db nosql-db")

    print("=" * 60)
    print(f"  Migration multi-tenant | dry-run={dry}")
    print(f"  backups : {backup_dir}")
    print("=" * 60)

    # 1. Sauvegarde
    if resume:
        print("\n[1/5] Dump ignoré (--resume-dir) : dumps existants réutilisés.")
    else:
        print("\n[1/5] Dump des bases existantes...")
        if dry:
            print(f"  $ mysqldump {MYSQL_DB}  >  {mysql_dump}")
            print(f"  $ mongodump --db {MONGO_DB}  >  {mongo_dump}")
        else:
            backup_dir.mkdir(parents=True, exist_ok=True)
            dump_mysql(sql_id, os.getenv("MYSQL_ROOT_PASSWORD", ""), mysql_dump)
            dump_mongo(nosql_id, mongo_dump)

    # 2. Destructif (confirmé)
    print("\n[2/5] Arrêt + purge des répertoires de données...")
    if not dry:
        print(f"  ⚠  Voici les répertoires qui seront VIDÉS :\n    - {MYSQL_DATA}\n    - {MONGO_DATA}")
        if input("  Confirmer la purge (oui/non) ? ").strip().lower() not in ("o", "oui", "yes", "y"):
            print("  Annulé. Aucune modification.")
            return 1
    subprocess.run(["docker", "compose", "-f", str(COMPOSE_FILE), "down"], cwd=str(REPO_ROOT), check=not dry) if not dry else None
    if dry:
        print("  $ docker compose down")
        print(f"  $ docker run --rm -v {MYSQL_DATA}:/d/mysql -v {MONGO_DATA}:/d/mongo alpine rm -rf /d/mysql/* /d/mongo/*")
    else:
        purge_data_dir()

    # 3. Démarrage neuf
    print("\n[3/5] Redémarrage des bases (init scripts → 2 bases chacune)...")
    if dry:
        print("  $ docker compose up -d sql-db nosql-db")
    else:
        subprocess.run(["docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d", "sql-db", "nosql-db"], cwd=str(REPO_ROOT), check=True)
        # Les conteneurs sont recréés : relire les IDs (celui d'avant le down est obsolète).
        sql_id = compose_ps("sql-db")
        nosql_id = compose_ps("nosql-db")
        wait_mysql_ready(sql_id, os.getenv("MYSQL_ROOT_PASSWORD", ""))
        wait_mongo_ready()

    # 4. Restore
    print("\n[4/5] Restore des dumps dans leurs bases d'origine...")
    if dry:
        print(f"  $ mysql {MYSQL_DB}  <<  {mysql_dump}")
        print(f"  $ mongorestore --nsInclude={MONGO_DB}.*  <<  {mongo_dump}")
    else:
        restore_mysql(sql_id, os.getenv("MYSQL_ROOT_PASSWORD", ""), mysql_dump)
        restore_mongo(nosql_id, mongo_dump)

    # 5. Vérification
    print("\n[5/5] Vérification...")
    if dry:
        print("  (dry-run : pas de vérification)")
    else:
        print("  " + "\n  ".join(mysql_table_counts(sql_id, os.getenv("MYSQL_ROOT_PASSWORD", ""))))
        from pymongo import MongoClient
        uri = f"mongodb://{os.getenv('MONGO_ROOT_USERNAME')}:{os.getenv('MONGO_ROOT_PASSWORD')}@localhost:{os.getenv('MONGO_PORT', '27017')}/?authSource=admin"
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        for db_name in (MONGO_DB, MONGO_ANNEMASSE_DB):
            d = client[db_name]
            print(f"  {db_name} collections : {len(d.list_collection_names())}")

    print("\nTerminé.")
    return 0


if __name__ == "__main__":
    sys.exit(main())