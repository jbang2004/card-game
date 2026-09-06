"""Attempt actual HTTP and file navigation; record restrictions without bypasses."""
from pathlib import Path
import os
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json,shutil,urllib.request
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
with urllib.request.urlopen(base,timeout=5) as response:
 http_status=response.status;http_bytes=len(response.read())
result={'publicDeployment':False,'server':'temporary local static server','httpResponse':http_status,'servedHTMLBytes':http_bytes,'browser':{}}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,url in [('http',base),('file',(ROOT/'index.html').as_uri())]:
  pg=b.new_page();pg.set_default_timeout(6000)
  try:
   pg.goto(url,wait_until='domcontentloaded');pg.wait_for_function('typeof Emberfall!=="undefined"')
   pg.evaluate('localStorage.setItem("emberfall.test.probe","ok")');pg.reload(wait_until='domcontentloaded')
   result['browser'][name]={'navigation':'passed','persistence':pg.evaluate('localStorage.getItem("emberfall.test.probe")==="ok"')}
   pg.evaluate('localStorage.removeItem("emberfall.test.probe")')
  except Exception as e:result['browser'][name]={'navigation':'blocked or failed','error':str(e).split('Call log:')[0].strip()}
  pg.close()
 b.close()
server.shutdown()
(ROOT/'tests/anime/origin-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
