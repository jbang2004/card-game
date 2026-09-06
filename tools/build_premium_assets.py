"""Rebuild the portable environment binding from the reviewed WebP asset."""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
asset = ROOT / "assets/premium/tavern-board.webp"
encoded = base64.b64encode(asset.read_bytes()).decode("ascii")
(ROOT / "src/premium-assets.js").write_text(
    'const PremiumAssets = Object.freeze({board:"data:image/webp;base64,'
    + encoded + '"});\n', encoding="utf-8"
)
