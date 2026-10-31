#!/usr/bin/env python3
"""Pin DejaVu Serif math outlines; run with Python fontTools and a font path.

Normal catalog rebuilds use the checked-in JSON and need only the stdlib.
License: public/logos/svg/education-LICENSE.txt.
"""
import json
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

font=TTFont(sys.argv[1]); glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); result={}
for char in 'π∞Δθ√∑∫×÷±%=≠≈<>≤≥⊥∥∠°':
    name=cmap[ord(char)]; p=SVGPathPen(glyphs); b=BoundsPen(glyphs)
    glyphs[name].draw(p); glyphs[name].draw(b)
    result[char]={'path':p.getCommands(),'bounds':b.bounds,'advance':font['hmtx'][name][0]}
Path(__file__).with_name('math_glyphs.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
