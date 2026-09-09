#!/usr/bin/env python3
"""Reproducible portable and web builds from a single ordered template.

index.html: fully embedded, suitable for offline transfer and legacy tests.
dist/: external scripts, styles and content-addressed images/audio for HTTP caching.
The registry maps template tokens to source files; dependencies follow template
order. Unknown, duplicate or unused tokens fail the build instead of shipping.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
from tools.characters import generate as generate_characters
from tools.audio_assets import generate as generate_audio
from tools.vfx_assets import generate as generate_vfx
from tools.ui_assets import generate as generate_ui

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
TOKEN = re.compile(r'/\*([A-Z_]+)\*/')
MEDIA = re.compile(r'data:(?:image|audio)/(png|webp|jpeg|gif|mpeg);base64,([A-Za-z0-9+/=]+)')


def build():
    generate_characters()
    generate_audio()
    generate_vfx()
    generate_ui()
    registry = json.loads((ROOT / 'config/build.json').read_text())
    template = (SRC / 'template.html').read_text()
    tokens = TOKEN.findall(template)
    if len(tokens) != len(set(tokens)) or set(tokens) != set(registry):
        raise ValueError('Template tokens must match build registry exactly')
    def embed_asset(match):
        path = (ROOT / 'assets' / match[1]).resolve()
        if (ROOT / 'assets').resolve() not in path.parents:
            raise ValueError('Asset must be inside assets/')
        mime = {'.png': 'png', '.webp': 'webp', '.jpg': 'jpeg'}[path.suffix]
        return 'data:image/' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()

    sources = {k: re.sub(r'asset:([\w/.-]+)', embed_asset, (SRC / v).read_text())
               for k, v in registry.items()}
    portable = TOKEN.sub(lambda m: sources[m[1]], template)
    (ROOT / 'index.html').write_text(portable)

    dist = ROOT / 'dist'
    previous = dist / 'build-manifest.json'
    if previous.exists():
        for name in json.loads(previous.read_text()).get('files', {}):
            target = (dist / name).resolve()
            if dist.resolve() in target.parents and target.is_file():
                target.unlink()
    (dist / 'assets').mkdir(parents=True, exist_ok=True)
    records = {}

    def extract_media(match):
        data = base64.b64decode(match[2], validate=True)
        suffix = {'jpeg': 'jpg', 'mpeg': 'mp3'}.get(match[1], match[1])
        name = f'assets/{hashlib.sha256(data).hexdigest()[:20]}.{suffix}'
        (dist / name).write_bytes(data)
        records[name] = len(data)
        # URLs assigned to JS image.src resolve relative to document, not script.
        return './' + name

    def web_script(match):
        key = match[1]
        text = MEDIA.sub(extract_media, sources[key])
        name = 'scripts/' + registry[key]
        target = dist / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        records[name] = target.stat().st_size
        return f'<script src="./{name}" defer></script>'

    web = re.sub(r'<script>/\*([A-Z_]+)\*/</script>', web_script, template)
    css = []

    def web_style(match):
        css.append(MEDIA.sub(extract_media, TOKEN.sub(lambda m: sources[m[1]], match[1])))
        return '<link rel="stylesheet" href="./styles.css">'

    web = re.sub(r'<style>(.*?)</style>', web_style, web, flags=re.S)
    (dist / 'styles.css').write_text('\n'.join(css))
    (dist / 'index.html').write_text(web)
    if TOKEN.search(web):
        raise ValueError('Unresolved web build token')
    for name in ('index.html', 'styles.css'):
        records[name] = (dist / name).stat().st_size
    report = {'version': json.loads((ROOT / 'package.json').read_text())['version'], 'portableBytes': len(portable.encode()),
              'webBytes': sum(records.values()), 'files': records,
              'portableSha256': hashlib.sha256(portable.encode()).hexdigest()}
    (dist / 'build-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Portable: index.html ({report["portableBytes"]:,} bytes)')
    print(f'Web: dist/index.html ({len(records)} files; {report["webBytes"]:,} bytes)')


if __name__ == '__main__':
    build()
