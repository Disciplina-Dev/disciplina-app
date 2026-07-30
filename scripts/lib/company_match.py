"""Fuzzy resolver from a free-text company name to a row of the MySQL `companies` table.

The contract file names employers the way a trainer says them out loud ('Mcdo
Duparc', 'O guava', 'Chicken street'), while `companies.name` holds the
registered trade name. Matching mirrors `candidate_matcher.py`: legal forms and
punctuation are dropped, comparison is order-independent over token sets, and a
tie between two distinct companies is reported instead of guessed.
"""

import re
from difflib import SequenceMatcher

from lib.company_csv import remove_accents

SCORE_THRESHOLD = 0.87

# Formes juridiques et mots vides : présents d'un côté, absents de l'autre, ils
# feraient chuter le score sans rien apporter à l'identification.
NOISE_TOKENS = {
    "SARL", "SAS", "SASU", "EURL", "SA", "SCI", "SNC", "SARLU", "EI", "EIRL",
    "SELARL", "ETS", "ETABLISSEMENTS", "STE", "SOCIETE", "GROUPE", "ENTREPRISE",
    "LE", "LA", "LES", "L", "DE", "DU", "DES", "D", "ET", "AU", "AUX", "CHEZ",
}


def normalize_company(name):
    """'SARL Le Ti Boucan (St-Denis)' -> frozenset({'TI', 'BOUCAN', 'ST', 'DENIS'})."""
    text = remove_accents(name or "").upper()
    text = re.sub(r"\([^)]*\)", " ", text)
    tokens = [token for token in re.split(r"[^A-Z0-9]+", text) if token]
    kept = [token for token in tokens if token not in NOISE_TOKENS]
    return frozenset(kept or tokens)


def _score(left, right):
    """Order-independent similarity between two token sets.

    Names differing by more than one token never match: averaging over the shorter
    set alone would rate 'Le Holding' against 'MOGALIA INVEST HOLDING' a perfect
    1.0, since 'HOLDING' is then the only token compared.
    """
    if not left or not right or abs(len(left) - len(right)) > 1:
        return 0.0
    smaller, larger = sorted((left, right), key=len)
    # Un nom d'un seul mot ('Holding') se retrouve dans trop d'entreprises pour
    # identifier quoi que ce soit : on exige alors l'égalité stricte.
    if len(smaller) == 1 and len(larger) > 1:
        return 0.0
    ratios = [
        max((SequenceMatcher(None, token, other).ratio() for other in larger), default=0.0)
        for token in smaller
    ]
    return sum(ratios) / len(ratios)


def _blocks(tokens):
    """Blocking keys of a token set: the first two letters of each token.

    Scoring 300 contract rows against 8600 companies is 2.6M token comparisons —
    slow enough to matter in the seed. Two names that score above the threshold
    necessarily share a token opening, so the search is restricted to that block.
    """
    return {token[:2] for token in tokens if len(token) >= 2}


class CompanyMatcher:
    """Index of the MySQL companies, queried by free-text name."""

    def __init__(self, companies):
        """`companies`: iterable of (id, name)."""
        self.entries = []
        self.index = {}
        for company_id, name in companies:
            tokens = normalize_company(name)
            if not tokens:
                continue
            entry = {"id": company_id, "name": name, "tokens": tokens}
            self.entries.append(entry)
            for block in _blocks(tokens):
                self.index.setdefault(block, []).append(entry)

    def _shortlist(self, tokens):
        seen = {}
        for block in _blocks(tokens):
            for entry in self.index.get(block, ()):
                seen[id(entry)] = entry
        return list(seen.values())

    def _scored(self, raw_name):
        tokens = normalize_company(raw_name)
        if not tokens:
            return tokens, []
        return tokens, [(_score(tokens, entry["tokens"]), entry) for entry in self._shortlist(tokens)]

    def match(self, raw_name):
        """Return (entry, status) with status in {matched, ambiguous, unmatched}.

        `entry` is None unless the status is `matched`.
        """
        tokens, scored = self._scored(raw_name)
        if not scored:
            return None, "unmatched"

        exact = [entry for _, entry in scored if entry["tokens"] == tokens]
        if exact:
            return exact[0], "matched"

        best_score, best_entry = max(scored, key=lambda item: item[0])
        if best_score < SCORE_THRESHOLD:
            return None, "unmatched"

        top_names = {
            entry["name"] for score, entry in scored if score >= best_score - 1e-9
        }
        if len(top_names) > 1:
            return None, "ambiguous"
        return best_entry, "matched"

    def best_effort(self, raw_name):
        """Closest name and its score, whatever the threshold — for the reject report."""
        _, scored = self._scored(raw_name)
        if not scored:
            return "", 0.0
        score, entry = max(scored, key=lambda item: item[0])
        return entry["name"], round(score, 3)


def load_companies(cursor):
    """Read (id, name) from MySQL. Kept here so callers own the connection."""
    cursor.execute("SELECT id, name FROM companies WHERE name IS NOT NULL AND name != ''")
    return cursor.fetchall()
