"""Original name-free character studies, not official logo source files.

Existing marks and stable alternate IDs are preserved. New poses, props and
portraits use vector outlines and a three-color palette for remixing.
"""
import math
DARK='#17202C';WHITE='#FFFFFF'

def p(d,fill,stroke=DARK,width=2.5):return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>'
def e(x,y,rx,ry,fill,stroke=DARK,width=2):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
def line(d,color=DARK,width=2):return p(d,'none',color,width)
def wrap(body,color):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>
<linearGradient id="suit"><stop stop-color="{WHITE}"/><stop offset=".25" stop-color="{color}"/><stop offset=".72" stop-color="{color}"/><stop offset="1" stop-color="{DARK}"/></linearGradient>
<linearGradient id="metal"><stop stop-color="{WHITE}"/><stop offset=".3" stop-color="{color}"/><stop offset=".6" stop-color="{WHITE}"/><stop offset="1" stop-color="{DARK}"/></linearGradient>
</defs>{body}</svg>\n'''

def mask(web=False):
    a=p('M128 25C81 25 60 58 63 114L70 170C79 199 109 229 128 231C147 229 177 199 186 170L193 114C196 58 175 25 128 25Z','url(#suit)')
    if web:
        a+=line('M128 28V229M128 114 78 55M128 114 177 55M128 114 65 97M128 114 191 97M128 114 72 173M128 114 184 173M128 114 98 211M128 114 158 211',DARK,1.6)
        for d in ['M96 39Q128 55 160 39','M78 61Q96 70 110 81Q128 69 146 81Q160 70 178 61','M66 92Q87 95 99 108Q128 94 157 108Q170 95 190 92','M69 151Q90 138 108 149Q128 136 148 149Q166 138 187 151','M81 188Q98 174 113 180Q128 170 143 180Q158 174 175 188','M100 213Q114 199 128 207Q142 199 156 213']:a+=line(d,DARK,1.5)
        a+=p('M76 105Q95 110 119 135Q95 164 80 142Z',WHITE,DARK,5)+p('M180 105Q161 110 137 135Q161 164 176 142Z',WHITE,DARK,5)
    else:
        a+=p('M77 65Q108 66 116 102L112 162Q94 182 76 156Q62 110 77 65Z',DARK)+p('M179 65Q148 66 140 102L144 162Q162 182 180 156Q194 110 179 65Z',DARK)
        a+=p('M79 112 108 119 106 132 84 129Z',WHITE)+p('M177 112 148 119 150 132 172 129Z',WHITE)
        a+=line('M128 29V98M128 151V218M108 190Q128 198 148 190',DARK,1.5)
    return a

def vader():
    a=p('M128 25C78 25 58 67 58 122L32 200 67 216 94 211 128 230 162 211 189 216 224 200 198 122C198 67 178 25 128 25Z','url(#metal)')
    a+=p('M116 28H140L147 109H109Z',DARK)+p('M72 105 113 111 106 140 78 135Z',DARK)+p('M184 105 143 111 150 140 178 135Z',DARK)
    a+=p('M128 127 160 185H96Z',DARK)+line('M118 151V178M128 145V182M138 151V178',WHITE,2)
    a+=p('M78 143 105 145 91 185 72 190Z',DARK)+p('M178 143 151 145 165 185 184 190Z',DARK)
    a+=e(86,198,9,9,DARK,WHITE,2)+e(170,198,9,9,DARK,WHITE,2)+line('M112 201H144M104 210H152',WHITE,1.5)
    return a

def mando():
    a=p('M64 201V94C64 47 89 28 128 28C167 28 192 47 192 94V201L162 222 143 199H113L94 222Z','url(#metal)')
    a+=p('M73 94H183V121L144 129 137 199H119L112 129 73 121Z',DARK)
    a+=p('M73 132 104 141 106 191 81 194Z','url(#suit)')+p('M183 132 152 141 150 191 175 194Z','url(#suit)')
    a+=line('M119 33V87M137 33V87M69 102V191M187 102V191',WHITE,2)
    return a

def hammer():
    a=p('M113 109 141 109 141 216 113 216Z','url(#suit)')
    for y in range(125,210,12):a+=line(f'M114 {y}l26 -7',WHITE,2)
    a+=p('M46 41 68 29H197L215 45V106L197 123H65L46 107Z','url(#metal)')
    a+=p('M46 41 66 57V122L46 107Z',DARK)+p('M66 57H197L215 45','none',DARK,2)
    a+=line('M197 57V122M78 68H181M78 110H181',WHITE,2)
    a+=p('M118 216C98 250 163 247 137 216','none',DARK,5)
    return a

def shield():
    a=p('M48 35H208V132C208 171 173 202 128 229C83 202 48 171 48 132Z','url(#suit)')
    a+=p('M50 91H206V132C206 166 175 198 128 226C81 198 50 166 50 132Z',WHITE)
    a+=p('M75 93H96V202L75 183Z','#C73535')+p('M117 93H139V218L128 226 117 218Z','#C73535')+p('M160 93H181V183L160 202Z','#C73535')
    for cx in (83,128,173):
        pts=[(cx+(16 if i%2==0 else 7)*math.cos(-math.pi/2+i*math.pi/5),64+(16 if i%2==0 else 7)*math.sin(-math.pi/2+i*math.pi/5)) for i in range(10)]
        a+=p('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in pts)+'Z',WHITE,'none')
    return a

def creeper():
    a=p('M39 68 145 28 220 72 113 116Z','#72AA45')+p('M39 68 113 116V228L39 182Z','url(#suit)')+p('M113 116 220 72V182L113 228Z','#72AA45')
    a+=p('M128 121 154 110V137L128 148Z',DARK)+p('M181 99 206 89V116L181 127Z',DARK)
    a+=p('M153 143 180 132V156L194 150V190L180 196V180L153 191V207L139 213V173L153 167Z',DARK)
    for d in ['M52 87 65 95V111L52 103Z','M78 140 92 149V165L78 156Z','M49 158 63 167V181L49 173Z','M157 66 173 60 187 68 171 74Z']:a+=p(d,WHITE,'none')
    return a

def flower():
    a=p('M123 216V142H136V216Z','#E84522')+p('M123 191Q76 145 59 174Q80 213 123 210Z','url(#suit)')+p('M136 180Q173 139 196 159Q178 199 136 202Z','url(#suit)')
    a+=e(128,98,76,62,'url(#suit)')+e(128,98,57,43,WHITE)+e(128,98,36,34,'#E84522')
    a+=e(117,95,5,13,DARK)+e(139,95,5,13,DARK)+e(116,90,1.5,4,WHITE,'none')+e(138,90,1.5,4,WHITE,'none')
    return a

def great_ball():
    a=e(128,128,96,96,WHITE,DARK,4)+p('M32 128A96 96 0 0 1 224 128Z','url(#suit)')
    a+=p('M55 66 71 52 101 101 85 113Z','#DC3A32')+p('M201 66 185 52 155 101 171 113Z','#DC3A32')
    a+=line('M32 128H224',DARK,12)+e(128,128,25,25,WHITE,DARK,6)+e(128,128,14,14,WHITE,DARK,2)
    return a

def pikachu():
    a=p('M80 92 44 27Q42 17 53 22L104 70M153 71 202 22Q213 17 210 29L177 96','url(#suit)')
    a+=p('M44 27 62 36 77 60 65 65Z',DARK)+p('M202 22 186 33 175 57 189 62Z',DARK)
    a+=p('M76 88C98 61 155 62 179 88L196 131 190 175 174 198Q128 222 81 199L64 177 59 134Z','url(#suit)')
    a+=e(93,129,9,12,DARK)+e(163,129,9,12,DARK)+e(90,125,3,4,WHITE,'none')+e(160,125,3,4,WHITE,'none')
    a+=e(77,160,14,12,'#E54132')+e(180,160,14,12,'#E54132')+p('M124 149H132L128 153Z',DARK)+line('M128 165Q117 176 111 166M128 165Q139 176 145 166',DARK,2)
    return a

FIGURES={
 'SPIDEY':('webbed-mask','Webbed mask',lambda:mask(True),'#C83236'),
 'DEADPOOL':('mask-portrait','Mask portrait',mask,'#BA2737'),
 'VADER':('helmet-study','Helmet study',vader,'#68778A'),
 'MANDO':('beskar-helmet','Armored helmet',mando,'#A5AFB9'),
 'THOR':('hammer','Hammer',hammer,'#8F9EAA'),
 'CAP':('heater-shield','Heater shield',shield,'#24518B'),
 'CREEPER':('voxel-head','Voxel head',creeper,'#4E8B39'),
 'MARIO':('fire-flower','Fire flower',flower,'#E84522'),
 'POKEBALL':('great-ball','Great ball',great_ball,'#3074C0'),
 'PIKACHU':('face-portrait','Face portrait',pikachu,'#E9BA2B'),
}
def render(abbr):
    _,_,draw,color=FIGURES[abbr]
    return wrap(draw(),color)
