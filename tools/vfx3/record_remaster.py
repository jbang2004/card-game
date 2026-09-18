"""Capture deterministic actual-game R9 replay, with the same pose tracks.
The later mux uses runtime PCM at cue timestamps. No generative image substitution.
"""
from pathlib import Path
import json,math,sys,time,os
from playwright.sync_api import sync_playwright
from verify_benchmarks import launch,load
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/remaster-r9/recording';OUT.mkdir(parents=True,exist_ok=True)
ROLES=[('archer','弓矢 · 穿心'),('wolf','裂爪 · 撕袭'),('berserker','重刃 · 崩击'),('huntress','投枪 · 贯日'),('fireball','陨火 · 爆燃'),('frostbolt','霜棱 · 贯刺'),('nova','霜原 · 盛放'),('silence','虚空 · 蚀灭'),('lifedrain','血契 · 回流'),('renew','生息 · 回复'),('shield','光壁 · 凝盾'),('blessing','战意 · 赋能'),('wisdom','星构 · 解印'),('wolves','灵门 · 显现'),('demise','余魂 · 离散')]
def main():
 report={'fps':30,'clips':[],'errors':[],'origin':'in-memory','claim_real_fps':False,'audio':'runtime PCM mixed offline at identical cue deadlines','visual':'real post-action replay, card values are already resolved'}
 with sync_playwright() as pw:
  b=launch(pw);p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:report['errors'].append(str(e)));load(p)
  for role,label in ROLES:
   assert p.evaluate('r=>VFXLab.cast(r)',role),role
   group=p.evaluate('EmberFx2.mesh3d.lastGroup');d=p.evaluate('EmberFx2.mesh3d.lastUtility' if role=='demise' else 'EmberFx2.mesh3d.last')
   duration=p.evaluate('VFXLab.duration')/1000+.10;n=math.ceil(duration*30)
   folder=OUT/role;folder.mkdir(exist_ok=True)
   p.evaluate('VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause())')
   for i in range(n):
    p.evaluate('ms=>VFXLab.seek(ms)',i/30*1000)
    p.screenshot(path=str(folder/f'{i:05d}.jpg'),type='jpeg',quality=87)
   report['clips'].append({'role':role,'label':label,'descriptor':d,'group':group,'duration':duration,'frames':n,'folder':str(folder)})
   (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('Recorded',role,n,'frames',flush=True)
  b.close()
 if report['errors']:raise RuntimeError(report['errors'])
if __name__=='__main__':main()
