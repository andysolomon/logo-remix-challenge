#!/usr/bin/env python3
"""The Cobb County roster behind the game's HIGH SCHOOL league.

Scope: the 17 Cobb County School District high schools. Unlike the NFL and
college rosters there is no feed to pull from, so every school lists an
explicit source URL, resolved by hand and verified against the artwork:

  * ``official``  the school's own athletics website (WordPress or the VNN
                  "sportshub" platform the Cobb athletic sites run on)
  * ``district``  the school's page on cobbk12.org, whose marks live on the
                  district's Azure blob storage (used when the school has no
                  scrapeable athletics site, and for Cobb Horizon, which has
                  no athletics program at all -- its entry is the school's
                  primary institutional mark)
  * ``wikipedia`` the infobox logo of the school's Wikipedia article
  * ``community`` a third-party community or aggregator mirror (VNN sportshub
                  uploads reached outside the school's own site, vhv.rs,
                  scorestream and the like), used when none of the three
                  sources above carries the mark the school actually uses

Each entry is ``(abbr, region, nickname, url, source_kind, source_page)``:
  abbr         id/file stem used in src/lib/teams.json ("HS-<abbr>")
  region       school name as shown in the game (e.g. "Walton")
  nickname     athletics nickname; empty for Cobb Horizon, which fields no
               teams and has no mascot
  url          direct URL of the logo asset to download
  source_kind  one of official / district / wikipedia / community, per the
               table above; the set is pinned in ``download_cobb_svgs``
  source_page  the page the asset was found on, for re-verification. When a
               community mirror exposes no richer page than the asset itself,
               this repeats the asset URL rather than inventing a citation.
"""

from __future__ import annotations

SCHOOLS: list[tuple[str, str, str, str, str, str]] = [
    ("ALLA", "Allatoona", "Buccaneers",
     "https://allatoonabucs.com/wp-content/uploads/2021/03/FULL-COLOR-BUCS-1-02.svg",
     "official", "https://allatoonabucs.com"),
    # The Spartan head the school actually fields, mirrored on a search-result
    # CDN. It is served as JPEG; the downloader re-encodes it to PNG so every
    # high-school asset stays a format Logo.tsx can recolor.
    ("CAMP", "Campbell", "Spartans",
     "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2Dc7xR9vXzUm1UcCanCk9WMqsmQCmgIb-jeevyNINl2lUN7_z2oc0CW0&s=10",
     "community", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2Dc7xR9vXzUm1UcCanCk9WMqsmQCmgIb-jeevyNINl2lUN7_z2oc0CW0&s=10"),
    # Cobb Horizon is the district's non-traditional high school: no athletics
    # program, no mascot. Its primary institutional mark stands in.
    ("HORZ", "Cobb Horizon", "",
     "https://sbcobbstor.blob.core.windows.net/media/WWWCobb/fgg/695/cobbhorizon-primary.png",
     "district", "https://www.cobbk12.org/cobbhorizon"),
    ("HARR", "Harrison", "Hoyas",
     "https://sbcobbstor.blob.core.windows.net/media/WWWCobb/fgg/753/Harrison-header.png",
     "district", "https://www.cobbk12.org/harrison"),
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
    ("MCEA", "McEachern", "Indians",
     "https://s3-us-west-2.amazonaws.com/scorestream-team-profile-pictures/4530/20190119073353_718_mascot300.png",
     "community", "https://s3-us-west-2.amazonaws.com/scorestream-team-profile-pictures/4530/20190119073353_718_mascot300.png"),
    ("NCOB", "North Cobb", "Warriors",
     "https://www.vhv.rs/dpng/d/607-6077206_north-cobb-high-school-home-page-north-cobb.png",
     "community", "https://www.vhv.rs/dpng/d/607-6077206_north-cobb-high-school-home-page-north-cobb.png"),
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
]

# abbr -> (primary, secondary) school colors, snapped to the nearest color
# actually present in the artwork before they reach teams.json -- the same
# trick scripts/download_hbcu_svgs.py plays, because pixel frequency alone
# favors outlines and drop shadows over a school's real colors. Schools absent
# here fall back to frequency order.
BRAND_COLORS: dict[str, tuple[str, str]] = {
    "ALLA": ("#EF3D33", "#000000"),   # red and black
    # The Spartan head is blue on blue: the field is the school's royal blue and
    # the helmet its silver. JPEG ringing scatters that silver across thousands
    # of shades, none big enough to read as a fill, so it is named exactly.
    "CAMP": ("#1B518D", "#A099AB"),   # spartan blue and silver
    "HORZ": ("#1B3D6D", "#C5A46D"),   # navy and vegas gold (institutional mark)
    "HARR": ("#1E7B34", "#12294B"),   # green and navy
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
}
