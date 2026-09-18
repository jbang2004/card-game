"""R3 visual review: capture actual mesh replay after a real rule action.

Usage: python3 build.py && xvfb-run -a python3 tools/vfx3/record_flow.py
Needs Playwright, Chromium, and a desktop display / Xvfb. No audio is captured.
The frame rate describes deterministic export, not real-time GPU performance.
"""
from pathlib import Path
import argparse
import json
import math
import os
import shutil
import sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check import load, ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fps', type=int, default=30)
    parser.add_argument('--width', type=int, default=1440)
    parser.add_argument('--height', type=int, default=900)
    args = parser.parse_args()
    if not (1 <= args.fps <= 60 and args.width >= 800 and args.height >= 600):
        parser.error('Use FPS 1–60 and a desktop viewport of at least 800×600.')
    output = ROOT / 'output/vfx3-r3'
    frames = output / 'frames'
    frames.mkdir(parents=True, exist_ok=True)
    # Remove only this tool's old frame sequence, never arbitrary user files.
    for old in frames.glob('frame-*.jpg'):
        old.unlink()
    browser_path = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    errors, segments, index = [], [], 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=browser_path, headless=False,
            args=['--no-sandbox', '--use-gl=angle', '--use-angle=gl',
                  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': args.width, 'height': args.height}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        load(page)
        page.add_script_tag(content=(ROOT / 'tools/vfx3/lab.js').read_text())
        page.wait_for_function('window.VFXLab', timeout=30000)
        page.mouse.move(2, 2)
        for speed in (1.0, 0.5):
            for skill in ('breath', 'slash'):
                if not page.evaluate('k => VFXLab.cast(k)', skill):
                    raise RuntimeError(f'Real {skill} action failed')
                descriptor = page.evaluate('EmberFx2.mesh3d.last')
                duration = descriptor['impact'] - descriptor['start'] + descriptor['tail']
                before = page.evaluate('JSON.stringify(EmberDebug.game.s)')
                count = math.ceil((duration / 1000 / speed + 0.2) * args.fps)
                begin = index
                for frame in range(count):
                    time_ms = min(duration, frame / args.fps * 1000 * speed)
                    page.evaluate('t => VFXLab.seek(t)', time_ms)
                    page.evaluate('text => document.getElementById("lab-mode").textContent = text',
                                  ('1× 原速' if speed == 1 else '½× 慢放') + ' · 特效回看 / 不重复扣血')
                    page.screenshot(path=str(frames / f'frame-{index:05d}.jpg'), type='jpeg', quality=94)
                    index += 1
                assert page.evaluate('JSON.stringify(EmberDebug.game.s)') == before, 'Replay changed rule state'
                assert page.evaluate('EmberFx2.mesh3d.diagnostics().error') == 0, 'WebGL error'
                segments.append({'skill': skill, 'speed': speed, 'firstFrame': begin,
                                 'frames': count, 'descriptor': descriptor, 'durationMs': duration})
                print(skill, speed, count, flush=True)
        assert not errors, errors
        report = {'frames': index, 'fps': args.fps, 'size': [args.width, args.height],
                  'segments': segments, 'errors': errors,
                  'renderer': page.evaluate('EmberFx2.mesh3d.diagnostics().webgl'),
                  'capture': 'actual game action followed by effect-only seek; DOM motion and rule damage are not replayed',
                  'audio': 'none', 'origin': 'in-memory browser loading; not an HTTP storage validation'}
        (output / 'video.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()
    print(f'Done: {index} frames. Encode with ffmpeg -framerate {args.fps} -i {frames}/frame-%05d.jpg ...', flush=True)


if __name__ == '__main__':
    main()
