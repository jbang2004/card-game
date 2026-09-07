"""Optional art rebuild from retained CC0 originals (requirements-art.txt/Pillow).
The ordinary build only verifies and packs the frozen WebP atlases; it needs no Pillow.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1] / 'assets/vfx'

def repack():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    for a in manifest['assets']:
        source = ROOT / a['sourcePath']
        box = tuple(a['cropBounds'])
        canvas = Image.new('RGBA', (a['width'], a['height']))
        if a['kind'] == 'texture':
            im = Image.open(source).convert('RGBA').crop(box)
            im.thumbnail((256, 256), Image.Resampling.LANCZOS)
            canvas.paste(im, ((256-im.width)//2, (256-im.height)//2))
        else:
            x0,y0,x1,y1 = a['contentBoundsInCell']
            for i, frame in enumerate(a['sourceFrames']):
                im = Image.open(ROOT / frame['file']).convert('RGBA').crop(box)
                im = im.resize((x1-x0, y1-y0), Image.Resampling.LANCZOS)
                canvas.paste(im, ((i % a['columns'])*128+x0, (i // a['columns'])*128+y0))
        dest = ROOT / a['file']
        canvas.save(dest, format='WEBP', lossless=True, exact=True, method=6)
        if Image.open(dest).convert('RGBA').tobytes() != canvas.tobytes():
            raise ValueError('Lossless VFX verification failed: ' + a['id'])
        a['rgbaSha256'] = hashlib.sha256(canvas.tobytes()).hexdigest()
        a['sha256'] = hashlib.sha256(dest.read_bytes()).hexdigest()
        a['bytes'] = dest.stat().st_size
    manifest['compressedBytes'] = sum(a['bytes'] for a in manifest['assets'])
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')

if __name__ == '__main__':
    repack()
