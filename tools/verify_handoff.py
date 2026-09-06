#!/usr/bin/env python3
"""Verify an unmodified handoff against the local manifest. No dependencies.
Normal source edits are expected to invalidate this immutable baseline manifest.
--build writes index.html and compares it with the original v0.7.0 build hash.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true', help='Build and verify baseline index.html')
    args = parser.parse_args()
    manifest_path = ROOT / 'HANDOFF_MANIFEST.json'
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        print(f'Cannot load handoff manifest: {exc}', file=sys.stderr)
        return 2
    failures: list[str] = []
    for item in manifest['files']:
        path = (ROOT / item['path']).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            failures.append(item['path'] + ': missing or unsafe path')
        elif path.stat().st_size != item['bytes'] or digest(path) != item['sha256']:
            failures.append(item['path'] + ': changed from delivered baseline')
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        print('Source changes made after delivery legitimately change the baseline.', file=sys.stderr)
        return 1
    print(f"PASS: {len(manifest['files'])} delivered files match their SHA-256 values.")
    if args.build:
        try:
            # -S deliberately skips site packages: ordinary building needs no pip package.
            subprocess.run([sys.executable, '-S', str(ROOT / 'build.py')], cwd=ROOT, check=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            print(f'Build failed: {exc}', file=sys.stderr)
            return 2
        actual = digest(ROOT / 'index.html')
        if actual != manifest['expectedHTMLsha256']:
            print(f'HTML differs from baseline: {actual}', file=sys.stderr)
            print('A changed source or an optional vendor/three.min.js changes this hash.', file=sys.stderr)
            return 1
        print(f'PASS: built HTML is byte-identical to original v0.7.0 ({actual}).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
