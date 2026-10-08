"""Pinned MLB IDs, conferences, brand colors and answer aliases.

MLB IDs/conferences: https://www.mlb.com/team and the official Stats API.
Palettes are snapped to the downloaded artwork by download_extra_logos.py.
The fast-food and brand rosters live in brand_rosters.py.
"""

# abbreviation: (MLB ID, conference, primary, secondary, aliases)
MLB = {
    "ATH": (133, "American League", "003831", "EFB21E", ["A's", "As", "Oakland Athletics"]),
    "PIT": (134, "National League", "FDB827", "000000", []),
    "SD": (135, "National League", "2F241D", "FFC425", ["SDP"]),
    "SEA": (136, "American League", "0C2C56", "005C5C", []),
    "SF": (137, "National League", "FD5A1E", "000000", ["SFG"]),
    "STL": (138, "National League", "C41E3A", "0C2340", []),
    "TB": (139, "American League", "092C5C", "8FBCE6", ["TBR"]),
    "TEX": (140, "American League", "003278", "C0111F", []),
    "TOR": (141, "American League", "134A8E", "E8291C", []),
    "MIN": (142, "American League", "002B5C", "D31145", []),
    "PHI": (143, "National League", "E81828", "002D72", []),
    "ATL": (144, "National League", "CE1141", "13274F", []),
    "CWS": (145, "American League", "000000", "C4CED4", ["CHW"]),
    "MIA": (146, "National League", "00A3E0", "EF3340", []),
    "NYY": (147, "American League", "003087", "C4CED4", ["Yanks"]),
    "MIL": (158, "National League", "12284B", "FFC52F", []),
    "LAA": (108, "American League", "BA0021", "003263", []),
    "AZ": (109, "National League", "A71930", "30CED8", ["ARI", "Dbacks", "D-backs"]),
    "BAL": (110, "American League", "DF4601", "000000", []),
    "BOS": (111, "American League", "BD3039", "0C2340", []),
    "CHC": (112, "National League", "0E3386", "CC3433", []),
    "CIN": (113, "National League", "C6011F", "000000", []),
    "CLE": (114, "American League", "E50022", "00385D", []),
    "COL": (115, "National League", "333366", "C4CED4", []),
    "DET": (116, "American League", "0C2340", "FA4616", []),
    "HOU": (117, "American League", "002D62", "EB6E1F", []),
    "KC": (118, "American League", "004687", "BD9B60", ["KCR"]),
    "LAD": (119, "National League", "005A9C", "EF3E42", []),
    "WSH": (120, "National League", "AB0003", "14225A", ["WAS", "Nationals", "Nats"]),
    "NYM": (121, "National League", "002D72", "FF5910", []),
}

LEAGUES = {
    "MLB": {"label": "MLB", "conferences": ["American League", "National League"]},
}

