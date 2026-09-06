#!/usr/bin/env python3
"""Clean inherited card-frame apertures; omit all obsolete portrait caches.
Uses stored originals, so repeating this command doesn't re-compress its inputs.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import base64,json
ROOT=Path(__file__).resolve().parents[1]
FRAME_HOLES={
 'minion':[(72,74),(96,48),(127,26),(167,13),(200,22),(232,38),(264,62),(302,81),(318,135),(44,135)],
 'spell':[(78,54),(108,41),(154,37),(258,43),(314,62),(329,102),(78,102)],
 'nature':[(78,54),(108,41),(160,38),(263,43),(314,62),(329,102),(78,102)],
 'legendary':[(89,64),(134,62),(178,60),(251,56),(286,61),(316,73),(328,132),(61,132)],
 'weapon':[(78,58),(106,46),(258,47),(309,61),(329,95),(78,95)]
}
def build():
 r=ROOT/'assets/atelier';originals=ROOT/'assets/anime/frame-sources'
 for key,points in FRAME_HOLES.items():
  im=Image.open(originals/f'frame-{key}.webp').convert('RGBA')
  a=im.getchannel('A');ImageDraw.Draw(a).polygon(points,fill=0);im.putalpha(a)
  im.save(r/f'frame-{key}.webp','WEBP',lossless=True,method=6)
 cache={p.stem:'data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode() for p in sorted(r.glob('*.webp')) if not p.stem.startswith('portrait-')}
 (ROOT/'src/atelier-assets.js').write_text('/* Runtime environment + cleaned frames only. Card portraits are in AnimeAssets. */\nconst AtelierAssets='+json.dumps(cache,separators=(',',':'))+';\n')
 relics=json.loads((ROOT/'assets/anime/non-card-relics.json').read_text())
 (ROOT/'src/portraits.js').write_text('/* Six non-card relic illustrations. No legacy card portraits included. */\nconst TavernPortraits='+json.dumps(relics,separators=(',',':'))+';\n')
 print('Embedded',len(cache),'environment/frame assets and',len(relics),'non-card relic images; legacy card images: 0')
if __name__=='__main__':build()
