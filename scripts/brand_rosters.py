"""Brand collections: fast-food chains, brands grouped by brand type, and iOS apps.

Each row is (abbr, display name, category, primary color, secondary color, answer aliases).
The colors are the donor palette and white completes the third slot. Fast-food colors keep
the values snapped from the chains' original logos, so saved rounds look the same. Every
artwork variant (primary and alternates) is pinned in brand_artwork_sources.json and must
not show the brand's name, so players guess from the symbol alone. Hardee's and Carl's Jr.
share one Happy Star, so each accepts the other's name.
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
    ("HARD", "Hardee's", "Burgers", "FFC72C", "CE1329", ["Hardees", "Carl's Jr.", "Carls Jr"]),
    ("CARL", "Carl's Jr.", "Burgers", "FFCF21", "E40425", ["Carls Jr", "Carl's Junior", "Hardee's", "Hardees"]),
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

BRAND = [
    ("PEPSI", "Pepsi", "Product", "005891", "EB1D39", ["Pepsi-Cola", "Pepsi Cola"]),
    ("PS", "PlayStation", "Product", "0070D1", "000000", ["Sony PlayStation", "PS5", "PS4", "Play Station"]),
    ("ANDROID", "Android", "Product", "34A853", "202124", ["Android OS", "Google Android"]),
    ("GATORADE", "Gatorade", "Product", "FF5000", "000000", ["Gatorade Thirst Quencher"]),
    ("MUSTANG", "Ford Mustang", "Product", "000000", "C8102E", ["Mustang"]),
    ("MC", "Mastercard", "Service", "EB001B", "F79E1B", ["MasterCard", "Master Card"]),
    ("UNITED", "United Airlines", "Service", "002244", "1414D2", ["United", "UA"]),
    ("DELTA", "Delta Air Lines", "Service", "E31937", "003366", ["Delta", "Delta Airlines"]),
    ("CHASE", "Chase", "Service", "117ACA", "000000", ["Chase Bank", "JPMorgan Chase", "JP Morgan Chase"]),
    ("ALLSTATE", "Allstate", "Service", "0033A0", "000000", ["Allstate Insurance"]),
    ("APPLE", "Apple", "Corporate", "000000", "A2AAAD", ["Apple Inc.", "Apple Computer", "Apple Computer Inc."]),
    ("MICROSOFT", "Microsoft", "Corporate", "F25022", "00A4EF", ["Microsoft Corporation", "Microsoft Corp", "Windows"]),
    ("META", "Meta", "Corporate", "0081FB", "192830", ["Meta Platforms", "Facebook", "Facebook Inc.", "FB"]),
    ("NBC", "NBC", "Corporate", "6E55DC", "FCCC12", ["National Broadcasting Company", "NBCUniversal", "NBC Universal"]),
    ("NIKE", "Nike", "Corporate", "111111", "FA5400", ["Nike Inc.", "Nike Swoosh"]),
    ("MJ", "Michael Jordan", "Personal", "000000", "CE1141", ["Jordan", "MJ", "Air Jordan", "Jumpman", "Jordan Brand", "Michael Jeffrey Jordan"]),
    ("PRINCE", "Prince", "Personal", "4B384C", "D4AF37", ["Prince Rogers Nelson", "The Artist Formerly Known as Prince", "The Artist", "TAFKAP"]),
    ("STONES", "The Rolling Stones", "Personal", "EB2E2E", "000000", ["Rolling Stones", "Stones", "The Stones"]),
    ("MRBEAST", "MrBeast", "Personal", "00ACD2", "E3457C", ["Mr Beast", "Mr. Beast", "Jimmy Donaldson", "Jimmy", "BEAST"]),
    ("TARGET", "Target", "Store", "CC0000", "000000", ["Target Corporation", "Tarzhay", "Tar-zhay", "SuperTarget"]),
    ("WALMART", "Walmart", "Store", "0053E2", "FFC220", ["Wal-Mart", "Wally World", "Walmart Supercenter"]),
    ("AMAZON", "Amazon", "Store", "FF9900", "232F3E", ["Amazon.com", "Amazon Prime"]),
    ("AE", "American Eagle", "Store", "182C52", "000000", ["American Eagle Outfitters", "AEO", "Am Eagle"]),
    ("LULU", "Lululemon", "Store", "D41935", "000000", ["Lululemon Athletica", "Lulu", "lulu lemon"]),
    ("TX", "Texas", "Place", "00205B", "BF0A30", ["Lone Star State", "Tejas", "State of Texas"]),
    ("CANADA", "Canada", "Place", "D52B1E", "000000", ["Canadian", "Great White North", "CAN"]),
    ("JAPAN", "Japan", "Place", "BC002D", "FFD700", ["Nippon", "Nihon", "Land of the Rising Sun", "JPN"]),
    ("CHICAGO", "Chicago", "Place", "41B6E6", "E4002B", ["Chi-Town", "Windy City", "Second City", "Chicago, Illinois", "CHI"]),
    ("MEXICO", "Mexico", "Place", "006847", "CE1126", ["México", "United Mexican States", "Estados Unidos Mexicanos", "MEX"]),
]

APP = [
    ("MAPS", "Maps", "Built-in", "76C63B", "3394E3", ["Apple Maps"]),
    ("WEATHER", "Weather", "Built-in", "387BD0", "FED500", ["Apple Weather"]),
    ("MESSAGES", "Messages", "Built-in", "34DA50", "1C1C1E", ["iMessage", "iMessages", "Apple Messages"]),
    ("FACETIME", "FaceTime", "Built-in", "1C1C1E", "31D950", ["Face Time"]),
    ("SAFARI", "Safari", "Built-in", "FE3C30", "1D9CF5", ["Apple Safari"]),
    ("SETTINGS", "Settings", "Built-in", "2E2E2F", "A6A6AA", ["iPhone Settings", "Apple Settings"]),
    ("CLOCK", "Clock", "Built-in", "EF8732", "202020", ["Apple Clock", "iPhone Clock"]),
    ("CALENDAR", "Calendar", "Built-in", "FE3C3B", "262626", ["Apple Calendar", "iCal", "iPhone Calendar"]),
    ("IG", "Instagram", "Social", "C837AB", "FF543E", ["Insta", "IG"]),
    ("SNAP", "Snapchat", "Social", "FFFC00", "000000", ["Snap", "Snap Chat"]),
    ("TIKTOK", "TikTok", "Social", "000000", "FE2C55", ["Tik Tok", "Musically", "Musical.ly"]),
    ("WA", "WhatsApp", "Social", "25D366", "075E54", ["Whats App", "Whatsapp Messenger"]),
    ("PIN", "Pinterest", "Social", "E60023", "111111", ["Pin", "Pins"]),
    ("DISCORD", "Discord", "Social", "5865F2", "23272A", ["Discord App"]),
    ("ROBLOX", "Roblox", "Games", "335FFF", "000000", []),
    ("MC", "Minecraft", "Games", "59AA43", "6D4E3B", ["Minecraft PE", "Minecraft Pocket Edition", "Minecraft Bedrock"]),
    ("AB", "Angry Birds", "Games", "D7002D", "000000", ["Angry Bird"]),
    ("POGO", "Pokémon GO", "Games", "FF1C1C", "000000", ["Pokemon GO", "Pokemon Go", "Pokémon Go", "Pokemon", "Pokémon"]),
    ("AMONG", "Among Us", "Games", "C51111", "FDD835", ["Among Us!", "Amogus"]),
    ("SURF", "Subway Surfers", "Games", "D50000", "4FC3F7", ["Subway Surfer", "Subway Surf"]),
    ("SPOTIFY", "Spotify", "Music & Video", "1ED760", "191414", ["Spotify Music"]),
    ("YT", "YouTube", "Music & Video", "FF0000", "282828", ["You Tube", "YT"]),
    ("NETFLIX", "Netflix", "Music & Video", "E50914", "000000", ["Netflix App"]),
    ("SHAZAM", "Shazam", "Music & Video", "0088FF", "000000", []),
    ("TWITCH", "Twitch", "Music & Video", "9146FF", "000000", ["Twitch TV", "TwitchTV"]),
    ("DUO", "Duolingo", "Everyday", "58CC02", "89E219", ["Duo", "Duo Lingo"]),
    ("GMAPS", "Google Maps", "Everyday", "EA4335", "34A853", ["GMaps", "Google Map"]),
    ("WAZE", "Waze", "Everyday", "33CCFF", "000000", []),
    ("VENMO", "Venmo", "Everyday", "008CFF", "1A1A1A", []),
    ("CASH", "Cash App", "Everyday", "00D632", "000000", ["CashApp", "Square Cash"]),
]

LEAGUES = {
    "FOOD": {"label": "FAST FOOD", "conferences": ["Burgers", "Chicken", "Sandwiches", "Pizza", "Mexican & Asian", "Coffee & Treats"]},
    "BRAND": {"label": "BRANDS", "conferences": ["Product", "Service", "Corporate", "Personal", "Store", "Place"]},
    "APP": {"label": "APPS", "conferences": ["Built-in", "Social", "Games", "Music & Video", "Everyday"]},
}

ROSTERS = {"FOOD": FOOD, "BRAND": BRAND, "APP": APP}
SLUGS = {"FOOD": "fast-food", "BRAND": "brands", "APP": "apps"}
