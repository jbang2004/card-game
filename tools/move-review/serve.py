#!/usr/bin/env python3
"""招式审片台 — the review page for the move sheets (docs/design/MOVES.md).

    python3 tools/move-review/serve.py [--port 8013]

Serves the repository as it is on disk, so there is nothing to build: the page (/) loads the game's own figure
stack straight from src/ (the module list and order come from src/template.html and config/build.json, as the voxel
gallery's do), plus this folder's page.html and app.js. On top of the files it keeps what a review needs:

    GET  /lab                      the battlefield view lab (lab.html, lab.js): whole boards of figures under the
                                   candidate cameras, layouts and board shapes
    GET  /__review/state           the move sheets' fingerprint, the revisions kept, the marks made (the page polls it
                                   and reloads the sheets the moment content/moves.js is saved)
    GET  /__review/moves?rev=N     the sheets as they were at revision N (`prev`: before the last save)
    GET  /__review/notes           the reviewer's notes: { figure: { act: { text, verdict, at, time, status, reply } } }
    POST /__review/note            one note written (or cleared): { figure, name, act, text, verdict, at }
    POST /__review/mark            a moment the viewer marked: its numbers and a screenshot → marks/NNN.json + .png
    POST /__review/audit           an audit's contact sheet and numbers → audits/<id>.json + .png

Every save of src/content/moves.js that changes it keeps the version it replaced under revisions/ (the page compares
"上一版" with the current one side by side; "回到上一版" is copying that file back). Standard library only.
"""
import argparse
import base64
import hashlib
import http.server
import json
import pathlib
import re
import threading
import time
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MOVES = ROOT / "src/content/moves.js"
REVS, MARKS, AUDITS = HERE / "revisions", HERE / "marks", HERE / "audits"
NOTES = HERE / "notes.json"                    # what the reviewer says of each act of each figure (kept: it is their taste)
SKIP = {"VOXEL_HERO", "VOXEL_STAGE"}          # the battlefield adapters: the page places its figures itself
LOCK = threading.Lock()


def scripts():
    """the figure stack's scripts, in the build's order, as paths under src/"""
    cfg = json.loads((ROOT / "config/build.json").read_text(encoding="utf-8"))
    tpl = (ROOT / "src/template.html").read_text(encoding="utf-8")
    return [cfg[t] for t in re.findall(r"/\*(VESPER_THREE|VOXEL_[A-Z0-9_]+)\*/", tpl) if t not in SKIP]


def page(query, html="page.html", js="app.js"):
    """the review page: page.html with the stack's script tags (the sheets of a kept revision when asked for one);
    the battlefield view lab is the same stack with lab.html and lab.js"""
    rev = (query.get("rev") or [""])[0]
    tags = []
    for path in scripts():
        if path == "content/moves.js":
            src = f"/__review/moves?rev={urllib.parse.quote(rev)}" if rev else f"/src/{path}?t={int(MOVES.stat().st_mtime_ns)}"
        else:
            src = f"/src/{path}?t={int((ROOT / "src" / path).stat().st_mtime_ns)}"
        tags.append(f'<script src="{src}"></script>')
    tags.append('<script src="/tools/voxel-gallery/sfx.js"></script>')
    tags.append(f'<script src="/tools/move-review/{js}?t={int((HERE / js).stat().st_mtime_ns)}"></script>')
    body = (HERE / html).read_text(encoding="utf-8").replace("<!--SCRIPTS-->", "\n".join(tags))
    return ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + body + "</body></html>")


# ---------------------------------------------------------------- revisions of the sheets
def digest(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def revisions():
    REVS.mkdir(exist_ok=True)
    index = REVS / "index.json"
    return json.loads(index.read_text(encoding="utf-8")) if index.exists() else []


def keep(text, why):
    """keep `text` as the next revision → its number (the same text is not kept twice in a row)"""
    with LOCK:
        revs = revisions()
        if revs and revs[-1]["hash"] == digest(text):
            return revs[-1]["n"]
        n = (revs[-1]["n"] + 1) if revs else 1
        (REVS / f"{n:04d}.js").write_text(text, encoding="utf-8")
        revs.append({"n": n, "hash": digest(text), "time": time.strftime("%Y-%m-%d %H:%M:%S"), "why": why})
        (REVS / "index.json").write_text(json.dumps(revs, ensure_ascii=False, indent=1), encoding="utf-8")
        return n


def revision(rev):
    """the sheets at a revision: a number, `prev` (the last one kept: what the current file replaced) or the file"""
    revs = revisions()
    if rev == "prev":
        current = digest(MOVES.read_text(encoding="utf-8"))
        older = [r for r in revs if r["hash"] != current]
        rev = str(older[-1]["n"]) if older else ""
    if rev.isdigit() and (REVS / f"{int(rev):04d}.js").exists():
        return (REVS / f"{int(rev):04d}.js").read_text(encoding="utf-8")
    return MOVES.read_text(encoding="utf-8")


def watch():
    """every version of the sheets that a save replaces is kept"""
    last = MOVES.read_text(encoding="utf-8")
    keep(last, "审片开始时")
    while True:
        time.sleep(0.4)
        try:
            text = MOVES.read_text(encoding="utf-8")
        except OSError:
            continue
        if text != last:
            keep(last, "被替换前")
            keep(text, "保存")
            last = text


def notes():
    try:
        return json.loads(NOTES.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def state():
    text = MOVES.read_text(encoding="utf-8")
    MARKS.mkdir(exist_ok=True)
    marks = sorted(int(p.stem) for p in MARKS.glob("*.json") if p.stem.isdigit())
    stamp = NOTES.stat().st_mtime_ns if NOTES.exists() else 0
    # the code and the clips the page runs (everything but the sheets): when any of it changes, an open page must load
    # itself again — new sheets on old code name clips and effects the page does not have, and the figures stand still
    code = max([(ROOT / "src" / p).stat().st_mtime_ns for p in scripts() if p != "content/moves.js"] + [(HERE / "app.js").stat().st_mtime_ns])
    return {"hash": digest(text), "revisions": revisions()[-12:], "marks": marks, "notes": stamp, "code": code}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kw):
        super().__init__(*args, directory=str(ROOT), **kw)

    def log_message(self, *args):
        pass

    def send(self, body, kind="application/json; charset=utf-8", code=200):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        # the sheets and this folder's own files are always read fresh; everything else (the engine's code, the clips,
        # the models — large) is revalidated by date on every load: a browser must never play a stale engine or a
        # stale clip bundle against new sheets (it did: "clip … is not in EmberModelAnims" after a repack)
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/src/content/") or path.startswith("/tools/move-review/"):
            self.send_header("Cache-Control", "no-store")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(url.query)
        if url.path in ("/", "/index.html"):
            return self.send(page(query), "text/html; charset=utf-8")
        if url.path in ("/lab", "/lab/"):
            return self.send(page(query, "lab.html", "lab.js"), "text/html; charset=utf-8")
        if url.path == "/__review/state":
            return self.send(json.dumps(state(), ensure_ascii=False))
        if url.path == "/__review/moves":
            return self.send(revision((query.get("rev") or [""])[0]), "text/javascript; charset=utf-8")
        if url.path == "/__review/notes":
            return self.send(json.dumps(notes(), ensure_ascii=False))
        if url.path == "/__review/marks":
            MARKS.mkdir(exist_ok=True)
            out = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(MARKS.glob("*.json"))]
            return self.send(json.dumps(out, ensure_ascii=False))
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        png = body.pop("png", None)
        if url.path == "/__review/mark":
            MARKS.mkdir(exist_ok=True)
            with LOCK:
                n = max([int(p.stem) for p in MARKS.glob("*.json") if p.stem.isdigit()] or [0]) + 1
                body["n"] = n
                body["sheets"] = digest(MOVES.read_text(encoding="utf-8"))
                (MARKS / f"{n:03d}.json").write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
                if png:
                    ext = "jpg" if png.startswith("data:image/jpeg") else "png"
                    (MARKS / f"{n:03d}.{ext}").write_bytes(base64.b64decode(png.split(",", 1)[1]))
            return self.send(json.dumps({"n": n}))
        if url.path == "/__review/note":
            # one act of one figure: what the reviewer thinks of it. Saying something new reopens a note Claude answered
            with LOCK:
                data = notes()
                fig, act = str(body.get("figure", "")), str(body.get("act", ""))
                text, verdict = str(body.get("text", "")).strip(), body.get("verdict") or ""
                old = data.get(fig, {}).get(act, {})
                if not text and not verdict:
                    data.get(fig, {}).pop(act, None)
                    if fig in data and not data[fig]:
                        del data[fig]
                    entry = {}
                else:
                    entry = dict(old)
                    if text != old.get("text", "") or verdict != old.get("verdict", ""):
                        entry["status"] = "open"
                        entry["time"] = time.strftime("%Y-%m-%d %H:%M:%S")
                        entry["sheets"] = digest(MOVES.read_text(encoding="utf-8"))
                        if body.get("at") is not None:
                            entry["at"] = body["at"]
                    entry.update({"text": text, "verdict": verdict, "name": body.get("name", fig)})
                    data.setdefault(fig, {})[act] = entry
                NOTES.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            return self.send(json.dumps(entry, ensure_ascii=False))
        if url.path == "/__review/mark/note":
            path = MARKS / f"{int(body['n']):03d}.json"
            if path.exists():
                mark = json.loads(path.read_text(encoding="utf-8"))
                mark["note"] = body.get("note", "")
                path.write_text(json.dumps(mark, ensure_ascii=False, indent=1), encoding="utf-8")
            return self.send("{}")
        if url.path == "/__review/audit":
            AUDITS.mkdir(exist_ok=True)
            name = re.sub(r"[^a-z0-9_-]", "", str(body.get("id", "audit")))
            (AUDITS / f"{name}.json").write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
            if png:
                ext = "jpg" if png.startswith("data:image/jpeg") else "png"
                for old in AUDITS.glob(f"{name}.*"):
                    if old.suffix in (".png", ".jpg"):
                        old.unlink()
                (AUDITS / f"{name}.{ext}").write_bytes(base64.b64decode(png.split(",", 1)[1]))
            return self.send(json.dumps({"saved": name}))
        return self.send("{}", code=404)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8013)
    args = ap.parse_args()
    threading.Thread(target=watch, daemon=True).start()
    http.server.ThreadingHTTPServer.request_queue_size = 512
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"招式审片台: http://127.0.0.1:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
