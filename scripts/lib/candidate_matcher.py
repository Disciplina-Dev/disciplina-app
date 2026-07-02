"""Fuzzy resolver from a raw 'A envoyer' name fragment to an existing candidate.

Names in the CSVs vary in first/last order, case, accents and typos. Matching is
order-independent (token sets) with per-token typo tolerance, so a single mistyped
word (e.g. "Djanfarc" for "Djanfar") still resolves. Genuine misses and cross-name
ties are reported rather than guessed.
"""

import re
import unicodedata
from difflib import SequenceMatcher

SCORE_THRESHOLD = 0.87
TOKEN_THRESHOLD = 0.84


def normalize_tokens(name):
    stripped = "".join(
        c for c in unicodedata.normalize("NFD", name or "")
        if unicodedata.category(c) != "Mn"
    )
    words = re.sub(r"[^a-z\s]", " ", stripped.lower()).split()
    return frozenset(words)


def _coverage_score(fragment_tokens, candidate_tokens):
    """Average token similarity when every fragment token has a close match, else 0."""
    smaller, larger = sorted((fragment_tokens, candidate_tokens), key=len)
    if not smaller:
        return 0.0
    best_ratios = [
        max((SequenceMatcher(None, token, other).ratio() for other in larger), default=0.0)
        for token in smaller
    ]
    if any(ratio < TOKEN_THRESHOLD for ratio in best_ratios):
        return 0.0
    return sum(best_ratios) / len(best_ratios)


class CandidateMatcher:
    def __init__(self, candidates):
        self.entries = [
            {"candidate": candidate,
             "name": _full_name(candidate),
             "tokens": normalize_tokens(_full_name(candidate))}
            for candidate in candidates
            if normalize_tokens(_full_name(candidate))
        ]

    def match(self, fragment):
        """Return (candidate, status): status in {matched, ambiguous, unmatched}.

        An exact normalized-name hit always wins (duplicate candidate docs resolve to
        the first). Otherwise the best fuzzy score above threshold wins, unless two
        distinct names tie for the top.
        """
        tokens = normalize_tokens(fragment)
        if not tokens:
            return None, "unmatched"

        exact = [entry for entry in self.entries if entry["tokens"] == tokens]
        if exact:
            return exact[0]["candidate"], "matched"

        scored = [(_coverage_score(tokens, entry["tokens"]), entry) for entry in self.entries]
        best_score, best_entry = max(scored, key=lambda item: item[0])
        if best_score < SCORE_THRESHOLD:
            return None, "unmatched"

        top_names = {entry["name"] for score, entry in scored if score >= best_score - 1e-9}
        if len(top_names) > 1:
            return None, "ambiguous"
        return best_entry["candidate"], "matched"


def _full_name(candidate):
    return (candidate.get("identity") or {}).get("full_name", "")
