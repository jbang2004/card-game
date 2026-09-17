"""Art sources live outside the repository; their generated output lives in it.

A fresh clone has `src/*-assets.js` but no `assets/`, so every generator asks
`skip()` first: with its sources gone but its output already committed it says
so and leaves the output alone, and with neither present it fails loudly rather
than shipping an empty bank.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HINT = '素材源不在仓库中，见 README 的「素材源」一节'


def skip(tool, sources, outputs):
    """True when `tool` has no sources left but its generated outputs are here."""
    missing = [name for name in sources if not (ROOT / name).exists()]
    if not missing:
        return False
    absent = [name for name in outputs if not (ROOT / name).exists()]
    if absent:
        raise FileNotFoundError(
            f'{tool}: source {missing[0]} is missing and {absent[0]} has never '
            f'been generated. {HINT}')
    print(f'{tool}: {missing[0]} absent, keeping generated {", ".join(outputs)}')
    return True
