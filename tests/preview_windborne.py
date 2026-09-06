from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import shutil,json
R=Path(__file__).resolve().parents[1];O=R/'tests/windborne';O.mkdir(exist_ok=True)
html=(R/'index.html').read_text();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for tag,w,h,mobile in [('desktop',1600,940,False),('portrait',390,844,True),('landscape',844,390,True)]:
  ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);p=ctx.new_page();p.set_default_timeout(8000)
  p.on('pageerror',lambda e:errors.append(str(e)));p.route('https://**/*',lambda r:r.abort())
  p.evaluate("window.__storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}})")
  p.set_content(html,wait_until='domcontentloaded');p.wait_for_function('!AtelierWorld.loading');p.wait_for_timeout(500)
  p.mouse.move(4,4);p.screenshot(path=str(O/(tag+'-lobby.png')))
  if not mobile:
   p.locator('#start-btn').click();p.wait_for_timeout(250);p.mouse.move(4,4);p.screenshot(path=str(O/'heroes.png'));p.evaluate('Emberfall.closeModal()')
   p.evaluate('Emberfall.showAtelier()');p.wait_for_timeout(300);p.mouse.move(4,4);p.screenshot(path=str(O/'workshop.png'));p.evaluate('Emberfall.closeModal()')
  p.evaluate('Emberfall.demo()');p.wait_for_function('!EmberFX.busy');p.wait_for_timeout(3300);p.mouse.move(4,4);p.screenshot(path=str(O/(tag+'-battle.png')))
  if not mobile:
   p.evaluate('Emberfall.toggleWorldTime()');p.wait_for_timeout(150);p.screenshot(path=str(O/'desktop-dusk.png'));p.evaluate('Emberfall.toggleWorldTime()')
  p.evaluate('Emberfall.showLibrary()');p.wait_for_timeout(300);p.mouse.move(4,4);p.screenshot(path=str(O/(tag+'-library.png')));p.evaluate('Emberfall.closeModal()')
  if mobile:
   p.locator('#hand [data-cardid="frostbolt"]').tap();p.wait_for_timeout(200);p.screenshot(path=str(O/(tag+'-card.png')))
  ctx.close()
 b.close()
(O/'preview-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
print('Errors',errors)
