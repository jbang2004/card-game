"""R7 real-game integration verification. No network/file-origin claim.
Run using CHROMIUM_PATH and an X display (or xvfb-run). Produces actual screenshots
and a JSON report; any failed assertion causes a nonzero exit.
"""
from pathlib import Path
import os,re,json,time,hashlib,traceback
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"output/benchmark-r7";OUT.mkdir(parents=True,exist_ok=True)
ROLES={"paladin":("judgment",4),"assassin":("night",4),"frostking":("frost",7)}
checks=[];descriptors={};errors=[];timings=[]
def check(name,value):
    checks.append({"name":name,"passed":bool(value)})
    print(("PASS " if value else "FAIL ")+name,flush=True)
    if not value:raise AssertionError(name)
def load(pg):
    html=(ROOT/"Card_Game_3D_VFX_Demo.html").read_text()
    scripts=re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)
    pg.set_content(re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S),wait_until="domcontentloaded")
    for s in scripts:pg.add_script_tag(content=s)
    pg.wait_for_function("window.VFXLab && EmberFx2.renderer3dAvailable",timeout=45000)
def launch(p):
    return p.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH","/usr/bin/chromium"),headless=False,
      args=["--no-sandbox","--use-gl=angle","--use-angle=gl","--enable-webgl","--ignore-gpu-blocklist","--disable-dev-shm-usage"])
def seek(pg,t):pg.evaluate("(t)=>VFXLab.seek(t)",t)
def run():
    env={"origin":"in-memory inspection HTML; not HTTP/file storage validation","full_e2e":False,
         "hardware_gpu_verified":False,"real_mobile_verified":False,"safari_verified":False}
    with sync_playwright() as p:
        b=launch(p)
        try:
            pg=b.new_page(viewport={"width":1440,"height":900});pg.on("pageerror",lambda e:errors.append(str(e)));load(pg)
            pg.click("#lab-audio")
            pg.wait_for_function("EmberAudio.state==='running'")
            check("user gesture enables existing audio mixer",pg.evaluate("EmberAudio.diagnostics.enabled"))
            env.update(pg.evaluate("EmberFx2.mesh3d.diagnostics().webgl"))
            for role,(style,damage) in ROLES.items():
                n=pg.evaluate("EmberFx2.mesh3d.trace.length")
                history=pg.evaluate("EmberAudio.diagnostics.history.length")
                check(role+": dispatch through real game rules",pg.evaluate("r=>VFXLab.cast(r)",role))
                d=pg.evaluate("EmberFx2.mesh3d.last");descriptors[role]=d;lead=d["impact"]-d["start"]
                check(role+": identity and source/target references",d["swordStyle"]==style and bool(d.get("sourceRef")) and bool(d.get("targetRef")))
                check(role+": exactly one new visual instance",pg.evaluate("EmberFx2.mesh3d.trace.length")==n+1)
                check(role+": original single damage amount",pg.evaluate("EmberDebug.game.s.e.board[2].hp")==60-damage)
                h=pg.evaluate("EmberAudio.diagnostics.history")[history:]
                h=[x for x in h if x["type"].startswith("benchmark-"+style)]
                check(role+": four dedicated audio cues scheduled once",len(h)==4 and len({x["type"] for x in h})==4)
                impact=next(x for x in h if x["type"].endswith("-impact"))
                check(role+": audio deadline equals visual contact",abs(impact["scheduledAt"]-d["impact"])<.001)
                state=pg.evaluate("JSON.stringify(EmberDebug.game.s)")
                audioCount=pg.evaluate("EmberAudio.diagnostics.history.length")
                for phase,dt in [("charge",-180),("entry",-55),("impact",14),("fracture",185),("residue",490)]:
                    seek(pg,max(0,lead+dt))
                    check(role+":"+phase+" clean GL frame",pg.evaluate("EmberFx2.mesh3d.diagnostics().error")==0)
                    pg.screenshot(path=str(OUT/f"{role}-{phase}.png"))
                check(role+": scrubbing preserves complete rule state",pg.evaluate("JSON.stringify(EmberDebug.game.s)")==state)
                check(role+": scrubbing emits no additional sound",pg.evaluate("EmberAudio.diagnostics.history.length")==audioCount)
                seek(pg,lead+35)
                check(role+": shared pose controller owns source and target",pg.evaluate("EmberFx2.benchmarkFeedback.active")==2)
                transforms=pg.evaluate("""()=>[...document.querySelectorAll('#battle .minion')].filter(e=>e.style.transform).map(e=>e.style.transform)""")
                check(role+": source/target rigidity (no scale/squash)",all("scale" not in s and "skew" not in s for s in transforms))
                first=pg.evaluate("ms=>{VFXLab.seek(ms);return document.getElementById('fx-3d').toDataURL()}",lead+35)
                seek(pg,0);seek(pg,lead+350);seek(pg,lead+35)
                check(role+": atomic draw/read repeats identical GPU pixels",first==pg.evaluate("ms=>{VFXLab.seek(ms);return document.getElementById('fx-3d').toDataURL()}",lead+35))
                seek(pg,pg.evaluate("VFXLab.duration"))
                check(role+": all effects and pose ownership end cleanly",pg.evaluate("EmberFx2.mesh3d.stats.active===0 && EmberFx2.benchmarkFeedback.active===0"))
                check(role+": no mixer runtime failures",pg.evaluate("EmberAudio.diagnostics.runtimeErrors")==0)
            # Playback controls operate on the shared pose track and audio lifecycle.
            pg.evaluate("VFXLab.seek(0);VFXLab.play()")
            pg.wait_for_function("VFXLab.snapshot().t>30",timeout=10000)
            pg.click("#lab-play")
            check("pause stops all playback voices",pg.evaluate("EmberAudio.diagnostics.activeVoices")==0)
            frozen=pg.evaluate("VFXLab.snapshot().t");pg.wait_for_timeout(220)
            check("pause freezes pose time",pg.evaluate("VFXLab.snapshot().t")==frozen)
            pg.select_option("#lab-speed",".5")
            check("slow preview is silent",pg.evaluate("EmberAudio.diagnostics.activeVoices")==0)
            pg.evaluate("VFXLab.play()")
            pg.wait_for_function("VFXLab.snapshot().t>40",timeout=10000)
            pg.click("#lab-play");pg.select_option("#lab-speed","1")
            check("pause and speed changes do not change damage",pg.evaluate("EmberDebug.game.s.e.board[2].hp")==53)
            # Cancellation stops scheduled and active audio, releases visual transforms.
            pg.evaluate("VFXLab.fixture('paladin');EmberFx2.mesh3d.resume()")
            pg.evaluate("()=>{const g=EmberDebug.game;Emberfall.act(()=>g.dispatch(VFXLab.actionFor('paladin')));EmberFX.cancel(true);}")
            check("cancel leaves no pending audio voice",pg.evaluate("EmberAudio.diagnostics.activeVoices")==0)
            check("cancel releases poses and mesh instances",pg.evaluate("EmberFx2.benchmarkFeedback.active===0 && EmberFx2.mesh3d.stats.active===0"))
            for role,damage in [("breath",6),("lightning",2),("squire",1)]:
                check(role+": unchanged real attack still works",pg.evaluate("r=>VFXLab.cast(r)",role))
                check(role+": unchanged original damage",pg.evaluate("EmberDebug.game.s.e.board[2].hp")==60-damage)
                d=pg.evaluate("EmberFx2.mesh3d.last");seek(pg,d["impact"]-d["start"]+120)
                check(role+": clean retained renderer path",pg.evaluate("EmberFx2.mesh3d.diagnostics().error")==0)
            pg.evaluate("VFXLab.cast('paladin')")
            d=pg.evaluate("EmberFx2.mesh3d.last");pg.evaluate("EmberFx2.setQuality({low:true,reduced:false})")
            seek(pg,d["impact"]-d["start"]+30)
            check("low quality preserves benchmark identity",pg.evaluate("EmberFx2.mesh3d.last.swordStyle")== "judgment")
            check("low quality has valid output",pg.evaluate("EmberFx2.mesh3d.stats.drawCalls>0 && EmberFx2.mesh3d.diagnostics().error===0"))
            pg.evaluate("EmberFx2.setQuality({low:false,reduced:true})")
            check("reduced motion clears both poses and new effects",pg.evaluate("EmberFx2.mesh3d.stats.active===0 && EmberFx2.benchmarkFeedback.active===0"))
            pg.evaluate("EmberFx2.setQuality({low:false,reduced:false});EmberFX.cancel(true)")
            check("desktop has no uncaught JavaScript errors",not errors)
            pg.close()
            for width,height in [(390,844),(844,390)]:
                m=b.new_page(viewport={"width":width,"height":height});me=[];m.on("pageerror",lambda e:me.append(str(e)));load(m)
                for role,(style,damage) in ROLES.items():
                    check(f"{width} {role}: real dispatch",m.evaluate("r=>VFXLab.cast(r)",role))
                    d=m.evaluate("EmberFx2.mesh3d.last");lead=d["impact"]-d["start"]
                    check(f"{width} {role}: correct identity and damage",d["swordStyle"]==style and m.evaluate("EmberDebug.game.s.e.board[2].hp")==60-damage)
                    seek(m,lead+45);m.screenshot(path=str(OUT/f"{width}-{role}.png"))
                    check(f"{width} {role}: valid mesh output",m.evaluate("EmberFx2.mesh3d.stats.drawCalls>0 && EmberFx2.mesh3d.diagnostics().error===0"))
                    state=m.evaluate("JSON.stringify(EmberDebug.game.s)")
                    seek(m,m.evaluate("VFXLab.duration"))
                    check(f"{width} {role}: pose cleanup/no rule change",m.evaluate("EmberFx2.benchmarkFeedback.active===0") and m.evaluate("JSON.stringify(EmberDebug.game.s)")==state)
                check(f"{width}: no horizontal page overflow",m.evaluate("document.documentElement.scrollWidth<=innerWidth+2"))
                check(f"{width}: no JavaScript errors",not me);m.close()
            env["mobile_layouts"]="independent 390x844 and 844x390; not orientation-switch certification"
        except Exception:
            errors.append(traceback.format_exc());raise
        finally:
            report={"checks":checks,"passed":sum(c["passed"] for c in checks),"failed":sum(not c["passed"] for c in checks),
                    "descriptors":descriptors,"errors":errors,"environment":env}
            (OUT/"browser-tests.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
            b.close()
if __name__=="__main__":run()
