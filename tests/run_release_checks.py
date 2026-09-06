"""Run the unchanged gameplay regression suite and the new visual integration suite."""
from pathlib import Path
import subprocess,json,hashlib,time,sys
r=Path(__file__).resolve().parents[1];o=r/'tests/windborne';o.mkdir(parents=True,exist_ok=True);out=[]
for name,args in [('engine',['node','--test','tests/engine.test.cjs']),('card-assets',['node','--test','tests/anime_assets.test.cjs']),('pocket',[sys.executable,'tests/browser_pocket.py']),('pocket-extra',[sys.executable,'tests/pocket_additional.py']),('anime',[sys.executable,'tests/browser_anime.py']),('world',[sys.executable,'tests/browser_windborne.py'])]:
 t=time.time()
 with (o/(name+'-release.log')).open('w') as log:
  try:p=subprocess.run(args,cwd=r,stdout=log,stderr=subprocess.STDOUT,timeout=240);code=p.returncode
  except subprocess.TimeoutExpired:code=124
 out.append({'suite':name,'exitCode':code,'seconds':round(time.time()-t,2)})
 (o/'suite-status.json').write_text(json.dumps(out,indent=2))
 if code:sys.exit(code)
(o/'release-sha.json').write_text(json.dumps({'sha256':hashlib.sha256((r/'index.html').read_bytes()).hexdigest(),'suites':out},indent=2))
