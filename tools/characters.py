#!/usr/bin/env python3
"""Validate the authored character catalog and generate runtime data; stdlib only."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'assets/characters.json'
TEMPLATES = {'whole-subject', 'held-accent', 'anchored-accent', 'joint', 'canopy', 'wings'}

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
        need(set(card) == {'staticKey', 'focus', 'motion'}, f'{cid}: unknown or missing character fields')
        need(card['staticKey'] == cid, f'{cid}: static artwork must use its own ID')
        need(type(card['focus']) in (int, float) and 0 <= card['focus'] <= 100, f'{cid}: invalid focus')
        local_file(root / 'assets/anime', anime[cid]['file'])
        motion = card['motion']
        if motion is None:
            continue
        allowed = {'source','atlas','mask','cuts','maskCuts','accent','preserveHighlights','edgeTrim','backgroundWidth','files','size','rig','nativeAlpha'}
        need(set(motion) <= allowed, f'{cid}: unknown motion field')
        need(motion['source'] == f'assets/anime/{cid}.webp', f'{cid}: motion reference must be its own artwork')
        local_file(root / 'assets/motion', motion['atlas'])
        if motion.get('mask'):
            local_file(root / 'assets/motion', motion['mask'])
        else:
            need(motion.get('nativeAlpha') is True, f'{cid}: provide a matte or nativeAlpha')
        need(motion['size'] == [384,512], f'{cid}: current packer requires 384x512 layers')
        rig = motion['rig']
        template = rig.get('template')
        need(template in TEMPLATES, f'{cid}: unknown motion template {template}')
        common = {'template','speed','lift','turn'}
        extra = {'whole-subject': {'sway'}, 'held-accent': {'sway'}, 'anchored-accent': {'sway'},
                 'joint': {'sway','pivot','offset'}, 'canopy': {'sway','pivot','offset','crop'}, 'wings': {'wingSpeed','wings'}}[template]
        need(set(rig) == common | extra, f'{cid}: missing or unknown rig parameters')
        for field in ['speed','lift','turn'] + (['sway'] if 'sway' in extra else []):
            need(type(rig[field]) in (int,float) and 0 <= rig[field] <= 5, f'{cid}: invalid {field}')
        need(0 < rig['speed'] <= 3 and rig['lift'] <= .04 and rig['turn'] <= .2, f'{cid}: excessive motion')
        for field in ('pivot','offset'):
            if field in rig:
                need(len(rig[field]) == 2 and all(type(v) in (int,float) and abs(v) <= 512 for v in rig[field]), f'{cid}: invalid {field}')
        if 'crop' in rig:
            x,y,w,h = rig['crop']
            need(x >= 0 and y >= 0 and w > 0 and h > 0 and x+w <= 384 and y+h <= 512, f'{cid}: crop outside layer')
        if template == 'wings':
            need(type(rig['wingSpeed']) in (int,float) and 0 < rig['wingSpeed'] <= 3, f'{cid}: wing speed')
            need(len(rig['wings']) == 2 and all(len(w) == 6 and all(type(v) in (int,float) for v in w) for w in rig['wings']), f'{cid}: wing joints')
        roles = ['background','subject'] + ([] if template == 'whole-subject' else ['accent'])
        need([f['role'] for f in motion['files']] == roles, f'{cid}: layers must match {roles}')
        for field in ['cuts'] + (['maskCuts'] if motion.get('mask') else []):
            cuts = motion[field]
            need(len(cuts) >= len(roles)+1 and all(type(v) is int and v >= 0 for v in cuts) and all(a < b for a,b in zip(cuts,cuts[1:])), f'{cid}: invalid {field}')
        for layer in motion['files']:
            need(layer['file'] == f'{cid}-{layer["role"]}.webp', f'{cid}: layer must use its own ID and role')
            data = local_file(root / 'assets/motion', layer['file']).read_bytes()
            need(data[:4] == b'RIFF' and data[8:12] == b'WEBP', f'{cid}: expected WebP')
            need(len(data) == layer['bytes'] and hashlib.sha256(data).hexdigest() == layer['sha256'], f'{cid}: stale layer hash; repack assets')
    return cards

def outputs(cards, root=ROOT):
    catalog, cache = {}, {}
    for cid, card in cards.items():
        motion = card['motion']
        catalog[cid] = {**card, 'motion': None if motion is None else {
            'size': motion['size'], 'rig': motion['rig'], 'layers': [f['role'] for f in motion['files']]}}
        if motion:
            cache[cid] = {f['role']: 'data:image/webp;base64,' + base64.b64encode((root/'assets/motion'/f['file']).read_bytes()).decode() for f in motion['files']}
    freeze = 'const freeze = o => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };'
    return {
        'src/character-catalog.js': '/* Generated from assets/characters.json by tools/characters.py. */\nconst CharacterCatalog = (() => {' + freeze + 'return freeze(' + json.dumps(catalog,ensure_ascii=False,separators=(',',':')) + ');})();\n',
        'src/motion-assets.js': '/* Generated from assets/characters.json; do not edit. */\nconst MotionAssets = Object.freeze(' + json.dumps(cache,separators=(',',':')) + ');\n'}

def generate(root=ROOT, check=False):
    cards = validate(json.loads((root/'assets/characters.json').read_text()),root)
    for name, content in outputs(cards,root).items():
        path = root/name
        if check:
            need(path.is_file() and path.read_text() == content, f'Stale generated file: {name}; run python3 tools/characters.py')
        else:
            path.write_text(content)
    return cards

def inventory(cards):
    names = json.loads((ROOT/'assets/anime/manifest.json').read_text())['items']
    return [{'id':cid,'name':names[cid]['name'],'status':'animated' if c['motion'] else 'static',
             'template': c['motion']['rig']['template'] if c['motion'] else None,
             'layers':len(c['motion']['files']) if c['motion'] else 0} for cid,c in cards.items()]

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
            print(f'Characters: {len(cards)} registered; {sum(c["motion"] is not None for c in cards.values())} animated')
    except (ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'Character validation failed: {error}\n')
