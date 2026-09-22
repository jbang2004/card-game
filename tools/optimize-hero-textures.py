#!/usr/bin/env python3
"""Downsample self-contained GLB textures; preserve geometry, skins and clips.

Requires the existing requirements-art.txt environment (Pillow). Use after
decode-hero-meshopt.mjs. This tool never changes the character's appearance,
poses, geometry or animation tracks beyond sampling its texture maps.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image

source, target = map(Path, sys.argv[1:3])
raw = source.read_bytes()
magic, version, length = struct.unpack_from('<III', raw)
assert magic == 0x46546C67 and version == 2 and length == len(raw)
json_length = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20 + json_length])
assert 'EXT_meshopt_compression' not in gltf.get('extensionsRequired', []), 'Decode meshopt first'
binary = raw[28 + json_length:]
base_images = set()
for material in gltf.get('materials', []):
    tex = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if tex:
        base_images.add(gltf['textures'][tex['index']]['source'])
replacements, report = {}, []
for index, image in enumerate(gltf.get('images', [])):
    view_index = image['bufferView']
    view = gltf['bufferViews'][view_index]
    image_bytes = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    with Image.open(io.BytesIO(image_bytes)) as opened:
        original_size = opened.size
        limit = 2048 if index in base_images else 1024
        im = opened.copy()
        im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        if im.mode == 'RGBA' and im.getextrema()[3] == (255, 255):
            im = im.convert('RGB')
        output = io.BytesIO()
        if image['mimeType'] == 'image/jpeg':
            im.convert('RGB').save(output, 'JPEG', quality=92 if index in base_images else 95,
                                   subsampling=0, optimize=True)
        else:
            assert image['mimeType'] == 'image/png'
            im.save(output, 'PNG', optimize=True)
        replacements[view_index] = output.getvalue()
        report.append({'name': image.get('name'), 'before': original_size, 'after': im.size,
                       'beforeBytes': len(image_bytes), 'afterBytes': len(output.getvalue())})
parts = bytearray()
for index, view in enumerate(gltf['bufferViews']):
    assert view['buffer'] == 0
    data = replacements.get(index)
    if data is None:
        data = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    parts.extend(b'\0' * ((-len(parts)) % 4))
    view['byteOffset'], view['byteLength'] = len(parts), len(data)
    parts.extend(data)
gltf['buffers'] = [{'byteLength': len(parts)}]
json_raw = json.dumps(gltf, separators=(',', ':')).encode()
json_raw += b' ' * ((-len(json_raw)) % 4)
parts.extend(b'\0' * ((-len(parts)) % 4))
out = struct.pack('<III', magic, 2, 28 + len(json_raw) + len(parts))
out += struct.pack('<II', len(json_raw), 0x4E4F534A) + json_raw
out += struct.pack('<II', len(parts), 0x004E4942) + parts
target.write_bytes(out)
print(json.dumps({'source': str(source), 'target': str(target), 'bytes': len(out),
                  'sha256': hashlib.sha256(out).hexdigest(), 'textures': report}, indent=2))
