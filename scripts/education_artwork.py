"""Original vector illustration details. All shading uses the three remix colors.

No filters, bitmap textures, external references or fonts: gradients and geometry
remain editable in SVG exports. Sizes are deliberately independent of pixels.
"""
import math
import re

INK, ACCENT, WHITE = '#183153', '#009688', '#FFFFFF'

def path(d, fill=INK, stroke=None, width=2, **attrs):
    extra = ''.join(f' {k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f'<path d="{d}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round"' if stroke else '') + extra + '/>'

def ellipse(x,y,rx,ry,fill,stroke=None,width=2):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{width}"' if stroke else '') + '/>'

def defs(dark=INK, light=ACCENT):
    return f'''<defs>
<linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{WHITE}"/><stop offset=".35" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></linearGradient>
<linearGradient id="glass"><stop stop-color="{light}" stop-opacity=".30"/><stop offset=".22" stop-color="{WHITE}"/><stop offset=".65" stop-color="{WHITE}"/><stop offset="1" stop-color="{light}" stop-opacity=".5"/></linearGradient>
<linearGradient id="liquid"><stop stop-color="{light}"/><stop offset=".5" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></linearGradient>
<radialGradient id="globe" cx=".3" cy=".25" r=".75"><stop stop-color="{WHITE}" stop-opacity=".48"/><stop offset=".44" stop-color="{WHITE}" stop-opacity="0"/><stop offset=".72" stop-color="{dark}" stop-opacity="0"/><stop offset="1" stop-color="{dark}" stop-opacity=".78"/></radialGradient>
<radialGradient id="pearl" cx=".28" cy=".25" r=".8"><stop stop-color="{WHITE}"/><stop offset=".3" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></radialGradient>
</defs>'''

def shape_2d(art):
    return defs() + f'<g fill="url(#face)" stroke="{INK}" stroke-width="2.5" stroke-linejoin="miter">{art}</g>'

def solids():
    edge=INK
    return {
      'CUBE': path('M128 28 224 80 128 134 32 80Z',WHITE,edge)+path('M32 80 128 134V232L32 178Z',ACCENT,edge)+path('M128 134 224 80V178L128 232Z','url(#liquid)',edge),
      'SPHERE': ellipse(128,128,98,98,'url(#pearl)',edge),
      'CYLINDER': path('M48 58V198C48 236 208 236 208 198V58Z','url(#glass)',edge)+ellipse(128,58,80,28,'url(#face)',edge)+path('M59 78V196','none',WHITE,4),
      'CONE': path('M128 25 33 199C33 235 223 235 223 199Z','url(#face)',edge)+path('M33 199C33 235 223 235 223 199','none',edge)+path('M128 25 71 201','none',WHITE,2,opacity='.55'),
      'PYRAMID': path('M128 24 24 190 129 232Z','url(#face)',edge)+path('M128 24 129 232 232 190Z','url(#liquid)',edge),
      'PRISM': path('M32 206 96 78 160 206Z','url(#face)',edge)+path('M96 78 160 26 224 154 160 206Z','url(#liquid)',edge)+path('M96 78 160 26','none',WHITE,2),
    }

def math_symbol(symbol_body):
    # Font outlines supply the true counter-shapes; a subtle two-color face gives
    # optical weight without a tile, extrusion or decorations resembling operators.
    return defs() + symbol_body.replace(f'fill="{INK}"', 'fill="url(#liquid)"')

def science(ab, art):
    art=art.replace('stroke-width="5"','stroke-width="3"').replace('stroke-width="3"','stroke-width="2.5"')
    art=art.replace(f'fill="{WHITE}"', 'fill="url(#glass)"').replace(f'fill="{ACCENT}"', 'fill="url(#liquid)"')
    extra=''
    if ab=='CELL':
        extra=path('M45 121C40 155 65 201 108 210M52 88C75 51 121 44 156 51','none',ACCENT,2)
        for x,y in [(151,61),(188,119),(54,135),(140,182),(79,184),(205,161)]:
            extra+=ellipse(x,y,2,2,INK)
        extra+=path('M154 120q18 0 24 12m-27-4q18 0 24 12m-27-4q18 0 24 12','none',INK,2)
    elif ab=='MICROSCOPE':
        extra=path('M52 217H201M147 162H172M165 169H172','none',ACCENT,2)+ellipse(176,122,5,5,WHITE,INK,1.5)
    elif ab=='TELESCOPE':
        extra=path('M87 208H166M124 153V206','none',ACCENT,2)
    elif ab=='DNA':
        art=art.replace('stroke-width="11"','stroke-width="10"').replace('stroke-width="5"','stroke-width="5.5"')
    elif ab in ('FLASK','BEAKER','TESTTUBE'):
        # True ellipsoidal meniscus and glass-wall reflections at the liquid level.
        cx,cy,rx=(128,162,57) if ab=='FLASK' else (128,134,61) if ab=='BEAKER' else (128,118,27)
        extra=ellipse(cx,cy,rx,4,ACCENT,INK,1.5)+path(f'M{cx-rx+4} {cy-6}V{cy-24}','none',WHITE,3)
    elif ab=='MAGNET':
        extra=path('M65 95V148C65 188 191 188 191 148V95','none',ACCENT,3)
    elif ab=='ATOM':
        # Specular caps on nucleons, not a physically literal electron orbit model.
        extra=ellipse(124,124,3,3,WHITE)
    return defs()+art+extra

def earth():
    # Orthographic-style Atlantic view: eastern North America, South America,
    # Europe and Africa, with foreshortening toward the limb.
    coast='M49 77 60 64 72 57 81 61 87 53 102 49 109 56 103 65 114 72 112 82 101 88 97 99 88 105 90 117 99 124 104 129 101 133 92 128 83 120 76 108 66 105 60 95 53 91Z M105 138 115 130 129 134 142 145 143 155 136 166 132 179 122 190 115 205 109 209 108 195 105 181 101 166 97 154 99 144Z M137 49 151 43 164 47 160 58 151 63 144 61Z M161 69 172 65 181 71 180 81 191 85 195 96 184 100 177 94 169 96 159 89 155 82Z M166 104 180 102 196 110 207 122 204 136 197 142 191 157 181 174 174 171 169 157 162 146 156 133 157 117Z M202 163 207 155 207 170 202 176Z'
    return path(coast,'#57AD57')+path('M64 54Q90 39 113 44M50 135Q74 125 92 136M123 89Q137 83 149 90M144 190Q169 194 191 182','none',WHITE,3,opacity='.85')

def planet(ab, art, pal):
    dark,light,_=pal
    # Preserve ring occlusion by placing lighting before the front ring group.
    r=68 if ab=='SATURN' else 88 if ab=='URANUS' else 96
    if ab=='EARTH':
        art=ellipse(128,128,96,96,dark)+earth()+path('M94 37Q128 27 154 36L146 43 112 45Z',WHITE)
    elif ab=='PLUTO':
        # Irregular two-lobed Tombaugh region instead of a literal heart icon.
        art=ellipse(128,128,96,96,dark)+path('M99 101C116 87 135 104 144 112C156 91 181 93 190 111L193 129 181 145 172 168 158 181 145 193 132 177 118 169 108 150 94 131 91 117Z',light)+path('M99 108Q118 96 140 120L148 177 131 165 111 146Z',WHITE,opacity='.6')
    elif ab=='JUPITER':
        for y in (77,108,132,164,187):
            half=math.sqrt(96**2-(y-128)**2)-4
            art+=path(f'M{128-half:.1f} {y}q{half/2:.1f} -9 {half:.1f} 0t{half:.1f} 0','none',light if y%2 else dark,3)
        art+=ellipse(159,159,18,8,dark)+ellipse(157,158,12,4,light)
    elif ab=='MARS':
        art+=path('M68 142 94 148 111 144 127 150 149 146','none',dark,2)
        for x,y,r0 in [(79,87,8),(169,175,10),(184,108,5),(96,180,6)]:
            art+=ellipse(x,y,r0,r0*.65,'none',dark,1.3)
    elif ab=='MERCURY':
        for x,y,r0 in [(62,129,8),(130,82,6),(182,170,9),(73,156,4),(152,190,4),(105,59,4)]:
            art+=ellipse(x,y,r0,r0*.85,'none',dark,1.2)
    elif ab=='VENUS':
        art+=path('M45 115C83 83 161 151 213 116M55 162C102 131 153 193 195 166M81 62Q130 88 170 69','none',light,4)
    elif ab=='NEPTUNE':
        art+=ellipse(159,149,20,8,dark)+path('M142 138Q159 131 178 139M81 113Q104 105 126 111','none',WHITE,2.2)
    lighting=ellipse(128,128,r,r,'url(#globe)')
    if ab in ('SATURN','URANUS'):
        marker='<g transform="translate(128 128) rotate('
        front=art.rfind(marker)
        # Saturn has two coincident front ring strokes. Insert before both.
        if ab=='SATURN': front=art.rfind(marker,0,front)
        art=art[:front]+lighting+art[front:]
    else:art+=lighting
    return defs(dark,light)+art

def sun():
    dark,light='#B64B13','#F5B82E'
    art=''
    for i in range(20):
        a=i*math.pi/10
        x,y=128+90*math.cos(a),128+90*math.sin(a)
        xx,yy=128+111*math.cos(a+.08),128+111*math.sin(a+.08)
        art+=path(f'M{x:.2f} {y:.2f}Q{xx:.2f} {y:.2f} {xx:.2f} {yy:.2f}','none',light,2+(i%3))
    art+=ellipse(128,128,87,87,'url(#pearl)')
    for i in range(50):
        a=i*2.399963;r=75*math.sqrt((i+.5)/50)
        art+=ellipse(round(128+r*math.cos(a),2),round(128+r*math.sin(a),2),1.2+(i%3)*.5,1.2,dark,width=1)
    return defs(dark,light)+art,[dark,light,WHITE]

def moon():
    dark,light='#505D71','#BAC4CD'
    art=ellipse(128,128,96,96,light)
    art+=path('M75 65Q101 48 119 65L131 93 113 113 87 103 72 83Z M128 110Q164 81 193 109L200 132 179 148 154 143Z M68 136Q95 119 112 146L107 180 83 189 64 169Z',dark,opacity='.30')
    for x,y,r in [(78,83,13),(164,69,12),(181,154,16),(119,185,19),(72,153,8),(141,130,7),(163,195,6),(102,117,5),(203,119,5),(120,58,5)]:
        art+=ellipse(x,y,r,r*.9,light,dark,1.4)+path(f'M{x-r*.7} {y}q{r*.7} {-r} {r*1.4} 0','none',WHITE,1.6)
    return defs(dark,light)+art+ellipse(128,128,96,96,'url(#globe)'),[dark,light,WHITE]


def prune_defs(body):
    """Unused gradient stops must not advertise palette slots the art never paints."""
    match=re.search(r'<defs>(.*?)</defs>',body,re.S)
    if not match:return body
    drawn=body[:match.start()]+body[match.end():]
    used=set(re.findall(r'url\(#([^)]+)\)',drawn))
    gradients=re.findall(r'<(?:linear|radial)Gradient\b.*?</(?:linear|radial)Gradient>',match[1],re.S)
    keep=[g for g in gradients if re.search(r'id="([^"]+)"',g)[1] in used]
    return body[:match.start()]+'<defs>'+''.join(keep)+'</defs>'+body[match.end():]
