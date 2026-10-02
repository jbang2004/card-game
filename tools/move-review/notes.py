#!/usr/bin/env python3
"""The reviewer's notes on the moves (tools/move-review/notes.json, written by the review page).

    python3 tools/move-review/notes.py                      what is waiting (open notes), oldest first
    python3 tools/move-review/notes.py --all                every note, answered ones too
    python3 tools/move-review/notes.py reply paladin attack "蓄力加长到 230 ms，地裂缩小三成"
                                                            answer a note: it shows under the note on the page,
                                                            marked 已处理 (the reviewer writing again reopens it)

A note: { text, verdict ("ok" 满意 · "fix" 要改 · ""), at (the moment it was written on: act ms, phase), time,
sheets (the sheets' fingerprint then), status (open | done), reply }. The act "general" is the figure as a whole.
"""
import json
import pathlib
import sys
import time

NOTES = pathlib.Path(__file__).resolve().parent / "notes.json"
ACT = {"general": "整体", "attack": "攻击", "heavy": "重击", "kill": "致命一击", "hurt": "受击", "hurt3": "重创", "die": "阵亡",
       "victory": "胜利", "enter": "登场", "idle": "待机"}
VERDICT = {"ok": "满意", "fix": "要改", "": ""}


def main():
    data = json.loads(NOTES.read_text(encoding="utf-8")) if NOTES.exists() else {}
    args = sys.argv[1:]
    if args[:1] == ["reply"]:
        fig, act, reply = args[1], args[2], args[3]
        note = data[fig][act]
        note.update({"reply": reply, "status": "done", "replied": time.strftime("%Y-%m-%d %H:%M:%S")})
        NOTES.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"answered {fig} · {ACT.get(act, act)}")
        return
    rows = [(n.get("time", ""), fig, act, n) for fig, acts in data.items() for act, n in acts.items()]
    rows = [r for r in sorted(rows) if "--all" in args or r[3].get("status") != "done"]
    if not rows:
        print("没有待处理的留言。")
    for when, fig, act, n in rows:
        at = n.get("at") or {}
        where = f" @ {at.get('phase') or ''} 第 {at.get('ms')} ms" if at.get("ms") is not None else ""
        v = VERDICT.get(n.get("verdict", ""), "")
        print(f"[{n.get('status', 'open')}] {n.get('name', fig)}（{fig}）· {ACT.get(act, act)}{where} {('【' + v + '】') if v else ''} {when}")
        if n.get("text"):
            print("    " + n["text"].replace("\n", "\n    "))
        if n.get("reply"):
            print("    ↳ " + n["reply"])


if __name__ == "__main__":
    main()
