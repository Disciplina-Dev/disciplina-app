import os
import csv
import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    return mysql.connector.connect(
        host='localhost',
        port=5000,
        user='root',
        password=os.getenv("MYSQL_ROOT_PASSWORD"),
        database="sales_service",
    )

def select_salers(name: str, email: str) -> int:
    if name.capitalize() == "Amanda" or email == 'sinaman.commercial@disciplina.re': return 2
    if name.capitalize() == "Brandon" or email == 'galmar.commercial@disciplina.re': return 3
    if name.capitalize() == "Emile" or email == 'lebon.commercial@disciplina.re': return 4
    return 1


def import_csv_to_db(csv_path: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    insert_query = """
        INSERT IGNORE INTO companies (
            sale_person_id, legal_referent, name, phone, email,
            address, sector, main_activity, SIRET, IDCC,
            notes, conclusion
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """

    rows_inserted = 0
    rows_skipped = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                cursor.execute(insert_query, (
                    select_salers(row.get("Commercial"), row.get('Propriétaire du contact')),
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