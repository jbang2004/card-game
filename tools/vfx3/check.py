"""Local browser inspection of the built game. In-memory debug gate only.
This does NOT validate HTTP origins, persistent storage, or physical mobile GPUs.
"""
from pathlib import Path
import re,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/vfx3';OUT.mkdir(parents=True,exist_ok=True)
def load(page):
 html=(ROOT/'index.html').read_text()
 scripts=re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)
 page.set_content(re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S),wait_until='domcontentloaded')
 for i,s in enumerate(scripts):
  print("loading script",i,len(s),flush=True)
  s=s.replace('["127.0.0.1", "localhost"].includes(location.hostname)','true').replace('new URLSearchParams(location.search).get("debug") === "1"','true').replace('new URLSearchParams(location.search).has("debug")','true')
  page.add_script_tag(content=s)
 print('scripts done',flush=True);page.wait_for_function('window.Emberfall && !AtelierWorld.loading',timeout=10000)
 page.locator('#quick-btn').click();print('quick clicked',flush=True);page.wait_for_function('!EmberFX.busy && EmberFx2.renderer3dAvailable',timeout=10000)
 page.evaluate('EmberDebug.game.aiStep=()=>({ok:true})')
SETUP="""(kind)=>{
 EmberFX.cancel(true);const g=EmberDebug.game;
 g.s.p.board=[];g.s.e.board=[];g.s.p.hand=[];g.s.p.mana=g.s.p.maxMana=10;g.s.active='p';g.s.phase='battle';g.s.e.secrets=[];
 for(let i=0;i<3;i++)g.summon('e','treant');
 const ids=kind==='breath'?['dragon','guard','oracle']:['squire','archer','guard'];
 for(const id of ids)g.summon('p',id,{sick:false});
 for(const u of g.s.e.board)u.hp=u.maxHp=30;
 if(kind==='lightning')g.s.p.hand=[g.card('bolt')];
 g.events=[];g.emit();return {target:g.s.e.board[2].uid,actor:g.s.p.board[0].uid,hand:g.s.p.hand[0]?.uid};
}"""
ATTACK="""kind=>{const g=EmberDebug.game;return Emberfall.act(()=>g.dispatch(kind==='lightning'?{type:'play',side:'p',uid:g.s.p.hand[0].uid,target:{side:'e',uid:g.s.e.board[2].uid}}:{type:'attack',side:'p',uid:g.s.p.board[0].uid,target:{side:'e',uid:g.s.e.board[2].uid}}))}"""
if __name__=='__main__':
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('ERROR',str(e),flush=True)));page.on('console',lambda m:print(m.type,m.text[:400],flush=True))
  print('loading',flush=True);load(page);print('ready',flush=True)
  checks=[]
  for kind in ['breath','lightning','slash']:
   page.evaluate(SETUP,kind);page.evaluate(ATTACK,kind);page.wait_for_timeout(850)
   last=page.evaluate('EmberFx2.mesh3d.last');print(kind,last,flush=True)
   assert last and last['kind']==kind
   state=page.evaluate('JSON.stringify(EmberDebug.game.s)');page.wait_for_function('!EmberFX.busy');page.evaluate('EmberFX.cancel(true)')
   for phase,dt in [('anticipation',-35),('contact',40),('tail',160)]:
    t=max(0,last['impact']-last['start']+dt);page.evaluate('t=>EmberFx2.mesh3d.replay(t)',t)
    page.screenshot(path=str(OUT/f'{kind}-{phase}.png'))
    checks.append({'kind':kind,'phase':phase,'gl':page.evaluate('EmberFx2.mesh3d.diagnostics().error')})
   assert page.evaluate('JSON.stringify(EmberDebug.game.s)')==state
   print('shots',kind,flush=True)
  (OUT/'browser-first.json').write_text(json.dumps({'errors':errors,'checks':checks},indent=2));assert not errors,errors;b.close()
