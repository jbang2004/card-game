"""Build the voxel gallery (体素角色馆) as one self-contained page.

    python3 tools/voxel-gallery/build.py [out.html] [--standalone]

The page runs the game's own voxel stack — the module list and order come from src/template.html and
config/build.json (three.js, sculpt, voxelize, kit, every registered figure, render, clips, hit-feel, arena) — plus
the gallery's page (page.html), its sound (sfx.js) and its app (app.js). The battlefield adapters (hero.js,
stage.js) stay out: the gallery places figures itself. The page is written as an Artifact body (the host adds the
document skeleton); --standalone wraps it in one for opening the file locally. Standard library only, like build.py.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
SKIP = {"VOXEL_HERO", "VOXEL_STAGE"}


def modules():
    cfg = json.loads((ROOT / "config/build.json").read_text(encoding="utf-8"))
    tpl = (ROOT / "src/template.html").read_text(encoding="utf-8")
    tokens = [t for t in re.findall(r"/\*(VESPER_THREE|VOXEL_[A-Z0-9_]+)\*/", tpl) if t not in SKIP]
    for token in tokens:
        path = ROOT / "src" / cfg[token]
        code = path.read_text(encoding="utf-8")
        if "</script" in code.lower():
            raise SystemExit(f"{path} contains a closing script tag")
        yield token, code


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = pathlib.Path(args[0]) if args else HERE / "dist/voxel-gallery.html"
    page = (HERE / "page.html").read_text(encoding="utf-8")
    scripts = "".join(f"<script>/* {t} */\n{code}\n</script>\n" for t, code in modules())
    for name in ("sfx.js", "app.js"):
        scripts += f"<script>/* {name} */\n{(HERE / name).read_text(encoding='utf-8')}\n</script>\n"
    html = page.replace("<!--SCRIPTS-->", scripts)
    if "--standalone" in sys.argv:
        html = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
                + html + "</body></html>")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out} ({len(html.encode('utf-8')):,} bytes)")


if __name__ == "__main__":
    main()
