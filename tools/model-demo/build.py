"""Build the model demo (圣光裁决者 · 3D 模型演示) as one self-contained page.

    python3 tools/model-demo/build.py [out.html] [--standalone]

Runs the game's own figure stack (the same module list as the voxel gallery: three.js, kit, figures, render, sprites,
models, clips, hit-feel, arena) with this page (page.html), the gallery's sound (tools/voxel-gallery/sfx.js) and its
app (app.js). Written as an Artifact body; --standalone wraps it in a document for opening the file locally.
Standard library only.
"""
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
GALLERY = HERE.parent / "voxel-gallery"
spec = importlib.util.spec_from_file_location("gallery_build", GALLERY / "build.py")
gallery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gallery)


def split(out_dir):
    """--split out_dir: the page plus one script file per module under out_dir/js (an Artifact page is at most 16 MB;
    the models alone are larger), for publishing with the Artifact tool's `files`."""
    out_dir = pathlib.Path(out_dir); (out_dir / "js").mkdir(parents=True, exist_ok=True)
    page = (HERE / "page.html").read_text(encoding="utf-8")
    tags = ""
    mods = list(gallery.modules()) + [(p.stem.upper(), p.read_text(encoding="utf-8")) for p in (GALLERY / "sfx.js", HERE / "app.js")]
    for token, code in mods:
        name = token.lower() + ".js"
        (out_dir / "js" / name).write_text(code, encoding="utf-8")
        tags += f'<script src="js/{name}"></script>\n'
    (out_dir / "index.html").write_text(page.replace("<!--SCRIPTS-->", tags), encoding="utf-8")
    print(f"{out_dir}: {len(mods)} scripts")


def main():
    if "--split" in sys.argv:
        return split(sys.argv[sys.argv.index("--split") + 1])
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = pathlib.Path(args[0]) if args else HERE / "dist/model-demo.html"
    page = (HERE / "page.html").read_text(encoding="utf-8")
    scripts = "".join(f"<script>/* {t} */\n{code}\n</script>\n" for t, code in gallery.modules())
    for path in (GALLERY / "sfx.js", HERE / "app.js"):
        scripts += f"<script>/* {path.name} */\n{path.read_text(encoding='utf-8')}\n</script>\n"
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
