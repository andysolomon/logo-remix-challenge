"""Pinned MLB and soccer rosters: conferences, brand colors, answer aliases and sources.

MLB IDs/conferences: https://www.mlb.com/team and the official Stats API.
Soccer clubs are the most popular clubs worldwide, grouped by domestic league.
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

FOOTBALL_DATA = "https://crests.football-data.org/{}.svg"
WIKIPEDIA = "https://upload.wikimedia.org/wikipedia/en/{}"

# abbreviation: (league group, club name, primary, secondary, aliases, crest URL, source page)
# Two-color clubs (Juventus, Tottenham, Celtic) take neutral gray as the secondary, like the Nets.
SOCCER = {
    "ARS": ("Premier League", "Arsenal", "DB0007", "063672", ["Arsenal FC", "Gunners", "The Gunners"],
            FOOTBALL_DATA.format(57), "https://www.football-data.org/"),
    "AVL": ("Premier League", "Aston Villa", "670E36", "95BFE5", ["Villa", "AVFC", "Aston Villa FC"],
            FOOTBALL_DATA.format(58), "https://www.football-data.org/"),
    "CHE": ("Premier League", "Chelsea", "034694", "DBA111", ["Chelsea FC", "CFC"],
            FOOTBALL_DATA.format(61), "https://www.football-data.org/"),
    "LIV": ("Premier League", "Liverpool", "C8102E", "00B2A9", ["Liverpool FC", "LFC"],
            FOOTBALL_DATA.format(64), "https://www.football-data.org/"),
    "MCI": ("Premier League", "Manchester City", "6CABDD", "1C2C5B", ["Man City", "City", "MCFC", "Manchester City FC"],
            FOOTBALL_DATA.format(65), "https://www.football-data.org/"),
    "MUN": ("Premier League", "Manchester United", "DA291C", "FBE122",
            ["Man United", "Man Utd", "Man U", "MUFC", "Manchester United FC", "Red Devils"],
            FOOTBALL_DATA.format(66), "https://www.football-data.org/"),
    "NEW": ("Premier League", "Newcastle United", "241F20", "41B6E6", ["Newcastle", "NUFC", "Magpies", "Toon"],
            FOOTBALL_DATA.format(67), "https://www.football-data.org/"),
    "TOT": ("Premier League", "Tottenham Hotspur", "132257", "808080", ["Tottenham", "Spurs", "THFC"],
            FOOTBALL_DATA.format(73), "https://www.football-data.org/"),
    "RMA": ("La Liga", "Real Madrid", "FEBE10", "00529F", ["Real", "Real Madrid CF", "Los Blancos", "RMCF"],
            FOOTBALL_DATA.format(86), "https://www.football-data.org/"),
    "BAR": ("La Liga", "Barcelona", "A50044", "004D98", ["Barca", "FC Barcelona", "FCB", "Blaugrana"],
            FOOTBALL_DATA.format(81), "https://www.football-data.org/"),
    "ATM": ("La Liga", "Atlético Madrid", "CB3524", "272E61", ["Atletico", "Atleti", "Atletico de Madrid"],
            FOOTBALL_DATA.format(78), "https://www.football-data.org/"),
    "SEV": ("La Liga", "Sevilla", "D71920", "B1722B", ["Sevilla FC", "Seville"],
            FOOTBALL_DATA.format(559), "https://www.football-data.org/"),
    "BAY": ("Bundesliga", "Bayern Munich", "DC052D", "0066B2",
            ["Bayern", "FC Bayern", "Bayern München", "Bayern Muenchen", "FC Bayern Munich"],
            FOOTBALL_DATA.format(5), "https://www.football-data.org/"),
    "BVB": ("Bundesliga", "Borussia Dortmund", "FDE100", "000000", ["Dortmund", "BVB 09"],
            FOOTBALL_DATA.format(4), "https://www.football-data.org/"),
    "B04": ("Bundesliga", "Bayer Leverkusen", "E32221", "000000", ["Leverkusen", "Bayer 04", "Bayer 04 Leverkusen"],
            FOOTBALL_DATA.format(3), "https://www.football-data.org/"),
    "RBL": ("Bundesliga", "RB Leipzig", "DD0741", "001F47", ["Leipzig", "RasenBallsport Leipzig"],
            FOOTBALL_DATA.format(721), "https://www.football-data.org/"),
    "JUV": ("Serie A", "Juventus", "000000", "808080", ["Juve", "Juventus FC", "Bianconeri"],
            FOOTBALL_DATA.format(109), "https://www.football-data.org/"),
    "MIL": ("Serie A", "AC Milan", "FB090B", "000000", ["Milan", "ACM", "Rossoneri"],
            FOOTBALL_DATA.format(98), "https://www.football-data.org/"),
    "INT": ("Serie A", "Inter Milan", "0068A8", "000000",
            ["Inter", "Internazionale", "Inter Milano", "FC Internazionale Milano", "Nerazzurri"],
            FOOTBALL_DATA.format(108), "https://www.football-data.org/"),
    "NAP": ("Serie A", "Napoli", "12A0D7", "003C82", ["SSC Napoli", "Naples"],
            "https://a.espncdn.com/i/teamlogos/soccer/500/114.png", "https://www.espn.com/soccer/club/_/id/114/napoli"),
    "ROM": ("Serie A", "AS Roma", "8E1F2F", "F0BC42", ["Roma", "Giallorossi"],
            WIKIPEDIA.format("f/f7/AS_Roma_logo_%282017%29.svg"), "https://en.wikipedia.org/wiki/File:AS_Roma_logo_(2017).svg"),
    "PSG": ("Ligue 1", "Paris Saint-Germain", "004170", "DA291C", ["Paris", "Paris SG"],
            WIKIPEDIA.format("a/a7/Paris_Saint-Germain_F.C..svg"), "https://en.wikipedia.org/wiki/File:Paris_Saint-Germain_F.C..svg"),
    "OM": ("Ligue 1", "Marseille", "2FAEE0", "BA8C58", ["Olympique de Marseille", "Olympique Marseille"],
           FOOTBALL_DATA.format(516), "https://www.football-data.org/"),
    "AJA": ("Rest of World", "Ajax", "D2122E", "000000", ["AFC Ajax", "Ajax Amsterdam"],
            FOOTBALL_DATA.format(678), "https://www.football-data.org/"),
    "BEN": ("Rest of World", "Benfica", "E83030", "000000", ["SL Benfica", "Sport Lisboa e Benfica"],
            WIKIPEDIA.format("a/a2/SL_Benfica_logo.svg"), "https://en.wikipedia.org/wiki/File:SL_Benfica_logo.svg"),
    "POR": ("Rest of World", "FC Porto", "00428C", "D18A26", ["Porto", "FCP"],
            FOOTBALL_DATA.format(503), "https://www.football-data.org/"),
    "CEL": ("Rest of World", "Celtic", "018749", "808080", ["Celtic FC", "Glasgow Celtic", "The Bhoys"],
            FOOTBALL_DATA.format(732), "https://www.football-data.org/"),
    "GAL": ("Rest of World", "Galatasaray", "A90432", "FDB912", ["Galatasaray SK", "Gala", "Cimbom"],
            FOOTBALL_DATA.format(610), "https://www.football-data.org/"),
    "FLA": ("Rest of World", "Flamengo", "E2231A", "000000", ["CR Flamengo", "Mengao", "Clube de Regatas do Flamengo"],
            FOOTBALL_DATA.format(1783), "https://www.football-data.org/"),
    "MIA": ("Rest of World", "Inter Miami", "F7B5CD", "231F20", ["Inter Miami CF", "Club Internacional de Futbol Miami"],
            WIKIPEDIA.format("5/5c/Inter_Miami_CF_logo.svg"), "https://en.wikipedia.org/wiki/File:Inter_Miami_CF_logo.svg"),
}

LEAGUES = {
    "MLB": {"label": "MLB", "conferences": ["American League", "National League"]},
    "SOCCER": {"label": "SOCCER", "conferences": ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", "Rest of World"]},
}

