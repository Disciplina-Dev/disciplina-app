#!/usr/bin/env python3
"""Clean the raw *-company.csv files into normalized CSVs on disk.

Reads scripts/resources/<saler>-company.csv, normalizes the heterogeneous
headers, derives sector/status/notes/SIRET, and writes
scripts/resources/cleaned/<saler>-company.cleaned.csv with canonical columns.
"""

import csv
import glob
import os
import sys

from lib.company_csv import CLEAN_FIELDNAMES, build_clean_row, normalize_header

RESOURCE_DIR = os.path.join(os.path.dirname(__file__), "resources")
CLEANED_DIR = os.path.join(RESOURCE_DIR, "cleaned")

# Salers present as a CSV but not commercial users -> skipped entirely.
IGNORED_SALERS = set()


def saler_from_path(path):
    return os.path.basename(path).split("-company")[0]


def find_header_row(reader):
    """Return the first row mapping >=3 canonical keys, skipping legend rows."""
    for values in reader:
        if sum(1 for value in values if normalize_header(value)) >= 3:
            return values
    return []


def clean_file(source_path):
    saler = saler_from_path(source_path)
    with open(source_path, encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = find_header_row(reader)
        rows = [
            build_clean_row(headers, values, saler)
            for values in reader
            if any(value.strip() for value in values)
        ]
    return [row for row in rows if row["name"]]


def write_cleaned(saler, rows):
    os.makedirs(CLEANED_DIR, exist_ok=True)
    target = os.path.join(CLEANED_DIR, f"{saler}-company.cleaned.csv")
    with open(target, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CLEAN_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    return target


def clean_all():
    sources = sorted(glob.glob(os.path.join(RESOURCE_DIR, "*-company.csv")))
    cleaned_paths = []
    for source_path in sources:
        saler = saler_from_path(source_path)
        if saler.lower() in IGNORED_SALERS:
            print(f"  SKIP -- {saler} (not a commercial)")
            continue
        rows = clean_file(source_path)
        target = write_cleaned(saler, rows)
        print(f"  OK -- {saler}: {len(rows)} rows -> {os.path.basename(target)}")
        cleaned_paths.append(target)
    return cleaned_paths


def main():
    print("Cleaning raw company CSVs ...")
    if not clean_all():
        print("  SKIP -- no *-company.csv files found")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
