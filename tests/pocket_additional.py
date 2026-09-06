import hashlib
"""Focused weapon/desktop-drag and responsive lifecycle regressions.
Chromium touch emulation with explicit in-memory localStorage; no physical device claim.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import shutil,json,sys,traceback
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'tests/pocket';HTML=(ROOT/'index.html').read_text()
checks=[];errors=[];page=None

def passed(s):checks.append(s);print('PASS',s,flush=True)
def boot(browser,w,h,touch):
 c=browser.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch);p=c.new_page();p.set_default_timeout(6000);p.on('pageerror',lambda e:errors.append(str(e)));p.route('https://**/*',lambda r:r.abort())
 p.evaluate("window.__storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}})")
 p.set_content(HTML,wait_until='domcontentloaded');p.wait_for_timeout(400);return c,p

def idle(p):p.wait_for_function('!EmberFX.busy',timeout=20000);p.wait_for_timeout(120)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  c,page=boot(b,390,844,True);page.locator('#quick-btn').tap();idle(page)
  page.locator('#hand [data-cardid="sunblade"]').tap();page.locator('#touch-card-play').tap();idle(page)
  assert page.evaluate("Emberfall.game.s.p.weapon.atk===4 && Emberfall.game.s.p.mana===2")
  for sel in ['#touch-hand-all','#power-btn','#player-hero','#end-turn']:
   assert page.locator(sel).evaluate("e=>{const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#'+e.id)}"),sel
  passed('Equipping a weapon through touch confirmation preserves mana, shows the weapon and leaves hand/hero/skill controls unobscured')
  page.locator('#player-hero').tap();page.locator('#battle .minion.enemy[data-cardid="golem"]').tap();idle(page)
  assert page.evaluate("Emberfall.game.s.p.weapon.durability===1 && Emberfall.game.s.p.hp===28") # 26 starting HP - 2 retaliation + 4 lifesteal
  passed('Touch hero weapon attack targets a legal taunt, applies retaliation/lifesteal and loses exactly one durability')
  page.wait_for_timeout(1900);page.screenshot(path=str(OUT/'portrait-weapon.png'))
  state=page.evaluate('JSON.stringify(Emberfall.game.s)')
  page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(180)
  page.locator('#touch-menu').tap();page.locator('[data-touch-menu="hand"]').tap()
  assert page.locator('.touch-hand-grid button').count()==5
  page.locator('.modal-close').tap();assert page.evaluate('JSON.stringify(Emberfall.game.s)')==state
  passed('Landscape full-hand overview is reachable from the touch menu and does not alter the equipped-weapon match')
  page.set_viewport_size({'width':1600,'height':940});page.wait_for_timeout(300)
  assert not page.evaluate('EmberViewport.mobile')
  assert page.locator('#weapon-slot').evaluate("e=>e.style.left==='' && e.style.top===''")
  assert page.evaluate('JSON.stringify(Emberfall.game.s)')==state
  page.set_viewport_size({'width':320,'height':568});page.wait_for_timeout(200)
  assert page.evaluate('EmberViewport.mobile && EmberViewport.portrait')
  assert page.locator('#power-btn span').evaluate("e=>getComputedStyle(e).display==='none'")
  passed('Switching between native mobile and desktop layouts resets weapon geometry without changing the match; narrow resource rows do not overlap the skill caption')
  c.close()
  c,page=boot(b,1600,940,False);page.locator('#quick-btn').click();idle(page)
  phoenix=page.locator('#hand [data-cardid="phoenix"]');phoenix.hover();page.wait_for_timeout(350)
  r=phoenix.bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']*.32
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(1070,440,steps=12);page.mouse.up();idle(page)
  assert page.evaluate("Emberfall.game.s.p.board.some(m=>m.cid==='phoenix') && Emberfall.game.s.p.mana===2")
  assert page.locator('.drag-ghost').count()==0
  passed('Desktop mouse drag-to-summon still spends the original cost and cleans its drag ghost')
  c.close()
  assert not errors,errors
  (OUT/'additional-results.json').write_text(json.dumps({'status':'passed','testedHTMLsha256':hashlib.sha256(HTML.encode()).hexdigest(),'checks':checks,'count':len(checks),'errors':errors,'input':'Chromium desktop mouse and emulated touch','storage':'explicit memory adapter'},ensure_ascii=False,indent=2))
 except Exception as ex:
  if page and not page.is_closed():page.screenshot(path=str(OUT/'additional-failure.png'))
  (OUT/'additional-results.json').write_text(json.dumps({'status':'failed','checks':checks,'errors':errors,'exception':str(ex)},ensure_ascii=False,indent=2));traceback.print_exc();b.close();sys.exit(1)
 b.close()
