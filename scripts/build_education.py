#!/usr/bin/env python3
"""Rebuild the offline educational catalog and vector assets (Python stdlib only).

Identity: IUPAC periodic table (elements.json, atomic numbers 1–118).
Glyph outlines: DejaVu Sans (education_glyphs.json), see education-SOURCES.md.
Illustrations: original schematic artwork, not scale models or scientific diagrams.
No runtime fonts, remote requests, embedded rasters or labels spelling the answers.
"""
import hashlib
import json
import math
import education_artwork as detail
from pathlib import Path
from build_teams import atomic_write_text, fmt_entry

ROOT = Path(__file__).resolve().parent.parent
TEAMS_JSON = ROOT / 'src/lib/teams.json'
GLYPHS = json.loads((ROOT / 'scripts/education_glyphs.json').read_text())
MATH_GLYPHS = json.loads((ROOT / 'scripts/math_glyphs.json').read_text())
INK, ACCENT, WHITE = '#183153', '#009688', '#FFFFFF'
PALETTE = [INK, ACCENT, WHITE]
LEAGUES = {
    'ELEMENT': {'label': 'ELEMENTS', 'conferences': [f'Period {n}' for n in range(1, 8)]},
    'MATH': {'label': 'MATH', 'conferences': ['Constants & variables', 'Operations', 'Relations', 'Geometry']},
    'SHAPE': {'label': 'SHAPES', 'conferences': ['2D shapes', '3D solids']},
    'SPACE': {'label': 'SPACE', 'conferences': ['Planets', 'Dwarf planets', 'Other objects']},
    'SCIENCE': {'label': 'SCIENCE', 'conferences': ['Physics', 'Biology', 'Lab equipment']},
}

def glyph(text, x, y, width, height, fill=WHITE, glyphs=GLYPHS):
    """Fit outlines to a box using their real ink bounds, preserving aspect ratio."""
    offset = 0; parts = []; bounds = []
    for char in text:
        g = glyphs[char]; a,b,c,d = g['bounds']
        bounds.append((a+offset,b,c+offset,d)); parts.append((offset,g['path'])); offset += g['advance']
    left=min(b[0] for b in bounds); bottom=min(b[1] for b in bounds)
    right=max(b[2] for b in bounds); top=max(b[3] for b in bounds)
    s=min(width/(right-left),height/(top-bottom))
    tx=x+(width-(right-left)*s)/2-left*s; ty=y+(height-(top-bottom)*s)/2+top*s
    paths=''.join(f'<path transform="translate({off} 0)" d="{path}"/>' for off,path in parts)
    return f'<g fill="{fill}" transform="translate({tx:.4f} {ty:.4f}) scale({s:.6f} {-s:.6f})">{paths}</g>'

def svg(body):
    body=detail.prune_defs(body)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">{body}</svg>\n'

def line(body, color=INK, weight=10):
    return f'<g fill="none" stroke="{color}" stroke-width="{weight}" stroke-linecap="round" stroke-linejoin="round">{body}</g>'

def circle(x,y,r,fill=INK):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"/>'

def polygon(n):
    return ' '.join(f'{128+92*math.cos(-math.pi/2+i*2*math.pi/n):.3f},{128+92*math.sin(-math.pi/2+i*2*math.pi/n):.3f}' for i in range(n))

# Science figures are drawn like textbook illustrations: one thin ink outline weight,
# white bodies, a flat accent tint for liquids, poles, mercury and organelles, and
# real part details (graduations, a nucleus, base pairs) instead of icon strokes.
# Every figure paints all three palette slots, so a remix needs no backdrop tile.
OUTLINE, DETAIL, HAIRLINE = 5, 3, 2
def solid(body, fill=WHITE, weight=OUTLINE):
    return f'<g fill="{fill}" stroke="{INK}" stroke-width="{weight}" stroke-linecap="round" stroke-linejoin="round">{body}</g>'
def ink(body, weight=DETAIL): return line(body, INK, weight)
def dot(x, y, r, fill=ACCENT, weight=DETAIL): return solid(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}"/>', fill, weight)
def rect(x, y, w, h, rx=0): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/>'

def atom():
    """Bohr-style schematic: a nucleus cluster, three orbits and an electron on each."""
    art = ink(''.join(f'<ellipse cx="128" cy="128" rx="102" ry="36" transform="rotate({a} 128 128)"/>' for a in (0, 60, 120)))
    for a, t in ((0, 200), (60, 320), (120, 80)):
        x, y = 102*math.cos(math.radians(t)), 36*math.sin(math.radians(t)); r = math.radians(a)
        art += dot(128 + x*math.cos(r) - y*math.sin(r), 128 + x*math.sin(r) + y*math.cos(r), 7)
    art += ''.join(dot(128+15*math.cos(math.radians(90+60*i)), 128+15*math.sin(math.radians(90+60*i)), 11, (ACCENT, WHITE)[i % 2]) for i in range(6))
    return art + dot(128, 128, 11)

def magnet():
    """Horseshoe magnet with tinted pole faces and field lines arcing between them."""
    field = ''.join(f'<path d="M{72+i*9} 42C{72+i*9} {6+i*13} {184-i*9} {6+i*13} {184-i*9} 42"/>' for i in range(3))
    body = solid('<path d="M56 52V150C56 206 200 206 200 150V52H160V150C160 170 96 170 96 150V52Z"/>')
    return ink(field, 2.5) + body + solid(rect(56, 52, 40, 36) + rect(160, 52, 40, 36), ACCENT)

def dna():
    """Double helix: two outlined ribbons (one tinted) joined by base-pair rungs, back half-turns drawn first."""
    top, bottom, start, turns = 30, 226, math.pi/4, 1.75
    stop = start + 2*math.pi*turns
    x = lambda th, s: 128 + s*44*math.sin(th)
    y = lambda th: top + (bottom-top)*(th-start)/(stop-start)
    # Segments start and end exactly where the strands cross, so butt-capped ends tuck under the front ribbon.
    bounds = [start] + [th for th in (math.pi/2 + k*math.pi for k in range(4)) if start < th < stop] + [stop]
    def ribbon(front):
        parts = ''
        for s, tint in ((1, ACCENT), (-1, WHITE)):
            for a, b in zip(bounds, bounds[1:]):
                if (s*math.cos((a+b)/2) >= 0) != front: continue
                pts = [(x(a+(b-a)*i/40, s), y(a+(b-a)*i/40)) for i in range(41)]
                d = 'M' + 'L'.join(f'{px:.1f} {py:.1f}' for px, py in pts)
                caps = ''.join(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5.5" fill="{INK}"/><circle cx="{px:.1f}" cy="{py:.1f}" r="2.5" fill="{tint}"/>'
                               for th, (px, py) in ((a, pts[0]), (b, pts[-1])) if th in (start, stop))
                parts += caps + f'<g fill="none" stroke-linecap="butt"><path d="{d}" stroke="{INK}" stroke-width="11"/><path d="{d}" stroke="{tint}" stroke-width="5"/></g>'
        return parts
    rungs = ''
    for i in range(1, 16):
        th = start + (stop-start)*i/16; xa, xb = x(th, 1), x(th, -1); inset = 5 if xa < xb else -5
        if abs(xa-xb) > 24: rungs += f'<path d="M{xa+inset:.1f} {y(th):.1f}H{xb-inset:.1f}"/>'
    return ribbon(False) + ink(rungs) + ribbon(True)

def cell():
    """Animal cell: membrane, tinted nucleus with nucleolus, endoplasmic reticulum, mitochondria and vesicles."""
    art = solid('<path d="M128 36C180 34 226 66 230 112C234 160 206 222 140 226C84 230 30 196 26 140C22 86 72 38 128 36Z"/>')
    art += solid('<circle cx="116" cy="118" r="34"/>', ACCENT) + dot(108, 110, 9, WHITE)
    art += ink('<path d="M66 150c10-12 30-12 40 0M60 164c14-16 42-16 56 0"/>', HAIRLINE)
    for cx, cy, a in ((178, 92, -30), (170, 176, 20)):
        art += f'<g transform="rotate({a} {cx} {cy})">' + solid(f'<ellipse cx="{cx}" cy="{cy}" rx="26" ry="12"/>', WHITE, DETAIL)
        art += ink(f'<path d="M{cx-18} {cy}q4-7 8 0t8 0t8 0t8 0"/>', HAIRLINE) + '</g>'
    return art + ''.join(dot(x, y, 5, ACCENT, HAIRLINE) for x, y in ((74, 94), (92, 196), (138, 198), (200, 136)))

def flask():
    """Erlenmeyer flask: tinted liquid with a meniscus line, graduations and a glass highlight."""
    body = 'M104 28H152V40H148V100L214 206Q220 224 200 224H56Q36 224 42 206L108 100V40H104Z'
    level = 162; xl = 108 - 66*(level-100)/106; xr = 148 + 66*(level-100)/106
    art = solid(f'<path d="{body}"/>') + f'<path d="M{xl:.1f} {level}H{xr:.1f}L214 206Q220 224 200 224H56Q36 224 42 206Z" fill="{ACCENT}"/>'
    art += ink(f'<path d="M{xl:.1f} {level}H{xr:.1f}"/>') + line('<path d="M98 120L64 176"/>', WHITE, 4)
    ticks = ''.join(f'<path d="M{148+66*(y-100)/106:.1f} {y}h{-16 if y % 40 == 0 else -9}"/>' for y in range(120, 201, 20))
    return art + ink(ticks, HAIRLINE) + ink(f'<path d="{body}"/>', OUTLINE)

def beaker():
    """Griffin beaker with a pouring spout, tinted liquid, graduations and a glass highlight."""
    body = 'M66 52V210Q66 222 78 222H178Q190 222 190 210V52'
    art = solid(f'<path d="{body}Z"/>') + f'<path d="M66 134H190V210Q190 222 178 222H78Q66 222 66 210Z" fill="{ACCENT}"/>'
    art += ink('<path d="M66 134H190"/>') + line('<path d="M80 72V200"/>', WHITE, 4)
    ticks = ''.join(f'<path d="M190 {y}h{-18 if y % 40 == 14 else -10}"/>' for y in range(74, 200, 20))
    return art + ink(ticks, HAIRLINE) + ink(f'<path d="{body}"/>', OUTLINE) + ink('<path d="M196 44H74Q62 44 54 34"/>', OUTLINE)

def testtube():
    """Upright test tube with a rolled rim, tinted liquid, bubbles and a glass highlight."""
    body = 'M100 44V192A28 28 0 0 0 156 192V44'
    art = solid(f'<path d="{body}Z"/>') + f'<path d="M100 118H156V192A28 28 0 0 1 100 192Z" fill="{ACCENT}"/>'
    art += ink('<path d="M100 118H156"/>') + line('<path d="M112 60V200"/>', WHITE, 4)
    art += dot(134, 170, 5, WHITE, HAIRLINE) + dot(140, 148, 3, WHITE, HAIRLINE) + ink(f'<path d="{body}"/>', OUTLINE)
    return art + solid(rect(92, 34, 72, 10, 5))

def thermometer():
    """Glass thermometer: capillary, tinted mercury column and bulb, and a graduated scale."""
    art = solid('<path d="M110 50A18 18 0 0 1 146 50V165A34 34 0 1 1 110 165Z"/>') + ink('<path d="M128 70V190"/>', HAIRLINE)
    art += line('<path d="M128 84V194"/>', ACCENT, 8) + circle(128, 194, 22, ACCENT)
    return art + ink(''.join(f'<path d="M152 {y}h{16 if y % 50 == 10 else 8}"/>' for y in range(60, 161, 10)), HAIRLINE)

def microscope():
    """Compound microscope in side view: base, curved arm, focus knob, mirror, tinted stage with a slide, tilted body tube."""
    art = solid(rect(40, 208, 176, 24, 8))
    arm = '<path d="M172 214V150C172 112 152 104 140 96"/>'
    art += line(arm, INK, 22) + line(arm, WHITE, 12)
    art += ink('<path d="M114 186H172"/>', OUTLINE) + solid('<circle cx="100" cy="186" r="14"/>') + ink('<path d="M92 176L108 196"/>', HAIRLINE)
    art += solid(rect(60, 146, 116, 12, 2), ACCENT) + solid(rect(96, 136, 44, 10, 2), WHITE, DETAIL) + dot(176, 122, 12, ACCENT, OUTLINE)
    tube = solid(rect(104, 20, 28, 92, 3)) + solid(rect(98, 10, 40, 16, 4), ACCENT)
    tube += solid('<path d="M104 112H132L124 130H112Z"/>') + solid(rect(111, 130, 14, 18, 2), ACCENT, DETAIL)
    return art + f'<g transform="rotate(-20 118 110)">{tube}</g>'

def telescope():
    """Refracting telescope on a tripod: tube with tinted lens cell and eyepiece, finder scope, focuser and mount."""
    scope = solid(rect(48, 96, 152, 28, 4)) + solid(rect(192, 90, 26, 40, 4), ACCENT) + solid(rect(28, 101, 22, 18, 3), ACCENT, DETAIL)
    scope += solid(rect(100, 84, 40, 10, 3), WHITE, DETAIL) + solid(rect(116, 124, 24, 14, 2), WHITE, DETAIL)
    art = f'<g transform="rotate(-30 128 110)">{scope}</g>' + ink('<path d="M126 138L72 232M126 138L182 232M126 138V228M96 196H156"/>', OUTLINE)
    return art + dot(126, 140, 9, ACCENT, OUTLINE)

def taper(points, widths):
    """A filled ribbon along a polyline whose half-width changes point by point (tails, spiral arms)."""
    left, right = [], []
    for i, (x, y) in enumerate(points):
        (x0, y0), (x1, y1) = points[max(i-1, 0)], points[min(i+1, len(points)-1)]
        n = math.hypot(x1-x0, y1-y0) or 1; nx, ny = -(y1-y0)/n, (x1-x0)/n
        left.append((x+nx*widths[i], y+ny*widths[i])); right.append((x-nx*widths[i], y-ny*widths[i]))
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in left + right[::-1]) + 'Z'

def comet():
    """Comet: outlined nucleus and coma, a tapered curved dust tail and straight ion-tail streaks."""
    bez = lambda t: ((1-t)**2*72 + 2*(1-t)*t*176 + t*t*232, (1-t)**2*184 + 2*(1-t)*t*164 + t*t*34)
    pts = [bez(i/24) for i in range(25)]; widths = [22*(1-i/24)**1.3 + 1 for i in range(25)]
    tail = solid(f'<path d="{taper(pts, widths)}"/>', ACCENT, DETAIL)
    ion = ink('<path d="M90 150L178 46M100 142L206 30M104 158L220 46"/>', HAIRLINE)
    return ion + tail + solid('<circle cx="72" cy="184" r="34"/>', ACCENT, OUTLINE) + solid('<circle cx="72" cy="184" r="15"/>', WHITE, OUTLINE)

def galaxy():
    """Face-on spiral galaxy: two tapered logarithmic arms winding out from a bright outlined core, with star dots."""
    arms, stars = '', ''
    for phase in (0, math.pi):
        pts, widths = [], []
        for i in range(49):
            th = 5.2*i/48; r = 12*math.exp(0.415*th)
            pts.append((128 + r*math.cos(th+phase), 128 + r*math.sin(th+phase))); widths.append(16*(1-i/48)**0.7 + 2)
        arms += f'<path d="{taper(pts, widths)}"/>'
        stars += ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{3 if i % 2 else 2}"/>' for i, (x, y) in enumerate(pts[20::7]))
    return solid(arms, ACCENT, HAIRLINE) + solid('<circle cx="128" cy="128" r="28"/>', ACCENT, OUTLINE) + solid('<circle cx="128" cy="128" r="13"/>', WHITE, OUTLINE) + solid(stars, WHITE, 1.5)

def science_figures():
    return {
      'ATOM':('Atom','Physics',atom()),'MAGNET':('Magnet','Physics',magnet()),'TELESCOPE':('Telescope','Physics',telescope()),
      'DNA':('DNA','Biology',dna()),'CELL':('Cell','Biology',cell()),
      'FLASK':('Flask','Lab equipment',flask()),'BEAKER':('Beaker','Lab equipment',beaker()),'TESTTUBE':('Test tube','Lab equipment',testtube()),
      'THERMOMETER':('Thermometer','Lab equipment',thermometer()),'MICROSCOPE':('Microscope','Lab equipment',microscope()),
    }

# Planets are drawn like textbook figures: a flat disk in the body's own palette with its
# real surface cues (polar caps, belts, craters, cloud swirls, ring systems) and a white
# specular highlight on the lit upper-left limb. Each paints all three palette slots.
def band(y1, y2, fill, r=96, cx=128, cy=128):
    """A horizontal zone of a disk between two heights (belts, polar caps)."""
    w = lambda y: math.sqrt(max(r*r - (y-cy)**2, 0))
    return f'<path fill="{fill}" d="M{cx-w(y1):.1f} {y1}H{cx+w(y1):.1f}A{r} {r} 0 0 1 {cx+w(y2):.1f} {y2}H{cx-w(y2):.1f}A{r} {r} 0 0 1 {cx-w(y1):.1f} {y1}Z"/>'
def limb(r, cx=128, cy=128):
    pt = lambda deg: f'{cx+r*math.cos(math.radians(deg)):.1f} {cy+r*math.sin(math.radians(deg)):.1f}'
    return f'<path fill="none" stroke="{WHITE}" stroke-width="2" opacity=".3" stroke-linecap="round" d="M{pt(198)}A{r} {r} 0 0 1 {pt(252)}"/>'
def ring(rx, ry, tilt, color, width, front, cap=''):
    """Half of a ring ellipse (front passes below the globe, back above); drawn in a tilted group."""
    half = f'<path d="M{-rx} 0A{rx} {ry} 0 0 {0 if front else 1} {rx} 0"/>'  # sweep 1 passes above the centre line
    return f'<g transform="translate(128 128) rotate({tilt})" fill="none" stroke="{color}" stroke-width="{width}">{half}{cap}</g>'

def planet_figures():
    figures = {}
    def planet(ab, name, dark, light, body, art, r=96):
        figures[ab] = (name, [dark, light, WHITE], circle(128, 128, r, body) + art + limb(r - 10))
    gray, silver = '#555B65', '#ACB1B9'
    craters = ((88, 92, 16), (152, 68, 9), (160, 150, 22), (96, 168, 11), (130, 120, 6), (188, 110, 7), (126, 196, 8))
    planet('MERCURY', 'Mercury', gray, silver, silver, line(''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in craters), gray, 3)
           + ''.join(circle(x, y, r-5, gray) + circle(x-3, y-3, r-5, silver) for x, y, r in craters if r > 10) + circle(188, 110, 3, WHITE))
    rust, straw = '#B45D16', '#F1BC67'
    planet('VENUS', 'Venus', rust, straw, straw, line('<path d="M44 100Q128 66 212 108M38 136Q110 178 198 170M70 196Q130 150 186 190M60 70Q100 92 140 78"/>', rust, 7))
    ocean, land = '#1968B3', '#57AD57'
    continents = ('M74 58C90 48 118 48 128 60C138 66 130 80 120 88C112 96 108 106 104 118C98 126 92 118 88 112C80 106 72 100 70 92C62 84 60 72 74 58Z'
                  'M112 128C124 124 138 130 142 142C146 156 138 174 128 190C124 196 118 192 118 182C114 168 108 150 106 140C104 134 106 130 112 128Z'
                  'M188 92C200 88 214 100 212 116C210 130 200 140 190 136C182 130 178 112 188 92Z')
    planet('EARTH', 'Earth', ocean, land, ocean, f'<path fill="{land}" d="{continents}"/>' + band(32, 46, WHITE) + band(212, 224, WHITE)
           + line('<path d="M60 150Q80 142 98 152M150 70Q168 60 186 70M150 176Q170 170 192 180"/>', WHITE, 4))
    red, ochre = '#A63D24', '#D98A58'
    maria = 'M64 112C90 96 126 104 150 118C170 128 190 126 202 140C184 156 150 152 126 144C104 138 82 136 64 128Z M150 80C166 72 184 82 180 92C168 98 150 92 150 80Z M96 176C110 170 128 176 126 186C116 192 98 188 96 176Z'
    planet('MARS', 'Mars', red, ochre, ochre, f'<path fill="{red}" d="{maria}"/>' + band(32, 52, WHITE) + band(212, 224, WHITE))
    umber, sand = '#B37740', '#E6BD89'
    belts = ''.join(band(y1, y2, umber) for y1, y2 in ((56, 64), (82, 100), (122, 128), (138, 156), (174, 182), (194, 200)))
    planet('JUPITER', 'Jupiter', umber, sand, sand, belts + f'<ellipse cx="160" cy="160" rx="22" ry="11" fill="{umber}" stroke="{WHITE}" stroke-width="3"/>')
    gold, walnut = '#B88D42', '#66523D'
    bands = ''.join(band(y1, y2, walnut, 68) for y1, y2 in ((88, 92), (112, 118), (144, 148)))
    rings = lambda front: ring(116, 26, -18, walnut, 14, front) + ring(116, 26, -18, WHITE, 2, front)
    figures['SATURN'] = ('Saturn', [gold, walnut, WHITE], rings(False) + circle(128, 128, 68, gold) + bands + limb(58) + rings(True))
    teal, ice = '#4496A4', '#9CD5D9'
    figures['URANUS'] = ('Uranus', [teal, ice, WHITE], ring(108, 14, 102, teal, 6, False) + circle(128, 128, 88, ice)
                         + line('<path d="M62 100Q128 82 194 100M62 156Q128 174 194 156"/>', teal, 4) + limb(78) + ring(108, 14, 102, teal, 6, True))
    navy, azure = '#2247A0', '#5E91DE'
    planet('NEPTUNE', 'Neptune', navy, azure, navy, band(92, 104, azure) + band(136, 158, azure)
           + line('<path d="M72 80Q104 70 136 78M118 172Q150 164 184 176"/>', WHITE, 4))
    cocoa, cream = '#8F6A58', '#E6C8AB'
    heart = 'M142 196C72 146 80 96 114 96C126 96 136 106 142 118C148 106 158 96 170 96C204 96 212 146 142 196Z'
    lobe = 'M142 196C72 146 80 96 114 96C126 96 136 106 142 118Z'
    planet('PLUTO', 'Pluto', cocoa, cream, cocoa, f'<path fill="{cream}" d="{heart}"/><path fill="{WHITE}" d="{lobe}"/>')
    return figures

entries=[]; assets=[]
def add(league, abbr, name, group, body, aliases=(), unused=(), alternates=(), palette=PALETTE):
    folder=league.lower();path=f'/logos/svg/education/{folder}/{abbr.lower()}.svg'
    entry=dict(id=f'{league}-{abbr}',league=league,conference=group,region=name,name='',abbr=abbr,palette=palette,logo=path)
    if aliases:entry['aliases']=list(aliases)
    if unused:entry['unusedSourceSlots']=list(unused)
    def write(path, body):
        raw=svg(body);target=ROOT/'public'/path.lstrip('/');target.parent.mkdir(parents=True,exist_ok=True);atomic_write_text(target,raw)
        assets.append({'path':path,'sha256':hashlib.sha256(raw.encode()).hexdigest()})
    write(path,body)
    for vid,label,art,slots in alternates:
        ap=f'/logos/svg/education/{folder}/alternates/{abbr.lower()}-{vid}.svg';write(ap,art)
        entry.setdefault('alternateLogos',[]).append(dict(id=vid,label=label,logo=ap,sourcePalette=palette,unusedSourceSlots=slots))
    entries.append(entry)

def build():
    entries.clear();assets.clear()
    elements=json.loads((ROOT/'scripts/elements.json').read_text())
    assert [e['number'] for e in elements] == list(range(1,119))
    for e in elements:
        n=e['number'];symbol=e['symbol'];period=next(i+1 for i,last in enumerate([2,10,18,36,54,86,118]) if n<=last)
        aliases={'Aluminium':['Aluminum'],'Caesium':['Cesium'],'Sulfur':['Sulphur']}.get(e['name'],[])
        tile=f'<rect x="24" y="24" width="208" height="208" rx="24" fill="{INK}"/><path d="M48 210H208" stroke="{ACCENT}" stroke-width="10"/>'
        tile+=glyph(str(n),44,43,52,30,ACCENT)+glyph(symbol,48,90,160,100)
        add('ELEMENT',symbol,e['name'],f'Period {period}',tile,aliases,alternates=[('symbol','Symbol only',glyph(symbol,30,30,196,196,INK),[1,2])])
    maths=[
        ('PI','Pi','π','Constants & variables',['pi']),('INFINITY','Infinity','∞','Constants & variables',['infinite']),
        ('DELTA','Delta','Δ','Constants & variables',[]),('THETA','Theta','θ','Constants & variables',[]),
        ('SQRT','Square root','√','Operations',['sqrt','radical']),('SUM','Summation','∑','Operations',['sigma','sum']),
        ('INTEGRAL','Integral','∫','Operations',['integration']),('MULTIPLY','Multiplication','×','Operations',['multiply','times']),
        ('DIVIDE','Division','÷','Operations',['divide']),('PLUSMINUS','Plus or minus','±','Operations',['plus minus']),
        ('PERCENT','Percent','%','Operations',['percentage']),('EQUAL','Equal','=', 'Relations',['equals']),
        ('NOTEQUAL','Not equal','≠','Relations',['not equals']),('APPROX','Approximately equal','≈','Relations',['approximately','approx']),
        ('LESS','Less than','<','Relations',[]),('GREATER','Greater than','>','Relations',[]),
        ('LEQ','Less than or equal','≤','Relations',['less than or equal to']),('GEQ','Greater than or equal','≥','Relations',['greater than or equal to']),
        ('PERP','Perpendicular','⊥','Geometry',[]),('PARALLEL','Parallel','∥','Geometry',[]),
        ('ANGLE','Angle','∠','Geometry',[]),('DEGREE','Degree','°','Geometry',['degrees']),
    ]
    for ab,name,sym,group,aliases in maths:add('MATH',ab,name,group,detail.math_symbol(glyph(sym,36,36,184,184,INK,GLYPHS if ab == 'PI' else MATH_GLYPHS)),[*aliases,sym],unused=[2])
    shapes=[('CIRCLE','Circle','<circle cx="128" cy="128" r="90"/>',[]),('OVAL','Oval','<ellipse cx="128" cy="128" rx="104" ry="68"/>',['ellipse']),
      ('TRIANGLE','Triangle',f'<polygon points="{polygon(3)}"/>',[]),('SQUARE','Square','<rect x="40" y="40" width="176" height="176"/>',[]),
      ('RECTANGLE','Rectangle','<rect x="24" y="68" width="208" height="120"/>',[]),('RHOMBUS','Rhombus','<polygon points="128,24 224,128 128,232 32,128"/>',['diamond']),
      ('TRAPEZOID','Trapezoid','<polygon points="76,52 180,52 232,204 24,204"/>',['trapezium']),('PARALLELOGRAM','Parallelogram','<polygon points="76,52 232,52 180,204 24,204"/>',[])]
    for n,name in [(5,'Pentagon'),(6,'Hexagon'),(7,'Heptagon'),(8,'Octagon'),(9,'Nonagon'),(10,'Decagon')]:shapes.append((name.upper(),name,f'<polygon points="{polygon(n)}"/>',[]))
    for ab,name,art,aliases in shapes:add('SHAPE',ab,name,'2D shapes',detail.shape_2d(art),aliases,[],[('outline','Outline',line(art),[1,2])])
    solid_names = {'CUBE': ('Cube', []), 'SPHERE': ('Sphere', []),
                   'CYLINDER': ('Cylinder', []), 'CONE': ('Cone', []),
                   'PYRAMID': ('Pyramid', ['square pyramid']), 'PRISM': ('Triangular prism', ['prism'])}
    for ab,art in detail.solids().items():
        name,aliases=solid_names[ab]
        add('SHAPE',ab,name,'3D solids',detail.defs()+art,aliases)
    for ab,(name,pal,art) in planet_figures().items():
        add('SPACE',ab,name,'Dwarf planets' if ab=='PLUTO' else 'Planets',detail.planet(ab,art,pal),palette=pal)
    sun_art,sun_palette=detail.sun();moon_art,moon_palette=detail.moon()
    add('SPACE','SUN','Sun','Other objects',sun_art,['Sol'],palette=sun_palette)
    add('SPACE','MOON','Moon','Other objects',moon_art,['Luna','crescent moon'],palette=moon_palette)
    add('SPACE','COMET','Comet','Other objects',detail.science('COMET',comet()),[])
    add('SPACE','GALAXY','Galaxy','Other objects',detail.science('GALAXY',galaxy()),['spiral galaxy'])
    for ab,(name,group,art) in science_figures().items():
        aliases={'DNA':['deoxyribonucleic acid','double helix'],'FLASK':['Erlenmeyer flask','conical flask'],'TESTTUBE':['testtube']}.get(ab,[])
        add('SCIENCE',ab,name,group,detail.science(ab,art),aliases)
    text=TEAMS_JSON.read_text();data=json.loads(text)
    old=[t for t in data['teams'] if t['league'] not in LEAGUES]
    start=text.index('"teams": [');end=text.index('\n  ]',start)
    text=text[:start]+'"teams": [\n'+',\n'.join(fmt_entry(t) for t in old+entries)+text[end:]
    # Preserve each existing builder's exact formatting and category order.
    for key, config in LEAGUES.items():
        if key not in json.loads(text)['leagues']:
            marker=text.index('\n  },',text.index('"leagues"'))
            text=text[:marker]+',\n    '+json.dumps(key)+': '+json.dumps(config)+text[marker:]
    json.loads(text);atomic_write_text(TEAMS_JSON,text)
    atomic_write_text(ROOT/'public/logos/svg/education-manifest.json',json.dumps({'generator':'scripts/build_education.py','assets':assets},indent=2)+'\n')
    print(f'{len(entries)} educational entries; {len(assets)} SVGs')

if __name__ == '__main__':build()
