/* ATELIER EDITION. Optional Three.js r160 renderer, calibrated to the 1600 × 940
 * interaction plane. Canvas world + VFX remain independent and fully offline.
 * Geometry is projected from the same screen coordinates as the DOM targets:
 * changing quality never changes card positions or game rules. */
const EmberScene=(()=>{
 'use strict';
 let T,renderer,scene,camera,root,active=false,view='lobby',reduced=false,low=false,last=0,raf=0,theme=0,phase=false;
 const tokens=new Map(),bursts=[],gems=[],rings=[];
 const palette=[0xd49b68,0x92bfa3,0xb197d4,0x8fcadd,0xe5a171];
 function status(s){document.getElementById('engine-status').textContent=s;}
 function material(color,metalness=.3,roughness=.6){return new T.MeshStandardMaterial({color,metalness,roughness});}
 function mesh(geometry,mat,parent=root){const m=new T.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function dispose(o){o.traverse(n=>{n.geometry?.dispose();if(n.material){const mats=Array.isArray(n.material)?n.material:[n.material];for(const m of mats){m.map?.dispose();m.dispose();}}});}
 function world(x,y,h=.18){const p=new T.Vector3(x/800-1,1-y/470,.5).unproject(camera),d=p.sub(camera.position).normalize();return camera.position.clone().add(d.multiplyScalar((h-camera.position.y)/d.y));}
 function slab(points,depth,top,mat,bevel=.022){const shape=new T.Shape();points.forEach(([x,y],i)=>{const p=world(x,y,top);i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z);});shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:!!bevel,bevelSegments:3,bevelSize:bevel,bevelThickness:bevel});const a=g.attributes.position,u=g.attributes.uv;g.computeBoundingBox();const b=g.boundingBox;for(let i=0;i<a.count;i++)u.setXY(i,(a.getX(i)-b.min.x)/(b.max.x-b.min.x),(a.getY(i)-b.min.y)/(b.max.y-b.min.y));const m=mesh(g,mat);m.rotation.x=-Math.PI/2;m.position.y=top-depth;return m;}
 function outline(points,color,opacity=.5,h=.225){const ps=points.map(([x,y])=>world(x,y,h));ps.push(ps[0].clone());const g=new T.BufferGeometry().setFromPoints(ps),m=new T.LineBasicMaterial({color,transparent:true,opacity});const line=new T.Line(g,m);root.add(line);return line;}
 function slate(){
  const c=document.createElement('canvas');c.width=1536;c.height=768;const x=c.getContext('2d');
  const grad=x.createRadialGradient(768,384,0,768,384,870);grad.addColorStop(0,'#e7d7ad');grad.addColorStop(1,'#c5a56b');x.fillStyle=grad;x.fillRect(0,0,c.width,c.height);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
  const img=new Image();img.onload=()=>{x.drawImage(img,0,0,c.width,c.height);t.needsUpdate=true;};img.src=AtelierAssets['table-surface'];
  return t;
 }
 function board(){
  // Same projected contour as the painted Canvas tabletop. Architecture stays
  // in separate painted layers; only central slabs and token bases use WebGL.
  const topPoints=[[238,294],[333,277],[455,250],[580,223],[691,202],[738,186],[800,181],[862,186],[909,202],[1020,223],[1145,250],[1267,277],[1362,294],[1383,320],[1392,372],[1390,532],[1378,583],[1360,605],[1257,630],[1145,658],[1026,684],[919,711],[860,728],[800,733],[740,728],[681,711],[574,684],[455,658],[343,630],[240,605],[220,583],[209,531],[208,375],[217,320]];
  const scaled=(a,sx,sy,dy=0)=>a.map(([x,y])=>[800+(x-800)*sx,457+(y-457)*sy+dy]);
  slab(scaled(topPoints,1.035,1.065,5),.31,-.08,material(0x4e3827,.16,.76),.035);
  slab(scaled(topPoints,1.018,1.033),.12,.09,material(0xb18d53,.45,.47),.024);
  const mat=material(0xffffff,.03,.97);mat.map=slate();mat.bumpMap=mat.map;mat.bumpScale=.005;slab(topPoints,.08,.19,mat,.013);
  outline(topPoints,0xe7c890,.58);outline(scaled(topPoints,.985,.975),0x9a7848,.23);
  outline([[238,433],[1367,433]],0x937348,.22,.235);
  for(const [x,y] of [[326,309],[1277,309],[326,590],[1277,590]]){
    const pos=world(x,y,.23),g=new T.Group();g.position.copy(pos);root.add(g);
    const gem=mesh(new T.OctahedronGeometry(.025),new T.MeshStandardMaterial({color:palette[theme],emissive:palette[theme],emissiveIntensity:.24,metalness:.6,roughness:.3}),g);gem.position.y=.05;gem.scale.y=.35;
    const light=new T.PointLight(palette[theme],.28,1.5,2);light.position.set(0,.4,0);g.add(light);gems.push({gem,light,seed:x+y});
  }
 }
 function sync(s){if(!active||!s)return;const ids=new Set();for(const side of ['p','e'])s[side].board.forEach((m,i)=>{
   ids.add(m.uid);const p=world(800+(i-(s[side].board.length-1)/2)*128,(side==='p'?507:354)+48,.27);let g=tokens.get(m.uid);
   if(!g){g=new T.Group();root.add(g);const metal=material(side==='p'?0xb3a075:0x997458,.76,.32),base=mesh(new T.CylinderGeometry(.5,.56,.08,40),metal,g);base.scale.z=.69;const inset=mesh(new T.CylinderGeometry(.45,.47,.085,40),material(0x695c46,.18,.7),g);inset.position.y=.04;inset.scale.z=.65;const rim=mesh(new T.TorusGeometry(.49,.009,6,48),new T.MeshBasicMaterial({color:side==='p'?0xc2ddc3:0xc28f77,transparent:true,opacity:.6}),g);rim.rotation.x=Math.PI/2;rim.position.y=.1;rim.scale.y=.67;g.position.copy(p);g.userData.rim=rim;tokens.set(m.uid,g);}
   g.userData.dest=p;g.userData.rim.material.opacity=m.sick?.16:m.frozen?.36:.62;g.visible=view==='battle';
  });for(const [id,g]of tokens)if(!ids.has(id)){root.remove(g);dispose(g);tokens.delete(id);}
 }
 function burst(x,y,color=0xe3b58c,count=24){if(!active||reduced||view!=='battle')return;count=Math.min(low?14:42,count);if(bursts.length>12)return;const p=world(x,y,.5),a=new Float32Array(count*3),v=[];for(let i=0;i<count;i++){a.set([p.x,p.y,p.z],i*3);v.push({x:(Math.random()-.5)*3,y:1.2+Math.random()*2,z:(Math.random()-.5)*2});}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(a,3));const points=new T.Points(g,new T.PointsMaterial({color,size:.026,transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending}));root.add(points);bursts.push({points,v,life:.8});}
 function animate(t){raf=requestAnimationFrame(animate);if(document.hidden||EmberViewport.mobile||t-last<(low?40:30))return;const dt=Math.min((t-last)/1000,.05);last=t;root.visible=view==='battle';if(!root.visible){renderer.clear();return;}const time=reduced?0:t/1000;
   for(const g of gems){g.gem.rotation.y=time*.25;g.gem.position.y=.05+Math.sin(time*1.4+g.seed)*.005;g.light.intensity=(phase?.45:.28)*(1+Math.sin(time*5+g.seed)*.08);}
   for(const g of tokens.values())g.position.lerp(g.userData.dest,reduced?1:.24);
   for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.life-=dt;const a=b.points.geometry.attributes.position;for(let j=0;j<b.v.length;j++){const v=b.v[j];v.y-=dt*5;a.setXYZ(j,a.getX(j)+v.x*dt,a.getY(j)+v.y*dt,a.getZ(j)+v.z*dt);}a.needsUpdate=true;b.points.material.opacity=Math.max(0,b.life);if(b.life<=0){root.remove(b.points);b.points.geometry.dispose();b.points.material.dispose();bursts.splice(i,1);}}
   renderer.render(scene,camera);
 }
 function setTheme(i,p=false){theme=i;phase=p;for(const g of gems){g.gem.material.color.setHex(palette[i]||palette[0]);g.gem.material.emissive.setHex(palette[i]||palette[0]);g.light.color.setHex(palette[i]||palette[0]);}for(const r of rings)r.material.color.setHex(palette[i]||palette[0]);}
 function quality(r,l){reduced=!!r;low=!!l;if(renderer){renderer.setPixelRatio(low?1:Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=!low;}}
 function setView(v){view=v;if(root)root.visible=v==='battle';}
 function init(lib){if(active)return;try{
  T=lib;renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setSize(1600,940);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=!low;renderer.shadowMap.type=T.PCFSoftShadowMap;document.getElementById('scene').appendChild(renderer.domElement);
  scene=new T.Scene();camera=new T.PerspectiveCamera(34,1600/940,.1,90);camera.position.set(0,15.8,16.8);camera.lookAt(0,0,.8);camera.updateMatrixWorld(true);root=new T.Group();scene.add(root);
  scene.add(new T.HemisphereLight(0xffe7c2,0x543e24,2.1));const key=new T.DirectionalLight(0xffe6b5,2.1);key.position.set(-6,12,-4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-15,right:15,top:12,bottom:-12});key.shadow.bias=-.001;scene.add(key);const fill=new T.DirectionalLight(0x9ab9de,.85);fill.position.set(6,4,8);scene.add(fill);board();active=true;document.getElementById('app').classList.add('three-ready');status('THREE.JS · 3D 场景');quality(reduced,low);sync(window.Emberfall?.game?.s);animate(0);
 }catch(e){console.warn('3D unavailable; independent Canvas world and combat compositor stay active.',e);cancelAnimationFrame(raf);renderer?.dispose();renderer?.domElement?.remove();if(root)dispose(root);active=false;document.getElementById('app').classList.remove('three-ready');status('2D 兼容模式 · 完整战斗特效');}}
 function load(){if(EmberViewport.mobile){status('触屏布局 · Canvas');return;}if(active)return;status('载入 3D 场景…');const sources=['https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js','https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js'];let index=0;function next(){if(active)return;if(window.THREE){init(window.THREE);return;}if(index>=sources.length){status('2D 兼容模式 · 完整战斗特效');return;}const script=document.createElement('script');script.src=sources[index++];script.async=true;script.crossOrigin='anonymous';let done=false;const finish=()=>{if(done||active)return;done=true;clearTimeout(timer);if(window.THREE)init(window.THREE);else next();};const timer=setTimeout(finish,5500);script.onload=finish;script.onerror=finish;document.head.appendChild(script);}next();}
 return{load,init,sync,burst,setView,setTheme,quality,get active(){return active;}};
})();

/* Procedural layered audio: transient, body and tail have separate envelopes.
 * A shared convolution send keeps nodes bounded. Audio starts on user gesture,
 * never on loading the page. Volume is deliberately restrained. */
const EmberAudio=(()=>{
 let ctx,master,dry,wet,convolver,noiseBuffer,enabled=true,started=false;
 const played={};
 function init(){if(started)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;ctx=new C();master=ctx.createGain();master.gain.value=enabled?.38:0;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=18;limiter.ratio.value=4;limiter.attack.value=.004;limiter.release.value=.18;master.connect(limiter);limiter.connect(ctx.destination);dry=ctx.createGain();dry.gain.value=1;dry.connect(master);wet=ctx.createGain();wet.gain.value=.16;convolver=ctx.createConvolver();const ir=ctx.createBuffer(2,Math.floor(ctx.sampleRate*1.5),ctx.sampleRate);for(let ch=0;ch<2;ch++){const a=ir.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,3.7)*.55;}convolver.buffer=ir;convolver.connect(wet);wet.connect(master);
  noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const a=noiseBuffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
  const ambience=ctx.createGain();ambience.gain.value=.026;ambience.connect(dry);for(const [i,f]of [55,82.407,110,164.814].entries()){const o=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();o.type='triangle';o.frequency.value=f;o.detune.value=i%2?2.4:-2.4;g.gain.value=.18;filter.type='lowpass';filter.frequency.value=240;o.connect(filter);filter.connect(g);g.connect(ambience);o.start();}started=true;
 }catch(e){enabled=false;}}
 function unlock(){if(!enabled)return;init();ctx?.resume().catch(()=>{});}
 function connect(node,tail=true){node.connect(dry);if(tail)node.connect(convolver);}
 function tone(f,end=f,d=.35,v=.1,type='sine',delay=0){if(!started||!enabled)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(22,f),t);o.frequency.exponentialRampToValueAtTime(Math.max(22,end),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,v),t+Math.min(.025,d*.15));g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);connect(g);o.start(t);o.stop(t+d+.025);o.onended=()=>{o.disconnect();g.disconnect();};}
 function noise(d=.25,v=.14,f=1800,end=200,type='bandpass',delay=0){if(!started||!enabled)return;const t=ctx.currentTime+delay,s=ctx.createBufferSource(),g=ctx.createGain(),filter=ctx.createBiquadFilter();s.buffer=noiseBuffer;filter.type=type;filter.Q.value=.7;filter.frequency.setValueAtTime(f,t);filter.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(filter);filter.connect(g);connect(g,false);s.start(t,Math.random()*.5,d+.01);s.onended=()=>{s.disconnect();filter.disconnect();g.disconnect();};}
 function cast(s){switch(s){
  case'fire':noise(.47,.2,400,3500,'bandpass');tone(75,170,.34,.08,'triangle');break;
  case'frost':noise(.46,.12,5000,2100,'highpass');[1100,1650,2200].forEach((f,i)=>tone(f,f*1.25,.38,.045,'sine',i*.05));break;
  case'arcane':[220,330,440].forEach((f,i)=>tone(f,f*2,.5,.055,'sine',i*.035));tone(120,190,.4,.08,'triangle');break;
  case'nature':noise(.48,.18,600,2200);[196,261.63,392].forEach((f,i)=>tone(f,f*.98,.2,.065,'triangle',i*.09));break;
  case'holy':[392,523.25,783.99].forEach((f,i)=>tone(f,f,.8,.055,'sine',i*.055));break;
  case'shadow':case'blood':tone(175,43,.62,.13,'triangle');tone(180,58,.68,.05);noise(.58,.12,1200,180,'lowpass');break;
  default:noise(.32,.19,800,4200,'bandpass');tone(130,95,.18,.065,'triangle');}}
 function impact(s){switch(s){
  case'fire':noise(.64,.3,2600,100,'lowpass');tone(105,32,.55,.25,'sine');noise(.22,.09,5200,2500,'highpass',.1);break;
  case'frost':noise(.18,.19,6700,3800,'highpass');[1760,2370,3150,4220].forEach((f,i)=>tone(f,f*.88,.32+i*.05,.045,'sine',i*.025));tone(74,43,.25,.1);break;
  case'arcane':tone(86,44,.38,.18);[440,659.25,880].forEach((f,i)=>tone(f,f*.72,.55,.068,'sine',i*.045));noise(.14,.1,3400,800);break;
  case'nature':noise(.37,.21,1900,250,'bandpass');tone(145,58,.25,.15,'triangle');[392,523.25].forEach((f,i)=>tone(f,f,.65,.05,'sine',i*.08));break;
  case'holy':tone(130.81,65.4,.3,.16);[523.25,783.99,1046.5,1567.98].forEach((f,i)=>tone(f,f,1.1,.058,'sine',i*.025));noise(.2,.06,2500,700);break;
  case'shadow':case'blood':tone(90,27,.8,.24,'triangle');tone(133,47,.65,.09);noise(.65,.18,1600,100,'lowpass');break;
  default:noise(.12,.3,3600,400);tone(82,39,.24,.19);[710,1140,1830].forEach((f,i)=>tone(f,f*.96,.32,.045,'sine',i*.008));}}
 function fx(type){if(!enabled||!started)return;played[type]=(played[type]||0)+1;if(type.startsWith('cast-')){cast(type.slice(5));return;}if(type.startsWith('impact-')){impact(type.slice(7));return;}switch(type){
  case'swing':noise(.2,.19,700,3700);break;case'attack':impact('steel');break;case'damage':tone(70,40,.18,.1);break;case'equip':impact('steel');tone(523,780,.65,.06);break;
  case'play':noise(.12,.07,2600,900);tone(329,493,.2,.04);break;case'summon':tone(90,130,.4,.09,'triangle');tone(261,392,.6,.04);break;case'power':cast('arcane');break;
  case'turn':[261.63,392,523.25].forEach((f,i)=>tone(f,f,.95,.058,'sine',i*.095));break;
  case'over':[261.63,329.63,392,523.25,659.25].forEach((f,i)=>tone(f,f,1.7,.075,'sine',i*.13));break;
  case'phase':tone(78,32,1.8,.17,'triangle');tone(117,43,1.6,.065);noise(1.4,.18,2100,90,'lowpass');break;
  case'shield':[1320,1760,2340].forEach((f,i)=>tone(f,f*.85,.4,.05,'sine',i*.025));break;
  case'heal':cast('nature');break;default:tone(520,580,.08,.035);}}
 function toggle(v){enabled=!!v;if(ctx){if(v)ctx.resume().catch(()=>{});master.gain.setTargetAtTime(v?.38:0,ctx.currentTime,.08);}}
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend().catch(()=>{});else if(enabled)ctx.resume().catch(()=>{});});
 return{unlock,fx,toggle,played,get started(){return started;},get state(){return ctx?.state||'not-started';}};
})();
