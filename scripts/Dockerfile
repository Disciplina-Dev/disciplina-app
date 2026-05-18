FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY startup.py .
COPY resource/ ./resource/

CMD ["python", "startup.py"]
