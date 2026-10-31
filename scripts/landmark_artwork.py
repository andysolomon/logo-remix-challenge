"""Original architectural SVG studies, designed for small tiles and large exports.

Recognition details are drawn explicitly (arcades, setbacks, cables, onion domes,
robe folds). These are illustrations, not measured architectural elevations.
"""
import math

DARK='#263446'; STONE='#C7B69B'; WHITE='#FFFFFF'

def p(d, fill=STONE, stroke=DARK, width=1.5, **attrs):
    extra=''.join(f' {k.replace("_","-")}="{v}"' for k,v in attrs.items())
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'
def r(x,y,w,h,fill=STONE,stroke=DARK,width=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
def e(x,y,rx,ry,fill=STONE,stroke=DARK,width=1):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
def line(d,color=DARK,width=1):return p(d,'none',color,width)
def win(x,y,w=5,h=9):return r(x,y,w,h,DARK,'none')
def arch(x,y,w,h,fill=DARK):return p(f'M{x} {y+h}V{y+w/2}a{w/2} {w/2} 0 0 1 {w} 0V{y+h}Z',fill,'none')
def base(y=224):return r(24,y,208,6,'url(#stone)')+r(18,y+6,220,5,WHITE)
def course(x,y,w,rows,step=8):return ''.join(line(f'M{x} {y+i*step}h{w}',DARK,.65) for i in range(rows))
def windows(x,y,nx,ny,dx=10,dy=14,w=4,h=8):return ''.join(win(x+i*dx,y+j*dy,w,h) for j in range(ny) for i in range(nx))
def wrap(body,accent=STONE):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>
<linearGradient id="stone"><stop stop-color="{WHITE}"/><stop offset=".38" stop-color="{accent}"/><stop offset="1" stop-color="{DARK}"/></linearGradient>
<linearGradient id="wall" x2="0" y2="1"><stop stop-color="{WHITE}"/><stop offset="1" stop-color="{accent}"/></linearGradient>
<radialGradient id="dome" cx=".3" cy=".25" r=".8"><stop stop-color="{WHITE}"/><stop offset=".35" stop-color="{accent}"/><stop offset="1" stop-color="{DARK}"/></radialGradient>
</defs>{body}</svg>\n'''

def taj():
    a=base()+r(60,155,136,69,'url(#wall)')
    a+=r(98,139,60,85,'url(#wall)')+arch(110,167,36,57)+arch(115,173,26,51,STONE)
    a+=p('M90 139C79 112 96 101 116 83L128 63 140 83C160 101 177 112 166 139Z','url(#dome)')
    a+=e(128,139,38,5,STONE)+line('M128 63V46M123 52h10',DARK,2)
    for x in (44,204):
        a+=p(f'M{x-5} 224 {x-4} 98H{x+4}L{x+5} 224Z','url(#stone)')
        for y in (127,174,214):a+=r(x-8,y,16,4,WHITE)
        a+=p(f'M{x-9} 99Q{x-12} 87 {x} 79Q{x+12} 87 {x+9} 99Z','url(#dome)')+line(f'M{x} 79V72')
    for x in (77,179):
        a+=r(x-10,142,20,13,'url(#wall)')+p(f'M{x-13} 142Q{x-16} 128 {x} 116Q{x+16} 128 {x+13} 142Z','url(#dome)')+line(f'M{x} 116V109')
        a+=arch(x-8,173,16,31)+arch(x-8,211,16,13)
    return a+course(60,218,136,1)

def pisa():
    a=''
    a+=e(128,216,42,13,'url(#stone)')+r(86,70,84,146,'url(#wall)')
    for y in (78,101,124,147,170,193):
        a+=e(128,y+18,43,8,STONE)+r(85,y+9,86,8,'url(#wall)')
        for x in (89,103,118,133,148,162):
            w=8 if x in (89,162) else 10
            a+=arch(x,y-4,w,15)+line(f'M{x-2} {y-4}v19',WHITE,1.5)
    a+=e(128,70,43,9,WHITE)+r(101,42,54,27,'url(#wall)')+e(128,42,28,7,WHITE)
    for x in (105,117,130,142):a+=arch(x,46,8,18)
    a+=arch(117,202,22,22)
    return '<g transform="rotate(5 128 220)">'+a+'</g>'+base(229)

def burj():
    a=base()
    # Three wings successively step back as the central spire rises.
    for x,y,w in [(82,180,39),(101,133,41),(116,85,28),(126,52,15),(132,32,6)]:
        a+=r(x,y,w,224-y,'url(#stone)')
        a+=course(x,y+5,w,max(0,(219-y)//5),5)
        for xx in range(x+4,x+w,6):a+=line(f'M{xx} {y+1}V223',WHITE,.65)
    a+=r(141,162,22,62,'url(#stone)')+course(141,167,22,10,5)+line('M135 32V13',DARK,1.3)
    return a

def petronas():
    a=base()
    for cx in (90,166):
        a+=p(f'M{cx-26} 224V103H{cx-20}V77H{cx-12}V57H{cx-7}V40H{cx+7}V57H{cx+12}V77H{cx+20}V103H{cx+26}V224Z','url(#stone)')
        a+=line(f'M{cx} 40V18M{cx-4} 34h8')
        for y in range(86,218,7):
            w=20 if y<103 else 26
            a+=r(cx-w-2,y,2*w+4,2,WHITE,'none')
        for x in (cx-12,cx,cx+12):a+=line(f'M{x} 108V223',WHITE,.8)
    a+=r(116,142,24,8,WHITE)+line('M116 158 128 150 140 158M121 150V163M135 150V163',DARK,2)
    return a

def stonehenge():
    a=''
    for x,y,w,h in [(46,142,20,70),(73,119,24,98),(111,121,23,95),(154,124,23,94),(189,151,20,62)]:
        a+=p(f'M{x} {y}l{w-3} -3 3 {h} -{w+3} 2Z','url(#stone)')
        a+=line(f'M{x+6} {y+9}l-2 {h-19}',WHITE,1.3)
    for x,y,w in [(41,135,38),(69,108,70),(148,112,65)]:
        a+=p(f'M{x} {y}l{w} -3 2 17 -{w+3} 3Z','url(#wall)')+line(f'M{x+7} {y+9}h{w-11}',STONE,1)
    return a+line('M30 222Q128 213 227 222',STONE,2)

def moai():
    a=p('M80 226 87 173 94 154 91 106 104 51 147 44 169 68 172 111 162 155 172 177 179 226Z','url(#stone)')
    a+=p('M107 62 144 57 155 72 153 111 162 132 139 141 132 133 133 94 101 99Z','url(#wall)')
    a+=p('M100 91 121 86 132 94 151 84 154 98 135 105 123 98 100 104Z',DARK)
    a+=line('M131 101 123 133 138 137M111 152Q132 146 153 150M113 157l35 1M104 171 129 181 156 171',DARK,2)
    a+=line('M103 180 97 219M157 182l11 37',WHITE,1.5)
    a+=p('M100 166 98 186 130 197 161 186 160 168 134 175Z',STONE)
    return a+base(226)

def torii():
    a=base()
    a+=p('M56 222 64 81 78 81 72 222Z','url(#stone)')+p('M184 222 178 81 192 81 200 222Z','url(#stone)')
    a+=p('M30 57Q128 85 226 57L223 73Q128 99 33 73Z',DARK)
    a+=p('M38 77Q128 98 218 77L214 86Q128 108 42 86Z',STONE)
    a+=r(43,119,170,12,'url(#stone)')+r(121,91,14,39,'url(#stone)')
    for x in (60,183):a+=r(x,204,17,20,DARK)
    a+=line('M72 96 66 195M188 96 193 195',WHITE,1.5)
    return a

def bridge(kind):
    blue=kind=='TOWERBRIDGE';brook=kind=='BROOKLYN'
    a=''
    if blue:
        for x in (64,166):
            a+=r(x,93,26,113,'url(#wall)')+p(f'M{x-4} 93 {x+4} 76 {x+13} 63 {x+22} 76 {x+30} 93Z','url(#stone)')
            for xx in (x-3,x+24):a+=r(xx,103,5,84,STONE)+p(f'M{xx-2} 103 {xx+2} 91 {xx+7} 103Z',DARK)
            a+=windows(x+6,110,2,4,11,17,4,8)+arch(x+8,180,11,26)
            a+=r(x-5,160,36,5,WHITE)
        a+=r(90,119,76,5,'url(#stone)')+line('M16 190Q48 172 64 132M90 132Q128 182 166 132M192 132Q210 174 240 190',STONE,4)
    else:
        for x in (67,175):
            a+=r(x-6,58,18,156,'url(#stone)')
            if brook:
                a+=r(x-12,83,30,22,'url(#wall)')+arch(x-8,100,10,49)+arch(x+5,100,10,49)
                a+=p(f'M{x-12} 83V72L{x-6} 68H{x+12}L{x+18} 72V83Z','url(#wall)')
            else:
                for y in (85,116,150):a+=r(x-7,y,20,6,STONE)
        # Catenary-like suspension curves with vertical hangers, each evaluated on the same parabola.
        for left,right,y0,y1 in [(12,70,166,69),(70,178,69,69),(178,244,69,173)]:
            def height(t):return y0+(y1-y0)*t+64*4*t*(1-t)
            pts=[(left+(right-left)*i/30,height(i/30)) for i in range(31)]
            a+=line('M'+'L'.join(f'{x:.1f} {y:.1f}' for x,y in pts),STONE,2)
            for i in range(1,12):
                t=i/12;x=left+(right-left)*t;y=height(t)
                a+=line(f'M{x:.1f} {y:.1f}V194',DARK,.9)
            if brook:a+=line(f'M{left} {y0} {right} 194M{right} {y1} {left} 194',STONE,1)
    a+=r(12,194,232,7,'url(#stone)')+line('M12 207H244',STONE,1)
    return a+line('M25 227H79M98 220h67M181 228h48',STONE,1.5)

def st_basil():
    a=base()
    towers=[(56,143,22,81),(87,111,24,113),(125,85,28,139),(158,128,24,96),(193,145,22,79)]
    for cx,y,w,h in towers:
        a+=r(cx-w/2,y,w,h,'url(#wall)')+course(cx-w/2,y+8,w,int(h/14),14)
        a+=arch(cx-4,y+12,8,16)
        # Lobed onion dome, ribbed in alternating stone/copper tones.
        a+=p(f'M{cx-w/2-4} {y}C{cx-w} {y-20} {cx-8} {y-30} {cx} {y-42}C{cx+8} {y-30} {cx+w} {y-20} {cx+w/2+4} {y}Z','url(#dome)')
        a+=line(f'M{cx} {y-42}Q{cx-9} {y-14} {cx} {y}M{cx} {y-42}Q{cx+12} {y-13} {cx+8} {y}',WHITE,1.3)
        a+=line(f'M{cx} {y-42}v-11m-4 5h8',DARK,1.2)
    a+=p('M105 224V178L125 162 148 178V224Z','url(#stone)')+arch(116,186,19,38)
    return a

def liberty():
    a=base()+p('M98 224 103 195H153L160 224Z','url(#stone)')+r(101,192,54,7,STONE)
    a+=p('M104 192 111 148 106 119 98 104 86 73 92 66 110 91 121 98 145 99 158 119 163 151 151 156 145 145 151 192Z','url(#stone)')
    a+=p('M91 72 86 47 92 45 99 69Z','url(#stone)')+r(82,41,15,7,STONE)
    a+=p('M85 40C77 31 87 28 88 16C98 28 101 33 94 40Z',WHITE)
    a+=e(130,82,10,14,'url(#stone)')
    a+=p('M117 76 109 69 120 71 116 59 126 69 130 54 134 69 144 59 141 72 152 69 141 80Z',STONE)
    a+=line('M121 81h5m7 0h5M128 89h6',DARK,1)
    a+=p('M145 120 164 116 170 149 151 153Z','url(#wall)')
    a+=line('M121 106 116 153 111 186M132 107 129 166 122 190M140 116 137 175 145 190M107 123 126 137M107 143 123 154M145 100 140 117',DARK,1.5)
    a+=line('M121 117 119 145M134 136 132 180',WHITE,2)
    return a

def redeemer():
    a=base()+r(107,213,42,11,'url(#stone)')
    a+=p('M105 211 115 112 101 108 37 95 28 83 39 79 105 89 118 84 138 84 151 90 216 80 229 85 219 96 152 109 142 112 152 211Z','url(#stone)')
    a+=e(128,71,11,16,'url(#wall)')+p('M116 68Q116 51 130 52Q142 53 140 68L135 61 121 62Z',DARK)
    a+=line('M117 85 128 101 139 85M128 101V202M118 116 111 203M140 119 145 204M47 90 107 101M153 102 210 91',DARK,1.3)
    a+=line('M123 116 120 197M135 119 138 197',WHITE,2)
    return a

def skytree():
    a=base()
    a+=p('M95 224 111 135 113 88H143L145 135 161 224Z','url(#wall)')
    for y in range(143,217,12):
        w=16+(y-143)*.19
        a+=line(f'M{128-w:.1f} {y}L{128+w+2:.1f} {y+12}M{128+w:.1f} {y}L{128-w-2:.1f} {y+12}',DARK,.8)
    a+=p('M108 132H148L143 143H113Z','url(#stone)')+r(110,120,36,10,'url(#stone)')
    a+=p('M111 86H145L141 97H115Z','url(#stone)')+r(117,72,22,14,'url(#wall)')
    a+=r(124,43,8,29,'url(#stone)')+line('M128 43V13',DARK,1.3)
    return a

def pearl():
    a=base()
    for x in (107,128,149):a+=p(f'M{x-7} 224 {x-3} 90H{x+3}L{x+7} 224Z','url(#stone)')
    a+=e(128,163,39,35,'url(#dome)')+e(128,76,21,20,'url(#dome)')
    a+=r(124,33,8,25,'url(#stone)')+line('M128 33V15',DARK,1.4)
    a+=e(128,165,38,8,'none')+e(128,77,21,5,'none')
    for x in range(99,159,8):a+=line(f'M{x} 148v29',WHITE,.6)
    a+=r(117,198,22,7,STONE)
    return a

def mont():
    a=p('M17 228 31 212 53 205 74 182 93 159 122 142 161 167 190 193 224 213 240 228Z','url(#stone)')
    for x,y,w,h in [(46,197,23,24),(72,185,30,32),(100,171,30,46),(132,183,28,33),(161,197,30,23)]:
        a+=r(x,y,w,h,'url(#wall)')+p(f'M{x-3} {y} {x+w/2} {y-14} {x+w+3} {y}Z',DARK)+windows(x+5,y+7,2,2,10,12,3,6)
    a+=r(112,124,42,48,'url(#wall)')+p('M109 124 131 108 157 124Z',DARK)
    a+=r(124,83,16,41,'url(#stone)')+p('M122 83 132 48 142 83Z',DARK)+line('M132 48V32',DARK,1.5)
    a+=arch(128,92,8,20)+windows(117,135,3,2,12,15,4,9)
    return a+line('M18 235H240',STONE,1.3)

FIGURES={'TAJ':taj,'PISA':pisa,'BURJ':burj,'PETRONAS':petronas,'STONEHENGE':stonehenge,'MOAI':moai,'TORII':torii,'STBASIL':st_basil,'LIBERTY':liberty,'REDEEMER':redeemer,'SKYTREE':skytree,'PEARL':pearl,'MONTSTMICHEL':mont,'GOLDENGATE':lambda:bridge('GOLDENGATE'),'BROOKLYN':lambda:bridge('BROOKLYN'),'TOWERBRIDGE':lambda:bridge('TOWERBRIDGE')}
ACCENTS={'LIBERTY':'#6FA287','GOLDENGATE':'#C0362C','TORII':'#C64E37','TOWERBRIDGE':'#749AB5','STBASIL':'#B8543E','PETRONAS':'#8EADBA','BURJ':'#8EADBA','SKYTREE':'#99AFBB','PEARL':'#C45F6F','REDEEMER':'#B8B5A8','MOAI':'#95836E'}
def render(abbr):return wrap(FIGURES[abbr](),ACCENTS.get(abbr,STONE)).replace(f'fill="{STONE}"',f'fill="{ACCENTS.get(abbr,STONE)}"')
