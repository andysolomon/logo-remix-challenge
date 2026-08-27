#!/usr/bin/env python3
"""The HBCU roster behind the game's HBCU chip.

Scope: every member of the three historically Black athletic conferences --
the SWAC and MEAC (NCAA Division I) and the SIAC (Division II) -- plus the
three Division I HBCUs that play in other conferences. Spring Hill College is
a SIAC member but is not an HBCU, so it is deliberately absent.

``ESPN_FOOTBALL`` is the slice that ``scripts/download_svgs.py`` already covers
through ESPN's college-football standings: SWAC, the football-playing half of
the MEAC, and the three independents. ``EXTRA`` is everything ESPN's football
feed cannot reach -- the two MEAC schools with no football team and the whole
Division II SIAC -- whose logos ``scripts/download_hbcu_svgs.py`` pulls from
Wikipedia instead.

Each EXTRA entry is ``(abbr, region, nickname, wiki_titles)`` where:
  abbr        id/file stem used in src/lib/teams.json ("COL-<abbr>")
  region      institution name as shown in the game
  nickname    athletics nickname
  wiki_titles Wikipedia articles to search for an infobox logo, best first.
              The athletics article goes first: several of these redirect to
              the institution article, in which case the school's seal is the
              logo Wikipedia has.
"""

from __future__ import annotations

# HBCUs whose logos come from scripts/download_svgs.py (ESPN D-I football):
# the 12 SWAC schools, the 6 MEAC schools that field football, and the three
# D-I HBCUs in other conferences (Hampton and NC A&T in the CAA, Tennessee
# State in the OVC/Big South).
ESPN_FOOTBALL = [
    # SWAC
    "AAMU", "ALST", "ALCN", "UAPB", "BCU", "FAMU", "GRAM", "JKST", "MVSU",
    "PV", "SOU", "TXSO",
    # MEAC (football)
    "DSU", "HOW", "MORG", "NORF", "NCCU", "SCST",
    # D-I, other conferences
    "HAMP", "NCAT", "TNST",
]

EXTRA: list[tuple[str, str, str, list[str]]] = [
    # ---- MEAC schools with no football program (absent from ESPN standings)
    ("COPP", "Coppin State", "Eagles", ["Coppin State Eagles", "Coppin State University"]),
    ("UMES", "Maryland Eastern Shore", "Hawks", ["Maryland Eastern Shore Hawks", "University of Maryland Eastern Shore"]),
    # ---- SIAC (NCAA Division II)
    ("ALBY", "Albany State", "Golden Rams", ["Albany State Golden Rams", "Albany State University"]),
    ("ALLN", "Allen", "Yellow Jackets", ["Allen Yellow Jackets", "Allen University"]),
    ("BEN", "Benedict", "Tigers", ["Benedict Tigers", "Benedict College"]),
    ("CENT", "Central State", "Marauders", ["Central State Marauders", "Central State University"]),
    ("CAU", "Clark Atlanta", "Panthers", ["Clark Atlanta Panthers", "Clark Atlanta University"]),
    ("EWU", "Edward Waters", "Tigers", ["Edward Waters Tigers", "Edward Waters University"]),
    ("FVSU", "Fort Valley State", "Wildcats", ["Fort Valley State Wildcats", "Fort Valley State University"]),
    ("KYST", "Kentucky State", "Thorobreds", ["Kentucky State Thorobreds", "Kentucky State University"]),
    ("LANE", "Lane", "Dragons", ["Lane Dragons", "Lane College"]),
    ("LEMO", "LeMoyne-Owen", "Magicians", ["LeMoyne–Owen Magicians", "LeMoyne–Owen College"]),
    ("MILE", "Miles", "Golden Bears", ["Miles Golden Bears", "Miles College"]),
    ("MORE", "Morehouse", "Maroon Tigers", ["Morehouse Maroon Tigers", "Morehouse College"]),
    ("SAV", "Savannah State", "Tigers", ["Savannah State Tigers", "Savannah State University"]),
    ("TUSK", "Tuskegee", "Golden Tigers", ["Tuskegee Golden Tigers", "Tuskegee University"]),
]

# abbr -> Wikipedia/Commons file to use, for schools whose infobox logo is
# unusable. This is the escape hatch for a bad resolution: fixing it here keeps
# the choice reviewable, where a fuzzy search would silently pick an unrelated
# school's mark.
WIKI_FILE_OVERRIDES: dict[str, str] = {
    # The Panthers infobox logo is a <rect> filled with an embedded base64 PNG,
    # so it carries no SVG fills for the remix to rewrite.
    "CAU": "Clark Atlanta University wordmark.svg",
    # Wikipedia's Lane College logo is a scanned seal: ~1,900 shades of
    # near-white with no flat brand color to key the recolor off.
    "LANE": "Lane College Dragons wordmark blue.svg",
}

# abbr -> (primary, secondary) official colors, as stated by the {{color box}}
# pair in the school's Wikipedia infobox. These are snapped to the nearest color
# actually present in the artwork before they reach teams.json, the same trick
# scripts/build_teams.py plays with ESPN's brand colors: pixel frequency alone
# picks outlines and drop shadows over a school's real colors. Schools absent
# here state no colors in their infobox and fall back to frequency order.
BRAND_COLORS: dict[str, tuple[str, str]] = {
    "COPP": ("#003056", "#FFC915"),
    "UMES": ("#822433", "#8B8D8E"),
    "ALBY": ("#0033A0", "#EAAA00"),
    "ALLN": ("#025399", "#F3CF3E"),
    "CENT": ("#A40046", "#FFD700"),
    "FVSU": ("#003087", "#FFCD00"),
    "KYST": ("#0A8137", "#EDCB04"),
    # Cardinal first officially, but Wikipedia's only Lane vector is the blue
    # wordmark, which has no cardinal in it for the primary slot to land on.
    "LANE": ("#002366", "#C41E3A"),
    "LEMO": ("#800080", "#FFD700"),
    "MILE": ("#FFD700", ""),
    # Morehouse states maroon and white; white is the light slot every team
    # already has, so only the maroon is a brand slot here.
    "MORE": ("#84002B", ""),
    "SAV": ("#CC5500", ""),
    "TUSK": ("#7B0707", "#F2BD2C"),
}
