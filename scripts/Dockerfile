FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY delete_companies.py seed_annemasse_test_data.py ./
COPY db/ ./db/
COPY lib/ ./lib/

# Legacy CSV seed (startup.py + import_*.py) was removed in #778. The image is
# kept as a runner for the surviving admin scripts (cf. HOWTODEPLOY.md:
# `docker compose run --rm startup-script python -u delete_companies.py ...`)
# so the default command is a no-op that exits 0 instead of failing boot.
CMD ["python", "-c", "print('CSV seed removed (#778): nothing to run on boot.')"]
