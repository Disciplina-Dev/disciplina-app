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


def _connect_local():
    password = os.getenv("MYSQL_ROOT_PASSWORD")
    if not password:
        raise ValueError("MYSQL_ROOT_PASSWORD must be set")
    config = {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": 3306,
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
