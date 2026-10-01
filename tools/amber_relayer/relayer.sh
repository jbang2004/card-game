#!/bin/sh
# Re-layer every card in descs.json that has no work/<id>/out yet: two codex-image calls each (6 in parallel),
# then the layering, then art/amber and src/amber-layers.js. Safe to re-run after the image quota resets.
cd "$(dirname "$0")"
for c in $(python3 -c "import json;print(' '.join(json.load(open('descs.json'))))"); do
  [ -f "work/$c/out/body.png" ] || { echo "$c:plate"; echo "$c:figure"; }
done | xargs -P 6 -I{} sh -c 'c=$(echo {} | cut -d: -f1); w=$(echo {} | cut -d: -f2); python3 gen.py $c $w'
for c in $(python3 -c "import json;print(' '.join(json.load(open('descs.json'))))"); do
  [ -f "work/$c/out/body.png" ] || [ ! -f "work/$c/plate.png" ] || [ ! -f "work/$c/figure.png" ] || echo "$c"
done | xargs -P 3 -I{} uv run --python 3.12 --no-project --with pillow --with numpy --with onnxruntime python layer.py {}
cd ../.. && uv run --python 3.12 --no-project --with pillow --with numpy python tools/bake_amber_layers.py
