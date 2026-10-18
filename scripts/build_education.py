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
    science={
      'ATOM':('Atom','Physics','<ellipse cx="128" cy="128" rx="106" ry="40"/><ellipse cx="128" cy="128" rx="106" ry="40" transform="rotate(60 128 128)"/><ellipse cx="128" cy="128" rx="106" ry="40" transform="rotate(120 128 128)"/>',circle(128,128,15)),
      'MAGNET':('Magnet','Physics','<path d="M48 40V152C48 249 208 249 208 152V40H160V152C160 184 96 184 96 152V40Z M48 85H96 M160 85H208"/>',''),
      'DNA':('DNA','Biology','<path d="M80 24C80 76 176 76 176 128S80 180 80 232 M176 24C176 76 80 76 80 128S176 180 176 232 M80 24H176 M100 50H156 M100 102H156 M80 128H176 M100 154H156 M100 206H156 M80 232H176"/>',''),
      'CELL':('Cell','Biology','<ellipse cx="128" cy="128" rx="103" ry="83"/><circle cx="135" cy="125" r="30"/><path d="M61 92q23-25 28 1t-22 8 M157 173q23-25 28 1t-22 8"/>',circle(135,125,9)),
      'FLASK':('Flask','Lab equipment','<path d="M100 28H156 M108 28V96L42 205Q36 224 56 224H200Q220 224 214 205L148 96V28 M74 159H182"/>',''),
      'BEAKER':('Beaker','Lab equipment','<path d="M62 36H194L181 58V216H75V58Z M75 142H181 M142 80H181 M154 108H181 M154 174H181"/>',''),
      'TESTTUBE':('Test tube','Lab equipment','<path d="M133 33 189 65 M143 39 55 191C32 233 88 258 111 219L199 66 M88 135 146 163"/>',''),
      'THERMOMETER':('Thermometer','Lab equipment','<path d="M108 164V47A20 20 0 0 1 148 47V164A39 39 0 1 1 108 164Z M128 77V192 M168 67H189 M168 97H183 M168 127H189"/>',circle(128,194,15)),
      'MICROSCOPE':('Microscope','Lab equipment','<path d="M83 32 151 72 128 112 60 72Z M116 35 133 7 162 24 145 52 M151 96C240 109 211 207 147 211 M62 152H152 M98 152V209 M56 224H205"/>',''),
      'TELESCOPE':('Telescope','Physics','<path d="M39 106 176 41 201 94 64 159Z M176 41 192 34 219 91 201 99 M38 119 21 127 33 151 51 143 M128 132V173 M128 173 80 232 M128 173 176 232 M128 173V232"/>',''),
    }
    for ab,(name,group,art,filled) in science.items():
        aliases={'DNA':['deoxyribonucleic acid','double helix'],'FLASK':['Erlenmeyer flask','conical flask'],'TESTTUBE':['testtube']}.get(ab,[])
        add('SCIENCE',ab,name,group,line(art,weight=8)+filled,aliases,[1,2])
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
