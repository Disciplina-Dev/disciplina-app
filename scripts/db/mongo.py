"""MongoDB connection helper.

Production (NODE_ENV=production) connects through MONGO_URI. Development uses the
individual MONGO_* variables against the local Docker container, retrying until it
is ready.
"""

import os
import time

from pymongo import MongoClient


def get_mongo_connection():
    node_env = os.getenv("NODE_ENV", "development")
    if node_env == "production":
        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
            raise ValueError("MONGO_URI must be set in production mode")
        return MongoClient(mongo_uri)
    # development: use individual vars, retry until local container is ready
    username = os.getenv("MONGO_ROOT_USERNAME")
    password = os.getenv("MONGO_ROOT_PASSWORD")
    port = os.getenv("MONGO_PORT", "27017")
    host = os.getenv("MONGO_HOST", "localhost")
    if not username or not password:
        raise ValueError("MONGO_ROOT_USERNAME and MONGO_ROOT_PASSWORD must be set")
    uri = f"mongodb://{username}:{password}@{host}:{port}/?authSource=admin"
    for attempt in range(1, 6):
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=3000)
            client.admin.command("ping")
            return client
        except Exception:
            if attempt == 5:
                raise
            print(f"MongoDB not ready (attempt {attempt}/5), retrying in 3s...")
            time.sleep(3)
