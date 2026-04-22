#!/usr/bin/env python3
"""
Génère un PDF Analyse de Besoin depuis les données JSON reçues sur stdin.
Écrit les bytes PDF sur stdout.

Usage:
  echo '{"raison_sociale": "..."}' | python3 pdf_generator.py

Dépendances:
  pip install weasyprint jinja2
  (WeasyPrint requiert aussi Cairo/Pango au niveau système)
"""
import sys
import json
import os
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def main():
    raw = sys.stdin.buffer.read()
    data = json.loads(raw.decode('utf-8'))

    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates')
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template('ab_template.html')

    html_content = template.render(**data)

    pdf_bytes = HTML(
        string=html_content,
        base_url=template_dir,
    ).write_pdf()

    sys.stdout.buffer.write(pdf_bytes)

if __name__ == '__main__':
    main()
