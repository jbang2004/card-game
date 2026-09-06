"""v0.6 artwork integration + touch viewer tests, on the real application.
Uses controlled fixtures for token spawn effects. Does not claim public deployment.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import json,hashlib,shutil,traceback,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'tests/anime';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'index.html').read_text();checks=[];errors=[];images=[]
def ok(s):checks.append(s);print('PASS',len(checks),s,flush=True)
def idle(p):p.wait_for_function('!EmberFX.busy',timeout=12000);p.wait_for_timeout(70)
def demo(p):p.evaluate('Emberfall.demo()');idle(p)
def inject(p,code):idle(p);p.evaluate('(()=>{const g=Emberfall.game;'+code+';g.emit()})()');idle(p)
def has(p,cid,side='p'):
 return p.evaluate("([id,side])=>[...document.querySelectorAll('.minion[data-side='+side+']')].some(e=>e.dataset.cardid===id&&e.querySelector('img').getAttribute('src')===AnimeAssets[id])",[cid,side])
def boot(b,w,h,mobile):
 c=b.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);p=c.new_page();p.set_default_timeout(5500)
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:images.append(r.url) if r.resource_type=='image' and r.url.startswith('http') else None)
 p.route('https://**/*',lambda r:r.abort())
 p.evaluate("window.__storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}})")
 p.set_content(HTML,wait_until='domcontentloaded');p.wait_for_timeout(400);return c,p
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  c,p=boot(b,1600,940,False)
  decoded=p.evaluate("""async()=>{const out=[];for(const [id,src]of Object.entries(AnimeAssets)){const i=new Image();i.src=src;await i.decode();out.push({id,w:i.naturalWidth,h:i.naturalHeight});}return out;}""")
  assert len(decoded)==56 and all(i['w']==336 and i['h']==448 for i in decoded)
  ok('All 56 embedded anime assets decode at their declared 336×448 resolution')
  assert p.evaluate('EmberData.cards.every(c=>EmberArt.card(c)===AnimeAssets[c.id]) && new Set(EmberData.cards.map(c=>EmberArt.card(c))).size===56')
  ok('Every card and token maps one-to-one to a distinct new image; no legacy/shared-card fallback')
  p.evaluate('Emberfall.showLibrary()');p.wait_for_timeout(250);p.mouse.move(4,4)
  assert p.locator('.library-item').count()==48 and p.locator('.library-item .art-original').count()==0
  assert p.evaluate("[...document.querySelectorAll('.library-item')].every(e=>e.querySelector('img').getAttribute('src')===AnimeAssets[e.dataset.add])")
  p.screenshot(path=str(OUT/'collection-final.png'))
  ok('The real searchable collection displays all 48 new collectible artworks')
  coverage=p.evaluate("""(()=>{const failures=[];for(const e of document.querySelectorAll('.library-item .card-art')){const i=e.querySelector('img'),a=e.getBoundingClientRect(),r=i.getBoundingClientRect();if(r.left>a.left+2.2||r.top>a.top+2.2||r.right<a.right-2.2||r.bottom<a.bottom-2.2)failures.push(e.closest('[data-add]').dataset.add);}return failures;})()""")
  assert not coverage,coverage
  ok('All 48 visible DOM art rectangles cover their apertures without letterboxing')
  assert p.evaluate("""(()=>{const e=document.createElement('div');e.innerHTML=Emberfall.cardHTML({...EmberData.byId.paladin,name:'实时数值检查',text:'测试规则文字。'},{cost:1,atk:9,hp:2});return e.querySelector('.card-cost').textContent==='1'&&e.querySelector('.stat.atk').textContent==='9'&&e.querySelector('.stat.hp').textContent==='2'&&e.querySelector('.card-title').textContent==='实时数值检查'})()""")
  ok('Names, cost, attack, health and text are live DOM, not the atlas caption pixels')
  p.evaluate('Emberfall.closeModal()');p.locator('#start-btn').click();p.wait_for_timeout(150)
  assert p.evaluate("[...document.querySelectorAll('[data-hero]')].every(e=>e.querySelector('img').getAttribute('src')===AnimeAssets[AtelierArt.heroPanels[e.dataset.hero]])")
  p.mouse.move(4,4);p.screenshot(path=str(OUT/'heroes-final.png'));p.evaluate('Emberfall.closeModal()')
  ok('The three hero choices use the documented matching anime panels')
  demo(p);inject(p,"g.s.p.board=[];g.s.p.hand=[g.card('wolves')];g.s.p.maxMana=g.s.p.mana=10")
  p.locator('#hand [data-cardid="wolves"]').click();idle(p)
  assert has(p,'spiritwolf') and p.locator('.minion.friendly[data-cardid="spiritwolf"]').count()==2
  ok('Playing the wolves spell summons two visible anime spirit-wolf tokens')
  demo(p);inject(p,"g.s.p.board=[];g.s.p.hand=[g.card('necromancer')];g.s.p.maxMana=g.s.p.mana=10")
  p.locator('#hand [data-cardid="necromancer"]').click();idle(p)
  assert has(p,'skeleton') and has(p,'necromancer')
  ok('Necromancer battlecry displays the new skeleton tokens and its own artwork')
  demo(p);inject(p,"g.s.p.hand=[g.card('polymorph')];g.s.p.maxMana=g.s.p.mana=10")
  p.locator('#hand [data-cardid="polymorph"]').click();p.locator('.minion.enemy[data-cardid="golem"]').click();idle(p)
  assert has(p,'sheep','e')
  ok('Transforming an enemy replaces the portrait with the new sheep illustration')
  demo(p);inject(p,"g.s.p.board=[];g.s.p.hand=[];g.s.p.maxMana=g.s.p.mana=10;g.s.heroId='paladin';g.s.p.powerUsed=false")
  p.locator('#power-btn').click();idle(p);assert has(p,'recruit')
  ok('The paladin hero power uses the new recruit artwork')
  # Actual deathrattle events from controlled legal combat fixtures.
  for cid,token in [('wolf','pup'),('titan','stone')]:
   demo(p);inject(p,f"g.s.p.board=[];g.s.e.board=[];const a=g.summon('p','{cid}',{{sick:false}});a.hp=1;g.summon('e','guard',{{sick:false}})")
   p.locator(f'.minion.friendly[data-cardid="{cid}"]').click();p.locator('.minion.enemy').first.click();idle(p);assert has(p,token)
  ok('Wolf and titan deathrattles reveal the new pup and stone-guard token images')
  demo(p);inject(p,"g.s.e.board=[];g.s.bossIndex=1;g.s.active='e';g.s.e.mana=10;g.s.e.powerUsed=false")
  p.evaluate("Emberfall.showModal('<section class=modal-box>AI paused for a controlled Boss power test</section>','test');Emberfall.game.power('e')")
  idle(p);assert has(p,'thorn','e');p.evaluate('Emberfall.home()')
  ok('The Thorn Queen power creates the new thorn token through actual rule events')
  demo(p);inject(p,"g.s.p.hand=[g.card('coin')];g.s.p.mana=5;g.s.p.maxMana=6")
  assert p.locator('#hand [data-cardid="coin"] img').get_attribute('src')==p.evaluate('AnimeAssets.coin')
  p.locator('#hand [data-cardid="coin"]').click();idle(p);assert p.evaluate('Emberfall.game.s.p.mana===6')
  ok('The eighth token, ether coin, uses its new art and still grants one mana')
  # Each Boss switches to a thematic anime image; no new Boss art is invented.
  for i in range(5):
   demo(p);inject(p,f'g.s.bossIndex={i}')
   assert p.evaluate("document.querySelector('#enemy-hero img').getAttribute('src')===AnimeAssets[AtelierArt.bossPanels[EmberData.bosses[Emberfall.game.s.bossIndex].id]]")
  ok('All five Boss portrait routes use their explicit new-art aliases')
  c.close();c,p=boot(b,390,844,True);demo(p)
  before=p.evaluate('JSON.stringify(Emberfall.game.s)');p.locator('#hand [data-cardid="phoenix"]').tap()
  p.locator('.anime-art-button').tap();p.wait_for_timeout(100)
  assert p.locator('.anime-viewer img').get_attribute('src')==p.evaluate('AnimeAssets.phoenix')
  assert p.evaluate('JSON.stringify(Emberfall.game.s)')==before
  p.screenshot(path=str(OUT/'art-viewer-final.png'))
  p.locator('.anime-viewer button').tap();assert p.evaluate("Emberfall.modal==='touch-card'")
  assert p.locator('.anime-art-button').evaluate('e=>document.activeElement===e')
  ok('Mobile full-art viewing preserves the battle and restores focus to the card sheet')
  p.locator('.anime-art-button').tap();p.keyboard.press('Escape');assert p.locator('.anime-viewer').count()==0 and p.evaluate("Emberfall.modal==='touch-card'")
  p.locator('.anime-art-button').tap();p.set_viewport_size({'width':844,'height':390});p.wait_for_timeout(180)
  assert p.locator('.anime-viewer').count()==0 and p.evaluate('JSON.stringify(Emberfall.game.s)')==before
  ok('Escape and device rotation close the art viewer without dismissing or spending the card')
  p.locator('#touch-card-cancel').tap();p.wait_for_timeout(3200);p.screenshot(path=str(OUT/'landscape-final.png'))
  p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(250);p.screenshot(path=str(OUT/'portrait-final.png'))
  c.close();assert not images,images;assert not errors,errors
  ok('No external image fetches or JavaScript page errors in the executed integration checks')
 except Exception as e:
  try:p.screenshot(path=str(OUT/'integration-failure.png'))
  except:pass
  (OUT/'integration-results.json').write_text(json.dumps({'status':'failed','checks':checks,'errors':errors,'exception':str(e)},ensure_ascii=False,indent=2));traceback.print_exc();b.close();sys.exit(1)
 b.close()
(OUT/'integration-results.json').write_text(json.dumps({'status':'passed','count':len(checks),'checks':checks,'decoded':decoded,'errors':errors,'imageRequests':images,'testedHTMLsha256':hashlib.sha256(HTML.encode()).hexdigest(),'mode':'Chromium desktop + native touch emulation; fixture-based token events; no public deployment or physical-device claim'},ensure_ascii=False,indent=2))
print('DONE',len(checks),'integration checks')
