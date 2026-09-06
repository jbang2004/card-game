#!/usr/bin/env python3
"""Build portable HTML. Optionally embed vendor/three.min.js for offline 3D."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
html = (SRC / "template.html").read_text(encoding="utf-8")
for token, filename in {
    "WORLD_ASSETS":"world-assets.js", "WINDBORNE_STYLE":"windborne.css", "WINDBORNE_UI":"windborne-ui.js",
    "ANIME_ASSETS":"anime-assets.js", "ANIME_STYLE":"anime.css", "ANIME_UI":"anime-ui.js",
    "MOBILE_VIEW":"mobile-view.js", "MOBILE_WORLD":"mobile-world.js", "MOBILE_STYLE":"mobile.css", "MOBILE_UI":"mobile-ui.js",
    "ATELIER_STYLE":"atelier.css", "ATELIER_ASSETS":"atelier-assets.js", "ATELIER_ART":"atelier-art.js", "ATELIER_WORLD":"atelier-world.js", "ATELIER_UI":"atelier-ui.js",
    "STYLE": "style.css", "DATA": "data.js", "ENGINE": "engine.js",
    "ART": "art.js", "SCENE": "scene.js", "UI": "ui.js",
    "MATERIALS":"materials.js", "PORTRAITS":"portraits.js", "TAVERN_ART":"tavern-art.js",
    "BACKDROPS":"backdrops.js", "TAVERN_WORLD":"tavern-world.js", "TAVERN_STYLE":"tavern.css", "TAVERN_UI":"tavern-ui.js",
    "REFINEMENT": "refinement.css", "EFFECTS": "effects.js", "ENHANCEMENTS": "enhancements.js"
}.items():
    text = (SRC / filename).read_text(encoding="utf-8")
    html = html.replace(f"/*{token}*/", text)

vendor = ROOT / "vendor" / "three.min.js"
if vendor.exists():
    library = vendor.read_text(encoding="utf-8")
    if len(library) < 100000 or "REVISION" not in library:
        raise ValueError("vendor/three.min.js is not a valid Three.js UMD build")
    library = re.sub(r"</script", r"<\\/script", library, flags=re.I)
    html = html.replace("</head>", "<script>" + library + "</script></head>", 1)
    mode = "embedded Three.js: offline 3D enabled"
else:
    mode = "CDN Three.js: full offline 2D fallback"

out = ROOT / "index.html"
out.write_text(html, encoding="utf-8")
print(f"Built {out}: {len(html.encode('utf-8')):,} bytes ({mode})")
