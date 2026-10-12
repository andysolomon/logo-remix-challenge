#!/usr/bin/env python3
"""The roster behind the game's HIGH SCHOOL league: metro Atlanta high schools by county.

Scope: the 16 Cobb County School District high schools that field athletics
teams (the league began as Cobb-only, hence the module name) plus a first set
of prominent programs from Paulding, Fulton, DeKalb and Gwinnett counties.
Each county is a filter chip and a random-deck pool. Unlike the NFL and
college rosters there is no feed to pull from, so every school lists an
explicit source URL, resolved by hand and verified against the artwork:

  * ``official``  the school's own athletics website (WordPress or the VNN
                  "sportshub" platform the Cobb athletic sites run on)
  * ``district``  the school's page on its district site (cobbk12.org keeps
                  its marks on the district's Azure blob storage), used when
                  the school has no scrapeable athletics site
  * ``wikipedia`` the infobox logo of the school's Wikipedia article
  * ``community`` a third-party community or aggregator mirror (VNN sportshub
                  uploads reached outside the school's own site, scorestream,
                  or the opponent logos a rival school's athletics site hosts),
                  used when none of the three sources above carries the mark
                  the school actually uses -- or carries it only as a bitmap
                  while a mirror has the vector original

Each entry is ``(abbr, region, nickname, url, source_kind, source_page)``:
  abbr         id/file stem used in src/lib/teams.json ("HS-<abbr>")
  region       school name as shown in the game (e.g. "Walton")
  nickname     athletics nickname
  url          direct URL of the logo asset to download
  source_kind  one of official / district / wikipedia / community, per the
               table above; the set is pinned in ``download_cobb_svgs``
  source_page  the page the asset was found on, for re-verification. When a
               community mirror exposes no richer page than the asset itself,
               this repeats the asset URL rather than inventing a citation.

Allatoona's athletics site (allatoonabucs.com) keeps vector logos of the
opponents on its schedules in its WordPress media library. Campbell, Harrison,
North Cobb and several schools outside Cobb use those SVGs: the only other
copies of their marks are low-resolution bitmaps. The same library supplies
most of the league's alternate marks (scripts/team_alternate_sources.json).
"""

from __future__ import annotations

School = tuple[str, str, str, str, str, str]

# County -> its schools, in the order the game lists them. A school's county is
# its filter chip in the team browser and its random-deck pool.
ROSTER: dict[str, list[School]] = {
    "Cobb County": [
        ("ALLA", "Allatoona", "Buccaneers",
         "https://allatoonabucs.com/wp-content/uploads/2021/03/FULL-COLOR-BUCS-1-02.svg",
         "official", "https://allatoonabucs.com"),
        ("CAMP", "Campbell", "Spartans",
         "https://allatoonabucs.com/wp-content/uploads/2021/03/campbell.svg",
         "community", "https://allatoonabucs.com/campbell-2/"),
        ("HARR", "Harrison", "Hoyas",
         "https://allatoonabucs.com/wp-content/uploads/2021/03/harrisonlogo-01.svg",
         "community", "https://allatoonabucs.com/harrisonlogo-01/"),
        ("HILL", "Hillgrove", "Hawks",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/376/2018/01/30200846/logo_outline.png",
         "official", "https://www.hillgroveathletics.com"),
        ("KELL", "Kell", "Longhorns",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/1059/2022/03/01181411/New-Kell-logo.png",
         "community", "https://sportshub2-uploads.vnn-prod.zone/files/sites/1059/2022/03/01181411/New-Kell-logo.png"),
        ("KMHS", "Kennesaw Mountain", "Mustangs",
         "https://upload.wikimedia.org/wikipedia/en/f/fa/Kennesaw_Mountain_High_School_%28logo%29.svg",
         "wikipedia", "https://en.wikipedia.org/wiki/Kennesaw_Mountain_High_School"),
        ("LASS", "Lassiter", "Trojans",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/1992/2018/05/14151445/logo.png",
         "official", "https://www.lassiterathletics.com"),
        # Marietta High is Marietta City Schools, not the Cobb district, but it is in Cobb County.
        ("MARI", "Marietta", "Blue Devils",
         "https://cdn2.sportngin.com/attachments/logo_graphic/88c1-180228065/MariettaHS_Mascot_large.png",
         "official", "https://www.marietta-athletics.com"),
        ("MCEA", "McEachern", "Indians",
         "https://s3-us-west-2.amazonaws.com/scorestream-team-profile-pictures/4530/20190119073353_718_mascot300.png",
         "community", "https://s3-us-west-2.amazonaws.com/scorestream-team-profile-pictures/4530/20190119073353_718_mascot300.png"),
        ("NCOB", "North Cobb", "Warriors",
         "https://allatoonabucs.com/wp-content/uploads/2021/02/ncobb-logo-01-2.svg",
         "community", "https://allatoonabucs.com/ncobb-logo-01-2/"),
        ("OSBO", "Osborne", "Cardinals",
         "https://sbcobbstor.blob.core.windows.net/media/WWWCobb/fgg/1293/Osborne_Footer-4.png",
         "district", "https://www.cobbk12.org/osborne"),
        ("PEBB", "Pebblebrook", "Falcons",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/1201/2025/03/28150340/Pebblebrook-Falcons-1.png",
         "community", "https://sportshub2-uploads.vnn-prod.zone/files/sites/1201/2025/03/28150340/Pebblebrook-Falcons-1.png"),
        ("POPE", "Pope", "Greyhounds",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/195/2023/06/22174707/Pope-HS.png",
         "official", "https://www.popeathletics.com"),
        ("SCOB", "South Cobb", "Eagles",
         "https://sbcobbstor.blob.core.windows.net/media/WWWCobb/fgg/1476/southcobb.png",
         "district", "https://www.cobbk12.org/southcobb"),
        ("SPRA", "Sprayberry", "Yellow Jackets",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/317/2023/08/07151535/Full-Color-White-Outline-Yellow-Jacket-Mark.png",
         "official", "https://www.sprayberryathletics.com"),
        ("WALT", "Walton", "Raiders",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/632/2018/02/16205342/logo_outline_9336.png",
         "official", "https://www.waltonathletics.com"),
        ("WHEE", "Wheeler", "Wildcats",
         "https://upload.wikimedia.org/wikipedia/en/7/7f/Wheeler_High_School_%28Georgia%29_logo.png",
         "wikipedia", "https://en.wikipedia.org/wiki/Wheeler_High_School_(Georgia)"),
    ],
    "Paulding County": [
        ("NPAU", "North Paulding", "Wolfpack",
         "https://sportshub2-uploads.vnn-prod.zone/files/sites/2249/2019/05/08185932/northpauldinglogo.png",
         "community", "https://sportshub2-uploads.vnn-prod.zone/files/sites/2249/2019/05/08185932/northpauldinglogo.png"),
    ],
    "Fulton County": [
        # Blessed Trinity is a private Catholic school in Roswell.
        ("BTRI", "Blessed Trinity", "Titans",
         "https://allatoonabucs.com/wp-content/uploads/2021/02/b-trinity-01-1-01.svg",
         "community", "https://allatoonabucs.com/b-trinity-01-1-01/"),
        ("CREE", "Creekside", "Seminoles",
         "https://allatoonabucs.com/wp-content/uploads/2025/01/creekside.svg",
         "community", "https://allatoonabucs.com/creekside/"),
        ("LHUG", "Langston Hughes", "Panthers",
         "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA25435/GA25435.png",
         "community", "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA25435/GA25435.png"),
        ("MILT", "Milton", "Eagles",
         "https://allatoonabucs.com/wp-content/uploads/2023/10/milton.svg",
         "community", "https://allatoonabucs.com/milton/"),
        ("NATL", "North Atlanta", "Warriors",
         "https://allatoonabucs.com/wp-content/uploads/2021/05/n.-Atlanta.svg",
         "community", "https://allatoonabucs.com/n-atlanta/"),
        ("WEST", "Westlake", "Lions",
         "https://allatoonabucs.com/wp-content/uploads/2026/01/westlake.svg",
         "community", "https://allatoonabucs.com/westlake/"),
    ],
    "DeKalb County": [
        ("DHIL", "Druid Hills", "Red Devils",
         "https://allatoonabucs.com/wp-content/uploads/2022/12/DRUID-HILLS.svg",
         "community", "https://allatoonabucs.com/druid-hills/"),
        ("SWDK", "Southwest DeKalb", "Panthers",
         "https://image.maxpreps.io/school-mascot/b/0/7/b070d4a6-0cef-4a4f-a5b5-91e231d6544a.gif",
         "community", "https://image.maxpreps.io/school-mascot/b/0/7/b070d4a6-0cef-4a4f-a5b5-91e231d6544a.gif"),
        ("STEP", "Stephenson", "Jaguars",
         "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA5321/GA5321.png",
         "community", "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA5321/GA5321.png"),
    ],
    "Gwinnett County": [
        ("BUFO", "Buford", "Wolves",
         "https://allatoonabucs.com/wp-content/uploads/2021/02/buford-01-2.svg",
         "community", "https://allatoonabucs.com/buford-01-2/"),
        ("GRAY", "Grayson", "Rams",
         "https://allatoonabucs.com/wp-content/uploads/2021/04/grayson.svg",
         "community", "https://allatoonabucs.com/grayson/"),
        ("PARK", "Parkview", "Panthers",
         "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA5226/Logo_-_P.png",
         "community", "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA5226/Logo_-_P.png"),
    ],
    "Carroll County": [
        ("CARR", "Carrollton", "Trojans",
         "https://allatoonabucs.com/wp-content/uploads/2021/02/carrolton-02.svg",
         "community", "https://allatoonabucs.com/carrolton-02/"),
    ],
    "Hall County": [
        ("GAIN", "Gainesville", "Red Elephants",
         "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA5015/gcss-ghs-logo-elephant-full-color-cmyk-FINAL-2021-07-21.png",
         "community", "https://production-gofan-assets.s3.amazonaws.com/uploads/school/logo/GA5015/gcss-ghs-logo-elephant-full-color-cmyk-FINAL-2021-07-21.png"),
    ],
    "Lee County": [
        ("LEEC", "Lee County", "Trojans",
         "https://resources.finalsite.net/images/v1770034738/leek12gaus/hwicdaicsn7af6oz26hd/Mascot.png",
         "district", "https://www.lee.k12.ga.us"),
    ],
    "Lowndes County": [
        ("VALD", "Valdosta", "Wildcats",
         "https://gowoodland.org/wp-content/uploads/2021/01/VALDOSTAcatsLOGO-01.svg",
         "community", "https://gowoodland.org/valdostacatslogo-01/"),
    ],
    "Newton County": [
        ("NEWT", "Newton", "Rams",
         "https://image.maxpreps.io/school-mascot/d/0/7/d07bd2a4-115f-40fc-852f-612c908497eb.gif",
         "community", "https://image.maxpreps.io/school-mascot/d/0/7/d07bd2a4-115f-40fc-852f-612c908497eb.gif"),
    ],
    "Thomas County": [
        ("TCC", "Thomas County Central", "Yellow Jackets",
         "https://allatoonabucs.com/wp-content/uploads/2023/07/tcc.svg",
         "community", "https://allatoonabucs.com/tcc/"),
    ],
}

SCHOOLS: list[School] = [school for schools in ROSTER.values() for school in schools]
COUNTY: dict[str, str] = {school[0]: county for county, schools in ROSTER.items() for school in schools}

# Schools whose mark is published only as a bitmap. The downloader checks the
# file against its pinned SHA-256 and traces it into flat-color SVG outlines with
# Designer mode's tracer (src/lib/trace.ts): "colors" is its color setting and
# "removeBackground" drops a solid field around the mark (Lee County's helmet sits
# on black). Tracing turns glossy, shaded artwork into clean recolorable fills.
TRACED: dict[str, dict] = {
    "NPAU": {"sha256": "69c4e2880004638a9dfa20657fdb3af34fff9acba76d182245c4d37df78e8067", "colors": "auto", "removeBackground": True},
    "LHUG": {"sha256": "ee331402202afc31f04adec80f4d60be24315ce721e11248ab14743532378a82", "colors": "auto", "removeBackground": True},
    "SWDK": {"sha256": "e43816cf2966dee45edd90a17f7b442c99c12cabf6e1990c836df137e6a90b40", "colors": "auto", "removeBackground": True},
    "STEP": {"sha256": "b6515f8f5e067d48fa1018e226ef18ab8d8d4454cd5ef16aae4a1ce40c84a099", "colors": "auto", "removeBackground": True},
    "PARK": {"sha256": "591ac960672b2bc602175ce4285a04c1b132bd06243de97279062613b404e3a5", "colors": "auto", "removeBackground": True},
    "GAIN": {"sha256": "11b85cfb5905e04f4b8aff335557cc42b275a0258b5b99fe64d15c4e64051e9b", "colors": "auto", "removeBackground": True},
    "NEWT": {"sha256": "8ff5c743a0cdc1037705bb7e5d14f6e628fb6ba139a56577facfa1437f749d19", "colors": "auto", "removeBackground": True},
    "LEEC": {"sha256": "f22fb277108a80a239a16f59dc380af86ef9d0b0645b36075f06c8101970f1cb", "colors": "auto", "removeBackground": True},
    "MARI": {"sha256": "4acfd0a34ae24170f381720e4658622e91d8b451f1d14f502b22d56247e35363", "colors": "auto", "removeBackground": True},
}

# abbr -> (primary, secondary) school colors, snapped to the nearest color
# actually present in the artwork before they reach teams.json -- the same
# trick scripts/download_hbcu_svgs.py plays, because pixel frequency alone
# favors outlines and drop shadows over a school's real colors. Schools absent
# here fall back to frequency order.
BRAND_COLORS: dict[str, tuple[str, str]] = {
    "ALLA": ("#EF3D33", "#000000"),   # red and black
    "CAMP": ("#1B518D", "#A099AB"),   # spartan blue and silver
    "HARR": ("#1E7B34", "#12294B"),   # green and navy (the bulldog mark)
    "HILL": ("#6D1A2E", "#6D6E71"),   # maroon and gray
    "KELL": ("#000000", "#F1E6B2"),   # black and vegas gold (the longhorn mark)
    "KMHS": ("#02A653", "#BBBCBF"),   # green and silver
    "LASS": ("#6D1418", "#000000"),   # maroon (the mark carries no gold)
    # This mark is drawn in web-safe navy and khaki rather than the seal's
    # deeper blue and gold, so the roster names the colors the artwork uses.
    "MCEA": ("#000099", "#CCCC99"),   # navy and khaki gold
    "NCOB": ("#E1622E", "#232F6B"),   # orange and navy
    "OSBO": ("#D22030", "#000000"),   # cardinal red
    "PEBB": ("#003B5C", "#AF272F"),   # navy and red (the falcon mark)
    "POPE": ("#8CB7DB", "#1B2A4A"),   # columbia blue and navy
    "SCOB": ("#1B2A4A", "#E87C22"),   # navy and orange
    "SPRA": ("#AF9A5B", "#241F20"),   # old gold and black
    "WALT": ("#1B2A5B", "#000000"),   # raider navy
    "WHEE": ("#F2BE39", "#1B2A4A"),   # gold and navy
    # Outside Cobb, colors are the ones each school lists on its GoFan ticketing page.
    "NPAU": ("#001547", "#D0D4D7"),   # navy and silver
    "LHUG": ("#0B422D", "#DBB76C"),   # green and gold
    "NATL": ("#000000", "#A2A9AD"),   # black and silver
    "WEST": ("#3253A4", "#C0C0C0"),   # blue and silver
    "DHIL": ("#EF1D28", "#363636"),   # red and black, drawn as bright red and charcoal
    "SWDK": ("#000053", "#C99A00"),   # navy and old gold (GoFan lists a brighter #FFE800)
    "STEP": ("#000000", "#000080"),   # black and royal blue
    "BUFO": ("#009639", "#B6A268"),   # green and gold
    "GRAY": ("#004812", "#C4A006"),   # hunter green and vegas gold
    "PARK": ("#EC5E1A", "#0924A0"),   # orange and blue
    "MARI": ("#041E42", "#9F9F9F"),   # navy (PMS 282) and silver
    "BTRI": ("#084512", "#A19162"),   # hunter green and gold
    "CREE": ("#A10022", "#C9B45B"),   # cardinal and vegas gold
    "MILT": ("#DB2742", "#002B56"),   # red and navy (the white band is open)
    "CARR": ("#000000", "#FEC727"),   # black and gold
    "GAIN": ("#C62030", "#010000"),   # red, with the mark's black outline
    "LEEC": ("#EB1E26", "#000000"),   # red and black
    "VALD": ("#FAB61E", "#000000"),   # gold and black
    "NEWT": ("#134897", "#04050D"),   # royal blue, with the ram's black
    "TCC": ("#012D56", "#B0A876"),    # navy and vegas gold (the TC is navy only)
}
