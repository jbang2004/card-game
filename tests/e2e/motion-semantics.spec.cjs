const {test,expect}=require('@playwright/test');
const path=require('node:path');
const output=path.resolve('artifacts/animation-improvement-20260919');
async function demo(page,query=''){await page.goto('./?debug=1'+query);await page.waitForFunction(()=>window.Emberfall&&!AtelierWorld.loading);await page.locator('#quick-btn').click();await page.waitForFunction(()=>!EmberFX.busy);}
async function prime(page,{cid='guard',full=false,hand=false}={}){return page.evaluate(({cid,full,hand})=>{
 EmberFX.cancel(true);const g=EmberDebug.game;g.aiStep=()=>({ok:true});g.s.active='p';g.s.phase='battle';g.s.p.board=[];g.s.e.board=[];g.s.p.hand=[];g.s.p.mana=g.s.p.maxMana=10;g.s.p.hp=g.s.e.hp=30;g.s.e.armor=0;g.s.e.secrets=[];
 for(let i=0;i<(full?7:2);i++){g.summon('p',i?'archer':cid,{sick:false});g.summon('e','treant');}
 if(hand)g.s.p.hand=Array.from({length:10},(_,i)=>g.card(i%2?'guard':'fireball'));
 g.events=[];g.emit();return JSON.stringify(g.s);
},{cid,full,hand});}
for(const [name,viewport]of [['large',{width:1920,height:1080}],['portrait',{width:390,height:844}],['landscape',{width:844,height:390}],['compact',{width:568,height:320}]]){
 test(`first-load mesh and full-board readability: ${name}`,async({browser})=>{
  const context=await browser.newContext({viewport,isMobile:name!=='large',hasTouch:name!=='large'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // The attacker is a blade card on a battlefield without figures (?figures=0 — as when WebGL fails or motion is
  // reduced): a card with a battlefield figure attacks through the figure instead of the fx2 mesh (BATTLE_PRESENTATION_V2
  // R13), every blade card has one now, and this case covers the fx2 mesh's first load.
  await demo(page,'&figures=0');await prime(page,{cid:'recruit',full:true,hand:true});
  // No quality reset or inspection tool: this is the original initialisation path.
  await expect(page.locator('#fx-3d')).toBeVisible();
  const canvas=await page.locator('#fx-3d').boundingBox();expect(canvas.width).toBeGreaterThan(300);expect(canvas.height).toBeGreaterThan(250);
  const covered=await page.locator('#battle .minion .stat-value').evaluateAll(nodes=>nodes.filter(n=>{
   const r=n.getBoundingClientRect(),owner=n.closest('.minion');
   return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.minion')!==owner;
  }).map(n=>({uid:n.closest('.minion').dataset.uid,stat:n.parentElement.className})));
  expect(covered).toEqual([]);
  await page.screenshot({path:path.join(output,name+'-full-board.png')});
  const report=await page.evaluate(async()=>{
   const g=EmberDebug.game,start=performance.now(),result=Emberfall.act(()=>g.dispatch({type:'attack',side:'p',uid:g.s.p.board[0].uid,target:{side:'e',uid:g.s.e.board[0].uid}}));
   if(!result.ok)throw Error(result.error);const state=JSON.stringify(g.s);
   await new Promise((resolve,reject)=>{const deadline=performance.now()+4000;function sample(){if(document.querySelector('.damage-number'))return resolve();if(performance.now()>deadline)return reject(Error('no contact'));requestAnimationFrame(sample);}sample();});
   const attack=EmberFX.trace.find(r=>r.type==='attack'&&r.at>=start),d=EmberFx2.mesh3d.last;
   return{state,delta:Math.abs(d.impact-attack.hitAt[0]),outcome:d.outcome,frames:EmberFx2.mesh3d.stats.frames};
  });
  expect(report.delta).toBeLessThan(1);expect(report.frames).toBeGreaterThan(0);expect(report.outcome.kind).toBe('damage');
  if(name!=='large')expect(await page.locator('.damage-number').first().evaluate(el=>parseFloat(getComputedStyle(el).width))).toBeLessThanOrEqual(64);
  await page.screenshot({path:path.join(output,name+'-live-contact.png')});await page.waitForFunction(()=>!EmberFX.busy&&EmberFx2.mesh3d.stats.active===0);
  expect(await page.evaluate(()=>JSON.stringify(EmberDebug.game.s))).toBe(report.state);
  expect(await page.evaluate(()=>[EmberFx2.benchmarkFeedback.active,EmberFx2.remasterFeedback.active])).toEqual([0,0]);
  if(name==='portrait'){
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(180);expect(await page.evaluate(()=>JSON.stringify(EmberDebug.game.s))).toBe(report.state);
   await page.screenshot({path:path.join(output,'rotation-same-battle.png')});
  }
  expect(errors).toEqual([]);await context.close();
 });
}
test('reduced motion retains outcomes without displacement, including death and reflow',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();await demo(page);await prime(page,{cid:'frostking',full:true});
 const report=await page.evaluate(async()=>{
  const g=EmberDebug.game;g.s.e.board[0].hp=1;g.events=[];g.emit();const out=Emberfall.act(()=>g.dispatch({type:'attack',side:'p',uid:g.s.p.board[0].uid,target:{side:'e',uid:g.s.e.board[0].uid}}));if(!out.ok)throw Error(out.error);
  const state=JSON.stringify(g.s),bad=[];let sawNumber=false;
  do{await new Promise(r=>requestAnimationFrame(r));sawNumber ||= !!document.querySelector('.damage-number');
   for(const a of document.getAnimations())if(a.playState==='running'&&a.effect?.target?.matches?.('.minion,.attack-actor,.card-motion-proxy,.hero-card-inner')&&a.effect.getKeyframes().some(k=>k.transform||k.translate||k.scale))bad.push(a.effect.target.className);
  }while(EmberFX.busy);
  return{state,bad,sawNumber,actors:document.querySelectorAll('.attack-actor').length,mesh:EmberFx2.mesh3d.stats.active};
 });
 expect(report.bad).toEqual([]);expect(report.sawNumber).toBe(true);expect(report.actors).toBe(0);expect(report.mesh).toBe(0);expect(await page.evaluate(()=>JSON.stringify(EmberDebug.game.s))).toBe(report.state);
 await page.screenshot({path:path.join(output,'portrait-reduced.png')});await context.close();
});
test('mixed pose families and cancelled tails restore inline styles',async({page})=>{
 await demo(page);await prime(page);const report=await page.evaluate(async()=>{
  const g=EmberDebug.game,source={side:'p',uid:g.s.p.board[0].uid},target={side:'e',uid:g.s.e.board[0].uid};
  const el=document.querySelector(`[data-uid="${target.uid}"].minion`),baseline={transform:el.style.transform,filter:el.style.filter},now=performance.now();
  const box=ref=>{const n=document.querySelector(`[data-uid="${ref.uid}"].minion`),b=n.getBoundingClientRect(),a=document.getElementById('app').getBoundingClientRect(),sx=EmberViewport.width/a.width,sy=EmberViewport.height/a.height;return{x:(b.x+b.width/2-a.x)*sx,y:(b.y+b.height/2-a.y)*sy,w:b.width*sx,h:b.height*sy};};
  const opts={from:box(source),to:box(target),sourceRef:source,targetRef:target,startedAt:now-300,contactAt:now-30,sequenceId:9001,outcome:{kind:'damage'},tier:2};
  EmberFx2.mesh3d.emit('slash',{...opts,swordStyle:'frost'});EmberFx2.mesh3d.emit('fireball',opts);
  await new Promise(r=>requestAnimationFrame(r));const owned=EmberFx2.benchmarkFeedback.active+EmberFx2.remasterFeedback.active;
  EmberFx2.beginSequence(9002);await new Promise(r=>setTimeout(r,220));
  return{baseline,final:{transform:el.style.transform,filter:el.style.filter},owned,active:EmberFx2.mesh3d.stats.active};
 });expect(report.owned).toBeGreaterThan(0);expect(report.final).toEqual(report.baseline);expect(report.active).toBe(0);
});
