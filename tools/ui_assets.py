"""Validate and embed the authored interface materials; stdlib-only build path."""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def generate():
    manifest = json.loads((ROOT / 'assets/ui/manifest.json').read_text())
    images = {}
    for key, entry in manifest['assets'].items():
        for field in ('source', 'runtime'):
            data = (ROOT / entry[field]).read_bytes()
            if hashlib.sha256(data).hexdigest() != entry[field + 'Sha256']:
                raise ValueError('UI asset hash mismatch: ' + key + ' ' + field)
        images[key] = 'data:image/webp;base64,' + base64.b64encode(data).decode()
    script = '/* Generated from assets/ui/manifest.json. */\n'
    script += 'const EmberUIAssets = Object.freeze(' + json.dumps(images) + ');\n'
    script += 'for (const [key, image] of Object.entries(EmberUIAssets)) document.documentElement.style.setProperty("--ui-" + key, `url("${image}")`);\n'
    (ROOT / 'src/ui-assets.js').write_text(script)


if __name__ == '__main__':
    generate()
