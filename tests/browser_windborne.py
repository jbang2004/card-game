"""v0.7 integration: real controls + visual material contracts. Uses native touch
emulation and explicit in-memory storage. No physical-device or WebGL claims."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import json,hashlib,shutil,traceback,sys
R=Path(__file__).resolve().parents[1];O=R/'tests/windborne';HTML=(R/'index.html').read_text();checks=[];errors=[];requests=[]
def ok(s):checks.append(s);print('PASS',len(checks),s,flush=True)
def idle(p):p.wait_for_function('!EmberFX.busy',timeout=15000);p.wait_for_timeout(80)
def demo(p):p.evaluate('Emberfall.demo()');idle(p)
def snap(p):return p.evaluate('JSON.stringify(Emberfall.game.s)')
def boot(b,w,h,touch=False):
 c=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch);p=c.new_page();p.set_default_timeout(6500)
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url) if r.url.startswith('http') and r.resource_type in ['image','font'] else None)
 p.route('https://**/*',lambda r:r.abort())
 p.evaluate("window.__storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}})")
 p.set_content(HTML,wait_until='domcontentloaded');p.wait_for_function('!AtelierWorld.loading');p.wait_for_timeout(300);return c,p
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  c,p=boot(b,1600,940)
  decoded=p.evaluate("""async()=>{const a=[];for(const [key,src] of Object.entries(WindborneAssets)){const i=new Image();i.src=src;await i.decode();a.push({key,w:i.naturalWidth,h:i.naturalHeight})}return a}""")
  assert len(decoded)==9 and all(x['w'] for x in decoded);ok('All nine embedded world/material assets decode, without remote image loads')
  assert p.evaluate("['brewery','observatory','mine','forge'].every(k=>AtelierAssets['building-'+k]===WindborneAssets['building-'+k])")
  assert p.evaluate("async()=>{const i=new Image();i.src=PremiumAssets.board;await i.decode();return i.naturalWidth>=1500&&i.naturalHeight>=1000}")
  ok('Continuous premium board decodes; four historical architecture assets remain archived')
  assert p.evaluate('EmberData.cards.every(c=>EmberArt.card(c)===AnimeAssets[c.id])')
  ok('All 56 card illustrations retain their existing approved image routes')
  before=snap(p);p.locator('#atelier-open').click();p.wait_for_timeout(200)
  assert p.locator('.atelier-vignette').count()==4 and p.evaluate("[...document.querySelectorAll('.atelier-vignette img')].every(i=>i.naturalWidth>0)")
  assert '原画档案' in p.locator('.atelier-box h2').inner_text();p.locator('#atelier-done').click();assert snap(p)==before
  ok('Historical art archive displays four originals, closes cleanly and leaves progression untouched')
  demo(p);before=snap(p);p.locator('#wind-time').click();p.wait_for_timeout(110)
  assert p.evaluate("AtelierWorld.dusk && document.body.classList.contains('world-dusk')") and snap(p)==before
  assert p.locator('#wind-time').get_attribute('aria-pressed')=='true';p.locator('#wind-time').click();assert snap(p)==before
  ok('Day/dusk switching changes visual state and aria state, never battle state or RNG')
  for key in ['chimney','crystals','tree','forge']:
   before=snap(p);p.locator(f'[data-prop="{key}"]').click();p.wait_for_timeout(410);assert snap(p)==before
   assert p.locator('#prop-tooltip').is_visible()
  p.evaluate('EmberFX.cancel()');ok('All four relocated scenery hotspots give feedback without consuming cards or mana')
  p.evaluate('Emberfall.showLibrary()');p.wait_for_timeout(240)
  assert p.locator('.library-item').count()==48
  faults=p.evaluate("""()=>[...document.querySelectorAll('.library-item .card-art')].filter(e=>{const r=e.getBoundingClientRect(),i=e.querySelector('img').getBoundingClientRect();return i.x>r.x+2.2||i.y>r.y+2.2||i.right<r.right-2.2||i.bottom<r.bottom-2.2}).map(e=>e.closest('[data-add]').dataset.add)""")
  assert not faults,faults
  assert p.evaluate("getComputedStyle(document.querySelector('.library-item .card')).backgroundImage.includes('linear-gradient')")
  p.evaluate('Emberfall.closeModal()');ok('All 48 collectible pictures cover the new matte frames; rule text remains live')
  demo(p);p.locator('#hand [data-cardid="frostbolt"]').click();p.locator('.minion.enemy[data-cardid="golem"]').click()
  before=snap(p);assert p.evaluate('EmberFX.busy');p.locator('#wind-time').click();assert snap(p)==before;idle(p)
  assert p.locator('.minion.enemy.frozen').count()==1 and p.evaluate('Emberfall.game.s.p.mana===4')
  p.locator('#wind-time').click();ok('Palette changes mid-spell do not cancel the result, freeze an input lock or spend twice')
  p.locator('.minion.friendly[data-cardid="guard"]').click();p.locator('.minion.enemy[data-cardid="golem"]').click();idle(p)
  assert p.evaluate('Emberfall.game.s.e.board.length===2 && Emberfall.game.s.p.board[0].hp===1')
  ok('Real desktop melee retains simultaneous damage, target removal and animation cleanup')
  demo(p);p.locator('#settings-btn').click();p.locator('[data-setting="reduced"]').click()
  assert p.locator('.wind-time-setting').is_visible();p.locator('.wind-time-setting').click();p.locator('#settings-done').click()
  assert p.evaluate('AtelierWorld.dusk && EmberFX.particles===0');p.wait_for_timeout(250)
  p.screenshot(path=str(O/'reduced-dusk.png'));ok('Reduced motion retains a static illuminated world and the new time-of-day setting')
  c.close();c,p=boot(b,390,844,True);demo(p)
  p.locator('#hand [data-cardid="frostbolt"]').tap();assert p.locator('.touch-rule').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=15
  p.locator('#touch-card-play').tap();p.locator('.minion.enemy[data-cardid="golem"]').tap();idle(p)
  assert p.locator('.minion.enemy.frozen').count()==1;ok('Portrait touch-confirmed casting stays readable and hits the right target with the new UI')
  before=snap(p);p.set_viewport_size({'width':844,'height':390});p.wait_for_timeout(200);assert snap(p)==before
  for sel in ['#end-turn','#power-btn','#player-hero','#enemy-hero']:
   r=p.locator(sel).bounding_box();assert r and r['x']>=-1 and r['y']>=-1 and r['x']+r['width']<=845 and r['y']+r['height']<=391,(sel,r)
  ok('Landscape rotation retains the same match and keeps all primary controls on screen')
  p.evaluate('Emberfall.showSettings()');p.locator('.wind-time-setting').tap();p.locator('#settings-done').tap();assert snap(p)==before and p.evaluate('AtelierWorld.dusk')
  ok('Phone-native day/dusk control remains reachable through settings without toolbar crowding')
  c.close();assert not errors,errors;assert not requests,requests;ok('No JavaScript page errors or remote image/font requests in this integration run')
 except Exception as e:
  try:p.screenshot(path=str(O/'failure.png'))
  except:pass
  (O/'integration.json').write_text(json.dumps({'status':'failed','checks':checks,'errors':errors,'exception':str(e)},ensure_ascii=False,indent=2));traceback.print_exc();b.close();sys.exit(1)
 b.close()
(O/'integration.json').write_text(json.dumps({'status':'passed','count':len(checks),'checks':checks,'assets':decoded,'errors':errors,'requests':requests,'testedHTMLsha256':hashlib.sha256(HTML.encode()).hexdigest(),'mode':'Chromium desktop and native touch emulation; explicit memory storage; offline Canvas'},ensure_ascii=False,indent=2))
print('DONE',len(checks),'checks')
