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
from pathlib import Path
from build_teams import atomic_write_text, fmt_entry

ROOT = Path(__file__).resolve().parent.parent
TEAMS_JSON = ROOT / 'src/lib/teams.json'
GLYPHS = json.loads((ROOT / 'scripts/education_glyphs.json').read_text())
INK, ACCENT, WHITE = '#183153', '#009688', '#FFFFFF'
PALETTE = [INK, ACCENT, WHITE]
LEAGUES = {
    'ELEMENT': {'label': 'ELEMENTS', 'conferences': [f'Period {n}' for n in range(1, 8)]},
    'MATH': {'label': 'MATH', 'conferences': ['Constants & variables', 'Operations', 'Relations', 'Geometry']},
    'SHAPE': {'label': 'SHAPES', 'conferences': ['2D shapes', '3D solids']},
    'SPACE': {'label': 'SPACE', 'conferences': ['Planets', 'Dwarf planets', 'Other objects']},
    'SCIENCE': {'label': 'SCIENCE', 'conferences': ['Physics', 'Biology', 'Lab equipment']},
}

def glyph(text, x, y, width, height, fill=WHITE):
    """Fit outlines to a box using their real ink bounds, preserving aspect ratio."""
    offset = 0; parts = []; bounds = []
    for char in text:
        g = GLYPHS[char]; a,b,c,d = g['bounds']
        bounds.append((a+offset,b,c+offset,d)); parts.append((offset,g['path'])); offset += g['advance']
    left=min(b[0] for b in bounds); bottom=min(b[1] for b in bounds)
    right=max(b[2] for b in bounds); top=max(b[3] for b in bounds)
    s=min(width/(right-left),height/(top-bottom))
    tx=x+(width-(right-left)*s)/2-left*s; ty=y+(height-(top-bottom)*s)/2+top*s
    paths=''.join(f'<path transform="translate({off} 0)" d="{path}"/>' for off,path in parts)
    return f'<g fill="{fill}" transform="translate({tx:.4f} {ty:.4f}) scale({s:.6f} {-s:.6f})">{paths}</g>'

def svg(body):
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

def science_figures():
    return {
      'ATOM':('Atom','Physics',atom()),'MAGNET':('Magnet','Physics',magnet()),'TELESCOPE':('Telescope','Physics',telescope()),
      'DNA':('DNA','Biology',dna()),'CELL':('Cell','Biology',cell()),
      'FLASK':('Flask','Lab equipment',flask()),'BEAKER':('Beaker','Lab equipment',beaker()),'TESTTUBE':('Test tube','Lab equipment',testtube()),
      'THERMOMETER':('Thermometer','Lab equipment',thermometer()),'MICROSCOPE':('Microscope','Lab equipment',microscope()),
    }

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
    for ab,name,sym,group,aliases in maths:add('MATH',ab,name,group,glyph(sym,36,36,184,184,INK),[*aliases,sym],unused=[1,2])
    shapes=[('CIRCLE','Circle','<circle cx="128" cy="128" r="90"/>',[]),('OVAL','Oval','<ellipse cx="128" cy="128" rx="104" ry="68"/>',['ellipse']),
      ('TRIANGLE','Triangle',f'<polygon points="{polygon(3)}"/>',[]),('SQUARE','Square','<rect x="40" y="40" width="176" height="176"/>',[]),
      ('RECTANGLE','Rectangle','<rect x="24" y="68" width="208" height="120"/>',[]),('RHOMBUS','Rhombus','<polygon points="128,24 224,128 128,232 32,128"/>',['diamond']),
      ('TRAPEZOID','Trapezoid','<polygon points="76,52 180,52 232,204 24,204"/>',['trapezium']),('PARALLELOGRAM','Parallelogram','<polygon points="76,52 232,52 180,204 24,204"/>',[])]
    for n,name in [(5,'Pentagon'),(6,'Hexagon'),(7,'Heptagon'),(8,'Octagon'),(9,'Nonagon'),(10,'Decagon')]:shapes.append((name.upper(),name,f'<polygon points="{polygon(n)}"/>',[]))
    for ab,name,art,aliases in shapes:add('SHAPE',ab,name,'2D shapes',f'<g fill="{INK}">{art}</g>',aliases,[1,2],[('outline','Outline',line(art),[1,2])])
    solids={
      'CUBE':('Cube','<path d="M128 24 224 76 224 180 128 232 32 180 32 76Z M32 76 128 132 224 76 M128 132V232 M128 24V124"/>',[]),
      'SPHERE':('Sphere','<circle cx="128" cy="128" r="96"/><ellipse cx="128" cy="128" rx="96" ry="30"/><ellipse cx="128" cy="128" rx="38" ry="96"/>',[]),
      'CYLINDER':('Cylinder','<ellipse cx="128" cy="52" rx="80" ry="28"/><path d="M48 52V200C48 238 208 238 208 200V52"/><path d="M48 200C48 164 208 164 208 200"/>',[]),
      'CONE':('Cone','<path d="M128 24 32 200 M128 24 224 200"/><ellipse cx="128" cy="200" rx="96" ry="28"/>',[]),
      'PYRAMID':('Pyramid','<path d="M128 24 24 192 128 232 232 192Z M128 24V232 M24 192 128 156 232 192"/>',['square pyramid']),
      'PRISM':('Triangular prism','<path d="M32 204 96 76 160 204Z M96 76 160 24 224 152 160 204 M32 204 96 152 M160 24 96 152 224 152"/>',['prism']),
    }
    for ab,(name,art,aliases) in solids.items():add('SHAPE',ab,name,'3D solids',line(art),aliases,[1,2])
    # Planet illustrations retain distinct physical cues even after recoloring.
    bodies={
      'MERCURY':('Mercury',circle(128,128,90)+circle(90,90,22,ACCENT)+circle(162,148,30,ACCENT)+circle(91,174,12,WHITE),['#555B65','#ACB1B9',WHITE]),
      'VENUS':('Venus',circle(128,128,90)+line('<path d="M65 72Q180 48 184 106T72 150Q40 188 166 194 M57 119Q130 86 194 139"/>',ACCENT,14),['#B45D16','#F1BC67',WHITE]),
      'EARTH':('Earth',circle(128,128,90)+f'<path fill="{ACCENT}" d="M82 51 128 41 145 65 123 90 133 119 102 141 82 125 58 102 45 109 52 76Z M144 135 183 118 211 151 190 187 164 210 153 177 132 158Z"/>', ['#1968B3','#57AD57',WHITE]),
      'MARS':('Mars',circle(128,128,90)+f'<path fill="{ACCENT}" d="M48 116Q85 78 131 128T207 150L195 178Q138 147 100 165T51 173Z"/>'+f'<path fill="{WHITE}" d="M88 47Q128 27 168 47L153 65 114 71Z"/>',['#A63D24','#D98A58',WHITE]),
      'JUPITER':('Jupiter',circle(128,128,90)+line('<path d="M64 70H192 M43 103H213 M43 145H213 M65 185H191"/>',ACCENT,14)+f'<ellipse cx="164" cy="151" rx="27" ry="17" fill="{WHITE}"/>',['#B37740','#E6BD89',WHITE]),
      'SATURN':('Saturn',circle(128,128,66)+line('<ellipse cx="128" cy="128" rx="116" ry="31" transform="rotate(-24 128 128)"/>',ACCENT,14),['#B88D42','#66523D',WHITE]),
      'URANUS':('Uranus',line('<ellipse cx="128" cy="128" rx="32" ry="113" transform="rotate(18 128 128)"/>',ACCENT,9)+circle(128,128,70)+line('<path d="M81 95Q119 71 166 89 M83 156Q131 179 170 152"/>',ACCENT,9),['#4496A4','#9CD5D9',WHITE]),
      'NEPTUNE':('Neptune',circle(128,128,90)+line('<path d="M57 83Q131 112 196 83 M48 154Q112 180 207 150"/>',ACCENT,12)+f'<ellipse cx="160" cy="124" rx="25" ry="12" fill="{WHITE}"/>',['#2247A0','#5E91DE',WHITE]),
      'PLUTO':('Pluto',circle(128,128,86)+f'<path fill="{ACCENT}" d="M128 173C36 111 89 68 128 105C167 68 220 111 128 173Z"/>',['#8F6A58','#E6C8AB',WHITE]),
    }
    for ab,(name,art,pal) in bodies.items():
        art=art.replace(INK,pal[0]).replace(ACCENT,pal[1]);add('SPACE',ab,name,'Dwarf planets' if ab=='PLUTO' else 'Planets',art,palette=pal,unused=[2] if WHITE not in art else [])
    add('SPACE','SUN','Sun','Other objects',circle(128,128,61)+line(''.join(f'<path d="M{128+82*math.cos(a):.2f} {128+82*math.sin(a):.2f}L{128+110*math.cos(a):.2f} {128+110*math.sin(a):.2f}"/>' for a in [i*math.pi/6 for i in range(12)])),['Sol'],[1,2])
    add('SPACE','MOON','Moon','Other objects',f'<path fill="{INK}" d="M172 30A99 99 0 1 0 220 170A93 93 0 0 1 172 30Z"/>',['Luna','crescent moon'],[1,2])
    add('SPACE','COMET','Comet','Other objects',circle(71,184,35)+line('<path d="M58 147 153 35 M96 169 222 84 M85 143 209 42"/>'),[],[1,2])
    add('SPACE','GALAXY','Galaxy','Other objects',circle(128,128,20)+line('<path d="M128 112C192 45 244 119 181 171C117 225 29 170 57 108C77 65 152 48 190 91 M128 144C64 211 12 137 75 85"/>'),['spiral galaxy'],[1,2])
    for ab,(name,group,art) in science_figures().items():
        aliases={'DNA':['deoxyribonucleic acid','double helix'],'FLASK':['Erlenmeyer flask','conical flask'],'TESTTUBE':['testtube']}.get(ab,[])
        add('SCIENCE',ab,name,group,art,aliases)
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
