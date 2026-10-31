#!/usr/bin/env python3
"""After visual review, pin original illustration bytes in the brand source catalog.

Refresh and roster builds remain the existing commands. External originals for
replaced landmarks are retained as provenance in previousSource, not fetched.
"""
import hashlib
import json
from pathlib import Path
import landmark_artwork
import character_artwork
ROOT=Path(__file__).resolve().parent.parent
sources_path=ROOT/'scripts/brand_artwork_sources.json'
sources=json.loads(sources_path.read_text())
for league,module in [('LANDMARK',landmark_artwork),('CHAR',character_artwork)]:
    for abbr in module.FIGURES:
        variant,label=('primary','Architectural study') if league=='LANDMARK' else module.FIGURES[abbr][:2]
        entry={'teamId':f'{league}-{abbr}','id':variant,'label':label,
               'sourceUrl':f'https://github.com/andysolomon/logo-remix-challenge/blob/main/scripts/{module.__name__}.py',
               'sourceSha256':hashlib.sha256(module.render(abbr).encode()).hexdigest(),
               'generator':module.__name__,'license':'Original project illustration; depicted character rights remain with their owners' if league=='CHAR' else 'Original project illustration'}
        index=next((i for i,s in enumerate(sources) if (s['teamId'],s['id'])==(entry['teamId'],variant)),None)
        if index is None:sources.append(entry)
        else:
            previous=sources[index]
            if league=='LANDMARK':entry['previousSource']=previous.get('previousSource', {k:v for k,v in previous.items() if k not in ('teamId','id','label')})
            sources[index]=entry
sources_path.write_text(json.dumps(sources,indent=2,ensure_ascii=False)+'\n')
