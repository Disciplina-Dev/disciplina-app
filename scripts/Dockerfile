FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY startup.py clean_companies.py import_company.py import_blacklist.py import_jobs.py ./
COPY db/ ./db/
COPY lib/ ./lib/
COPY resources/ ./resources/

CMD ["python", "-u", "startup.py"]
