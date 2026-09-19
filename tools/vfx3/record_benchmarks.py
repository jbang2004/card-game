"""Record actual R7 full-pose replay at a deterministic 60 Hz.
No damage re-execution; card values are the already-resolved rule values.
The renderer, movement and cue samples are the same modules as the running game.
The output sample rate is NOT a measured real-time GPU frame rate.
"""
from pathlib import Path
import json,os,sys,math,time
from verify_benchmarks import load,launch
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/"output/benchmark-r7/recording"
OUT.mkdir(parents=True,exist_ok=True)
ROLES=[("paladin","圣裁 · 天剑","HEAVENLY VERDICT"),("assassin","夜幕 · 无声刺","SILENT NEEDLE"),("frostking","白霜 · 王敕","FROST EDICT")]
def main():
 report={"fps":60,"origin":"in-memory","playback":"full pose and VFX replay, resolved card values","clips":[],"errors":[]}
 with sync_playwright() as p:
  b=launch(p);pg=b.new_page(viewport={"width":1440,"height":900})
  pg.on("pageerror",lambda e:report["errors"].append(str(e)));load(pg)
  for role,name,en in ROLES:
   assert pg.evaluate("r=>VFXLab.cast(r)",role)
   d=pg.evaluate("EmberFx2.mesh3d.last");duration=(d["impact"]-d["start"]+d["tail"])/1000+.16
   count=math.ceil(duration*60)
   folder=OUT/role;folder.mkdir(exist_ok=True)
   # Stop unrelated decorative CSS motion after the actual attack. The benchmark
   # pose controller uses inline transforms and continues to be sampled.
   pg.evaluate("VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause())")
   for i in range(count):
    pg.evaluate("ms=>VFXLab.seek(ms)",min(duration*1000,i/60*1000))
    pg.screenshot(path=str(folder/f"{i:05}.jpg"),type="jpeg",quality=90)
    if i%30==0:print(role,i,"/",count,flush=True)
   report["clips"].append({"role":role,"name":name,"en":en,"frames":count,"descriptor":d,"duration":duration,"folder":str(folder)})
   (OUT/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
  b.close()
 if report["errors"]:raise RuntimeError(report["errors"])
if __name__=="__main__":main()
