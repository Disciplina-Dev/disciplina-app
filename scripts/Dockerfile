FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY delete_companies.py seed_annemasse_test_data.py ./
COPY db/ ./db/

# Plus de seed CSV au démarrage : le service sert de conteneur d'outillage
# (`docker compose run --rm startup-script python -u <script>.py`, cf. HOWTODEPLOY.md).
CMD ["python", "-c", "print('startup-script: aucun job par defaut - lancer delete_companies.py ou seed_annemasse_test_data.py')"]
