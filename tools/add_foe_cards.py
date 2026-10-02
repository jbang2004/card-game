#!/usr/bin/env python3
"""The opponents' signature cards (docs/design/CAST_V2.md): a card of class "foe" that only its boss plays.

    python3 tools/add_foe_cards.py tools/foe_cards.json       # [{id, name, cost, type, ..., boss, prompt}, ...]

Appends each to src/content/cards.js (class "foe": not in any hero's pool, never offered, hidden from the collection),
adds the id to its boss's deck in src/content/campaign.js and the class to its class list. Art goes in through
tools/new_card.py. Idempotent: a card already in cards.js is skipped.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEYS = ["id", "name", "cost", "atk", "hp", "art", "palette", "rarity", "type", "tribe", "tags", "target", "onPlay", "onDeath", "triggers"]


def js(v, ind=4):
    pad = " " * ind
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{k}: {js(x, ind)}" for k, x in v.items()) + " }"
    if isinstance(v, list):
        return "[" + ", ".join(js(x, ind) for x in v) + "]"
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


def entry(c):
    lines = ["  {"]
    for k in KEYS:
        if k in c and c[k] is not None:
            lines.append(f"    {k}: {js(c[k])},")
    lines.append('    class: "foe",')
    lines.append("  },")
    return "\n".join(lines)


def main(path):
    cards = json.load(open(path))
    cp = ROOT / "src/content/cards.js"
    src = cp.read_text()
    fresh = [c for c in cards if f'id: "{c["id"]}"' not in src]
    if fresh:
        tail = "];\nif (typeof module"
        assert tail in src
        src = src.replace(tail, "\n".join(entry(c) for c in fresh) + "\n" + tail, 1)
        cp.write_text(src)
    camp = ROOT / "src/content/campaign.js"
    s = camp.read_text()
    if 'id: "foe"' not in s:
        s = s.replace('    {\n      id: "ranger",\n      name: "游侠",\n    },\n  ],', '    {\n      id: "ranger",\n      name: "游侠",\n    },\n    {\n      id: "foe",\n      name: "对手",\n    },\n  ],', 1)
        assert 'id: "foe"' in s
    for c in cards:
        m = re.search(r'id: "%s",.*?deck: \[(.*?)\],' % c["boss"], s, re.S)
        assert m, c["boss"]
        if f'"{c["id"]}"' not in m.group(1):
            s = s[:m.end(1)] + f', "{c["id"]}"' + s[m.end(1):]
    camp.write_text(s)
    print(f"{len(fresh)} cards added, decks updated")


if __name__ == "__main__":
    main(sys.argv[1])
