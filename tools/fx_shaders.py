"""Pack the fx2 GLSL sources into one JS bank so the build stays fetch-free."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def generate():
    folder = ROOT / 'assets/fx2/shaders'
    bank = {}
    for path in sorted(folder.glob('*.glsl')):
        text = path.read_text()
        if '\x00' in text:
            raise ValueError('Shader must be text: ' + path.name)
        bank[path.name] = text
    if not bank:
        raise ValueError('No fx2 shaders found')
    (ROOT / 'src/fx2-shaders.js').write_text(
        '/* Generated from assets/fx2/shaders/*.glsl by tools/fx_shaders.py. */\n'
        'const EmberFx2Shaders = Object.freeze('
        + json.dumps(bank, ensure_ascii=False, indent=1)
        + ');\n'
        'if (typeof module !== "undefined") module.exports = EmberFx2Shaders;\n'
    )
    return bank


if __name__ == '__main__':
    print(len(generate()), 'shaders packed')
