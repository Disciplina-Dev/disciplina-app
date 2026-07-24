"""MySQL/TiDB connection helper.

Production (NODE_ENV=production) connects through MYSQL_URI with TLS required
(TiDB Cloud). Development uses the individual MYSQL_* variables against the local
Docker container, retrying until it is ready.
"""

import os
import time
from urllib.parse import urlparse

import mysql.connector


def get_mysql_connection():
    node_env = os.getenv("NODE_ENV", "development")
    if node_env == "production":
        return _connect_from_uri()
    return _connect_local()


def connect_source_mysql():
    return _connect_from_uri()


def connect_target_mysql():
    return _connect_local()


def _connect_from_uri():
    mysql_uri = os.getenv("MYSQL_URI")
    if not mysql_uri:
        raise ValueError("MYSQL_URI must be set in production mode")
    parsed = urlparse(mysql_uri)
    return mysql.connector.connect(
        host=parsed.hostname or "localhost",
        port=parsed.port or 3306,
        user=parsed.username or "root",
        password=parsed.password or "",
        database=parsed.path.lstrip("/") or "disciplina",
        ssl_disabled=False,
        connection_timeout=10,
        charset="utf8mb4",
        collation="utf8mb4_0900_ai_ci",
    )


def local_mysql_target():
    """Cible MySQL locale, source unique de vérité pour la connexion et le garde-fou.

    Volontairement distincte de MYSQL_HOST/MYSQL_PORT, dont la sémantique est
    asymétrique : MYSQL_HOST est le nom du service vu depuis le réseau compose
    (sql-db), alors que MYSQL_PORT est le port publié côté hôte (5001, à gauche du
    mapping `ports:`) — le conteneur, lui, écoute sur 3306.

    Les défauts ci-dessous visent l'hôte (localhost:5001, port mappé). Dans le
    réseau compose, docker-compose.yaml passe LOCAL_MYSQL_HOST=sql-db et
    LOCAL_MYSQL_PORT=3306 au service startup-script.
    """
    return (
        os.getenv("LOCAL_MYSQL_HOST", "localhost"),
        int(os.getenv("LOCAL_MYSQL_PORT", "3306")),
    )


def _connect_local():
    password = os.getenv("MYSQL_ROOT_PASSWORD")
    if not password:
        raise ValueError("MYSQL_ROOT_PASSWORD must be set")
    host, port = local_mysql_target()
    config = {
        "host": host,
        "port": port,
        "user": os.getenv("MYSQL_USER", "root"),
        "password": password,
        "database": os.getenv("MYSQL_DATABASE", "disciplina"),
        "charset": "utf8mb4",
        "collation": "utf8mb4_0900_ai_ci",
    }
    for attempt in range(1, 6):
        try:
            conn = mysql.connector.connect(**config)
            conn.ping()
            return conn
        except Exception:
            if attempt == 5:
                raise
            print(f"MySQL not ready (attempt {attempt}/5), retrying in 3s...")
            time.sleep(3)
