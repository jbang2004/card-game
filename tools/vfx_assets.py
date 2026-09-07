"""Verify and pack local lossless VFX with the Python standard library."""
from pathlib import Path
import base64
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[1]


def dimensions(data):
    """Read a lossless WebP's VP8L header; reject other/animated formats."""
    if (data[:4] != b'RIFF' or data[8:12] != b'WEBP'
            or struct.unpack('<I', data[4:8])[0] + 8 != len(data)):
        raise ValueError('Invalid WebP container')
    offset = 12
    size = None
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        length = struct.unpack('<I', data[offset + 4:offset + 8])[0]
        payload = data[offset + 8:offset + 8 + length]
        if len(payload) != length or kind in (b'ANIM', b'ANMF', b'VP8 '):
            raise ValueError('VFX requires a static lossless WebP atlas')
        if kind == b'VP8L':
            if len(payload) < 5 or payload[0] != 0x2f:
                raise ValueError('Invalid lossless WebP header')
            bits = struct.unpack('<I', payload[1:5])[0]
            if bits >> 29:
                raise ValueError('Unsupported VP8L version')
            size = (1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff))
        offset += 8 + length + (length & 1)
    if size is None or offset != len(data):
        raise ValueError('Missing lossless WebP data')
    return size


def generate():
    folder = ROOT / 'assets/vfx'
    bank = {}
    for asset in json.loads((folder / 'manifest.json').read_text())['assets']:
        data = (folder / asset['file']).read_bytes()
        if asset['id'] in bank:
            raise ValueError('Duplicate VFX ID: ' + asset['id'])
        if hashlib.sha256(data).hexdigest() != asset['sha256']:
            raise ValueError('VFX hash mismatch: ' + asset['id'])
        width, height = dimensions(data)
        if (width, height) != (asset['width'], asset['height']):
            raise ValueError('VFX size mismatch: ' + asset['id'])
        bank[asset['id']] = {
            'src': 'data:image/webp;base64,' + base64.b64encode(data).decode(),
            'frames': asset.get('frames', 1),
            'cols': asset.get('columns', 1),
            'rows': asset.get('rows', 1),
            'frameWidth': asset.get('frameWidth', width),
            'frameHeight': asset.get('frameHeight', height),
            'anchor': asset.get('targetAnchor', asset['origin']),
        }
    (ROOT / 'src/vfx-assets.js').write_text(
        '/* Generated local CC0 VFX; see assets/vfx/manifest.json. */\n'
        'const EmberVfxAssets = Object.freeze('
        + json.dumps(bank, separators=(',', ':')) + ');\n')


if __name__ == '__main__':
    generate()
