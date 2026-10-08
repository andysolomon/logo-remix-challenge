"""Brand collections: the 30 fast-food chains and 30 brands grouped by brand type.

Each row is (abbr, display name, category, primary color, secondary color, answer aliases).
The colors are the donor palette and white completes the third slot. Fast-food colors keep
the values snapped from the chains' original logos, so saved rounds look the same. Every
artwork variant (primary and alternates) is pinned in brand_artwork_sources.json and must
not show the brand's name, so players guess from the symbol alone.
"""

FOOD = [
    ("MCD", "McDonald's", "Burgers", "FFCC00", "DA291C", ["McDonalds", "Mickey D's"]),
    ("BK", "Burger King", "Burgers", "D62300", "FF8732", ["BK"]),
    ("WEN", "Wendy's", "Burgers", "CF202E", "453635", ["Wendys"]),
    ("CFA", "Chick-fil-A", "Chicken", "E51636", "000000", ["Chick fil a", "CFA"]),
    ("KFC", "KFC", "Chicken", "E4002B", "000000", ["Kentucky Fried Chicken"]),
    ("POP", "Popeyes", "Chicken", "FF7D00", "D22630", ["Popeyes Louisiana Kitchen"]),
    ("SUB", "Subway", "Sandwiches", "008938", "F2B700", []),
    ("TB", "Taco Bell", "Mexican & Asian", "5B2994", "000000", []),
    ("ARB", "Arby's", "Sandwiches", "D71921", "000000", ["Arbys"]),
    ("SON", "Sonic", "Burgers", "EA0045", "0088D7", ["Sonic Drive-In"]),
    ("DQ", "Dairy Queen", "Coffee & Treats", "EE3E42", "007AC1", ["DQ"]),
    ("JACK", "Jack in the Box", "Burgers", "E31635", "000000", []),
    ("INO", "In-N-Out Burger", "Burgers", "E02A27", "FFCB05", ["In N Out", "In-N-Out"]),
    ("WHAT", "Whataburger", "Burgers", "FF770F", "000000", []),
    ("FIVE", "Five Guys", "Burgers", "C92027", "000000", []),
    ("CUL", "Culver's", "Burgers", "155195", "000000", ["Culvers"]),
    ("HARD", "Hardee's", "Burgers", "FFC72C", "CE1329", ["Hardees"]),
    ("CARL", "Carl's Jr.", "Burgers", "FFCF21", "E40425", ["Carls Jr", "Carl's Junior"]),
    ("CHIP", "Chipotle", "Mexican & Asian", "AC2318", "441500", ["Chipotle Mexican Grill"]),
    ("PANDA", "Panda Express", "Mexican & Asian", "C02827", "1A1B21", []),
    ("DOM", "Domino's", "Pizza", "0090E2", "FF0000", ["Dominos", "Domino's Pizza"]),
    ("PH", "Pizza Hut", "Pizza", "EA1C24", "C70307", []),
    ("PAPA", "Papa Johns", "Pizza", "FF0000", "000000", ["Papa John's", "Papa John's Pizza"]),
    ("LC", "Little Caesars", "Pizza", "FF6000", "000000", []),
    ("DUNK", "Dunkin'", "Coffee & Treats", "EF6A00", "C63663", ["Dunkin", "Dunkin Donuts"]),
    ("STAR", "Starbucks", "Coffee & Treats", "00643C", "000000", []),
    ("ZAX", "Zaxby's", "Chicken", "0C1D42", "EA092A", ["Zaxbys"]),
    ("CANE", "Raising Cane's", "Chicken", "E71A2A", "FEBD11", ["Raising Canes", "Canes"]),
    ("BOJ", "Bojangles", "Chicken", "D0191A", "F8C437", []),
    ("CHECK", "Checkers", "Burgers", "E81D2D", "231F20", ["Rally's", "Rallys", "Checkers and Rally's"]),
]

BRAND = []

LEAGUES = {
    "FOOD": {"label": "FAST FOOD", "conferences": ["Burgers", "Chicken", "Sandwiches", "Pizza", "Mexican & Asian", "Coffee & Treats"]},
    "BRAND": {"label": "BRANDS", "conferences": ["Product", "Service", "Corporate", "Personal", "Store", "Place"]},
}

ROSTERS = {"FOOD": FOOD, "BRAND": BRAND}
SLUGS = {"FOOD": "fast-food", "BRAND": "brands"}
