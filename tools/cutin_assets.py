"""Cut-in stills: convert sources with Pillow, pack them with the stdlib.

`generate()` is the build step and only uses the standard library: it reads the
already-converted `assets/cutin/*.webp`, checks each one is a static 512x512
WebP, and packs them into `src/cutin-assets.js` as `const CutinAssets`.

`convert()` is the authoring step and needs Pillow (`.venv`), so it is never
called from `build.py`. Run it by hand when new art lands:

    .venv/bin/python tools/cutin_assets.py output/cutin-gen-20260916/raw

Each source `<id>.png|.webp|.jpg` becomes `assets/cutin/<id>.webp`, centre
cropped to a square and resized to 448x448 at WebP q84. Cut-ins only ever play
for heroes and legendary minions (`cutinPolicy` in src/presentation/fx-profiles.js),
so the bank is exactly those 17 ids: the ten hero portraitIds plus the ten
legendary minions, which overlap on four ids. Ids outside the bank get no
cut-in at all — there is no fallback to the card illustration.
"""
from pathlib import Path
import base64
import struct
import sys

try:  # build.py imports tools.*; running this file directly puts tools/ on the path.
    from tools import sources
except ImportError:
    import sources

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/cutin'
SIZE = 448
QUALITY = 84
SOURCES = ('.png', '.webp', '.jpg', '.jpeg')


def dimensions(data):
    """Read a static WebP's size from its container; reject animated files."""
    if (data[:4] != b'RIFF' or data[8:12] != b'WEBP'
            or struct.unpack('<I', data[4:8])[0] + 8 != len(data)):
        raise ValueError('Invalid WebP container')
    offset = 12
    size = None
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        length = struct.unpack('<I', data[offset + 4:offset + 8])[0]
        payload = data[offset + 8:offset + 8 + length]
        if len(payload) != length:
            raise ValueError('Truncated WebP chunk: ' + kind.decode('latin1'))
        if kind in (b'ANIM', b'ANMF'):
            raise ValueError('Cut-in art must be a static WebP')
        if kind == b'VP8L':
            if len(payload) < 5 or payload[0] != 0x2f:
                raise ValueError('Invalid lossless WebP header')
            bits = struct.unpack('<I', payload[1:5])[0]
            size = (1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff))
        elif kind == b'VP8 ':
            if len(payload) < 10 or payload[3:6] != b'\x9d\x01\x2a':
                raise ValueError('Invalid lossy WebP header')
            w, h = struct.unpack('<HH', payload[6:10])
            size = (w & 0x3fff, h & 0x3fff)
        offset += 8 + length + (length & 1)
    if not size:
        raise ValueError('WebP carries no image chunk')
    return size


def generate():
    """Pack assets/cutin/*.webp into src/cutin-assets.js. Standard library only."""
    if sources.skip('tools/cutin_assets.py', ['assets/cutin'],
                    ['src/cutin-assets.js']):
        return None
    bank = {}
    for path in sorted(ASSETS.glob('*.webp')):
        data = path.read_bytes()
        width, height = dimensions(data)
        if (width, height) != (SIZE, SIZE):
            raise ValueError('Cut-in art must be %dx%d: %s (%dx%d)'
                             % (SIZE, SIZE, path.name, width, height))
        bank[path.stem] = ('data:image/webp;base64,'
                           + base64.b64encode(data).decode())
    lines = ',\n'.join(' %s: "%s"' % (k, v) for k, v in bank.items())
    (ROOT / 'src/cutin-assets.js').write_text(
        '/* Generated from assets/cutin/*.webp by tools/cutin_assets.py.\n'
        ' * Dedicated cut-in stills, keyed by card id (a hero uses its\n'
        ' * portraitId). Only heroes and legendary minions have one; any other\n'
        ' * id simply gets no cut-in. */\n'
        'const CutinAssets = Object.freeze({\n' + lines + '\n});\n'
        'if (typeof module !== "undefined") module.exports = CutinAssets;\n'
    )
    return bank


def convert(folder):
    """Pillow step: <folder>/<id>.<ext> -> assets/cutin/<id>.webp at 512x512."""
    from PIL import Image
    folder = Path(folder)
    ASSETS.mkdir(parents=True, exist_ok=True)
    written = []
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() not in SOURCES or path.stem.startswith('ref-'):
            continue
        image = Image.open(path).convert('RGB')
        side = min(image.size)
        left = (image.width - side) // 2
        top = (image.height - side) // 2
        square = image.crop((left, top, left + side, top + side))
        square = square.resize((SIZE, SIZE), Image.LANCZOS)
        target = ASSETS / (path.stem + '.webp')
        square.save(target, 'WEBP', quality=QUALITY, method=6)
        written.append((target.name, target.stat().st_size, 'q%d' % QUALITY))
    return written


if __name__ == '__main__':
    if len(sys.argv) > 1:
        for name, size, mode in convert(sys.argv[1]):
            print('%-24s %8d B  %s' % (name, size, mode))
    bank = generate()
    if bank is not None:
        print(len(bank), 'cut-in stills packed')
