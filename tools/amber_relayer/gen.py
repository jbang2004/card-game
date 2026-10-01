"""Generate the two helper images for one card: the empty background plate and the figure on a flat key colour.

    python3 gen.py <id> plate|figure        (run through xargs -P to parallelise; needs `codex` as in ~/.claude/skills/codex-image)
Writes relay/<id>/{source.png, plate.png | figure.png, provenance.json}.
"""
import json, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORK = HERE / "work"
D = json.load(open(HERE / "descs.json"))
KEYS = {"green": ("green", "#00FF00"), "magenta": ("magenta", "#FF00FF")}
TAIL = "Output full-bleed 3:4 at high resolution. ZERO baked text, numbers, letters, logos, icons, borders or watermarks anywhere."


def prompt(c, what):
    d = D[c]
    if what == "plate":
        return (f"Use case: precise-object-edit. Asset type: production game illustration layer, NOT a screenshot or mockup.\n"
                f"Input image is the edit target: an anime fantasy card painting. The main subject is {d['desc']}.\n"
                f"TASK: produce a CLEAN BACKGROUND PLATE. Completely remove the main subject (everything described above, with anything it holds or wears, its shadow and any reflection of it). "
                f"Paint what would naturally be BEHIND it: {d['scene']}, so the area where it stood looks like a finished, empty scene. Leave NO trace, ghost outline, shadow or smear of it.\n"
                f"Keep everything that is not the subject exactly as in the input: composition, perspective, palette, lighting, sparkles, brush style, at the same positions and scale.\n{TAIL}")
    name, hexv = KEYS[d["key"]]
    return (f"Use case: precise-object-edit / background-extraction. Asset type: production game illustration layer, NOT a screenshot or mockup.\n"
            f"Input image is the edit target. Extract ONLY the main subject: {d['desc']}. Keep its complete head and face fully visible (nothing cropped or hidden), every strand of hair or fur, and everything it holds or wears.\n"
            f"Keep its EXACT pose, scale, position in the frame, proportions, colors, line art and painting style, so that it lines up with the input pixel for pixel.\n"
            f"Replace EVERYTHING else with a flat, pure chroma-key {name} background {hexv}: the whole scene, and any object, particle or sparkle that is not the subject, whether behind, beside or in front of it. "
            f"Where something overlapped the subject, paint the subject continuing underneath. No gradient, no shadow, no floor, no glow spilling onto the {name}. Keep thin hair strands crisp against the {name}.\n"
            f"Do not add anything new. {TAIL}")


if __name__ == "__main__":
    c, what = sys.argv[1:3]
    out = WORK / c; out.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "assets/anime/overrides" / f"{c}.png", out / "source.png")
    target = out / ("plate.png" if what == "plate" else "figure.png")
    if target.exists():
        print("have", target); sys.exit(0)
    for attempt in range(3):
        r = subprocess.run([str(Path.home() / ".claude/skills/codex-image/gen.sh"), "-o", str(target), "-i", str(out / "source.png"), "-r", "3:4", prompt(c, what)], capture_output=True, text=True)
        print(c, what, "attempt", attempt, r.returncode, (r.stdout + r.stderr).strip()[-200:])
        if r.returncode == 0 and target.exists(): break
