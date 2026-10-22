#!/usr/bin/env python3
"""Rebuild the LANDMARKS collection: famous structures and natural wonders drawn as vector figures (Python stdlib only).

The artwork is original schematic geometry in the style of the science figures in build_education.py:
one thin ink outline weight, white bodies and a flat accent tint. Every figure paints all three
palette slots, so a remix needs no backdrop tile. No text, rasters, fonts or remote requests.
"""
import hashlib
import json
from pathlib import Path
from build_teams import atomic_write_text, fmt_entry
from build_education import (INK, ACCENT, WHITE, PALETTE, OUTLINE, DETAIL, HAIRLINE, LEAGUES as EDUCATION_LEAGUES,
                             svg, solid, ink, dot, rect, line, circle)

ROOT = Path(__file__).resolve().parent.parent
TEAMS_JSON = ROOT / 'src/lib/teams.json'
LEAGUE = 'LANDMARK'
CONFIG = {'label': 'LANDMARKS', 'conferences': ['Americas', 'Europe', 'Asia & Pacific', 'Africa & Middle East']}

def tint(body, weight=DETAIL): return solid(body, ACCENT, weight)
def accent_line(body, weight=HAIRLINE): return line(body, ACCENT, weight)
def white_line(body, weight=HAIRLINE): return line(body, WHITE, weight)
def ground(y=232, x0=12, x1=244, weight=DETAIL): return ink(f'<path d="M{x0} {y}H{x1}"/>', weight)
def waves(y, x0=8, x1=248, step=24, color=INK, weight=HAIRLINE):
    bumps = ''.join(f'q{step/2:.0f} -6 {step} 0' for _ in range((x1 - x0) // step))
    return line(f'<path d="M{x0} {y}{bumps}"/>', color, weight)
def tri(x0, y0, x1, y1, x2, y2): return f'<path d="M{x0} {y0}L{x1} {y1}L{x2} {y2}Z"/>'
def vlines(xs, y0, y1, color=ACCENT, weight=HAIRLINE):
    return line(''.join(f'<path d="M{x} {y0}V{y1}"/>' for x in xs), color, weight)
def columns(centers, top, bottom, width=10, fill=WHITE):
    return ''.join(solid(rect(cx - width/2, top, width, bottom - top, 1), fill, DETAIL) for cx in centers)

def bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3*a + 3*u*u*t*b + 3*u*t*t*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))
def quad(p0, p1, p2, t):
    u = 1 - t
    return tuple(u*u*a + 2*u*t*b + t*t*c for a, b, c in zip(p0, p1, p2))
def solve(curve, axis, value):
    """Coordinate on the other axis where a sampled curve crosses `value` on `axis`."""
    pts = [curve(i/400) for i in range(401)]
    return min(pts, key=lambda p: abs(p[axis] - value))[1 - axis]

# ---------------------------------------------------------------- Americas
def liberty():
    """Statue of Liberty: pedestal, robed figure, raised torch arm, tablet and the seven-rayed crown."""
    art = solid(rect(84, 200, 88, 32, 3)) + tint(rect(96, 184, 64, 16, 2))
    for arm in ('<path d="M112 106L94 148"/>', '<path d="M144 102L168 52"/>'):
        art += ink(arm, 12) + white_line(arm, 6)
    art += '<g transform="rotate(-14 94 150)">' + solid(rect(82, 136, 24, 30, 2)) + '</g>'
    art += tint(rect(161, 38, 14, 14, 3)) + tint('<path d="M168 38Q150 22 168 6Q186 22 168 38Z"/>')
    art += solid('<path d="M110 98Q128 90 146 98L156 184H100Z"/>') + ink('<path d="M116 124V176M128 120V180M140 124V176"/>', HAIRLINE)
    art += solid(rect(122, 86, 12, 12, 2)) + solid('<circle cx="128" cy="74" r="14"/>')
    import math
    rays = ''.join(f'<path d="M{128+14*math.cos(math.radians(a)):.1f} {74+14*math.sin(math.radians(a)):.1f}L{128+30*math.cos(math.radians(a)):.1f} {74+30*math.sin(math.radians(a)):.1f}"/>'
                   for a in range(-150, -29, 20))
    return art + ink(rays, DETAIL) + ink('<path d="M114 68Q128 58 142 68"/>', HAIRLINE)

def goldengate():
    """Golden Gate Bridge: two braced towers, the main cables with hangers, the deck and the bay below."""
    def cable_y(x):
        if 71 <= x <= 185: return 44 + 76 * (1 - ((x - 128) / 57) ** 2)
        return 44 + 106 * ((71 - x) / 63) ** 2 if x < 71 else 44 + 106 * ((x - 185) / 63) ** 2
    art = waves(220) + waves(230)
    for cx in (71, 185):
        art += tint(rect(cx - 14, 40, 8, 170, 1)) + tint(rect(cx + 6, 40, 8, 170, 1))
        art += ''.join(tint(rect(cx - 14, y, 28, 8, 1)) for y in (52, 84, 116, 148))
    xs = list(range(8, 249, 2))
    cable = 'M' + 'L'.join(f'{x} {cable_y(x):.1f}' for x in xs)
    hangers = ''.join(f'<path d="M{x} {cable_y(x):.1f}V158"/>' for x in range(16, 241, 12) if abs(x - 71) > 16 and abs(x - 185) > 16)
    art += ink(hangers, HAIRLINE) + ink(f'<path d="{cable}"/>', DETAIL)
    return art + solid(rect(4, 158, 248, 10, 2))

def empire():
    """Empire State Building: stepped setbacks, a tall shaft with window columns, the mast and antenna."""
    body = 'M56 232V196H72V160H88V122H104V72H120V44H136V72H152V122H168V160H184V196H200V232Z'
    art = solid(f'<path d="{body}"/>') + ink('<path d="M128 44V10"/>', DETAIL) + tint(rect(122, 36, 12, 8, 2))
    windows = [(range(110, 147, 8), 80, 224), ((92, 98), 130, 224), ((158, 164), 130, 224),
               ((76, 82), 168, 224), ((174, 180), 168, 224), ((62, 66), 204, 224), ((190, 194), 204, 224)]
    return art + ''.join(vlines(xs, y0, y1) for xs, y0, y1 in windows)

def needle():
    """Space Needle: the pinched tripod legs, the saucer-shaped observation deck and the spire."""
    art = tint(rect(76, 226, 104, 6, 2))
    art += ink('<path d="M88 232C108 184 120 150 124 106M168 232C148 184 136 150 132 106M128 106V232M104 196H152M116 150H140"/>', OUTLINE)
    art += solid('<path d="M54 102Q128 154 202 102Z"/>') + tint('<ellipse cx="128" cy="102" rx="74" ry="12"/>')
    return art + solid('<ellipse cx="128" cy="88" rx="24" ry="7"/>') + ink('<path d="M128 88V14"/>', DETAIL)

def arch():
    """Gateway Arch: the stainless catenary over the riverfront, with its tapering legs."""
    art = tint(rect(12, 224, 232, 8, 2))
    outer = 'M44 232C44 120 100 20 128 20C156 20 212 120 212 232'
    inner = 'C184 130 148 44 128 44C108 44 72 130 72 232'
    art += solid(f'<path d="{outer}H184{inner}H44Z"/>')
    seams = ''.join(f'<path d="M{x0} {y}H{x1}"/>' for y, x0, x1 in ((100, 60, 84), (140, 52, 76), (180, 48, 72), (100, 172, 196), (140, 180, 204), (180, 184, 208)))
    return art + ink(seams, HAIRLINE)

def washington():
    """Washington Monument: the obelisk on its plinth with an accent pyramidion and masonry courses."""
    art = tint(rect(48, 224, 160, 8, 2)) + solid(rect(64, 216, 128, 8, 2))
    art += solid('<path d="M112 216L118 64H138L144 216Z"/>') + tint(tri(118, 64, 128, 26, 138, 64))
    return art + ink(''.join(f'<path d="M{118-(y-64)*6/152:.1f} {y}H{138+(y-64)*6/152:.1f}"/>' for y in range(88, 216, 24)), HAIRLINE)

def capitol():
    """United States Capitol: the two wings with porticos, the central block, drum, dome and lantern."""
    art = tint(rect(16, 224, 224, 8, 2)) + solid(rect(24, 156, 208, 68, 2))
    art += vlines(range(36, 101, 10), 170, 212, INK) + vlines(range(156, 221, 10), 170, 212, INK)
    art += solid(tri(30, 156, 68, 136, 106, 156)) + solid(tri(150, 156, 188, 136, 226, 156))
    art += solid(rect(84, 140, 88, 84, 2)) + vlines(range(94, 163, 9), 156, 212, INK) + solid(tri(80, 140, 128, 116, 176, 140))
    art += solid(rect(96, 112, 64, 28, 2)) + vlines(range(104, 153, 8), 118, 134, INK)
    art += solid('<path d="M92 112C92 54 164 54 164 112Z"/>') + ink('<path d="M110 112C110 80 146 80 146 112M128 72V112"/>', HAIRLINE)
    return art + solid(rect(120, 54, 16, 16, 2)) + dot(128, 46, 6)

def redeemer():
    """Christ the Redeemer: the statue with outstretched arms on its pedestal atop the mountain."""
    art = tint('<path d="M4 232Q128 172 252 232Z"/>') + solid(rect(100, 196, 56, 36, 2)) + tint(rect(108, 184, 40, 12, 2))
    arms = '<path d="M36 96H220"/>'
    art += ink(arms, 14) + white_line(arms, 8)
    art += solid('<path d="M112 92Q128 84 144 92L154 184H102Z"/>') + ink('<path d="M118 112V176M128 108V180M138 112V176"/>', HAIRLINE)
    return art + solid(rect(123, 80, 10, 10, 2)) + solid('<circle cx="128" cy="68" r="13"/>')

def chichen():
    """Chichén Itzá: El Castillo's nine stepped tiers, the central stairway and the temple on top."""
    rise, run, tiers = 13, 9, 9
    left = ''.join(f'V{232 - rise*(i+1)}H{20 + run*(i+1)}' for i in range(tiers))
    right = ''.join(f'V{232 - rise*(tiers-i-1)}H{236 - run*(tiers-i-1)}' for i in range(tiers))
    top = 232 - rise * tiers
    art = solid(f'<path d="M20 232{left}H{236 - run*tiers}{right}Z"/>')
    art += solid(rect(116, top, 24, 232 - top)) + ink(''.join(f'<path d="M116 {y}H140"/>' for y in range(top + 8, 232, 8)), HAIRLINE)
    art += solid(rect(108, top - 20, 40, 20)) + tint(rect(104, top - 28, 48, 9, 1)) + f'<rect x="122" y="{top-12}" width="12" height="12" fill="{INK}"/>'
    return art

def cntower():
    """CN Tower: the tapering concrete shaft, the main pod, the SkyPod and the antenna."""
    art = tint(rect(84, 224, 88, 8, 2)) + solid('<path d="M116 224L122 40H134L140 224Z"/>')
    art += solid(rect(94, 124, 68, 30, 10)) + tint(rect(94, 138, 68, 8, 1)) + vlines(range(104, 153, 8), 128, 136, INK)
    return art + tint(rect(114, 74, 28, 12, 5)) + ink('<path d="M128 40V8"/>', DETAIL)

# ---------------------------------------------------------------- Europe
def eiffel():
    """Eiffel Tower: the curved iron legs, the arch, two accent platforms and lattice rungs."""
    leg = lambda t: bezier((36, 232), (64, 200), (104, 150), (112, 104), t)
    archc = lambda t: quad((176, 232), (128, 108), (80, 232), t)
    def half(y):
        if y >= 104: return 128 - solve(leg, 1, y)
        return 16 - 8 * (104 - y) / 72
    body = 'M36 232C64 200 104 150 112 104L120 32L128 12L136 32L144 104C152 150 192 200 220 232H176Q128 108 80 232Z'
    art = solid(f'<path d="{body}"/>')
    rungs = ''
    for y in range(48, 161, 16):
        h = half(y) - 3; rungs += f'<path d="M{128-h:.1f} {y}H{128+h:.1f}"/>'
    for y in range(184, 225, 20):
        h = half(y) - 3; a = 128 - solve(archc, 1, y) - 3
        rungs += f'<path d="M{128-h:.1f} {y}H{128-a:.1f}M{128+a:.1f} {y}H{128+h:.1f}"/>'
    art += ink(rungs + '<path d="M128 36V96"/>', HAIRLINE)
    return art + tint(rect(58, 166, 140, 8, 2)) + tint(rect(102, 100, 52, 8, 2)) + tint(rect(122, 30, 12, 6, 2))

def bigben():
    """Big Ben: the Elizabeth Tower's shaft, clock stage, belfry and spire."""
    art = tint(rect(92, 224, 72, 8, 2)) + solid(rect(102, 104, 52, 120, 2)) + vlines((112, 120, 136, 144), 118, 216)
    art += solid(rect(96, 60, 64, 44, 2)) + tint(rect(112, 66, 32, 32, 3)) + dot(128, 82, 14, WHITE, DETAIL)
    art += ink('<path d="M128 82V72M128 82L135 86"/>', DETAIL) + solid(rect(100, 44, 56, 16, 2)) + vlines((112, 128, 144), 48, 56, INK)
    return art + tint(tri(96, 44, 128, 6, 160, 44)) + ink('<path d="M128 6V0"/>', HAIRLINE)

def towerbridge():
    """Tower Bridge: twin Gothic towers, the high-level walkways, the bascule deck and suspension chains."""
    art = waves(216) + waves(228)
    art += ink('<path d="M60 112Q32 170 6 192M196 112Q224 170 250 192"/>', OUTLINE)
    art += ink(''.join(f'<path d="M{x} {solve(lambda t: quad((60,112),(32,170),(6,192), t), 0, x):.1f}V192"/>' for x in (16, 28, 40, 52)), HAIRLINE)
    art += ink(''.join(f'<path d="M{x} {solve(lambda t: quad((196,112),(224,170),(250,192), t), 0, x):.1f}V192"/>' for x in (204, 216, 228, 240)), HAIRLINE)
    art += solid(rect(6, 190, 244, 12, 2)) + ink('<path d="M128 190V202"/>', DETAIL)
    for x in (60, 156):
        art += solid(rect(x, 76, 40, 156, 2)) + vlines((x + 12, x + 28), 96, 180) + tint(tri(x - 4, 76, x + 20, 36, x + 44, 76))
    return art + tint(rect(100, 96, 56, 12, 2)) + tint(rect(100, 128, 56, 12, 2)) + white_line('<path d="M100 102H156M100 134H156"/>')

def colosseum():
    """Colosseum: the elliptical amphitheater with three tiers of arcades and the ruined lower wall."""
    art = tint('<ellipse cx="128" cy="214" rx="116" ry="12"/>')
    art += solid('<path d="M24 214V100Q80 82 148 90V140Q196 138 232 152V214Z"/>')
    art += ink('<path d="M24 136Q80 120 148 126M24 172Q80 158 148 162M148 180Q196 178 232 190"/>', HAIRLINE)
    arches = ''.join(f'<path d="M{x} {y}a7 7 0 0 1 14 0v16"/>' for y in (110, 144, 180) for x in range(32, 135, 18))
    arches += ''.join(f'<path d="M{x} {y}a7 7 0 0 1 14 0v16"/>' for y in (156, 192) for x in range(154, 220, 18))
    return art + ink(arches, HAIRLINE)

def pisa():
    """Leaning Tower of Pisa: the tilted cylinder of arcaded tiers and its belfry."""
    art = tint(rect(32, 226, 192, 6, 2)) + '<g transform="rotate(-6 128 232)">'
    art += solid(rect(96, 212, 64, 20, 2)) + solid(rect(100, 40, 56, 172, 3))
    art += ink(''.join(f'<path d="M100 {y}H156"/>' for y in range(64, 212, 24)), HAIRLINE)
    art += vlines(range(108, 149, 8), 70, 206, INK) + tint(rect(104, 22, 48, 18, 3))
    return art + '</g>'

def stonehenge():
    """Stonehenge: two standing trilithons, a lone upright behind them and a fallen stone in front."""
    art = tint('<ellipse cx="128" cy="224" rx="118" ry="10"/>') + solid(rect(118, 128, 22, 96, 3))
    art += solid(rect(26, 120, 30, 104, 3)) + solid(rect(72, 124, 28, 100, 3)) + solid(rect(22, 98, 82, 24, 5))
    art += solid(rect(156, 124, 28, 100, 3)) + solid(rect(200, 118, 30, 106, 3)) + solid(rect(152, 96, 82, 24, 5))
    art += solid(rect(104, 206, 48, 18, 4))
    return art + ink('<path d="M36 150Q40 160 36 170M86 140Q82 150 86 160M166 150Q170 160 166 170M214 140Q210 150 214 160"/>', HAIRLINE)

def arc():
    """Arc de Triomphe: the monumental arch with its vault, side arches, frieze and cornice."""
    art = tint(rect(24, 224, 208, 8, 2)) + solid(rect(40, 56, 176, 168, 2))
    vault = '<path d="M92 224V148A36 36 0 0 1 164 148V224Z"/>'
    art += f'<g fill="{ACCENT}">{vault}</g>' + ink(vault, DETAIL)
    for x in (50, 186):
        side = f'<path d="M{x} 224V196A10 10 0 0 1 {x+20} 196V224Z"/>'
        art += f'<g fill="{ACCENT}">{side}</g>' + ink(side, DETAIL)
    art += tint(rect(48, 64, 160, 12, 1)) + ink('<path d="M40 84H216M40 124H216"/>', DETAIL)
    return art + ink('<path d="M56 100V116M72 100V116M184 100V116M200 100V116"/>', HAIRLINE)

def brandenburg():
    """Brandenburg Gate: six Doric columns, the entablature and attic, and the quadriga on top."""
    art = tint(rect(16, 224, 224, 8, 2)) + columns(range(48, 209, 32), 120, 224, 14)
    art += solid(rect(28, 98, 200, 22, 2)) + solid(rect(56, 74, 144, 24, 2)) + ink('<path d="M28 108H228"/>', HAIRLINE)
    horse = 'M0 16V6Q0 0 6 0L10 -6L14 -4L12 2Q16 4 16 16Z'
    art += ''.join(f'<g transform="translate({x} 51.6) scale(1.4)">' + tint(f'<path d="{horse}"/>', HAIRLINE) + '</g>' for x in (62, 84, 150, 172))
    return art + tint(rect(116, 60, 24, 14, 2)) + dot(128, 50, 5, ACCENT, HAIRLINE)

def parthenon():
    """Parthenon: the pediment, entablature with triglyphs, eight Doric columns and the stepped base."""
    art = tint(rect(12, 218, 232, 8, 2)) + solid(rect(20, 208, 216, 10, 2)) + columns(range(40, 217, 25), 118, 208)
    art += vlines(range(40, 217, 25), 124, 202, INK) + solid(rect(28, 100, 200, 18, 2))
    art += ink(''.join(f'<path d="M{x} 104V114"/>' for x in range(40, 217, 12)), HAIRLINE)
    return art + solid(tri(24, 100, 128, 50, 232, 100)) + tint('<path d="M64 96Q128 70 192 96Z"/>', HAIRLINE)

def louvre():
    """Louvre Pyramid: the glass pyramid with its diamond lattice, flanked by the two smaller pyramids."""
    art = tint(tri(8, 216, 30, 180, 52, 216)) + tint(tri(204, 216, 226, 180, 248, 216)) + tint(tri(40, 216, 128, 44, 216, 216))
    lattice = ''
    for x0 in range(62, 217, 22):
        t = (216 - x0) / 176; lattice += f'<path d="M{x0} 216L{x0+88*t:.1f} {216-176*t:.1f}"/>'
        x1 = 256 - x0; lattice += f'<path d="M{x1} 216L{x1-88*t:.1f} {216-176*t:.1f}"/>'
    for y in range(72, 216, 24):
        h = 88 * (216 - y) / 172; lattice += f'<path d="M{128-h:.1f} {y}H{128+h:.1f}"/>'
    art += white_line(lattice) + ink(tri(40, 216, 128, 44, 216, 216).replace('<path', '<path fill="none"'), OUTLINE)
    return art + solid(rect(116, 196, 24, 20, 2)) + ground(216, 4, 252)

# ---------------------------------------------------------------- Asia & Pacific
def taj():
    """Taj Mahal: the onion dome and finial, the iwan, chhatris, four minarets and the platform."""
    art = tint(rect(12, 224, 232, 8, 2)) + solid(rect(20, 206, 216, 18, 2))
    for x in (28, 212):
        art += solid(rect(x, 96, 16, 110, 3)) + solid(f'<path d="M{x-2} 96Q{x+8} 78 {x+18} 96Z"/>') + ink(f'<path d="M{x} 132H{x+16}M{x} 168H{x+16}"/>', HAIRLINE)
    art += solid(rect(60, 136, 136, 70, 2))
    for d in ('<path d="M108 206V164A20 20 0 0 1 148 164V206Z"/>', '<path d="M70 206V182A8 8 0 0 1 86 182V206Z"/>', '<path d="M170 206V182A8 8 0 0 1 186 182V206Z"/>'):
        art += f'<g fill="{ACCENT}">{d}</g>' + ink(d, DETAIL)
    art += solid('<path d="M64 136Q78 110 92 136Z"/>') + solid('<path d="M164 136Q178 110 192 136Z"/>')
    art += solid(rect(100, 124, 56, 12, 2)) + solid('<path d="M96 124Q84 80 128 58Q172 80 160 124Z"/>')
    return art + ink('<path d="M128 58V42"/>', DETAIL) + dot(128, 40, 4, ACCENT, HAIRLINE)

def greatwall():
    """Great Wall of China: the wall snaking over the hills with two watchtowers."""
    art = tint('<path d="M4 232C40 190 80 200 120 170S200 150 252 180V232Z"/>')
    wall = '<path d="M4 196C50 184 80 120 128 130S200 90 252 100"/>'
    art += ink(wall, 24) + white_line(wall, 14)
    for x, y in ((112, 96), (206, 66)):
        art += solid(rect(x, y, 32, 50, 2)) + ''.join(solid(rect(x + i, y - 6, 6, 6), WHITE, HAIRLINE) for i in (2, 13, 24))
        art += f'<rect x="{x+12}" y="{y+30}" width="8" height="12" fill="{INK}"/>'
    return art

def tokyotower():
    """Tokyo Tower: the straight-legged lattice tower with its two white observation decks."""
    body = 'M44 232L108 116L118 44L128 12L138 44L148 116L212 232H172Q128 160 84 232Z'
    art = tint(f'<path d="{body}"/>', OUTLINE)
    archc = lambda t: quad((172, 232), (128, 160), (84, 232), t)
    rungs = ''
    for y in (60, 76, 92, 108, 124, 160, 176, 192, 208, 224):
        h = (10 + 10 * (y - 44) / 72 if y <= 116 else 20 + 64 * (y - 116) / 116) - 3
        if y < 160: rungs += f'<path d="M{128-h:.1f} {y}H{128+h:.1f}"/>'
        else:
            a = 128 - solve(archc, 1, y) - 3; rungs += f'<path d="M{128-h:.1f} {y}H{128-a:.1f}M{128+a:.1f} {y}H{128+h:.1f}"/>'
    art += white_line(rungs)
    return art + solid(rect(84, 136, 88, 16, 2)) + solid(rect(106, 80, 44, 12, 2)) + ground()

def petronas():
    """Petronas Towers: the twin stepped towers, their pinnacles and the skybridge between them."""
    art = tint(rect(20, 224, 216, 8, 2))
    for cx in (72, 184):
        body = f'M{cx-28} 224V150H{cx-24}V110H{cx-20}V76H{cx-16}V50H{cx-10}V32L{cx} 10L{cx+10} 32V50H{cx+16}V76H{cx+20}V110H{cx+24}V150H{cx+28}V224Z'
        art += solid(f'<path d="{body}"/>') + vlines((cx - 12, cx, cx + 12), 160, 216) + vlines((cx - 8, cx + 8), 86, 142)
        art += tint(tri(cx - 10, 32, cx, 10, cx + 10, 32), HAIRLINE)
    return art + ink('<path d="M100 156L128 198L156 156"/>', OUTLINE) + solid(rect(100, 146, 56, 10, 2))

def angkor():
    """Angkor Wat: the five lotus-bud towers above the long gallery and the moat."""
    art = tint(rect(8, 222, 240, 10, 2)) + solid(rect(16, 166, 224, 56, 2)) + vlines(range(28, 229, 16), 180, 210, INK)
    art += ink('<path d="M16 176H240"/>', HAIRLINE)
    for cx, top, hw in ((44, 112, 16), (212, 112, 16), (88, 86, 18), (168, 86, 18), (128, 46, 24)):
        art += solid(f'<path d="M{cx-hw} 166L{cx-hw+6} {top+30}Q{cx} {top} {cx+hw-6} {top+30}L{cx+hw} 166Z"/>')
        tiers = ''
        for y in range(top + 44, 160, 16):
            h = (hw - 6) + 6 * (y - top - 30) / (166 - top - 30); tiers += f'<path d="M{cx-h:.1f} {y}H{cx+h:.1f}"/>'
        art += ink(tiers, HAIRLINE) + tint(tri(cx - 4, top + 8, cx, top - 6, cx + 4, top + 8), HAIRLINE)
    return art

def fuji():
    """Mount Fuji: the symmetrical volcanic cone with its snow cap and low clouds."""
    art = tint('<path d="M4 216C60 204 92 130 108 80H148C164 130 196 204 252 216Z"/>')
    art += solid('<path d="M108 80H148C152 96 158 108 162 116C150 122 144 110 134 120C126 112 118 122 108 112C102 118 98 110 94 116C100 104 104 92 108 80Z"/>')
    art += ink('<path d="M112 80Q128 86 144 80"/>', HAIRLINE)
    cloud = '<path d="M0 0a10 10 0 0 1 18-6a12 12 0 0 1 22 2a9 9 0 0 1 12 10H-4a8 8 0 0 1 4-6Z"/>'
    return art + ''.join(f'<g transform="translate({x} {y})">' + solid(cloud, WHITE, DETAIL) + '</g>' for x, y in ((24, 150), (178, 136)))

def torii():
    """Itsukushima Shrine's great torii: the vermilion gate standing in the tidal water."""
    art = waves(212) + waves(224)
    for x in (34, 212): art += tint(rect(x, 132, 10, 72, 2))
    art += tint('<path d="M58 104L54 206H76L72 104Z"/>') + tint('<path d="M198 104L202 206H180L184 104Z"/>')
    art += tint(rect(40, 118, 176, 12, 1)) + tint('<path d="M26 92Q128 76 230 92L226 104Q128 90 30 104Z"/>')
    art += solid('<path d="M20 90Q128 70 236 90L232 82Q128 62 24 82Z"/>', INK, HAIRLINE)
    return art + solid(rect(120, 104, 16, 14, 1))

def opera():
    """Sydney Opera House: the shell roofs on their podium at the water's edge."""
    art = tint(rect(6, 216, 244, 12, 2)) + waves(222, 8, 248, 24, WHITE)
    art += solid('<path d="M154 196C170 150 186 120 212 106C214 150 204 176 198 196Z"/>')
    art += solid('<path d="M96 196C120 130 150 90 182 74C180 130 160 170 150 196Z"/>')
    art += solid('<path d="M40 196C60 120 100 72 140 56C136 120 112 164 92 196Z"/>')
    art += solid('<path d="M24 196C32 170 48 150 68 142C64 170 54 186 50 196Z"/>')
    art += ink('<path d="M66 196C78 150 104 100 140 56M118 196C130 150 150 110 182 74M176 196C184 160 194 130 212 106"/>', HAIRLINE)
    return art + solid(rect(14, 196, 228, 20, 2))

def harbour():
    """Sydney Harbour Bridge: the steel arch, the deck with hangers and the granite pylons."""
    inner = lambda t: bezier((218, 200), (218, 92), (38, 92), (38, 200), t)
    art = waves(218) + waves(230)
    art += solid('<path d="M20 200C20 56 236 56 236 200H218C218 92 38 92 38 200Z"/>')
    art += ink(''.join(f'<path d="M{x} {solve(inner, 0, x):.1f}V150"/>' for x in range(56, 201, 16)), HAIRLINE)
    art += solid(rect(4, 150, 248, 10, 2))
    for x in (10, 220): art += solid(rect(x, 112, 26, 88, 2)) + tint(rect(x - 2, 108, 30, 8, 1))
    return art

def moai():
    """Moai: an Easter Island statue with its heavy brow, long nose and red pukao topknot."""
    art = tint('<ellipse cx="128" cy="226" rx="100" ry="8"/>') + solid('<path d="M86 226V100Q86 44 128 40Q170 44 170 100V226Z"/>')
    art += tint(rect(98, 24, 60, 22, 5)) + ink('<path d="M96 104Q112 90 126 102Q142 90 160 104"/>', OUTLINE)
    art += ink('<path d="M100 114Q112 108 122 114M134 114Q146 108 158 114"/>', DETAIL) + ink('<path d="M128 104L120 156H138"/>', OUTLINE)
    return art + ink('<path d="M110 182Q128 176 148 182"/>', OUTLINE) + ink('<path d="M92 112V176M164 112V176M100 212Q128 200 156 212"/>', HAIRLINE)

# ---------------------------------------------------------------- Africa & Middle East
def pyramids():
    """Pyramids of Giza: the three pyramids on the desert plateau under the sun."""
    art = tint(rect(2, 212, 252, 20, 2)) + dot(206, 52, 16, WHITE, DETAIL)
    for x0, ax, ay, x1 in ((16, 60, 140, 104), (60, 140, 56, 220), (180, 212, 160, 244)):
        shade = x1 - (x1 - ax) * 0.55
        art += solid(tri(x0, 212, ax, ay, x1, 212)) + tint(tri(ax, ay, x1, 212, shade, 212))
    return art

def sphinx():
    """Great Sphinx of Giza: the lion body and nemes headdress in profile, a pyramid behind."""
    art = tint(tri(116, 150, 196, 48, 252, 150)) + tint(rect(2, 212, 252, 20, 2))
    art += solid('<path d="M60 212V146Q60 132 76 132H176Q226 132 228 176V212Z"/>') + solid(rect(20, 188, 96, 24, 8))
    art += ink('<path d="M60 200H116"/>', HAIRLINE) + solid('<path d="M40 140L50 80Q56 54 80 54Q104 54 110 80L120 140Z"/>')
    art += accent_line('<path d="M54 96L48 136M60 100L56 136M106 96L112 136M100 100L104 136"/>', DETAIL)
    art += solid(rect(75, 122, 10, 20, 2)) + solid('<ellipse cx="80" cy="100" rx="18" ry="24"/>', WHITE, DETAIL) + dot(80, 58, 3, ACCENT, HAIRLINE)
    return art + ink('<path d="M70 94Q74 90 78 94M82 94Q86 90 90 94M80 98V110M74 116Q80 119 86 116"/>', DETAIL)

def burj():
    """Burj Khalifa: the stepped spiral setbacks rising to the spire, over the Y-shaped base wings."""
    art = tint(rect(60, 224, 136, 8, 2)) + solid(rect(68, 190, 30, 34, 2)) + solid(rect(158, 190, 30, 34, 2))
    art += solid('<path d="M96 224V184H102V148H108V112H114V80H118V54H122V32H126L128 8L130 32H134V54H138V80H142V112H148V148H154V184H160V224Z"/>')
    for x, y, w in ((102, 184, 52), (108, 148, 40), (114, 112, 28), (118, 80, 20)): art += tint(rect(x, y - 6, w, 6, 1), HAIRLINE)
    return art + vlines(range(104, 153, 8), 192, 216) + vlines(range(112, 145, 8), 156, 176) + vlines(range(118, 139, 10), 120, 140)

def burjalarab():
    """Burj Al Arab: the sail-shaped hotel on its island with the cantilevered helipad."""
    art = waves(220) + waves(230) + solid(rect(48, 212, 160, 10, 2))
    art += solid('<path d="M184 212V64Q184 28 160 26Q92 36 72 212Z"/>')
    glass = '<path d="M160 26Q92 36 72 212H96Q104 64 160 46Z"/>'
    art += f'<g fill="{ACCENT}">{glass}</g>' + ink(glass, DETAIL)
    return art + ink('<path d="M184 76H208M176 28L182 6"/>', DETAIL) + solid('<ellipse cx="204" cy="72" rx="20" ry="5"/>')

def petra():
    """Petra: Al-Khazneh, the Treasury façade carved into the sandstone cliff."""
    art = tint('<path d="M12 232V48Q40 20 80 40Q128 14 176 36Q220 18 244 52V232Z"/>')
    art += columns((62, 84, 106, 150, 172, 194), 162, 232) + f'<rect x="118" y="170" width="20" height="62" fill="{INK}"/>'
    art += solid(rect(52, 148, 152, 14, 2)) + solid(tri(50, 148, 128, 116, 206, 148))
    art += solid('<path d="M54 108V80L100 64V108Z"/>') + solid('<path d="M202 108V80L156 64V108Z"/>') + vlines((66, 80, 176, 190), 76, 104, INK)
    return art + solid(rect(112, 62, 32, 46, 4)) + solid('<path d="M110 62Q128 40 146 62Z"/>') + vlines((120, 128, 136), 70, 104, INK) + dot(128, 40, 5, ACCENT, HAIRLINE)

def kilimanjaro():
    """Mount Kilimanjaro: the broad volcanic massif with its snow cap above the savanna and an acacia."""
    art = tint('<path d="M4 200C64 196 80 136 104 104L152 104C176 136 192 196 252 200Z"/>')
    art += solid('<path d="M104 104H152C156 112 162 118 166 128C156 124 148 134 140 126C132 136 124 124 116 130C108 124 100 130 92 126C96 118 100 110 104 104Z"/>')
    art += ground(216, 4, 252) + ink('<path d="M64 232V190M64 206L48 194M64 202L82 190"/>', OUTLINE)
    return art + solid('<path d="M28 192Q64 166 100 192Z"/>', INK, DETAIL)

def figures():
    return [
      ('Americas', 'LIBERTY', 'Statue of Liberty', ['Lady Liberty'], liberty()),
      ('Americas', 'GOLDENGATE', 'Golden Gate Bridge', ['Golden Gate'], goldengate()),
      ('Americas', 'EMPIRE', 'Empire State Building', ['Empire State'], empire()),
      ('Americas', 'NEEDLE', 'Space Needle', [], needle()),
      ('Americas', 'ARCH', 'Gateway Arch', ['St. Louis Arch', 'Saint Louis Arch'], arch()),
      ('Americas', 'WASHINGTON', 'Washington Monument', [], washington()),
      ('Americas', 'CAPITOL', 'United States Capitol', ['US Capitol', 'Capitol Building', 'The Capitol'], capitol()),
      ('Americas', 'REDEEMER', 'Christ the Redeemer', ['Cristo Redentor'], redeemer()),
      ('Americas', 'CHICHEN', 'Chichén Itzá', ['El Castillo', 'Temple of Kukulcán'], chichen()),
      ('Americas', 'CNTOWER', 'CN Tower', [], cntower()),
      ('Europe', 'EIFFEL', 'Eiffel Tower', ['Tour Eiffel'], eiffel()),
      ('Europe', 'BIGBEN', 'Big Ben', ['Elizabeth Tower', 'Palace of Westminster'], bigben()),
      ('Europe', 'TOWERBRIDGE', 'Tower Bridge', [], towerbridge()),
      ('Europe', 'COLOSSEUM', 'Colosseum', ['Coliseum', 'Roman Colosseum'], colosseum()),
      ('Europe', 'PISA', 'Leaning Tower of Pisa', ['Tower of Pisa'], pisa()),
      ('Europe', 'STONEHENGE', 'Stonehenge', [], stonehenge()),
      ('Europe', 'ARC', 'Arc de Triomphe', ["Arc de Triomphe de l'Étoile"], arc()),
      ('Europe', 'BRANDENBURG', 'Brandenburg Gate', ['Brandenburger Tor'], brandenburg()),
      ('Europe', 'PARTHENON', 'Parthenon', ['Acropolis'], parthenon()),
      ('Europe', 'LOUVRE', 'Louvre Pyramid', ['Louvre', 'Pyramide du Louvre'], louvre()),
      ('Asia & Pacific', 'TAJ', 'Taj Mahal', [], taj()),
      ('Asia & Pacific', 'GREATWALL', 'Great Wall of China', ['Great Wall'], greatwall()),
      ('Asia & Pacific', 'TOKYOTOWER', 'Tokyo Tower', [], tokyotower()),
      ('Asia & Pacific', 'PETRONAS', 'Petronas Towers', ['Petronas Twin Towers'], petronas()),
      ('Asia & Pacific', 'ANGKOR', 'Angkor Wat', ['Angkor'], angkor()),
      ('Asia & Pacific', 'FUJI', 'Mount Fuji', ['Fuji', 'Fujisan', 'Mt. Fuji'], fuji()),
      ('Asia & Pacific', 'TORII', 'Itsukushima Torii', ['Itsukushima Shrine', 'Torii', 'Torii gate', 'Miyajima'], torii()),
      ('Asia & Pacific', 'OPERA', 'Sydney Opera House', ['Opera House'], opera()),
      ('Asia & Pacific', 'HARBOUR', 'Sydney Harbour Bridge', ['Sydney Harbor Bridge', 'Harbour Bridge'], harbour()),
      ('Asia & Pacific', 'MOAI', 'Moai', ['Easter Island heads', 'Easter Island statues', 'Easter Island'], moai()),
      ('Africa & Middle East', 'PYRAMIDS', 'Pyramids of Giza', ['Great Pyramid of Giza', 'Great Pyramid', 'Giza Pyramids', 'Egyptian Pyramids', 'Pyramids'], pyramids()),
      ('Africa & Middle East', 'SPHINX', 'Great Sphinx of Giza', ['Sphinx', 'Great Sphinx'], sphinx()),
      ('Africa & Middle East', 'BURJ', 'Burj Khalifa', [], burj()),
      ('Africa & Middle East', 'BURJALARAB', 'Burj Al Arab', [], burjalarab()),
      ('Africa & Middle East', 'PETRA', 'Petra', ['Al-Khazneh', 'The Treasury', 'Treasury of Petra'], petra()),
      ('Africa & Middle East', 'KILIMANJARO', 'Mount Kilimanjaro', ['Kilimanjaro', 'Mt. Kilimanjaro'], kilimanjaro()),
    ]

def build():
    entries, assets = [], []
    for region, abbr, name, aliases, body in figures():
        assert region in CONFIG['conferences'], region
        raw = svg(body)
        for color in PALETTE:
            assert color in raw, f'{abbr} never paints {color}'
        path = f'/logos/svg/landmarks/{abbr.lower()}.svg'
        target = ROOT / 'public' / path.lstrip('/')
        target.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(target, raw)
        assets.append({'path': path, 'sha256': hashlib.sha256(raw.encode()).hexdigest()})
        entry = dict(id=f'{LEAGUE}-{abbr}', league=LEAGUE, conference=region, region=name, name='', abbr=abbr, palette=PALETTE, logo=path)
        if aliases: entry['aliases'] = aliases
        entries.append(entry)
    assert len({e['id'] for e in entries}) == len(entries)
    text = TEAMS_JSON.read_text(); data = json.loads(text); teams = data['teams']
    # Sit where the collection already sits, else just before the educational collections (which rebuild after everything else).
    at = next((i for i, t in enumerate(teams) if t['league'] == LEAGUE),
              next((i for i, t in enumerate(teams) if t['league'] in EDUCATION_LEAGUES), len(teams)))
    merged = teams[:at] + entries + [t for t in teams[at:] if t['league'] != LEAGUE]
    start = text.index('"teams": ['); end = text.index('\n  ]', start)
    text = text[:start] + '"teams": [\n' + ',\n'.join(fmt_entry(t) for t in merged) + text[end:]
    if LEAGUE not in data['leagues']:
        marker = text.index('\n  },', text.index('"leagues"'))
        text = text[:marker] + ',\n    ' + json.dumps(LEAGUE) + ': ' + json.dumps(CONFIG) + text[marker:]
    json.loads(text); atomic_write_text(TEAMS_JSON, text)
    atomic_write_text(ROOT / 'public/logos/svg/landmarks-manifest.json', json.dumps({'generator': 'scripts/build_landmarks.py', 'assets': assets}, indent=2) + '\n')
    print(f'{len(entries)} landmark entries; {len(assets)} SVGs')

if __name__ == '__main__': build()
