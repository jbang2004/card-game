"""Produce real browser preview screenshots. No public deployment involved."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import shutil,json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'tests/anime';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 errors=[]
 for w,h,touch,label in [(1600,940,False,'desktop'),(390,844,True,'portrait'),(844,390,True,'landscape')]:
  ctx=b.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch)
  page=ctx.new_page();page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://**/*',lambda r:r.abort())
  page.evaluate("window.__storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}})")
  page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded');page.wait_for_timeout(700)
  page.screenshot(path=str(OUT/f'{label}-lobby.png'))
  page.locator('#start-btn').click();page.wait_for_timeout(300);page.screenshot(path=str(OUT/f'{label}-heroes.png'))
  page.evaluate('Emberfall.closeModal();Emberfall.showLibrary()');page.wait_for_timeout(350)
  page.mouse.move(4,4);page.wait_for_timeout(150);page.screenshot(path=str(OUT/f'{label}-collection.png'))
  page.evaluate('Emberfall.closeModal();Emberfall.demo()');page.wait_for_function('!EmberFX.busy');page.wait_for_timeout(3200)
  if not touch:page.mouse.move(10,45)
  page.screenshot(path=str(OUT/f'{label}-battle.png'))
  if touch:
   page.locator('#hand [data-cardid="phoenix"]').tap();page.wait_for_timeout(160);page.screenshot(path=str(OUT/f'{label}-card.png'))
   page.locator('.anime-art-button').tap();page.wait_for_timeout(100);page.screenshot(path=str(OUT/f'{label}-art.png'))
  print(label,'ready',flush=True);ctx.close()
 (OUT/'preview-errors.json').write_text(json.dumps(errors,indent=2));b.close()
