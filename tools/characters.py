#!/usr/bin/env python3
"""Validate the authored character catalog and generate runtime data; stdlib only."""
import argparse
import json
from pathlib import Path

try:  # build.py imports tools.*; running this file directly puts tools/ on the path.
    from tools import sources
except ImportError:
    import sources

ROOT = Path(__file__).resolve().parents[1]
CATALOG = 'config/characters.json'

def need(condition, message):
    if not condition:
        raise ValueError(message)

def local_file(base, name):
    path = (base / name).resolve()
    need(base.resolve() in path.parents and path.is_file(), f'Missing or escaped asset: {name}')
    return path

def validate(document, root=ROOT):
    need(document.get('version') == 1, 'Unsupported character catalog version')
    cards = document['cards']
    anime = json.loads((root / 'assets/anime/manifest.json').read_text())['items']
    need(set(cards) == set(anime), 'Character IDs must exactly match the static artwork manifest')
    for cid, card in cards.items():
        need(set(card) == {'staticKey', 'focus'}, f'{cid}: unknown or missing character fields')
        need(card['staticKey'] == cid, f'{cid}: static artwork must use its own ID')
        need(type(card['focus']) in (int, float) and 0 <= card['focus'] <= 100, f'{cid}: invalid focus')
        local_file(root / 'assets/anime', anime[cid]['file'])
    return cards

def outputs(cards):
    freeze = 'const freeze = o => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };'
    return {
        'src/character-catalog.js': '/* Generated from config/characters.json by tools/characters.py. */\nconst CharacterCatalog = (() => {' + freeze + 'return freeze(' + json.dumps(cards,ensure_ascii=False,separators=(',',':')) + ');})();\n'}

def generate(root=ROOT, check=False):
    document = json.loads((root/CATALOG).read_text())
    # The catalog is configuration and stays in the repository; the artwork it
    # points at does not, so a clone without assets/ keeps the generated file.
    if sources.skip('tools/characters.py', ['assets/anime/manifest.json'],
                    ['src/character-catalog.js']):
        return document['cards']
    cards = validate(document,root)
    for name, content in outputs(cards).items():
        path = root/name
        if check:
            need(path.is_file() and path.read_text() == content, f'Stale generated file: {name}; run python3 tools/characters.py')
        else:
            path.write_text(content)
    return cards

def inventory(cards):
    manifest = ROOT/'assets/anime/manifest.json'
    need(manifest.is_file(), f'--list needs the artwork names in {manifest.name}; {sources.HINT}')
    names = json.loads(manifest.read_text())['items']
    return [{'id':cid,'name':names[cid]['name'],'focus':card['focus']} for cid,card in cards.items()]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='validate without writing')
    parser.add_argument('--list',action='store_true',help='print the complete character inventory as JSON')
    args = parser.parse_args()
    try:
        cards = generate(check=args.check or args.list)
        if args.list:
            print(json.dumps(inventory(cards),ensure_ascii=False,indent=2))
        else:
            print(f'Characters: {len(cards)} registered')
    except (ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'Character validation failed: {error}\n')
