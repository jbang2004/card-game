#!/usr/bin/env python3
"""Validate the shipped mage GLB, including skin data and authored clips.

Standard library only. Run against a decoded, self-contained GLB.
"""
import json
from pathlib import Path
import struct
import sys


def validate(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert (magic, version, length) == (0x46546C67, 2, len(raw)), 'Invalid GLB header'
    json_size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(raw[20:20 + json_size])
    bin_size, kind = struct.unpack_from('<II', raw, 20 + json_size)
    assert kind == 0x004E4942
    binary = raw[28 + json_size:28 + json_size + bin_size]
    assert len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0]
    assert all('bufferView' in im and 'uri' not in im for im in doc.get('images', []))
    assert 'EXT_meshopt_compression' not in doc.get('extensionsRequired', [])
    types = {5120: ('b', 127), 5121: ('B', 255), 5122: ('h', 32767),
             5123: ('H', 65535), 5125: ('I', 4294967295), 5126: ('f', 1)}
    dimensions = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

    def values(index):
        acc = doc['accessors'][index]
        assert 'sparse' not in acc
        view = doc['bufferViews'][acc['bufferView']]
        fmt, divisor = types[acc['componentType']]
        fmt = '<' + fmt * dimensions[acc['type']]
        size = struct.calcsize(fmt)
        start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        stride = view.get('byteStride', size)
        rows = [struct.unpack_from(fmt, binary, start + i * stride) for i in range(acc['count'])]
        if acc.get('normalized'):
            rows = [tuple(max(-1, x / divisor) for x in row) for row in rows]
        return rows

    nodes = doc['nodes']
    parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
    names = {node.get('name'): i for i, node in enumerate(nodes)}
    chains = []
    for side in ['Left', 'Right']:
        for parts in [('Shoulder', 'Arm', 'ForeArm', 'Hand'), ('UpLeg', 'Leg', 'Foot', 'ToeBase')]:
            chain = [names['mixamorig:' + side + part] for part in parts]
            assert all(parents.get(child) == parent for parent, child in zip(chain, chain[1:])), 'Broken limb chain'
            chains.append(chain)
    triangles = vertices = 0
    max_weight_error = 0
    for node in nodes:
        if 'mesh' not in node:
            continue
        assert 'skin' in node, 'Expected a skinned hero mesh'
        joint_count = len(doc['skins'][node['skin']]['joints'])
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            attrs = primitive['attributes']
            joints, weights = values(attrs['JOINTS_0']), values(attrs['WEIGHTS_0'])
            assert len(joints) == len(weights) == doc['accessors'][attrs['POSITION']]['count']
            for js, ws in zip(joints, weights):
                assert all(0 <= j < joint_count for j in js), 'Out-of-range joint index'
                error = abs(sum(ws) - 1)
                max_weight_error = max(max_weight_error, error)
                assert error < 0.02 and all(w >= 0 for w in ws), 'Invalid skin weights'
            vertices += len(joints)
            triangles += doc['accessors'][primitive['indices']]['count'] // 3
    clips = []
    for clip in doc.get('animations', []):
        animated = set()
        duration = 0
        for channel in clip['channels']:
            sampler = clip['samplers'][channel['sampler']]
            times = [row[0] for row in values(sampler['input'])]
            assert len(times) >= 2 and all(b > a for a, b in zip(times, times[1:])), 'Invalid keyframe times'
            duration = max(duration, times[-1])
            animated.add(channel['target']['node'])
            rows = values(sampler['output'])
            if channel['target']['path'] == 'rotation':
                assert all(abs(sum(x*x for x in row) - 1) < 0.01 for row in rows), 'Invalid quaternion'
        assert duration > 0 and len(animated) >= 3, 'Degenerate clip'
        clips.append({'name': clip['name'], 'duration': round(duration, 3), 'animatedBones': len(animated)})
    assert {'idle', 'cast', 'hit'} <= {x['name'] for x in clips}, 'Missing battle clips'
    return {'path': str(path), 'bytes': len(raw), 'triangles': triangles, 'vertices': vertices,
            'bones': len(doc['skins'][0]['joints']), 'limbChains': len(chains),
            'maxWeightError': max_weight_error, 'clips': clips, 'status': 'pass'}


if __name__ == '__main__':
    print(json.dumps(validate(Path(sys.argv[1])), indent=2))
