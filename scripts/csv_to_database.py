import os
import csv
import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", "5000")),
        user=os.getenv("MYSQL_USER", "mysql-user"),
        password=os.getenv("MYSQL_PASSWORD", "mysql-user-secret-pw"),
        database=os.getenv("MYSQL_DATABASE", "sales_service"),
    )


def import_csv_to_db(csv_path: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    insert_query = """
        INSERT IGNORE INTO companies (
            owner, commercial, legal_referent, contact_name, phone, email,
            address, sector, job_description, siret, idcc,
            notes, conclusion
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """

    rows_inserted = 0
    rows_skipped = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                cursor.execute(insert_query, (
                    row.get("Propriétaire du contact"),
                    row.get("Commercial"),
                    row.get("Représentant légale"),
                    row.get("Nom commercial"),
                    row.get("Numéro de téléphone"),
                    row.get("Adresse e-mail"),
                    row.get("ADRESSE"),
                    row.get("SECTEUR"),
                    row.get("METIER/Description"),
                    row.get("SIRET"),
                    row.get("IDCC"),
                    row.get("Note à moi même"),
                    row.get("Conclusion"),
                ))
                rows_inserted += 1
            except Exception as e:
                print(f"Error inserting row: {e}")
                rows_skipped += 1

    conn.commit()
    cursor.close()
    conn.close()

    print(f"Import complete: {rows_inserted} inserted, {rows_skipped} skipped")


if __name__ == "__main__":
    csv_path = os.path.join(
        os.path.dirname(__file__), "..", "ressources", "suivi_client-contact.csv"
    )
    csv_path = os.path.abspath(csv_path)
    import_csv_to_db(csv_path)