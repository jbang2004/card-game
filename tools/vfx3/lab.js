/* Export-only inspection tools. Not registered in the production game build.
 * This uses a disposable quick-demo battle, never the player's saved campaign.
 */
(async function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let n=0;n<400&&!(window.Emberfall&&typeof EmberDebug!=='undefined');n++)await wait(50);
if(typeof EmberDebug==='undefined')return;
Emberfall.demo();
for(let n=0;n<600&&(!EmberFx2.renderer3dAvailable||EmberFX.busy);n++)await wait(50);
if(!EmberFx2.renderer3dAvailable){alert('三维特效初始化失败，请使用支持 WebGL 的浏览器。');return;}
EmberDebug.game.aiStep=()=>({ok:true});
const names={breath:'焰龙 · 灼息',lightning:'星火 · 闪电',slash:'天剑 · 裂地'};
const css=document.createElement('style');css.textContent=`
#vfxlab{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9000;width:min(610px,calc(100vw - 28px));box-sizing:border-box;padding:13px 17px 12px;background:linear-gradient(145deg,#15262bef,#0b141cef);backdrop-filter:blur(15px);border:1px solid #8ba7b64d;border-radius:10px;color:#dfebf1;box-shadow:0 12px 50px #0008;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}
#vfxlab *{box-sizing:border-box}#vfxlab header{display:flex;gap:12px;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:1px;color:#96b0bc;margin-bottom:10px}#vfxlab strong{font-weight:500;color:#e4dcc1;letter-spacing:1.3px}#vfxlab .skills{display:flex;gap:7px}#vfxlab button,#vfxlab select{border:1px solid #779ba63d;background:#263944;color:#dce8ef;border-radius:5px;padding:9px 10px;font:inherit;cursor:pointer;min-height:34px}#vfxlab button:hover{border-color:#bad3d9}#vfxlab .skills button{flex:1}#vfxlab button.active{background:#456273;border-color:#afc8cf;color:#fff}#vfxlab button:disabled{opacity:.4;cursor:wait}#vfxlab .row{display:flex;align-items:center;gap:9px;margin-top:9px}#vfxlab .row button{padding:5px 9px;min-width:35px}#vfxlab input[type=range]{flex:1;min-width:35px;accent-color:#adc4d5}#vfxlab .readout{font-variant-numeric:tabular-nums;min-width:44px;font-size:10px;color:#b2c9d6}#vfxlab .note{font-size:10px;color:#879da7;margin:8px 0 0;line-height:1.5}#vfxlab button.close{padding:2px 6px;min-height:22px;font-size:10px;background:transparent}#lab-title{position:fixed;right:27px;top:123px;z-index:8000;text-align:right;pointer-events:none;color:#dfebef;text-shadow:0 2px 6px #0008;font-family:Georgia,'Songti SC',serif;font-size:23px;letter-spacing:2px}#lab-title small{display:block;font:9px -apple-system,sans-serif;letter-spacing:2px;color:#9dbbce;margin-top:7px}@media(max-width:760px){#vfxlab{bottom:8px;padding:10px;width:calc(100vw - 18px)}#vfxlab header{font-size:9px;margin-bottom:7px}#vfxlab button{font-size:11px;padding:8px 6px}#vfxlab .note{font-size:9px}#lab-title{top:72px;right:15px;font-size:16px}}`;
document.head.append(css);
const title=document.createElement('div');title.id='lab-title';document.body.append(title);
const bar=document.createElement('section');bar.id='vfxlab';bar.innerHTML=`<header><strong>EMBERFALL / R4 · ORIGINAL FLAME</strong><span id="lab-mode">真实对局 · 独立练习</span><button class="close" id="lab-close">收起 ×</button></header><div class="skills">${Object.entries(names).map(([k,v])=>`<button data-fx="${k}">${v}</button>`).join('')}</div><div class="row"><button id="lab-play" title="重播上一次的特效，不重复结算伤害">▶</button><button id="lab-step" title="逐帧">▸│</button><input id="lab-time" type="range" value="0" min="0" max="1000" step="1" aria-label="特效时间轴"><span class="readout" id="lab-readout">0.00s</span><select id="lab-speed" aria-label="慢放速度"><option value="1" selected>1×</option><option value=".5">½×</option><option value=".25">¼×</option></select><button id="lab-cycle">连播</button></div><p class="note">R4：原版火焰直接移植，保留二维龙卡。上排执行真实攻击；时间轴只回看特效，不重复扣血。</p>`;
document.body.append(bar);
const $=id=>document.getElementById(id);let selected='breath',running=false,inspecting=false,t=0,lastFrame=0,duration=1000,generation=0,sequence=false;
function fixture(kind){
 EmberFX.cancel(true);EmberFx2.mesh3d.resume();const g=EmberDebug.game;
 g.s.p.board=[];g.s.e.board=[];g.s.p.hand=[];g.s.p.mana=g.s.p.maxMana=10;g.s.active='p';g.s.phase='battle';g.s.e.secrets=[];
 for(let i=0;i<3;i++)g.summon('e','treant');
 for(const id of kind==='breath'?['dragon','guard','oracle']:['squire','archer','guard'])g.summon('p',id,{sick:false});
 for(const u of g.s.e.board)u.hp=u.maxHp=30;
 if(kind==='lightning')g.s.p.hand=[g.card('bolt')];
 g.events=[];g.emit();
}
function ui(){
 $('lab-time').max=duration;$('lab-time').value=t;$('lab-readout').textContent=(t/1000).toFixed(2)+'s';$('lab-play').textContent=running?'Ⅱ':'▶';
}
function stop(){generation++;running=false;sequence=false;inspecting=false;}
async function cast(kind,cycle=false){
 const gen=++generation;running=false;inspecting=false;selected=kind;sequence=cycle;
 bar.querySelectorAll('[data-fx]').forEach(b=>b.classList.toggle('active',b.dataset.fx===kind));
 title.innerHTML=names[kind]+`<small>LIVE GAME / REAL-TIME MESH VFX</small>`;$('lab-mode').textContent='真实攻击 · 规则结算';
 fixture(kind);const g=EmberDebug.game;const before=EmberFx2.mesh3d.trace.length;
 Emberfall.act(()=>g.dispatch(kind==='lightning'?{type:'play',side:'p',uid:g.s.p.hand[0].uid,target:{side:'e',uid:g.s.e.board[2].uid}}:{type:'attack',side:'p',uid:g.s.p.board[0].uid,target:{side:'e',uid:g.s.e.board[2].uid}}));
 for(let i=0;i<160;i++){await wait(25);if(gen!==generation)return false;if(EmberFx2.mesh3d.trace.length>before&&!EmberFX.busy)break;}
 if(gen!==generation)return false;
 const d=EmberFx2.mesh3d.last;if(!d)return false;duration=d.impact-d.start+d.tail;t=duration;ui();
 if(cycle){await wait(850);if(gen===generation){const ks=Object.keys(names),n=ks.indexOf(kind)+1;if(n<ks.length)return cast(ks[n],true);sequence=false;}}
 return true;
}
function seek(ms){running=false;EmberFX.cancel(true);inspecting=true;t=Math.max(0,Math.min(duration,Number(ms)||0));EmberFx2.mesh3d.replay(t);$('lab-mode').textContent='逐帧回看 · 不重复结算';ui();}
function play(){
 if(!EmberFx2.mesh3d.last)return cast(selected);if(running){running=false;ui();return;}
 generation++;sequence=false;EmberFX.cancel(true);inspecting=true;if(t>=duration)t=0;running=true;lastFrame=performance.now();$('lab-mode').textContent='慢放回看 · 仅特效轨';ui();
}
function tick(now){if(running){t=Math.min(duration,t+Math.min(80,now-lastFrame)*Number($('lab-speed').value));EmberFx2.mesh3d.replay(t);if(t>=duration)running=false;ui();}lastFrame=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
bar.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>cast(b.dataset.fx));$('lab-play').onclick=play;$('lab-step').onclick=()=>seek(t+1000/60);$('lab-time').oninput=e=>seek(e.target.value);$('lab-cycle').onclick=()=>cast('breath',true);
$('lab-close').onclick=()=>{stop();EmberFX.cancel(true);bar.remove();title.remove();Emberfall.demo();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;ui();}});
window.VFXLab={cast,seek,play,fixture,stop,get duration(){return duration},get selected(){return selected},snapshot:()=>({selected,t,duration,running,inspecting,mesh:EmberFx2.mesh3d.diagnostics()}),hide:v=>{bar.hidden=!!v;title.hidden=!!v;}};
fixture('breath');title.innerHTML='R4 · 原版焰流<small>ORIGINAL FLAME / 2D DRAGON CARD</small>';ui();
})();
