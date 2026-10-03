"""Pinned MLB IDs and a starter roster of 30 US fast-food chains.

MLB IDs/conferences: https://www.mlb.com/team and the official Stats API.
Food article names resolve each chain's infobox logo, recorded in the manifest.
Palettes are snapped to the downloaded artwork by download_extra_logos.py.
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

# abbreviation, display name, Wikipedia article, category, colors, answer aliases
FOOD = [
    ("MCD", "McDonald's", "McDonald's", "Burgers", "FFC72C", "DA291C", ["McDonalds", "Mickey D's"]),
    ("BK", "Burger King", "Burger King", "Burgers", "D62300", "FF8732", ["BK"]),
    ("WEN", "Wendy's", "Wendy's", "Burgers", "E2203D", "000000", ["Wendys"]),
    ("CFA", "Chick-fil-A", "Chick-fil-A", "Chicken", "E51636", "000000", ["Chick fil a", "CFA"]),
    ("KFC", "KFC", "KFC", "Chicken", "E4002B", "000000", ["Kentucky Fried Chicken"]),
    ("POP", "Popeyes", "Popeyes", "Chicken", "F18A00", "D22630", ["Popeyes Louisiana Kitchen"]),
    ("SUB", "Subway", "Subway (restaurant)", "Sandwiches", "008938", "FFC600", []),
    ("TB", "Taco Bell", "Taco Bell", "Mexican & Asian", "702082", "000000", []),
    ("ARB", "Arby's", "Arby's", "Sandwiches", "D71920", "000000", ["Arbys"]),
    ("SON", "Sonic", "Sonic Drive-In", "Burgers", "EF3B42", "FFD800", ["Sonic Drive-In"]),
    ("DQ", "Dairy Queen", "Dairy Queen", "Coffee & Treats", "ED1C24", "005596", ["DQ"]),
    ("JACK", "Jack in the Box", "Jack in the Box", "Burgers", "D71920", "000000", []),
    ("INO", "In-N-Out Burger", "In-N-Out Burger", "Burgers", "D50032", "FFCD00", ["In N Out", "In-N-Out"]),
    ("WHAT", "Whataburger", "Whataburger", "Burgers", "FF770F", "000000", []),
    ("FIVE", "Five Guys", "Five Guys", "Burgers", "CC0000", "000000", []),
    ("CUL", "Culver's", "Culver's", "Burgers", "005696", "000000", ["Culvers"]),
    ("HARD", "Hardee's", "Hardee's", "Burgers", "F4B223", "C8102E", ["Hardees"]),
    ("CARL", "Carl's Jr.", "Carl's Jr.", "Burgers", "F4B223", "C8102E", ["Carls Jr", "Carl's Junior"]),
    ("CHIP", "Chipotle", "Chipotle Mexican Grill", "Mexican & Asian", "A81612", "451400", ["Chipotle Mexican Grill"]),
    ("PANDA", "Panda Express", "Panda Express", "Mexican & Asian", "D1282E", "000000", []),
    ("DOM", "Domino's", "Domino's", "Pizza", "0078AE", "E31837", ["Dominos", "Domino's Pizza"]),
    ("PH", "Pizza Hut", "Pizza Hut", "Pizza", "EE3A43", "000000", []),
    ("PAPA", "Papa Johns", "Papa John's", "Pizza", "D8272D", "000000", ["Papa John's", "Papa John's Pizza"]),
    ("LC", "Little Caesars", "Little Caesars", "Pizza", "F26722", "000000", []),
    ("DUNK", "Dunkin'", "Dunkin'", "Coffee & Treats", "FF671F", "DA1884", ["Dunkin", "Dunkin Donuts"]),
    ("STAR", "Starbucks", "Starbucks", "Coffee & Treats", "00754A", "000000", []),
    ("ZAX", "Zaxby's", "Zaxby's", "Chicken", "002D72", "E4002B", ["Zaxbys"]),
    ("CANE", "Raising Cane's", "Raising Cane's Chicken Fingers", "Chicken", "C8102E", "F2C75C", ["Raising Canes", "Canes"]),
    ("BOJ", "Bojangles", "Bojangles (restaurant)", "Chicken", "E31837", "F8C437", []),
    ("CHECK", "Checkers", "Checkers and Rally's", "Burgers", "E31837", "000000", ["Rally's", "Rallys", "Checkers and Rally's"]),
]

LEAGUES = {
    "MLB": {"label": "MLB", "conferences": ["American League", "National League"]},
    "FOOD": {"label": "FAST FOOD", "conferences": ["Burgers", "Chicken", "Sandwiches", "Pizza", "Mexican & Asian", "Coffee & Treats"]},
}

# KFC's Wikipedia infobox deliberately has no image during its 2026 rebrand.
# Use the current primary Colonel mark published by KFC's own media library.
FOOD_SOURCE_OVERRIDES = {
    "KFC": ("https://cdn.sanity.io/images/kbqq3e0r/production/afcc23c7797d1ad1d55bd0e200e2128cfe163eba-4096x3802.png?w=512&q=100&fm=png",
            "png", "https://global.kfc.com/media-assets"),
}
