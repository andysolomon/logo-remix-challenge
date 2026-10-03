"""NBA team IDs and conferences from https://www.nba.com/teams.

Keys use ESPN abbreviations; IDs identify the official NBA CDN artwork.
"""

ROSTER = {
    "ATL": (1610612737, "Eastern"), "BOS": (1610612738, "Eastern"),
    "BKN": (1610612751, "Eastern"), "CHA": (1610612766, "Eastern"),
    "CHI": (1610612741, "Eastern"), "CLE": (1610612739, "Eastern"),
    "DAL": (1610612742, "Western"), "DEN": (1610612743, "Western"),
    "DET": (1610612765, "Eastern"), "GS": (1610612744, "Western"),
    "HOU": (1610612745, "Western"), "IND": (1610612754, "Eastern"),
    "LAC": (1610612746, "Western"), "LAL": (1610612747, "Western"),
    "MEM": (1610612763, "Western"), "MIA": (1610612748, "Eastern"),
    "MIL": (1610612749, "Eastern"), "MIN": (1610612750, "Western"),
    "NO": (1610612740, "Western"), "NY": (1610612752, "Eastern"),
    "OKC": (1610612760, "Western"), "ORL": (1610612753, "Eastern"),
    "PHI": (1610612755, "Eastern"), "PHX": (1610612756, "Western"),
    "POR": (1610612757, "Western"), "SAC": (1610612758, "Western"),
    "SA": (1610612759, "Western"), "TOR": (1610612761, "Eastern"),
    "UTAH": (1610612762, "Western"), "WSH": (1610612764, "Eastern"),
}

ALIASES = {
    "CLE": ["Cavs"], "DAL": ["Mavs"], "GS": ["GSW"],
    "LAC": ["Los Angeles Clippers"], "MIN": ["Wolves"],
    "NO": ["NOP"], "NY": ["NYK"], "PHI": ["Sixers", "Philadelphia Sixers"],
    "POR": ["Blazers"], "SA": ["SAS"], "UTAH": ["UTA"], "WSH": ["WAS"],
}
