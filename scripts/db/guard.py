"""Garde-fou : refuse d'écrire ailleurs que sur les bases locales.

Contrôle les hôtes que les connexions utilisent réellement (via local_*_target),
pas des variables voisines qui pourraient ne pas être celles qu'on croit.
"""

import os
import sys

from db.mongo import local_mongo_target
from db.mysql import local_mysql_target

LOCAL_HOSTS = {"localhost", "127.0.0.1", "sql-db", "nosql-db"}


def local_target_violations():
    violations = []
    mysql_host, _ = local_mysql_target()
    if mysql_host not in LOCAL_HOSTS:
        violations.append(f"cible MySQL '{mysql_host}'")
    mongo_host, _ = local_mongo_target()
    if mongo_host not in LOCAL_HOSTS:
        violations.append(f"cible MongoDB '{mongo_host}'")
    if os.getenv("NODE_ENV") == "production":
        violations.append("NODE_ENV=production")
    return violations


def guard_local_target(action="Import"):
    violations = local_target_violations()
    if violations:
        sys.exit(f"Refus: {', '.join(violations)} — la cible doit être locale. {action} annulé.")
