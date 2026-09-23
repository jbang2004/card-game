/* 3D battle arena (断裂王庭 — the broken court). Presentation only: it never
 * reads rules.
 *
 * The court is a raised plinth of pressed volcanic ash between two rivers of
 * lava. Its top carries one designed graphic layer, drawn once per layout into
 * a mask (courtArt): flow bands engraved around a diagonal inlay of rainbow
 * obsidian, a broken-crown emblem, the river line between the two ranks, and
 * inscriptions along the margins. A warm pool of light holds the eye on the
 * court; everything else sits in cool moonlight and stays dark, except the
 * melt. The rivers run down both flanks, wider apart up the picture and closer
 * to the court near the camera where the view narrows, and swing round the two
 * seat pads that carry the heroes. Columnar basalt walls the far banks and
 * dots the near ones. The accent colour is two gems, amethyst and emerald:
 * druses lit from within stand on the ground between court and river (past
 * the court's two ends in portrait), light the ground round them and shed
 * motes, placed only where the camera sees them and no HUD box covers them.
 *
 * Everything is drawn into `#arena-gl` (WebGL2, one context) beneath
 * `#battle`; the DOM minions, heroes and hand stay exactly where the game puts
 * them. Their footprints are measured and handed to the court shader as
 * contact shadows, and the hero portraits decide where the seat pads go.
 *
 * Layout is derived, never authored: on every relayout the two minion rows,
 * the arena rectangle, the top bar and the hand are measured in stage
 * coordinates (EmberViewport), and the camera is solved so the board spans the
 * arena width with its centre between the rows. The board's depth is whatever
 * room the layout leaves between the top bar and the hand. Desktop and the
 * touch layouts therefore share one scene.
 *
 * Materials: CC0 ambientCG maps (Rock035, Lava001) give normals, roughness,
 * occlusion and the melt's emission and veining; colour is authored in a few
 * tokens so a future encounter palette stays in one key. Lighting is a
 * hand-written GGX/Schlick model with a shadow map, a procedural reflection
 * environment, HDR bloom, depth of field, heat shimmer and ACES tone mapping.
 * `quality.low` drops MSAA, depth of field and the device pixel ratio;
 * `quality.reduced` renders one still frame.
 */
const EmberArena3D = (() => {
  "use strict";
  const TEXTURES = {
    rockN: ["asset:scenes/lava-forge/rock-normal.jpg", false],
    rockR: ["asset:scenes/lava-forge/rock-rough.jpg", false],
    rockAO: ["asset:scenes/lava-forge/rock-ao.jpg", false],
    lavaC: ["asset:scenes/lava-forge/lava-color.jpg", true],
    lavaN: ["asset:scenes/lava-forge/lava-normal.jpg", false],
    lavaE: ["asset:scenes/lava-forge/lava-emit.jpg", true],
  };
  const TEXNAMES = Object.keys(TEXTURES);
  /* ?arena-skip=shadow,scene,fx,bloom,post,all — diagnostics only, for cost bisection. */
  const SKIP = new Set((new URLSearchParams(location.search).get("arena-skip") || "").split(",").filter(Boolean));
  const SCENE_ID = "lava-forge";
  const PITCH = 57, FOV = 27, NEAR = 80, FAR = 7500, SM = 2048;
  /* the court top is y = 0; the gravel around it sits one plinth lower; the melt lower still */
  const GROUND = -30, LAVA_Y = -88;
  /* pressed ash of the court (warm grey) and the basalt of everything else (blue-black) */
  const STONE = [0.3, 0.286, 0.262], STONE2 = [0.37, 0.354, 0.328], ROCK = [0.045, 0.047, 0.053], ROCK2 = [0.085, 0.087, 0.095], EMBER = [1, 0.34, 0.06];
  const PAL = { key: [0.4, 0.5, 0.72], pool: [2.1, 1.86, 1.55], sky: [0.035, 0.042, 0.062], groundAmb: [0.02, 0.014, 0.011], fog: [0.018, 0.018, 0.024] };
  const SEAT_TINT = { p: [0.36, 0.62, 1.45], e: [1.45, 0.42, 0.22] };
  /* opaque HUD the druses keep out from under (the hero consoles themselves are transparent bars on touch) */
  const HUD_BOXES = "#home-btn, .top-actions > *, #battle-status, #enemy-hand, #log-toggle, #intel-toggle, .hero-card-inner, .hero-stat, .hero-phase, #power-btn, #contract-open, .enemy-deck, .player-deck, #end-turn, .mana-panel, #hand";
  /* amethyst and emerald, the ground's only cool colours: body glow, the core that lights edges and tips */
  const GEM = { glow: [[0.55, 0.16, 1], [0.04, 1, 0.42]], core: [[0.8, 0.52, 1], [0.42, 1, 0.7]], gain: 2.1, light: 4 };

  /* ------------------------------------------------------------------ math */
  const M = {
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
    look(e, t, up = [0, 1, 0]) { const z = V.norm(V.sub(e, t)), x = V.norm(V.cross(up, z)), y = V.cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, e), -V.dot(y, e), -V.dot(z, e), 1]); },
    persp(fov, as, n, f) { const q = 1 / Math.tan(fov / 2), d = 1 / (n - f); return new Float32Array([q / as, 0, 0, 0, 0, q, 0, 0, 0, 0, (f + n) * d, -1, 0, 0, 2 * f * n * d, 0]); },
    ortho(l, r, b, t, n, f) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]); },
    point(m, p) { const [x, y, z] = p, w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]; },
  };
  const V = { add: (a, b) => a.map((v, i) => v + b[i]), sub: (a, b) => a.map((v, i) => v - b[i]), scale: (a, s) => a.map((v) => v * s), dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: (a) => Math.hypot(a[0], a[1], a[2]) };
  V.norm = (a) => V.scale(a, 1 / (V.len(a) || 1));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x, z) { const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz); const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1); return a + (b - a) * fx + (c + (d - c) * fx - (a + (b - a) * fx)) * fz; }
  function fbm(x, z, o = 5) { let a = 0.5, s = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x, z); x = x * 2.03 + 17.1; z = z * 2.03 + 9.3; a *= 0.5; } return s; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* --------------------------------------------------------------- shaders */
  const NOISE = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,9.3);a*=.5;}return s;}`;
  const SURF_VS = `#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aN;layout(location=2) in vec2 aX;
uniform mat4 uVP,uLightVP;out vec3 vW,vN;out vec2 vX;out vec4 vSh;
void main(){vW=aPos;vN=aN;vX=aX;vSh=uLightVP*vec4(aPos,1.);gl_Position=uVP*vec4(aPos,1.);}`;
  const SURF_FS = `#version 300 es
precision highp float;precision highp sampler2DShadow;
in vec3 vW,vN;in vec2 vX;in vec4 vSh;layout(location=0) out vec4 o;
uniform sampler2DShadow uShadow;uniform sampler2D uRockN,uRockR,uRockAO,uLavaC,uLavaN,uLavaE,uCourt;
uniform float uMode,uTime,uLavaY,uGround,uK,uFogStart,uFogK,uSoft,uRadius,uEngrave;uniform vec2 uArena;uniform vec4 uRiv,uBulge,uStroke;
uniform vec3 uEye,uLightDir,uKey,uPool,uSky,uGroundAmb,uFog,uTint,uEmber,uStoneA,uStoneB,uRockA,uRockB;
uniform vec3 uLightPos[16],uLightCol[16];uniform float uLightRad[16];uniform vec3 uGemGlow[2],uGemCore[2];uniform float uGemGain;
uniform vec4 uCards[16];uniform vec4 uDecals[8];
${NOISE}
const float PI=3.14159265;
float shadow(vec3 n){vec3 q=vSh.xyz/vSh.w*.5+.5;if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z>1.)return 1.;
 float bias=max(.0032*(1.-max(dot(n,uLightDir),0.)),.0009);float s=0.,w=0.;int rad=uSoft>.5?2:1;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){if(abs(x)>rad||abs(y)>rad)continue;s+=texture(uShadow,vec3(q.xy+vec2(float(x),float(y))*.9/2048.,q.z-bias));w+=1.;}return s/w;}
vec3 triW(vec3 n){vec3 w=pow(abs(n),vec3(5.));return w/(w.x+w.y+w.z);}
vec3 tri(sampler2D t,vec3 p,vec3 w,float s){return texture(t,p.yz*s).rgb*w.x+texture(t,p.xz*s).rgb*w.y+texture(t,p.xy*s).rgb*w.z;}
vec3 triN(sampler2D t,vec3 p,vec3 n,vec3 w,float s,float k){vec3 tx=texture(t,p.yz*s).rgb*2.-1.,ty=texture(t,p.xz*s).rgb*2.-1.,tz=texture(t,p.xy*s).rgb*2.-1.;tx.xy*=k;ty.xy*=k;tz.xy*=k;
 tx=vec3(tx.xy+n.zy,abs(tx.z)*n.x);ty=vec3(ty.xy+n.xz,abs(ty.z)*n.y);tz=vec3(tz.xy+n.xy,abs(tz.z)*n.z);return normalize(tx.zyx*w.x+ty.xzy*w.y+tz.xyz*w.z);}
vec3 flatN(vec3 nm,float k){return normalize(vec3(nm.x*k,nm.z,nm.y*k));}
float rrect(vec2 p,vec2 b,float r){vec2 d=abs(p)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}
/* the court is the one warmly lit thing: a soft pool from above */
float pool(vec2 p){float r=length(p*vec2(1.,1.18))/(uArena.x*1.02);float onCourt=1.-smoothstep(-10.,150.,rrect(p,uArena,uRadius));float spot=1.-smoothstep(0.,1.18,r);return (pow(spot,1.3)*.7+.3)*onCourt;}
/* the two rivers; mirrors riverC()/riverW() on the CPU */
float rivC(float z,float s){float c=uRiv.x-uRiv.y*z+40.*sin(z*.0045+(s>0.?.6:2.3))+22.*sin(z*.0017+(s>0.?1.9:4.1));vec2 b=s>0.?uBulge.zw:uBulge.xy;c+=b.y*exp(-pow((z-b.x)/210.,2.));return s*c;}
float rivW(float z,float s){return uRiv.z*(1.+.16*sin(z*.006+(s>0.?3.:1.)));}
vec3 film(float h){return .5+.5*cos(6.2831*(h+vec3(0.,.33,.67)));}
vec3 brdf(vec3 alb,float rough,float metal,vec3 n,vec3 v,vec3 l,vec3 rad){vec3 h=normalize(l+v);float NdL=max(dot(n,l),0.),NdV=max(dot(n,v),1e-3),NdH=max(dot(n,h),0.),VdH=max(dot(v,h),0.);
 float a=max(rough*rough,.002),a2=a*a;float dd=NdH*NdH*(a2-1.)+1.;float D=a2/(PI*dd*dd);float k=(rough+1.)*(rough+1.)/8.;float G=(NdV/(NdV*(1.-k)+k))*(NdL/(NdL*(1.-k)+k));
 vec3 F0=mix(vec3(.04),alb,metal);vec3 F=F0+(1.-F0)*pow(1.-VdH,5.);vec3 spec=D*G*F/max(4.*NdV*NdL,1e-3);vec3 kd=(1.-F)*(1.-metal);return (kd*alb/PI+spec)*rad*NdL;}
vec4 lit(vec3 alb,float rough,float metal,float ao,vec3 n,vec3 p,vec3 emis){
 vec3 v=normalize(uEye-p);float sh=shadow(n);vec3 c=brdf(alb,rough,metal,n,v,normalize(uLightDir),uKey)*sh;
 vec3 poolCol=uPool*pool(p.xz);
 c+=brdf(alb,rough,metal,n,v,normalize(vec3(.1,1.,.2)),poolCol)*ao+alb*(1.-metal)*poolCol*.08*ao;
 vec3 F0=mix(vec3(.04),alb,metal);float NdV=max(dot(n,v),1e-3);vec3 F=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-NdV,5.);
 vec3 amb=mix(uGroundAmb,uSky,n.y*.5+.5);vec3 R=reflect(-v,n);vec3 env=mix(uGroundAmb*1.4,uSky*2.2,smoothstep(-.25,.65,R.y))+uEmber*.35*pow(clamp(1.-R.y,0.,1.),3.)+uKey*.5*pow(max(dot(R,normalize(uLightDir)),0.),30.);
 c+=alb*(1.-metal)*amb*ao*(1.-F*.5)+F*env*ao*(1.-rough*.75);
 for(int i=0;i<16;i++){vec3 d=uLightPos[i]-p;float d2=dot(d,d);float att=pow(clamp(1.-d2/(uLightRad[i]*uLightRad[i]),0.,1.),2.)/(1.+d2*2e-6);if(att<=0.)continue;c+=brdf(alb,rough,metal,n,v,d*inversesqrt(d2),uLightCol[i]*att);}
 c+=emis;float dist=max(0.,length(uEye-p)-uFogStart);c=mix(c,uFog,1.-exp(-dist*dist*uFogK));return vec4(c,dot(emis,vec3(.3,.5,.2)));}
void main(){vec3 n=normalize(vN),alb=vec3(.5),emis=vec3(0.),gloss=vec3(0.);float rough=.7,metal=0.,ao=1.;vec3 w=triW(n);
 if(uMode<.5){ /* ---- the court: pressed ash, the engraved graphic layer, the obsidian inlay ---- */
  vec2 p=vW.xz;vec2 cuv=(p+uArena)/(2.*uArena);vec4 cm=texture(uCourt,cuv);vec2 ts=1./vec2(textureSize(uCourt,0));
  float hL=texture(uCourt,cuv-vec2(ts.x,0.)).r,hR=texture(uCourt,cuv+vec2(ts.x,0.)).r,hD=texture(uCourt,cuv-vec2(0.,ts.y)).r,hU=texture(uCourt,cuv+vec2(0.,ts.y)).r;
  vec3 nm=texture(uRockN,p/230.).rgb*2.-1.;n=normalize(vec3(nm.x*.05,1.,nm.y*.05));
  float macro=fbm(p/520.),mott=fbm(p/150.+9.),grain=fbm(p/6.)-.5;
  alb=mix(uStoneA,uStoneB,clamp(macro*.8+mott*.3-.05,0.,1.))*(1.+grain*.07)*(.9+.2*fbm(p/60.+4.));rough=.66+(mott-.5)*.12;
  /* obsidian chips pressed into the ash */
  vec2 cell=floor(p/8.);vec2 cp=(cell+.2+.6*vec2(hash(cell),hash(cell+3.1)))*8.;float chip=step(.93,hash(cell+7.7))*(1.-smoothstep(.4,1.25,length(p-cp)));
  alb=mix(alb,vec3(.05,.05,.056),chip*.5);rough=mix(rough,.2,chip);
  /* engraving: depth becomes a normal, a darker floor and occlusion */
  vec3 en=vec3(hR-hL,0.,hU-hD)*uEngrave;n=normalize(n+en);float eg=cm.r;ao*=1.-eg*.5;alb*=1.-eg*.3;
  /* rainbow obsidian: black glass, flow-band sheen in a few lit zones, a glint that travels the inlay */
  float ob=cm.g,shn=cm.a;
  if(ob>.003){vec2 sa=uStroke.xy,sd=uStroke.zw-uStroke.xy;float along=clamp(dot(p-sa,sd)/dot(sd,sd),0.,1.);
   float zone=.22+.78*pow(cos((along-.3)*PI*3.2),2.);vec3 fc=film(fract(along*1.3+shn*.45+.06*sin(p.x*.05+p.y*.03)));float wht=smoothstep(.45,.75,shn);
   alb=mix(alb,vec3(.012,.012,.016),ob);rough=mix(rough,.06,ob);metal=mix(metal,0.,ob);n=normalize(mix(n,normalize(vec3(0.,1.,0.)+en*.7),ob));ao=mix(ao,1.,ob*.6);
   float sweep=exp(-pow((fract(uTime*.045)*1.5-.25-along)*9.,2.));
   fc=mix(vec3(dot(fc,vec3(.333))),fc,.7);
   gloss+=ob*(fc*shn*(1.-wht)*zone*.3+vec3(1.,.97,.92)*wht*.8+fc*sweep*.22*(.25+shn));}
  float bz=cm.b;if(bz>.003){alb=mix(alb,vec3(.64,.5,.3),bz);metal=mix(metal,1.,bz);rough=mix(rough,.32,bz);}
  /* the units stand here: their footprints shade the ash */
  float occ=1.;for(int i=0;i<16;i++){vec4 c=uCards[i];if(c.z<=0.)continue;vec2 dd=abs(p-c.xy+vec2(-.18,.15)*c.z)-c.zw;float sdc=length(max(dd,0.))+min(max(dd.x,dd.y),0.)-8.;float blur=12.+c.z*.25;occ*=1.-(1.-smoothstep(-2.,blur,sdc))*.62;}
  ao*=occ;
  for(int i=0;i<8;i++){vec4 dc=uDecals[i];if(dc.z<=0.)continue;float dr=length(p-dc.xy)/dc.z;float nz=fbm(p/26.+dc.xy);float m=1.-smoothstep(.3,1.,dr+nz*.5);float age=clamp((uTime-dc.w)/7.,0.,1.);alb*=1.-m*.7*(1.-age*.6);rough=mix(rough,.95,m);float ember=smoothstep(.55,.9,nz)*(1.-smoothstep(0.,.65,dr))*(1.-age);emis+=uEmber*ember*.9*(.6+.4*sin(uTime*7.+nz*30.));}
 }else if(uMode<1.5){ /* ---- terrain: basalt gravel, river banks, canyon rock ---- */
  vec3 p=vW;vec3 gn=n;n=triN(uRockN,p,n,w,1./520.,.8);n=triN(uRockN,p+31.,n,w,1./150.,.35);float rr=tri(uRockR,p,w,1./520.).r;ao=tri(uRockAO,p,w,1./520.).r*.5+.5;
  float flatG=smoothstep(.82,.97,gn.y);float macro=fbm(p.xz/600.);
  alb=mix(uRockA,uRockB,macro)*(.65+.35*flatG);float gr=hash(floor(p.xz/3.5));alb*=.8+.4*gr*flatG;rough=clamp(rr*.6+.35,.5,1.);
  float near=smoothstep(55.,-4.,p.y-uLavaY);float crack=fbm(p.xz/55.+2.);alb=mix(alb,vec3(.02,.014,.012),near*.75);emis+=uEmber*near*(.1+.9*smoothstep(.55,.8,crack))*1.9;
 }else if(uMode<2.5){ /* ---- the rivers: open melt down the channel, crust drifting at the banks ---- */
  vec2 p=vW.xz;float sd_=p.x<0.?-1.:1.;float xc=rivC(p.y,sd_),rw=rivW(p.y,sd_);float s=(p.x-xc)/rw,as=abs(s);
  float spd=1.-min(as,1.)*.65;vec2 fp=vec2(p.x,p.y-uTime*26.*sd_*spd);
  vec3 nA=texture(uLavaN,fp/520.).rgb*2.-1.,nB=texture(uLavaN,fp/900.+.37).rgb*2.-1.;n=flatN(normalize(vec3(nA.xy+nB.xy,nA.z*nB.z)),.55);
  vec3 em=pow(max(texture(uLavaE,fp/460.).rgb,texture(uLavaE,fp/820.+3.1).rgb*.9),vec3(1.35));
  float heat=1.-smoothstep(.25,1.05,as);float hot=smoothstep(.3,.8,fbm(fp/240.-vec2(0.,uTime*.05)));
  vec3 melt=mix(vec3(1.,.24,.03),vec3(1.5,.6,.13),clamp(heat*(.55+.45*hot),0.,1.));
  vec2 g=fp/44.;vec2 ip=floor(g),fq=fract(g);float d1=9.,d2=9.;vec2 cid=ip;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 of=vec2(float(i),float(j));vec2 r=of+vec2(hash(ip+of),hash(ip+of+7.3))-fq;float dd=dot(r,r);if(dd<d1){d2=d1;d1=dd;cid=ip+of;}else if(dd<d2)d2=dd;}
  float edge=sqrt(d2)-sqrt(d1);float reach=fbm(vec2(p.y/520.,sd_*3.1));float crustP=smoothstep(.42,1.,as)+(hash(cid+2.1)-.5)*.5+step(.94,hash(cid+5.5))*.6+(reach-.5)*.25;float crust=smoothstep(.42,.5,crustP)*smoothstep(.03,.1,edge);
  float seam=(1.-smoothstep(.012,.055,edge))*step(.36,crustP);
  alb=mix(vec3(.3,.07,.01),vec3(.024,.02,.018),crust);rough=mix(.35,.55,crust);
  float pulse=.85+.15*sin(uTime*1.4+p.y*.012+p.x*.01);
  float vein=dot(texture(uLavaC,fp/380.).rgb,vec3(.4,.4,.2));float streak=smoothstep(.25,.75,fbm(vec2(fp.x/34.,fp.y/150.)));
  emis+=(em*.8+melt*(.8+1.2*hot)*(.6+.8*vein)*(.7+.5*streak))*(1.-crust)*pulse*(.35+.65*heat);
  emis+=melt*seam*(.55+.6*heat)*pulse;
  vec2 bc=floor(fp/80.);vec2 bp=(bc+.5)*80.+(vec2(hash(bc),hash(bc+7.3))-.5)*40.;float ph=hash(bc+3.1);float alive=step(.5,hash(bc+9.4))*heat*(1.-crust);float life=fract(uTime*(.14+ph*.12)+ph);
  float rad=(8.+hash(bc+5.7)*13.)*sqrt(life)*alive;float pop=smoothstep(.82,.9,life);float d=length(fp-bp);
  if(d<rad){vec2 dir=(fp-bp)/max(rad,1.);float dome=sqrt(max(0.,1.-dot(dir,dir)));n=normalize(n+vec3(dir.x,0.,dir.y)*1.5*(1.-pop)+vec3(0.,dome*.4,0.));emis+=vec3(1.9,.8,.2)*(1.-pop)*dome*dome*.7;}
  float ripple=(1.-smoothstep(0.,3.,abs(d-rad*1.15)))*pop*(1.-smoothstep(.9,1.,life));emis+=vec3(2.,.85,.22)*ripple*.4*alive;
 }else if(uMode<3.5){ /* ---- columnar basalt ---- */
  vec3 p=vW;vec3 gn=n;n=triN(uRockN,p,n,w,1./380.,.6);float rr=tri(uRockR,p,w,1./380.).r;ao=tri(uRockAO,p,w,1./380.).r*.4+.6;
  float top=smoothstep(.8,.95,gn.y);float id=hash(floor(p.xz/30.)+.5);
  alb=mix(uRockA,uRockB*1.15,fbm(p.xz/260.+p.y/180.))*(.85+.35*top)*(.88+.24*id);rough=mix(clamp(rr*.55+.4,.55,1.),.72,top);
  if(top<.5){float jnt=smoothstep(.92,1.,sin(p.y*.085+id*6.2831));alb*=1.-jnt*.35;}
  float near=smoothstep(60.,-6.,p.y-uLavaY);float crack=fbm(p.xz/60.+p.y/40.);alb=mix(alb,vec3(.02,.015,.014),near*.6);emis+=uEmber*near*(.1+.9*smoothstep(.55,.85,crack))*1.5;
 }else if(uMode<4.5){ /* ---- dry grass: dark at the root, straw at the tip, the odd ember ---- */
  float t=smoothstep(.05,1.,vX.x);float v=hash(vec2(vX.y,1.7));alb=mix(vec3(.05,.042,.032),mix(vec3(.22,.18,.12),vec3(.3,.25,.17),v),t);rough=.85;
  float fl=.5+.5*sin(uTime*3.+vX.y*7.);emis+=uEmber*step(.965,v)*t*t*(.4+.6*fl)*.5;
 }else if(uMode<5.5){ /* ---- seat pads: dark metal, a ticked rim, one thin lens ring in the side's colour ---- */
  vec2 q=vW.xz-vX;float r=length(q)/uK;alb=vec3(.05,.05,.056);rough=.4;metal=.7;
  float rim=smoothstep(97.,99.,r);alb=mix(alb,vec3(.42,.4,.37),rim);metal=mix(metal,.95,rim);rough=mix(rough,.28,rim);
  float tk=step(.82,fract(atan(q.y,q.x)*48./6.2831853))*step(99.5,r)*(1.-step(104.5,r));alb*=1.-tk*.55;
  float inner=1.-smoothstep(64.,67.,r);alb=mix(alb,vec3(.012,.012,.015),inner);rough=mix(rough,.08,inner);metal=mix(metal,0.,inner);
  float lens=1.-smoothstep(1.,2.4,abs(r-78.));float halo=1.-smoothstep(3.,14.,abs(r-78.));
  emis+=uTint*(lens*1.25+halo*.18)*(.92+.08*sin(uTime*1.8));
  if(abs(n.y)<.5){alb=vec3(.035,.035,.04);metal=.5;emis=vec3(0.);}
 }else if(uMode<6.5){ /* ---- crystals: amethyst and emerald druses, lit from within ---- */
  float ci=floor(vX.x*.5),h=vX.x-2.*ci,ac=clamp((fract(vX.y)-.01)/.97,0.,1.);bool am=vX.y<1.;
  vec3 cg=am?uGemGlow[0]:uGemGlow[1],cc=am?uGemCore[0]:uGemCore[1];vec3 v=normalize(uEye-vW);float ndv=max(dot(n,v),0.);
  /* each facet bounces the inner light differently; more crystal to look through at the silhouette; the edges and tip carry the core */
  float face=hash(floor(n.xz*6.+.5)+floor(n.y*6.+.5)*vec2(3.1,1.7)+ci*1.37);float veil=.72+.56*fbm(vec2(vW.x*.035+vW.y*.05,vW.z*.035+ci*3.1));
  float e=min(ac,1.-ac),ridge=1.-smoothstep(0.,fwidth(e)*1.1+.022,e);
  float body=.04+.96*pow(h,1.5),thick=.35+.95*pow(1.-ndv,1.4),tip=smoothstep(.8,1.,h),pulse=.9+.1*sin(uTime*1.1+ci*2.3);
  float glint=pow(max(0.,sin(uTime*1.7+face*40.)),60.)*step(.6,face);
  alb=cg*.04;rough=.1;metal=0.;
  emis=(cg*body*thick*(.22+1.15*face*face)*veil+cc*(ridge*(.15+.85*h)*.5+tip*.75+glint*h*1.2))*pulse*uGemGain;
 }else{ /* ---- the court's plinth: chamfer, sides and the seat bridges ---- */
  vec3 p=vW;vec3 gn=n;n=triN(uRockN,p,n,w,1./300.,.35);float up=smoothstep(.3,.8,gn.y);float fall=smoothstep(uGround-14.,0.,p.y);
  alb=mix(uStoneA*.5,uStoneB*1.05,up)*(.5+.5*fall);rough=mix(.82,.6,up);ao=.55+.45*fall;
 }
 o=lit(alb,rough,metal,ao,n,vW,emis);o.rgb+=gloss;if(abs(uMode-6.)<.5)o.a*=-.85;}`;
  const DEPTH_FS = `#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`;
  const PT_VS = `#version 300 es
layout(location=0) in vec4 aP;uniform mat4 uVP;uniform float uSize;out float vA;void main(){gl_Position=uVP*vec4(aP.xyz,1.);gl_PointSize=(uSize+aP.w*uSize)*1100./max(1.,gl_Position.w);vA=aP.w;}`;
  const PT_FS = `#version 300 es
precision highp float;in float vA;out vec4 o;uniform vec3 uColor;void main(){float d=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-d),2.2)*vA;o=vec4(uColor*a,a);}`;
  const POST_VS = `#version 300 es
layout(location=0) in vec2 aQ;out vec2 vUV;void main(){vUV=aQ*.5+.5;gl_Position=vec4(aQ,0.,1.);}`;
  const BRIGHT_FS = `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uColor;void main(){vec4 c=texture(uColor,vUV);float l=dot(c.rgb,vec3(.3,.5,.2));float k=smoothstep(.95,2.4,l)*.6+abs(c.a)*.9;o=vec4(c.rgb*k,max(c.a,0.));}`;
  const BLUR_FS = `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uColor;uniform vec2 uDir;void main(){vec4 s=vec4(0.);float w[5]=float[](.227,.194,.121,.054,.016);s+=texture(uColor,vUV)*w[0];for(int i=1;i<5;i++){vec2 off=uDir*float(i)*1.5;s+=texture(uColor,vUV+off)*w[i];s+=texture(uColor,vUV-off)*w[i];}o=s;}`;
  const POST_FS = `#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uColor,uDepth,uBloom;uniform vec2 uRes;uniform float uNear,uFar,uFocus,uTime,uDof,uFocusScale;
float hash_(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lin(float z){z=z*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 px=1./uRes;vec4 bl=texture(uBloom,vUV);float heat=smoothstep(.15,.9,bl.a);
 vec2 sh=vec2(sin(vUV.y*90.+uTime*3.)+sin(vUV.x*70.-uTime*2.3),cos(vUV.y*80.-uTime*2.7))*heat*.0022;vec2 uv=vUV+sh;
 float d=lin(texture(uDepth,uv).r);float coc=smoothstep(360.*uFocusScale,1100.*uFocusScale,abs(d-uFocus))*6.*uDof;float j=hash_(vUV*913.)*6.2831;vec3 c=vec3(0.);
 for(int i=0;i<16;i++){float a=float(i)*2.39996+j;float r=sqrt((float(i)+.5)/16.);vec2 off=vec2(cos(a),sin(a))*r*coc*px*1.6;c+=texture(uColor,uv+off).rgb;}c/=16.;
 c+=bl.rgb*.5;
 c=aces(c*1.15);float lum=dot(c,vec3(.299,.587,.114));c=mix(c*vec3(.95,.96,1.05),c*vec3(1.05,1.0,.94),smoothstep(.15,.7,lum));c=pow(c,vec3(1./2.2));
 lum=dot(c,vec3(.299,.587,.114));c=mix(vec3(lum),c,1.08);c=c*c*(3.-2.*c)*.85+c*.15;vec2 q=vUV-.5;c*=1.-dot(q,q)*1.5;c+=(hash_(vUV*uRes+fract(uTime))-.5)*.012;o=vec4(c,1.);}`;

  /* ------------------------------------------------------------ geometry */
  function tri(o, a, b, c, na) { const n = na || V.norm(V.cross(V.sub(b, a), V.sub(c, a))); o.push(...a, ...n, 0, 0, ...b, ...n, 0, 0, ...c, ...n, 0, 0); }
  function quad(o, a, b, c, d, n) { tri(o, a, b, c, n); tri(o, a, c, d, n); }
  /* a vertex with its own normal and extra attribute (smooth rims, pads) */
  const vtx = (o, p, n, x = 0, z = 0) => o.push(p[0], p[1], p[2], n[0], n[1], n[2], x, z);
  function box(o, cx, cy, cz, sx, sy, sz) { const p = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]].map((q) => [cx + q[0] * sx, cy + q[1] * sy, cz + q[2] * sz]); for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) quad(o, p[f[0]], p[f[1]], p[f[2]], p[f[3]]); }
  /* a prism over a polygon (x,z ring), flat shaded, the top optionally tilted */
  function prism(o, ring, y0, y1, tilt = [0, 0]) {
    const n = ring.length, c = ring.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]); const yt = (p) => y1 + tilt[0] * (p[0] - c[0]) + tilt[1] * (p[1] - c[1]);
    for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; let nm = V.norm([b[1] - a[1], 0, -(b[0] - a[0])]); if (nm[0] * ((a[0] + b[0]) / 2 - c[0]) + nm[2] * ((a[1] + b[1]) / 2 - c[1]) < 0) nm = V.scale(nm, -1); quad(o, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], yt(b), b[1]], [a[0], yt(a), a[1]], nm); }
    const tn = V.norm([-tilt[0], 1, -tilt[1]]), ct = [c[0], y1, c[1]]; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; tri(o, ct, [a[0], yt(a), a[1]], [b[0], yt(b), b[1]], tn); }
  }
  function clipHalf(poly, mx, mz, nx, nz) { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const da = (a[0] - mx) * nx + (a[1] - mz) * nz, db = (b[0] - mx) * nx + (b[1] - mz) * nz; if (da <= 0) out.push(a); if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; }
  const insetRing = (ring, d) => { const n = ring.length, c = ring.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]); return ring.map((p) => { const l = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1, k = Math.max(0, 1 - d / l); return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]; }); };

  /* ---------------------------------------------------------------- scene */
  const rrectSD = (x, z, bx, bz, r) => { const dx = Math.abs(x) - bx + r, dz = Math.abs(z) - bz + r; return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - r; };
  /* a point at arc length s round the rounded rectangle (clockwise from the top middle) with its outward normal */
  function rrectAt(hx, hz, r, s) {
    const sx = hx - r, sz = hz - r, q = (Math.PI * r) / 2, L = [sx, q, 2 * sz, q, 2 * sx, q, 2 * sz, q, sx], per = L.reduce((a, b) => a + b, 0); s = ((s % per) + per) % per;
    let i = 0; while (i < 8 && s > L[i]) { s -= L[i]; i++; }
    const arc = (cx, cz, a0) => { const a = a0 + s / r; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)]; };
    switch (i) { case 0: return [s, -hz, 0, -1]; case 1: return arc(sx, -sz, -Math.PI / 2); case 2: return [hx, -sz + s, 1, 0]; case 3: return arc(sx, sz, 0); case 4: return [sx - s, hz, 0, 1]; case 5: return arc(-sx, sz, Math.PI / 2); case 6: return [-hx, sz - s, -1, 0]; case 7: return arc(-sx, -sz, Math.PI); default: return [-sx + s, -hz, 0, -1]; }
  }
  const rrectPerim = (hx, hz, r) => 4 * (hx - r + hz - r) + 2 * Math.PI * r;
  /* River centre (x) at depth z on one side (s = ±1): further out up the
   * picture, closer to the court near the camera where the view narrows; it
   * swings round a seat pad instead of drowning it. Mirrors rivC(). */
  let RIV = { a: 760, b: 0.147, w: 100 }, BULGE = [0, 0, 0, 0], PADS = {};
  function riverC(z, s) { let c = RIV.a - RIV.b * z + 40 * Math.sin(z * 0.0045 + (s > 0 ? 0.6 : 2.3)) + 22 * Math.sin(z * 0.0017 + (s > 0 ? 1.9 : 4.1)); const bz = s > 0 ? BULGE[2] : BULGE[0], bm = s > 0 ? BULGE[3] : BULGE[1]; c += bm * Math.exp(-(((z - bz) / 210) ** 2)); return s * c; }
  function riverW(z, s) { return RIV.w * (1 + 0.16 * Math.sin(z * 0.006 + (s > 0 ? 3 : 1))); }
  const riverSD = (x, z) => { const s = x < 0 ? -1 : 1; return Math.abs(x - riverC(z, s)) - riverW(z, s); };
  /* Gravel one plinth below the court; each river cuts a channel below the
   * melt line; beyond the far bank the ground climbs into basalt, and the
   * island rises into hills past both ends of the court. */
  function terrainAt(x, z) {
    const s = x < 0 ? -1 : 1, xc = riverC(z, s), rw = riverW(z, s), d = Math.abs(x - xc) - rw;
    let h = GROUND - (GROUND - (LAVA_Y - 26)) * sstep(20, -28, d);
    h += (fbm(x * 0.011 + 3, z * 0.011 + 1, 3) - 0.5) * 9 * sstep(20, 90, rrectSD(x, z, HX, HZ, RC)) * sstep(10, 60, d);
    const ridge = Math.pow(1 - Math.abs(2 * fbm(x * 0.0026 + 5, z * 0.0026 + 1, 4) - 1), 1.5);
    const outer = s * (x - xc) - rw - 90;
    h += sstep(0, 300, outer) * (80 + ridge * 280);
    const far = Math.max(-z - (HZ + 700), z - (HZ + 950));
    h += sstep(0, 800, far) * (90 + ridge * 260) * (1 - sstep(0, 300, outer) * 0.4);
    return h;
  }

  /* ------------------------------------------------------------ court art */
  /* The court's graphic layer (王庭图形层), drawn once per court size into one
   * RGBA mask in world units: R engraving depth, G the obsidian inlay, B the
   * bronze sigil, A the obsidian's flow-band sheen. The inscriptions use the
   * system's serif faces; nothing here is a bitmap. */
  const INSCRIPT = '"Trajan Pro", Cinzel, Baskerville, "Baskerville Old Face", "Palatino Linotype", Palatino, Georgia, serif';
  const SERIF_CN = '"Songti SC", STSong, "Noto Serif CJK SC", "Source Han Serif SC", "Noto Serif SC", SimSun, serif';
  const SANS_CN = '"PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
  let artKey = "", art = null, artMs = 0;
  function courtArt() {
    const k = clamp(Math.min(HX, HZ) / 409.24, 0.6, 1.3), R = RC;
    const big = EmberViewport.mobile ? 1408 : 1792, S = big / (2 * Math.max(HX, HZ)), TW = Math.round(2 * HX * S), TH = Math.round(2 * HZ * S);
    const A = [-0.902 * HX, 0.787 * HZ], B = [0.902 * HX, -0.777 * HZ], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const DIR = [(B[0] - A[0]) / len, (B[1] - A[1]) / len], NRM = [-DIR[1], DIR[0]], THS = Math.atan2(DIR[1], DIR[0]);
    const spine = (t) => { const o = (20 * Math.sin(2 * Math.PI * t) + 7 * Math.sin(5 * Math.PI * t + 1.1)) * k; return [A[0] + (B[0] - A[0]) * t + NRM[0] * o, A[1] + (B[1] - A[1]) * t + NRM[1] * o]; };
    const hwBody = (t) => 36 * k * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.42) * (0.9 + 0.2 * vnoise(t * 7, 3.3));
    const hwLat = (t) => 37 * k * Math.pow(Math.sin(Math.PI * clamp(t, 0.015, 0.985)), 0.16);
    const path = (pts, close) => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); if (close) p.closePath(); return p; };
    const arcP = (r, a0, a1) => { const p = new Path2D(); p.arc(0, 0, r, a0, a1); return p; };
    const circ = (r) => arcP(r, 0, Math.PI * 2);

    /* the inlay: thirteen bristle strands, torn fragments and splatter at both ends */
    const glass = [], r1 = rng(71), K = 13;
    for (let kk = 0; kk < K; kk++) {
      const lat = -1 + (2 * (kk + 0.5)) / K + (r1() - 0.5) * 0.08, edge = Math.abs(lat);
      const ts = 0.012 + r1() * 0.16 * (0.3 + 0.7 * edge), te = 0.988 - r1() * 0.17 * (0.3 + 0.7 * edge), cuts = [];
      if (edge > 0.45 && r1() < 0.7) { const g0 = ts + 0.02 + r1() * 0.12; cuts.push([g0, g0 + 0.008 + r1() * 0.03]); }
      if (edge > 0.45 && r1() < 0.7) { const g0 = te - 0.02 - r1() * 0.12; cuts.push([g0 - 0.008 - r1() * 0.03, g0]); }
      let segs = [[ts, te]];
      for (const [c0, c1] of cuts) segs = segs.flatMap(([s0, s1]) => (c1 <= s0 || c0 >= s1 ? [[s0, s1]] : [[s0, c0], [c1, s1]].filter(([a, b]) => b - a > 0.012)));
      for (const [s0, s1] of segs) {
        const left = [], right = [];
        for (let t = s0; t <= s1 + 1e-9; t += 0.0028) {
          const tt = Math.min(t, s1), p = spine(tt), off = lat * hwLat(tt) * 0.93 + 1.3 * k * (vnoise(kk * 3.1, tt * 22) - 0.5);
          const taper = sstep(s0, s0 + 0.022, tt) * (1 - sstep(s1 - 0.022, s1, tt)), rag = edge > 0.62 ? 0.78 + 0.44 * hash2(kk * 17 + 3, Math.floor(tt * 900)) : 1;
          const sw = (hwBody(tt) / K) * 2.15 * (0.72 + 0.56 * vnoise(kk * 3.7, tt * 9)) * taper * rag + 0.15, c = [p[0] + NRM[0] * off, p[1] + NRM[1] * off];
          left.push([c[0] + NRM[0] * sw, c[1] + NRM[1] * sw]); right.push([c[0] - NRM[0] * sw, c[1] - NRM[1] * sw]);
        }
        glass.push(path(left.concat(right.reverse()), true));
      }
    }
    for (const end of [0, 1]) {
      for (let i = 0; i < 24; i++) {
        const tf = end === 0 ? -0.05 + r1() * 0.16 : 0.89 + r1() * 0.16, u = (r1() - 0.5) * 2.3, base = spine(tf), hl = hwLat(clamp(tf, 0.02, 0.98)), c = [base[0] + NRM[0] * u * hl, base[1] + NRM[1] * u * hl];
        const near = 1 - Math.min(1, Math.abs(tf - (end === 0 ? 0.08 : 0.92)) / 0.12), fl = (5 + r1() * (12 + 22 * near)) * k, fw = (1.6 + r1() * (3 + 6 * near)) * k, ang = THS + (r1() - 0.5) * 0.55, ca = Math.cos(ang), sa = Math.sin(ang);
        const loc = [[-fl / 2, 0], [-fl / 6, (fw / 2) * (0.6 + 0.8 * r1())], [fl / 2, (r1() - 0.5) * fw * 0.4], [fl / 6, -(fw / 2) * (0.6 + 0.8 * r1())]];
        glass.push(path(loc.map(([x, y]) => [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca]), true));
      }
      for (let i = 0; i < 12; i++) { const tf = end === 0 ? -0.07 + r1() * 0.16 : 0.91 + r1() * 0.16, u = (r1() - 0.5) * 3, base = spine(tf), p = new Path2D(); p.arc(base[0] + NRM[0] * u * 30 * k, base[1] + NRM[1] * u * 30 * k, (0.8 + r1() * 1.6) * k, 0, Math.PI * 2); glass.push(p); }
    }
    /* the fissure the glass filled, and its hairline branches out into the stone */
    const r2 = rng(9), crack = [];
    for (let i = 0; i <= 90; i++) { const t = 0.04 + (0.92 * i) / 90, p = spine(t), o = ((fbm(t * 9, 2.2, 3) - 0.5) * 16 + (r2() - 0.5) * 2.2) * k; crack.push([p[0] + NRM[0] * o, p[1] + NRM[1] * o]); }
    const branches = [0.17, 0.36, 0.62, 0.81].map((t) => { const p = spine(t), sg = r2() < 0.5 ? -1 : 1, ang = Math.atan2(NRM[1] * sg, NRM[0] * sg) + (r2() - 0.5) * 1.1, bl = (42 + r2() * 50) * k, b = [p]; let q = p; for (let j = 1; j <= 14; j++) { const a2 = ang + (fbm(j * 0.4, t * 13, 2) - 0.5) * 1.6; q = [q[0] + (Math.cos(a2) * bl) / 14, q[1] + (Math.sin(a2) * bl) / 14]; b.push(q); } return path(b); });

    /* flow bands: iso-lines of the warped distance to the inlay, kept in a few calm patches */
    const flow = [];
    {
      const St = (5 * HX) / 560, NX = Math.round((2 * HX) / St) + 1, NZ = Math.round((2 * HZ) / St) + 1, sp = [];
      for (let i = 0; i <= 480; i++) sp.push(spine(-0.1 + (1.2 * i) / 480));
      const field = new Float32Array(NX * NZ), WX = Math.ceil(NX / 3) + 1, WZ = Math.ceil(NZ / 3) + 1, warp = new Float32Array(WX * WZ);
      for (let j = 0; j < WZ; j++) for (let i = 0; i < WX; i++) { const x = -HX + i * 3 * St, z = -HZ + j * 3 * St; warp[j * WX + i] = (34 * (fbm(x / 170, z / 170, 4) - 0.5) + 10 * (fbm(x / 48 + 3, z / 48 + 7, 4) - 0.5)) * k; }
      const warpAt = (i, j) => { const fi = i / 3, fj = j / 3, i0 = Math.floor(fi), j0 = Math.floor(fj), u = fi - i0, v = fj - j0, a = warp[j0 * WX + i0], b = warp[j0 * WX + i0 + 1], c = warp[(j0 + 1) * WX + i0], d = warp[(j0 + 1) * WX + i0 + 1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const x = -HX + i * St, z = -HZ + j * St; let best = 1e18, bi = 0;
        for (let q = 0; q < sp.length; q += 12) { const dd = (x - sp[q][0]) ** 2 + (z - sp[q][1]) ** 2; if (dd < best) { best = dd; bi = q; } }
        for (let q = Math.max(0, bi - 12); q <= Math.min(sp.length - 1, bi + 12); q++) { const dd = (x - sp[q][0]) ** 2 + (z - sp[q][1]) ** 2; if (dd < best) { best = dd; bi = q; } }
        const a = sp[Math.max(bi - 1, 0)], b = sp[Math.min(bi + 1, sp.length - 1)], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
        const sg = Math.sign((x - sp[bi][0]) * (-tz / tl) + (z - sp[bi][1]) * (tx / tl)) || 1;
        field[j * NX + i] = sg * Math.sqrt(best) + warpAt(i, j);
      }
      const keep = (x, z) => rrectSD(x, z, HX, HZ, R) < -46 * k && Math.hypot(x, z) > 280 * k && fbm(x / 430 + 11, z / 430 + 5, 3) > 0.4;
      const levels = []; for (let lk = 0; lk <= 19; lk++) for (const sg of [-1, 1]) levels.push(sg * (62 + 11 * lk) * k);
      const segsBy = levels.map(() => []);
      for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const v = [field[j * NX + i], field[j * NX + i + 1], field[(j + 1) * NX + i + 1], field[(j + 1) * NX + i]], lo = Math.min(v[0], v[1], v[2], v[3]), hi = Math.max(v[0], v[1], v[2], v[3]);
        if (hi < 62 * k && lo > -62 * k) continue;
        for (let li = 0; li < levels.length; li++) {
          const lv = levels[li]; if (lv <= lo || lv > hi) continue;
          const P = [[-HX + i * St, -HZ + j * St], [-HX + (i + 1) * St, -HZ + j * St], [-HX + (i + 1) * St, -HZ + (j + 1) * St], [-HX + i * St, -HZ + (j + 1) * St]], e = [];
          for (let q = 0; q < 4; q++) { const a = v[q] - lv, b = v[(q + 1) % 4] - lv; if ((a < 0) !== (b < 0)) { const t = a / (a - b), q2 = (q + 1) % 4; e.push([P[q][0] + (P[q2][0] - P[q][0]) * t, P[q][1] + (P[q2][1] - P[q][1]) * t]); } }
          if (e.length === 2) segsBy[li].push(e); else if (e.length === 4) { segsBy[li].push([e[0], e[1]]); segsBy[li].push([e[2], e[3]]); }
        }
      }
      for (let li = 0; li < levels.length; li++) {
        const lv = levels[li], segs = segsBy[li];
        const key = (p) => Math.round(p[0] * 20) + "," + Math.round(p[1] * 20), ends = new Map();
        segs.forEach((s, idx) => { for (const p of s) { const kk = key(p); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(idx); } });
        const used = new Uint8Array(segs.length), alpha = 1 - sstep(120 * k, 290 * k, Math.abs(lv));
        for (let s0 = 0; s0 < segs.length; s0++) {
          if (used[s0]) continue; used[s0] = 1; const line = [segs[s0][0], segs[s0][1]];
          for (const fwd of [true, false]) { let tip = fwd ? line[line.length - 1] : line[0]; for (;;) { const cand = (ends.get(key(tip)) || []).find((q) => !used[q]); if (cand === undefined) break; used[cand] = 1; const s = segs[cand], nxt = key(s[0]) === key(tip) ? s[1] : s[0]; if (fwd) line.push(nxt); else line.unshift(nxt); tip = nxt; } }
          let run = [];
          const flush = () => { if (run.length > 12) flow.push([path(run), alpha]); run = []; };
          for (const p of line) { if (keep(p[0], p[1])) run.push(p); else flush(); } flush();
        }
      }
    }

    /* canvas passes, one channel each, "lighten" so overlaps keep the deepest */
    const cv = document.createElement("canvas"); cv.width = TW; cv.height = TH;
    const g = cv.getContext("2d", { willReadFrequently: true }), data = new Uint8Array(TW * TH * 4);
    let chan = 0; const grey = (a) => { const v = Math.round(clamp(a) * 255); return chan === 0 ? "rgb(" + v + ",0,0)" : chan === 1 ? "rgb(0," + v + ",0)" : "rgb(0,0," + v + ")"; };
    const line = (p, w, a) => { g.strokeStyle = grey(a); g.lineWidth = w * k; g.stroke(p); };
    const fill = (p, a) => { g.fillStyle = grey(a); g.fill(p); };
    const spaced = (txt, x, y, font, ls, a, align = "center") => {
      g.font = font; g.fillStyle = grey(a); g.textBaseline = "middle"; g.textAlign = "left"; const chars = [...txt], ws = chars.map((c) => g.measureText(c).width);
      const total = ws.reduce((s, v) => s + v, 0) + ls * (chars.length - 1); let cx = align === "center" ? x - total / 2 : align === "end" ? x - total : x;
      chars.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + ls; });
    };
    const rotated = (txt, x, y, rot, font, ls, a) => { g.save(); g.translate(x, y); g.rotate(rot); spaced(txt, 0, 0, font, ls, a); g.restore(); };
    const onArc = (txt, r, mid, font, ls, a) => {
      g.font = font; g.fillStyle = grey(a); g.textBaseline = "middle"; g.textAlign = "center"; const chars = [...txt], ws = chars.map((c) => g.measureText(c).width);
      const total = ws.reduce((s, v) => s + v, 0) + ls * (chars.length - 1); let acc = 0;
      chars.forEach((c, i) => { const th = mid + (acc + ws[i] / 2 - total / 2) / r; g.save(); g.translate(Math.cos(th) * r, Math.sin(th) * r); g.rotate(th + Math.PI / 2); g.fillText(c, 0, 0); g.restore(); acc += ws[i] + ls; });
    };
    /* each layer draws into its own colour channel; "lighten" keeps the per-channel maximum.
     * A pass fills the mask's RGB, or copies its red channel into the mask's alpha. */
    const pass = (layers, toAlpha) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.fillStyle = "#000"; g.fillRect(0, 0, TW, TH);
      g.setTransform(S, 0, 0, S, TW / 2, TH / 2); g.globalCompositeOperation = "lighten"; g.lineCap = "round"; g.lineJoin = "round";
      layers.forEach((draw, c) => { chan = c; draw(); });
      const d = g.getImageData(0, 0, TW, TH).data;
      if (toAlpha) for (let i = 0; i < d.length; i += 4) data[i + 3] = d[i];
      else for (let i = 0; i < d.length; i += 4) { data[i] = d[i]; data[i + 1] = d[i + 1]; data[i + 2] = d[i + 2]; }
    };
    const gap = Math.asin(54 / 246), arcs = [[THS + gap, THS + Math.PI - gap], [THS + Math.PI + gap, THS + 2 * Math.PI - gap]];
    const gap2 = Math.asin(66 / 266), hairs = [[THS + gap2, THS + Math.PI - gap2], [THS + Math.PI + gap2, THS + 2 * Math.PI - gap2]];
    const LAT = (size, wgt = 600) => wgt + " " + size * k + "px " + INSCRIPT;
    const engraved = () => {
      for (const [p, a] of flow) line(p, 1.05, 0.62 * a);
      /* the margin groove, broken where the side inscriptions sit */
      { const hx = HX - 24 * k, hz = HZ - 24 * k, rr = R - 24 * k, per = rrectPerim(hx, hz, rr), n = 900; let run = [];
        const cut = (x, z) => (x < -hx + 1 && z > -204 * k && z < 144 * k) || (x > hx - 1 && z > -118 * k && z < 214 * k);
        for (let i = 0; i <= n; i++) { const q = rrectAt(hx, hz, rr, (i / n) * per); if (cut(q[0], q[1])) { if (run.length > 1) line(path(run), 1.7, 1); run = []; } else run.push([q[0], q[1]]); }
        if (run.length > 1) line(path(run), 1.7, 1); }
      { const mx = -HX + 108 * k, mz = -HZ + 99 * k; line(path([[mx - 7 * k, mz], [mx + 7 * k, mz]]), 1.1, 0.9); line(path([[mx, mz - 7 * k], [mx, mz + 7 * k]]), 1.1, 0.9); }
      /* the emblem: a broken ring, fine grooves, ticks, two rings, the river line */
      for (const [a0, a1] of arcs) { const band = new Path2D(); band.arc(0, 0, 258 * k, a0, a1); band.arc(0, 0, 234 * k, a1, a0, true); band.closePath(); fill(band, 0.28); line(band, 1.2, 0.9); line(arcP(240 * k, a0 + 0.01, a1 - 0.01), 0.8, 0.7); line(arcP(252 * k, a0 + 0.01, a1 - 0.01), 0.8, 0.7); }
      for (const [a0, a1] of hairs) line(arcP(266 * k, a0, a1), 0.8, 0.6);
      { const ticks = new Path2D(); for (let i = 0; i < 144; i++) { const a = (i / 144) * Math.PI * 2, x = (((a - THS) % Math.PI) + Math.PI) % Math.PI; if (Math.min(x, Math.PI - x) < gap + 0.03) continue; const l = (i % 6 === 0 ? 11 : 5.5) * k; ticks.moveTo(Math.cos(a) * 210 * k, Math.sin(a) * 210 * k); ticks.lineTo(Math.cos(a) * (210 * k - l), Math.sin(a) * (210 * k - l)); } line(ticks, 1, 0.75); }
      line(circ(152 * k), 1.1, 0.8); line(circ(144 * k), 0.7, 0.8); line(circ(60 * k), 1.4, 1);
      { const mer = new Path2D(), x0 = 284 * k, x1 = HX - 92 * k; for (const s of [-1, 1]) { mer.moveTo(s * x0, -3.2 * k); mer.lineTo(s * x1, -3.2 * k); mer.moveTo(s * x0, 3.2 * k); mer.lineTo(s * x1, 3.2 * k); for (let x = x0 + 36 * k; x < x1 - 12 * k; x += 40 * k) { mer.moveTo(s * x, -9 * k); mer.lineTo(s * x, -4 * k); mer.moveTo(s * x, 4 * k); mer.lineTo(s * x, 9 * k); } } line(mer, 0.95, 0.9);
        for (const s of [-1, 1]) { const dx = s * (HX - 81 * k); fill(path([[dx - 7 * k, 0], [dx, -6 * k], [dx + 7 * k, 0], [dx, 6 * k]], true), 0.8); } }
      onArc("THE BROKEN COURT · 断裂王庭", 282 * k, 0, LAT(12.5), 4.2 * k, 0.85);
      onArc("EMBERFALL · 烬 域 · MMXXVI", 282 * k, Math.PI, LAT(12.5), 4.2 * k, 0.85);
      /* margins: side inscriptions, the court's name above the ranks, the stage plate below them */
      rotated("FORGED IN EMBER", -HX + 24 * k, -30 * k, -Math.PI / 2, LAT(19), 7 * k, 0.9);
      rotated("EMBERFALL · 烬域", HX - 24 * k, 48 * k, Math.PI / 2, LAT(19), 7 * k, 0.9);
      { const tz = -HZ + 50 * k; spaced("断裂王庭", 8 * k, tz, "700 " + 21 * k + "px " + SERIF_CN, 16 * k, 0.9); const rule = new Path2D(); for (const s of [-1, 1]) { rule.moveTo(s * 96 * k, tz); rule.lineTo(s * 206 * k, tz); } line(rule, 1, 0.85); for (const s of [-1, 1]) fill(path([[s * 204 * k, tz], [s * 209 * k, tz - 5 * k], [s * 214 * k, tz], [s * 209 * k, tz + 5 * k]], true), 0.85); }
      { const px = HX - 90 * k, pz = HZ - 109 * k; line(path([[px - 120 * k, pz - 15 * k], [px, pz - 15 * k]]), 0.9, 0.8); spaced("STAGE I — LAVA FORGE", px, pz, LAT(10, 700), 3.2 * k, 0.85, "end"); spaced("第一关 · 熔岩要塞", px, pz + 18 * k, "500 " + 10 * k + "px " + SANS_CN, 2.4 * k, 0.8, "end"); }
      /* the fissure is the deepest cut of all */
      line(path(crack), 1.15, 1); for (const b of branches) line(b, 0.7, 1);
    };
    const inlay = () => { for (const p of glass) fill(p, 1); fill(circ(49 * k), 1); };
    const bronze = () => { line(path([[0, -30 * k], [20 * k, 0], [0, 30 * k], [-20 * k, 0]], true), 1.8, 1); fill(path([[0, -17 * k], [11 * k, 0], [0, 17 * k], [-11 * k, 0]], true), 0.92); };
    pass([engraved, inlay, bronze], false);
    pass([() => {
      /* flow-band streaks: colour where they are dim, white where they are bright */
      const r3 = rng(33), zone = (t) => 0.22 + 0.78 * Math.pow(Math.cos((t - 0.3) * Math.PI * 3.2), 2) * sstep(0, 0.1, t) * (1 - sstep(0.9, 1, t));
      for (let i = 0; i < 30; i++) {
        const u = -0.97 + (1.94 * i) / 29 + (r3() - 0.5) * 0.03; let t = 0.02 + r3() * 0.05;
        while (t < 0.97) {
          const t1 = Math.min(0.975, t + 0.05 + r3() * 0.2), pts = [];
          for (let tt = t; tt <= t1; tt += 0.006) { const p = spine(tt), off = u * hwLat(tt) * 0.93 + (vnoise(i * 2.3, tt * 14) - 0.5) * 3 * k; pts.push([p[0] + NRM[0] * off, p[1] + NRM[1] * off]); }
          const z = zone((t + t1) / 2), white = z > 0.62 && r3() < 0.3, a = white ? 0.9 + 0.1 * r3() : (0.04 + 0.34 * Math.pow(vnoise(i * 0.7 + 5, ((t + t1) / 2) * 7), 2)) * z * z;
          line(path(pts), white ? 0.9 + r3() * 0.8 : 0.6 + r3() * 1.8, a); t = t1 + 0.01 + r3() * 0.06;
        }
      }
      const edge = (t) => hwLat(t) * 0.93 + (hwBody(t) / 13) * 2.15 * 0.9;
      for (const [t0, t1, sg] of [[0.12, 0.37, -1], [0.46, 0.59, -1], [0.63, 0.85, -1], [0.2, 0.41, 1], [0.54, 0.78, 1]]) { const pts = []; for (let t = t0; t <= t1; t += 0.004) { const p = spine(t), off = sg * (edge(t) - 3 * k); pts.push([p[0] + NRM[0] * off, p[1] + NRM[1] * off]); } line(path(pts), 1.7, sg < 0 ? 1 : 0.9); }
      for (const [t, u] of [[0.31, -0.72], [0.665, -0.76]]) { const p = spine(t), q = [p[0] + NRM[0] * u * hwLat(t), p[1] + NRM[1] * u * hwLat(t)]; line(path([[q[0] - 8 * k, q[1]], [q[0] + 8 * k, q[1]]]), 0.9, 1); line(path([[q[0], q[1] - 5 * k], [q[0], q[1] + 5 * k]]), 0.9, 1); const c = new Path2D(); c.arc(q[0], q[1], 1.7 * k, 0, Math.PI * 2); fill(c, 1); }
      line(circ(47.5 * k), 2.6, 0.32); { const gl0 = new Path2D(); gl0.arc(0, 0, 44 * k, Math.PI * 1.08, Math.PI * 1.38); line(gl0, 1.4, 0.95); }
    }], true);
    return { w: TW, h: TH, data, engrave: (1.5 * k * S) / 2, stroke: [A[0], A[1], B[0], B[1]] };
  }

  /* ---------------------------------------------------------------- state */
  let canvas = null, gl = null, failed = false, active = false, hdr = false, aniso = null;
  let quality = { reduced: false, low: false };
  let W = 1600, H = 940, PW = 1600, PH = 940, dpr = 1, samples = 0;
  let HX = 560, HZ = 340, RC = 143, ornK = 1, gemK = 1, HUD = [];
  let layoutDirty = true, geomKey = "", stillDrawn = false, pending = 0, seatTries = 0;
  /* Adaptive cost: 0 full, 1 no MSAA / depth of field, 2 + lower resolution and
   * a tighter shadow kernel, 3 + quarter frame rate. Touch layouts start at 1;
   * a sustained frame gap above ~26 ms steps the tier down, never back up. */
  let tier = 0, gapEma = 16, tierFrames = 0, lastFrameAt = 0, frameCount = 0;
  const effTier = () => Math.max(tier, EmberViewport.mobile ? 1 : 0);
  let prog = null, tex = null, rt = null, geom = null, particles = null;
  let VP = null, eye = null, basis = null, lightVP = null;
  const cam = { pitch: PITCH, dist: 2600, tz: 0 };
  const LIGHT_DIR = V.norm([0.55, 0.5, -0.5]);
  const cardU = new Float32Array(64), decals = new Float32Array(32); let decalI = 0;
  const lightPos = new Float32Array(48), lightCol = new Float32Array(48), lightRad = new Float32Array(16);
  const GEM_GLOW = new Float32Array(GEM.glow.flat()), GEM_CORE = new Float32Array(GEM.core.flat()), MOTE = GEM.glow.map((c) => c.map((v) => v * 1.8 + 0.25));
  let encounter = "warden";

  function program(vs, fs) { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace("[0]", "")] = gl.getUniformLocation(p, info.name); } return { p, u }; }
  function mesh(arr) { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24); gl.bindVertexArray(null); return { vao, buf: b, n: arr.length / 8 }; }
  function freeMesh(m) { if (m) { gl.deleteBuffer(m.buf); gl.deleteVertexArray(m.vao); } }
  function loadTex(url, srgb) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(srgb ? [128, 128, 128, 255] : [128, 128, 255, 255])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); pending++;
    const img = new Image(); img.decoding = "async";
    img.onload = () => { if (!gl) return; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); pending--; stillDrawn = false; };
    img.onerror = () => { pending--; console.error("Arena texture could not load:", url); };
    img.src = url; return t;
  }
  function tex2d(w, h, fmt, filter) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  /** Upload the court's graphic layer; it only changes with the court's size. */
  function ensureCourtArt() {
    const key = HX + ":" + Math.round(HZ) + ":" + (EmberViewport.mobile ? "m" : "d");
    if (key === artKey && tex.court) return;
    artKey = key; const t0 = performance.now(); art = courtArt(); artMs = Math.round(performance.now() - t0);
    if (tex.court) gl.deleteTexture(tex.court);
    const t = (tex.court = gl.createTexture()); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, art.w, art.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, art.data); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    art.data = null;
  }

  /** Create the context, programs, static buffers and start the texture loads. */
  function ensure() {
    if (gl || failed) return !!gl;
    canvas = document.getElementById("arena-gl");
    if (!canvas) { failed = true; return false; }
    try {
      gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
      if (!gl) throw new Error("no webgl2");
      aniso = gl.getExtension("EXT_texture_filter_anisotropic");
      hdr = !!gl.getExtension("EXT_color_buffer_float");
      prog = { surf: program(SURF_VS, SURF_FS), depth: program(SURF_VS, DEPTH_FS), pts: program(PT_VS, PT_FS), bright: program(POST_VS, BRIGHT_FS), blur: program(POST_VS, BLUR_FS), post: program(POST_VS, POST_FS) };
      tex = {}; for (const k of TEXNAMES) tex[k] = loadTex(TEXTURES[k][0], TEXTURES[k][1]);
      const quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao); { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); } gl.bindVertexArray(null);
      const shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SM, SM); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE], [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      rt = { quadVao, shadowTex, shadowFbo, msFbo: null, rsFbo: null, colorTex: null, depthTex: null, bloomA: null, bloomB: null, bloomFboA: null, bloomFboB: null, w: 0, h: 0, samples: -1 };
      particles = { embers: pointSet(340), ash: pointSet(220), motes: [0, 1].map(() => ({ ...pointSet(36), gems: [] })), spots: [], lavaLights: [], gemLights: [] };
      geomKey = ""; artKey = ""; layoutDirty = true; stillDrawn = false;
    } catch (err) {
      failed = true; gl = null; console.error("Arena renderer unavailable:", err.message);
    }
    return !!gl;
  }
  function pointSet(n) { const data = new Float32Array(n * 4), vao = gl.createVertexArray(); gl.bindVertexArray(vao); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); return { n, data, vao, buf, st: [] }; }

  /** Colour + depth targets follow the backing-store size and the MSAA tier. */
  function ensureTargets() {
    const want = quality.low || effTier() >= 1 ? 0 : Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    if (rt.w === PW && rt.h === PH && rt.samples === want) return;
    for (const k of ["colorTex", "depthTex", "bloomA", "bloomB"]) if (rt[k]) gl.deleteTexture(rt[k]);
    for (const k of ["msFbo", "rsFbo", "bloomFboA", "bloomFboB"]) if (rt[k]) gl.deleteFramebuffer(rt[k]);
    if (rt.msColor) gl.deleteRenderbuffer(rt.msColor); if (rt.msDepth) gl.deleteRenderbuffer(rt.msDepth);
    const CF = hdr ? gl.RGBA16F : gl.RGBA8;
    samples = want; rt.w = PW; rt.h = PH; rt.samples = want;
    if (samples) {
      rt.msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.msFbo); rt.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rt.msColor); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, CF, PW, PH); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rt.msColor); rt.msDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rt.msDepth); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, PW, PH); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rt.msDepth);
    } else rt.msFbo = null;
    rt.rsFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.rsFbo); rt.colorTex = tex2d(PW, PH, CF, gl.LINEAR); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.colorTex, 0); rt.depthTex = tex2d(PW, PH, gl.DEPTH_COMPONENT24, gl.NEAREST); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, rt.depthTex, 0);
    const BW = Math.max(1, PW >> 1), BH = Math.max(1, PH >> 1); rt.bw = BW; rt.bh = BH;
    rt.bloomA = tex2d(BW, BH, CF, gl.LINEAR); rt.bloomB = tex2d(BW, BH, CF, gl.LINEAR); rt.bloomFboA = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.bloomFboA); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.bloomA, 0); rt.bloomFboB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.bloomFboB); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.bloomB, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* --------------------------------------------------------------- camera */
  function updateCamera() {
    const p = (cam.pitch * Math.PI) / 180; eye = [0, Math.sin(p) * cam.dist, cam.tz + Math.cos(p) * cam.dist];
    VP = M.mul(M.persp((FOV * Math.PI) / 180, W / H, NEAR, FAR), M.look(eye, [0, 0, cam.tz]));
    const f = V.norm(V.sub([0, 0, cam.tz], eye)), r = V.norm(V.cross(f, [0, 1, 0])), u = V.cross(r, f); basis = { f, r, u, t: Math.tan((FOV * Math.PI) / 360) };
  }
  const project = (p) => { const q = M.point(VP, p); return [(q[0] * 0.5 + 0.5) * W, (0.5 - q[1] * 0.5) * H]; };
  /** Stage pixel → point on the board plane (y = 0), or null when the ray misses. */
  function floorAt(sx, sy) { const nx = (sx / W) * 2 - 1, ny = 1 - (sy / H) * 2; const d = V.norm(V.add(basis.f, V.add(V.scale(basis.r, nx * basis.t * (W / H)), V.scale(basis.u, ny * basis.t)))); if (d[1] >= 0) return null; const t = -eye[1] / d[1]; return [eye[0] + d[0] * t, eye[2] + d[2] * t]; }

  /** Where the hero portraits stand: a pad at the foot of each, never cutting into the court. */
  function seats() {
    const out = {}, Vp = EmberViewport;
    for (const [k, sel] of [["p", ".hero.player"], ["e", ".hero.enemy"]]) {
      /* the portrait itself: on touch layouts the .hero element is a whole console bar */
      const q = Vp.pos(document.querySelector(sel + " .hero-card-inner") || document.querySelector(sel)); if (!q) continue;
      const f = floorAt(q.x, q.top + q.h); if (!f) continue;
      let x = f[0], z = f[1] - 36 * ornK; const want = 118 * ornK, sd = rrectSD(x, z, HX, HZ, RC);
      if (sd < want) { const gx = rrectSD(x + 1, z, HX, HZ, RC) - rrectSD(x - 1, z, HX, HZ, RC), gz = rrectSD(x, z + 1, HX, HZ, RC) - rrectSD(x, z - 1, HX, HZ, RC), gl2 = Math.hypot(gx, gz) || 1; x += (gx / gl2) * (want - sd); z += (gz / gl2) * (want - sd); }
      out[k] = [x, z];
    }
    return out;
  }

  /** Measure the live layout (stage coordinates) and solve the camera for it. */
  function relayout() {
    const Vp = EmberViewport; W = Vp.width; H = Vp.height;
    const app = document.getElementById("app"), appRect = app?.getBoundingClientRect();
    const cssScale = appRect && appRect.width ? appRect.width / W : 1;
    const T = effTier();
    dpr = clamp(cssScale * (devicePixelRatio || 1) * (T >= 2 ? 0.75 : 1), 0.5, quality.low || T >= 2 ? 1 : Vp.mobile ? 1.25 : 1.6);
    PW = Math.max(2, Math.round(W * dpr)); PH = Math.max(2, Math.round(H * dpr));
    if (canvas.width !== PW || canvas.height !== PH) { canvas.width = PW; canvas.height = PH; }
    const e = Vp.minion("e", 0, 1), p = Vp.minion("p", 0, 1);
    const yE = e.y + e.h / 2, yP = p.y + p.h / 2;
    const arena = Vp.pos(document.getElementById("arena")) || { left: 270, w: 1060, top: 212, h: 414 };
    const bar = Vp.pos(document.querySelector(".topbar")), hand = Vp.pos(document.getElementById("hand"));
    /* Portrait: a steeper look so the tall board is not squashed into a
     * sliver, a court a little narrower than the full-width board so the melt
     * still rims both edges, and a near edge that stops at the player's
     * console instead of running under it. */
    const tall = Vp.portrait;
    const yTop = bar ? bar.top + bar.h + 4 : 92, yBot = tall ? arena.top + arena.h - 2 : hand ? hand.top + 6 : H * 0.78;
    const targetSpan = arena.w - (tall ? 40 : 0), targetMid = (yE + yP) / 2, xMid = arena.left + arena.w / 2;
    HX = 560;
    cam.pitch = tall ? 64 : PITCH; cam.dist = 2600; cam.tz = 0;
    for (let i = 0; i < 14; i++) {
      updateCamera();
      const span = project([HX, 0, 0])[0] - project([-HX, 0, 0])[0];
      cam.dist *= Math.pow(span / targetSpan, 0.9);
      updateCamera();
      const y0 = project([0, 0, 0])[1], k = (project([0, 0, 50])[1] - project([0, 0, -50])[1]) / 100;
      cam.tz += (y0 - targetMid) / k;
    }
    updateCamera();
    const zTop = floorAt(xMid, yTop), zBot = floorAt(xMid, yBot);
    const laneHalf = Math.abs(((floorAt(xMid, yP) || [0, 0])[1] - (floorAt(xMid, yE) || [0, 0])[1]) / 2);
    HZ = clamp(Math.min(zTop ? -zTop[1] : 600, zBot ? zBot[1] : 600) - (tall ? 8 : 30), laneHalf + 110, tall ? 1250 : 640);
    RC = Math.min(HX, HZ) * 0.42;
    ornK = clamp(Math.min(HX, HZ) / 500, 0.55, 1.2);
    /* the druses keep a readable size on screen: larger in the world where the camera stands further off */
    gemK = clamp(Math.min(Math.sqrt((2 * HX) / (project([HX, 0, 0])[0] - project([-HX, 0, 0])[0])), 0.6 + HZ / 500), 1, 1.9);
    lightVP = M.mul(M.ortho(-(HX + 1250), HX + 1250, -(HZ + 950), HZ + 950, 10, 6500), M.look(V.scale(LIGHT_DIR, 3000), [0, 0, -HZ * 0.5]));
    /* the rivers sit a little past half way between the court and the screen's
     * edge, measured at the court's far and near ends, so every layout sees them */
    { const edgeX = (y) => { const f = floorAt(W, y); return f ? f[0] : HX + 400; }, rw = tall ? 72 : Vp.mobile ? 86 : 100, gapMin = tall ? 18 : 40;
      const xT = edgeX(project([0, 0, -HZ])[1]), xB = edgeX(project([0, 0, HZ])[1]);
      const cT = Math.max(HX + rw + gapMin, HX + 0.55 * (xT - HX)), cB = Math.max(HX + rw + (tall ? 18 : 25), HX + 0.55 * (xB - HX));
      RIV = { a: (cT + cB) / 2, b: (cT - cB) / (2 * HZ), w: rw }; }
    PADS = seats(); BULGE = [0, 0, 0, 0];
    HUD = [...document.querySelectorAll(HUD_BOXES)].map((el) => Vp.pos(el)).filter(Boolean);
    for (const pd of Object.values(PADS)) { const s = pd[0] < 0 ? -1 : 1, need = Math.abs(pd[0]) + 118 * ornK + riverW(pd[1], s) + 18 - Math.abs(riverC(pd[1], s)); if (need > 0) { if (s < 0) BULGE[0] = pd[1], BULGE[1] = need; else BULGE[2] = pd[1], BULGE[3] = need; } }
    layoutDirty = false; stillDrawn = false;
    /* the hero consoles may not be laid out yet on the very first frame of a battle */
    if (Object.keys(PADS).length < 2 && seatTries++ < 40) layoutDirty = true;
    const key = HX + ":" + Math.round(HZ) + ":" + (Vp.portrait ? "p" : "l") + ":" + Math.round(gemK * 10) + ":" + Object.values(PADS).map((q) => q.map((v) => Math.round(v / 8)).join(",")).join("|");
    if (key !== geomKey) { geomKey = key; build(); }
  }

  /* ---------------------------------------------------------------- build */
  function stalk(o, x, z, base, h, yaw, lean) { const dx = Math.cos(lean) * h * 0.18, dz = Math.sin(lean) * h * 0.18, wx = Math.cos(yaw) * 1.6, wz = Math.sin(yaw) * 1.6;
    const seed = Math.random(), a = [x - wx, base, z - wz], b = [x + wx, base, z + wz], c = [x + dx * 0.55 + wx * 0.5, base + h * 0.55, z + dz * 0.55 + wz * 0.5], d = [x + dx * 0.55 - wx * 0.5, base + h * 0.55, z + dz * 0.55 - wz * 0.5], e = [x + dx, base + h, z + dz];
    const n = V.norm([Math.sin(yaw), 0.35, -Math.cos(yaw)]); o.push(...a, ...n, 0, seed, ...b, ...n, 0, seed, ...c, ...n, 0.55, seed, ...a, ...n, 0, seed, ...c, ...n, 0.55, seed, ...d, ...n, 0.55, seed, ...d, ...n, 0.55, seed, ...c, ...n, 0.55, seed, ...e, ...n, 1, seed); }
  /* One crystal: a six-sided prism with a pointed termination, grown along d
   * from its root b. aX carries (index·2 + height up the crystal, hue + place
   * across the facet) so the gem shader can light the edges and the tip. */
  function crystal(o, b, d, r, len, tip, hue, idx, rnd) {
    const k = 6, u = V.norm(V.cross(Math.abs(d[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0], d)), w = V.cross(d, u), rot = rnd() * Math.PI, jit = Array.from({ length: k }, () => 0.82 + 0.36 * rnd());
    const L = len + tip, axis = (t) => V.add(b, V.scale(d, t));
    const at = (t, s, j) => { const a = rot + (j / k) * Math.PI * 2, rr = r * s * jit[j % k]; return V.add(axis(t), V.add(V.scale(u, Math.cos(a) * rr), V.scale(w, Math.sin(a) * rr))); };
    const apex = V.add(axis(L), V.add(V.scale(u, (rnd() - 0.5) * r * 0.4), V.scale(w, (rnd() - 0.5) * r * 0.4)));
    const put = (p, n, t, c) => o.push(p[0], p[1], p[2], n[0], n[1], n[2], idx * 2 + t / L, hue + 0.01 + c * 0.97);
    const out = (n, p, t) => (V.dot(n, V.sub(p, axis(t))) < 0 ? V.scale(n, -1) : n);
    for (let j = 0; j < k; j++) {
      const A = at(0, 1, j), B = at(0, 1, j + 1), C = at(len, 0.9, j + 1), D = at(len, 0.9, j);
      const n = out(V.norm(V.cross(V.sub(B, A), V.sub(D, A))), V.scale(V.add(A, C), 0.5), len / 2);
      put(A, n, 0, 0); put(B, n, 0, 1); put(C, n, len, 1); put(A, n, 0, 0); put(C, n, len, 1); put(D, n, len, 0);
      const m = out(V.norm(V.cross(V.sub(C, D), V.sub(apex, D))), V.scale(V.add(D, C), 0.5), len);
      put(D, m, len, 0); put(C, m, len, 1); put(apex, m, L, 0.5);
    }
  }
  /** A druse: one or two tall crystals leaning away from the court (never
   * toward the camera, so they still stand up on screen), a few beside them,
   * small points fanned round the foot and a couple of strays further out. */
  function druse(o, g, rnd, idx) {
    const { x: cx, z: cz, sc, hue } = g, away = Math.atan2(-Math.abs(cz), cx), k = 0.88 + rnd() * 0.24;
    const grow = (ox, oz, tilt, az, r, len, tip) => {
      const bx = cx + ox * sc, bz = cz + oz * sc; if (rrectSD(bx, bz, HX, HZ, RC) < 26 || riverSD(bx, bz) < 4) return;
      crystal(o, [bx, terrainAt(bx, bz) - Math.min(10, len * 0.3) * sc, bz], [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)], r * sc * k, len * sc * k, tip * sc * k, hue, idx++, rnd);
    };
    grow(0, 0, 0.1 + rnd() * 0.12, away + (rnd() - 0.5) * 0.8, 16, 80 + rnd() * 20, 30);
    if (rnd() < 0.5) { const a = away + (rnd() < 0.5 ? 1 : -1) * (0.9 + rnd() * 0.5); grow(Math.cos(a) * 11, Math.sin(a) * 11, 0.2 + rnd() * 0.15, a, 13, 58 + rnd() * 16, 25); }
    const n2 = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n2; i++) { const a = away + (i - (n2 - 1) / 2) * 1.5 + (rnd() - 0.5) * 0.5, dd = 13 + rnd() * 9; grow(Math.cos(a) * dd, Math.sin(a) * dd, 0.32 + rnd() * 0.28, a, 10 + rnd() * 3, 40 + rnd() * 24, 18); }
    const n3 = 6 + Math.floor(rnd() * 4);
    for (let i = 0; i < n3; i++) { const a = rnd() * Math.PI * 2, dd = 20 + rnd() * 24; grow(Math.cos(a) * dd, Math.sin(a) * dd, 0.55 + rnd() * 0.5, a, 4.5 + rnd() * 3, 12 + rnd() * 18, 8); }
    for (let i = 0; i < 2; i++) { const a = rnd() * Math.PI * 2, dd = 62 + rnd() * 40, bx = cx + Math.cos(a) * dd * sc, bz = cz + Math.sin(a) * dd * sc; if (rrectSD(bx, bz, HX, HZ, RC) > 40 && riverSD(bx, bz) > 12) grow(Math.cos(a) * dd, Math.sin(a) * dd, 0.2 + rnd() * 0.3, a + (rnd() - 0.5), 6 + rnd() * 2.5, 22 + rnd() * 14, 11); }
    return idx;
  }
  function build() {
    if (geom) for (const m of geom.all) freeMesh(m);
    ensureCourtArt();
    const all = []; const mk = (arr) => { const m = mesh(arr); all.push(m); return m; };
    const rnd = rng(1234 + Math.round(HZ));
    const padList = Object.entries(PADS);
    const nearSeat = (x, z, m) => padList.some(([, q]) => Math.hypot(x - q[0], z - q[1]) < 106 * ornK + m);

    /* terrain: finer across the rivers and near the court, a hole under the plinth */
    const to = [];
    { const X0 = -(HX + 1900), X1 = HX + 1900, Z0 = -(HZ + 1800), Z1 = HZ + 1300, xs = [], zs = [];
      for (let x = X0; x < X1; ) { xs.push(x); const ax = Math.abs(x); x += ax > HX - 60 && ax < RIV.a + RIV.w + 420 ? 22 : 60; } xs.push(X1);
      for (let z = Z0; z < Z1; ) { zs.push(z); z += z > -(HZ + 800) && z < HZ + 800 ? 26 : 70; } zs.push(Z1);
      const grid = zs.map((z) => xs.map((x) => [x, terrainAt(x, z), z]));
      const hidden = (p) => rrectSD(p[0], p[2], HX, HZ, RC) < -12;
      for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i]; if (hidden(a) && hidden(b) && hidden(c) && hidden(d)) continue; tri(to, a, c, b); tri(to, a, d, c); }
      const acc = new Map(); for (let k = 0; k < to.length; k += 8) { const key = to[k].toFixed(1) + "," + to[k + 2].toFixed(1); const e = acc.get(key) || [0, 0, 0]; e[0] += to[k + 3]; e[1] += to[k + 4]; e[2] += to[k + 5]; acc.set(key, e); }
      for (let k = 0; k < to.length; k += 8) { const e = V.norm(acc.get(to[k].toFixed(1) + "," + to[k + 2].toFixed(1))); to[k + 3] = e[0]; to[k + 4] = e[1]; to[k + 5] = e[2]; } }
    const terrain = mk(to);

    /* the plinth: the court top, a chamfer that catches the light, sides down into the gravel */
    const co = [], so = [];
    { const n = 480, per = rrectPerim(HX, HZ, RC), ring = (off, y) => { const out = []; for (let i = 0; i < n; i++) { const q = rrectAt(HX, HZ, RC, (i / n) * per); out.push([q[0] + q[2] * off, y, q[1] + q[3] * off, q[2], q[3]]); } return out; };
      const t0 = ring(0, 0), t1 = ring(7, -7), b0 = ring(7, GROUND - 14), up = [0, 1, 0];
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(co, [0, 0, 0], [t0[j][0], 0, t0[j][2]], [t0[i][0], 0, t0[i][2]], up);
        const cn = (r) => V.norm([r[3] * 0.7071, 0.7071, r[4] * 0.7071]), sn = (r) => [r[3], 0, r[4]];
        for (const [A, B, C, D, nf] of [[t0[i], t0[j], t1[j], t1[i], cn], [t1[i], t1[j], b0[j], b0[i], sn]]) { vtx(so, A, nf(A)); vtx(so, B, nf(B)); vtx(so, C, nf(C)); vtx(so, A, nf(A)); vtx(so, C, nf(C)); vtx(so, D, nf(D)); } }
      /* stone bridges from each seat pad to the plinth */
      for (const [, q] of padList) { const s = q[0] < 0 ? -1 : 1, az = Math.abs(q[1]), sz = HZ - RC; if (az > HZ - 20) continue; const edge = HX - RC + (az > sz ? Math.sqrt(Math.max(0, RC * RC - (az - sz) ** 2)) : RC); const x0 = s * (edge - 4), x1 = q[0] - s * 96 * ornK; if (s * (x1 - x0) <= 0) continue; box(so, (x0 + x1) / 2, (-8 + GROUND - 12) / 2, q[1], Math.abs(x1 - x0), -8 - (GROUND - 12), 34 * ornK); } }
    const board = mk(co), plinth = mk(so);

    /* Amethyst and emerald druses, the scene's accent colour. Landscape layouts
     * set them on the ground between court and river where it is wide enough;
     * portrait has no such ground, so they gather past the court's two ends.
     * Only where the camera sees them, never on a seat, never crowding. */
    const gems = [];
    { const courtX = (z) => { const az = Math.abs(z), sz = HZ - RC; return az <= sz ? HX : az < HZ ? HX - RC + Math.sqrt(RC * RC - (az - sz) ** 2) : 0; };
      /* half way across the ground between the court's edge and a river's near bank, or past one end of the court */
      const bank = (s, fz) => { const z = fz * HZ; return [(s * courtX(z) + riverC(z, s) - s * riverW(z, s)) / 2, z]; };
      const end = (fx, dz) => [fx * HX, Math.sign(dz) * HZ + dz];
      /* a druse must root where no HUD box covers it */
      const hidden = (p) => HUD.some((b) => p[0] > b.left - 6 && p[0] < b.left + b.w + 6 && p[1] > b.top - 6 && p[1] < b.top + b.h + 6);
      /* [size, where] in priority order; portrait lists each row left to right so its colours alternate along the row */
      const plan = EmberViewport.portrait
        ? [[0.95, end(-0.9, -45)], [0.6, end(-0.3, -60)], [0.5, end(0.12, -50)], [0.62, end(0.52, -62)], [0.75, end(-0.5, 85)], [1.05, end(0.3, 100)], [0.7, end(0.8, 30)]]
        : [[1.1, bank(1, -0.9)], [1.15, bank(-1, -0.78)], [0.95, bank(1, 0.45)], [0.8, bank(-1, -0.36)], [0.85, bank(1, 0.95)], [0.8, bank(-1, 0.95)], [0.8, end(0.75, -90)], [0.8, end(-0.62, -100)]];
      for (const [s0, [x, z]] of plan) {
        const sc = s0 * gemK;
        if (rrectSD(x, z, HX, HZ, RC) < 36 * sc || riverSD(x, z) < 24 * sc || nearSeat(x, z, 40 * sc) || gems.some((g) => Math.hypot(g.x - x, g.z - z) < 110 * Math.max(sc, g.sc))) continue;
        const g0 = terrainAt(x, z), root = [-20, 0, 20].map((dx) => project([x + dx * sc, g0, z]));
        if (root[1][0] < 8 || root[1][0] > W - 8 || root[1][1] < 8 || root[1][1] > H - 8 || root.some(hidden)) continue;
        /* which spots survive depends on the layout, so each colour is picked against the nearest druse
         * already placed; one standing alone takes the rarer colour, amethyst on a tie */
        let near = null, nd = Infinity;
        for (const g of gems) { const d = Math.hypot(g.x - x, g.z - z); if (d < 650 * Math.max(sc, g.sc) && d < nd) { near = g; nd = d; } }
        const n1 = gems.filter((g) => g.hue === 1).length;
        gems.push({ x, z, g0, sc, hue: near ? 1 - near.hue : n1 < gems.length - n1 ? 1 : 0 });
      } }
    const nearGem = (x, z, k) => gems.some((g) => Math.hypot(x - g.x, z - g.z) < k * g.sc);

    /* columnar basalt: Voronoi cells of a jittered hex lattice, walls on the far banks and low clusters on the near ones */
    const cols = [];
    { const s = 24, X = HX + 1250, Z0 = -(HZ + 1150), Z1 = HZ + 950, seeds = [], cellOf = new Map(), ck = (x, z) => Math.floor(x / 72) + ":" + Math.floor(z / 72);
      /* hand-placed low clusters: off the court's far corners and on the near banks the camera sees */
      const clusters = [[-(HX + 60), -HZ * 0.66, 120, 70], [HX + 60, HZ * 0.66, 120, 70], [-HX * 0.55, -(HZ + 95), 110, 60], [HX * 0.45, -(HZ + 105), 110, 55], [-(HX + 150), HZ * 0.1, 80, 45], [HX + 150, -HZ * 0.05, 80, 45]];
      for (let r = Math.floor(Z0 / (s * 1.5)); r * s * 1.5 < Z1; r++) for (let q = Math.floor(-X / (s * 1.7320508) - r / 2) - 1; ; q++) { const x0 = s * 1.7320508 * (q + r / 2); if (x0 > X) break; if (x0 < -X) continue; const sd = [x0 + (rnd() - 0.5) * s * 0.75, r * s * 1.5 + (rnd() - 0.5) * s * 0.75]; seeds.push(sd); const kk = ck(sd[0], sd[1]); if (!cellOf.has(kk)) cellOf.set(kk, []); cellOf.get(kk).push(sd); }
      const density = (x, z) => {
        const sd = x < 0 ? -1 : 1, xc = riverC(z, sd), rw = riverW(z, sd), d = Math.abs(x - xc) - rw, outer = sd * (x - xc) - rw, court = rrectSD(x, z, HX, HZ, RC);
        if (d < 14 || court < 36 || nearSeat(x, z, 26) || nearGem(x, z, 48)) return null;
        if (outer > 0) { const v = sstep(0, 60, outer) * (0.6 + 0.4 * fbm(x / 140, z / 140, 2)) * (1 - sstep(520, 720, outer)); return [v, 50 + 250 * sstep(0, 380, outer) * (0.55 + 0.45 * fbm(x / 90 + 7, z / 90, 2))]; }
        let best = null; for (const [cx, cz, cr, ch] of clusters) { const dd = Math.hypot(x - cx, z - cz); if (dd < cr) { const f = 1 - dd / cr; if (!best || f > best[0]) best = [f, ch]; } }
        if (best) return [0.95, 18 + best[1] * best[0]];
        const patch = fbm(x / 120 + 11, z / 120 + 4, 3); return [patch > 0.56 ? 0.9 : d < 50 ? 0.3 : 0, 16 + 62 * sstep(0.56, 0.76, patch) * (d > 40 ? 1 : 0.5)];
      };
      for (const [x, z] of seeds) {
        const f = density(x, z); if (!f || rnd() > f[0]) continue;
        let pg = [[x - 60, z - 60], [x + 60, z - 60], [x + 60, z + 60], [x - 60, z + 60]];
        for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) for (const t of cellOf.get(Math.floor(x / 72) + gx + ":" + (Math.floor(z / 72) + gz)) || []) { if (t[0] === x && t[1] === z) continue; pg = clipHalf(pg, (x + t[0]) / 2, (z + t[1]) / 2, t[0] - x, t[1] - z); }
        if (pg.length < 3) continue; const ring = insetRing(pg, 1.6);
        const base = Math.min(...ring.map((p) => terrainAt(p[0], p[1]))) - 12, h = Math.max(14, Math.round((f[1] * (0.78 + 0.44 * rnd()) * (rnd() < 0.1 ? 0.4 : 1)) / 5) * 5);
        prism(cols, ring, base, base + 12 + h, [(rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.1]);
      } }
    const columns = mk(cols);

    /* the druses; the largest seven also light the ground round them, and each colour sheds motes */
    const xo = []; let gi = 0;
    for (const g of gems) gi = druse(xo, g, rnd, gi);
    const crystals = mk(xo);
    particles.gemLights = gems.slice().sort((a, b) => b.sc - a.sc).slice(0, 7);
    particles.motes.forEach((set, h) => { set.gems = gems.filter((g) => g.hue === h); for (let i = 0; i < set.n; i++) { spawnMote(set, i); set.st[i].life = Math.random() * set.st[i].max; } });

    /* dry grass: along the near banks, the shores and round the basalt */
    const ro = []; let clumps = 0;
    for (let tries = 0; clumps < 360 && tries < 16000; tries++) {
      const x = (rnd() - 0.5) * (RIV.a * 2 + 700), z = -(HZ + 900) + rnd() * (HZ * 2 + 1500), court = rrectSD(x, z, HX, HZ, RC), d = riverSD(x, z);
      if (court < 22 || d < 8 || nearSeat(x, z, 8) || nearGem(x, z, 34)) continue;
      const want = (d < 60 ? 0.55 : 0) + (court < 80 ? 0.3 : 0) + (fbm(x * 0.006 + 2, z * 0.006 + 8, 3) > 0.58 ? 0.35 : 0); if (rnd() > want) continue;
      const g0 = terrainAt(x, z), n = 8 + Math.floor(rnd() * 10);
      for (let i = 0; i < n; i++) { const rad = Math.sqrt(rnd()) * 16, aa = rnd() * Math.PI * 2; stalk(ro, x + Math.cos(aa) * rad, z + Math.sin(aa) * rad, g0 - 3, (20 + rnd() * 36) * (1 - rad / 30), rnd() * Math.PI, aa + (rnd() - 0.5) * 0.9); }
      clumps++;
    }
    const reeds = mk(ro);

    /* seat pads: a low metal drum at each hero's feet */
    const pads = {};
    for (const [k, q] of padList) { const o = [], r = 106 * ornK, y = -8, n = 64; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2, A = [q[0] + Math.cos(a) * r, y, q[1] + Math.sin(a) * r], B = [q[0] + Math.cos(b) * r, y, q[1] + Math.sin(b) * r]; vtx(o, [q[0], y, q[1]], [0, 1, 0], q[0], q[1]); vtx(o, B, [0, 1, 0], q[0], q[1]); vtx(o, A, [0, 1, 0], q[0], q[1]); const na = [Math.cos(a), 0, Math.sin(a)], nb = [Math.cos(b), 0, Math.sin(b)], A2 = [A[0], GROUND - 12, A[2]], B2 = [B[0], GROUND - 12, B[2]]; vtx(o, A, na, q[0], q[1]); vtx(o, B, nb, q[0], q[1]); vtx(o, B2, nb, q[0], q[1]); vtx(o, A, na, q[0], q[1]); vtx(o, B2, nb, q[0], q[1]); vtx(o, A2, na, q[0], q[1]); } pads[k] = mk(o); }

    /* one sheet of melt under everything; the terrain hides it outside the channels */
    const lo = []; quad(lo, [-(HX + 1900), LAVA_Y, -(HZ + 1800)], [-(HX + 1900), LAVA_Y, HZ + 1300], [HX + 1900, LAVA_Y, HZ + 1300], [HX + 1900, LAVA_Y, -(HZ + 1800)], [0, 1, 0]); const lava = mk(lo);

    /* embers rise from the rivers; three lights down each */
    const spots = []; for (let i = 0; i < 400; i++) { const s = i % 2 ? 1 : -1, z = -(HZ + 700) + Math.random() * (HZ * 2 + 1300), x = riverC(z, s) + (Math.random() - 0.5) * 1.5 * riverW(z, s); if (terrainAt(x, z) < LAVA_Y - 10) spots.push([x, z]); }
    particles.spots = spots; particles.lavaLights = []; for (const s of [-1, 1]) for (const f of [-0.95, -0.1, 0.72]) { const z = f * HZ; particles.lavaLights.push([riverC(z, s), z]); }
    for (let i = 0; i < particles.embers.n; i++) { spawnEmber(i); particles.embers.st[i].life = Math.random() * particles.embers.st[i].max; }
    for (let i = 0; i < particles.ash.n; i++) { spawnAsh(i); particles.ash.st[i].life = Math.random() * particles.ash.st[i].max; particles.ash.st[i].y = Math.random() * 800; }
    geom = { all, terrain, board, plinth, columns, crystals, reeds, pads, lava, gems: gems.length };
  }
  function spawnEmber(i) { const s = particles.spots.length ? particles.spots[(Math.random() * particles.spots.length) | 0] : [0, -9999]; particles.embers.st[i] = { x: s[0] + (Math.random() - 0.5) * 50, y: LAVA_Y + 4, z: s[1] + (Math.random() - 0.5) * 50, vy: 18 + Math.random() * 34, life: 0, max: 3 + Math.random() * 4.5, ph: Math.random() * 7 }; }
  function spawnMote(set, i) { const g = set.gems.length ? set.gems[(Math.random() * set.gems.length) | 0] : null; set.st[i] = g ? { x: g.x + (Math.random() - 0.5) * 100 * g.sc, y: g.g0 + 8 + Math.random() * 50 * g.sc, z: g.z + (Math.random() - 0.5) * 100 * g.sc, vy: 5 + Math.random() * 11, life: 0, max: 2.5 + Math.random() * 3.5, ph: Math.random() * 7 } : { x: 0, y: -9999, z: 0, vy: 0, life: 0, max: 5, ph: 0 }; }
  function spawnAsh(i) { particles.ash.st[i] = { x: (Math.random() - 0.5) * (HX * 2 + 1500), y: 500 + Math.random() * 300, z: -(HZ + 900) + Math.random() * (HZ * 2 + 1400), vy: -(10 + Math.random() * 14), life: 0, max: 14 + Math.random() * 10, ph: Math.random() * 7 }; }

  /* --------------------------------------------------------------- render */
  const U3 = ["key", "pool", "sky", "groundAmb", "fog"];
  function setSurfUniforms(P, t, vp) {
    gl.useProgram(P.p); const u = P.u; gl.uniformMatrix4fv(u.uVP, false, vp || VP); gl.uniformMatrix4fv(u.uLightVP, false, lightVP); if (!u.uEye) return;
    gl.uniform1f(u.uTime, t); gl.uniform1f(u.uLavaY, LAVA_Y); gl.uniform1f(u.uGround, GROUND); gl.uniform1f(u.uK, ornK); gl.uniform1f(u.uSoft, effTier() >= 2 ? 0 : 1); gl.uniform1f(u.uFogStart, cam.dist * 0.654); gl.uniform1f(u.uFogK, 2.0e-7 * Math.pow(2600 / cam.dist, 2)); gl.uniform1f(u.uRadius, RC); gl.uniform1f(u.uEngrave, art ? art.engrave : 1);
    gl.uniform3fv(u.uEye, eye); gl.uniform3fv(u.uLightDir, LIGHT_DIR); gl.uniform2f(u.uArena, HX, HZ); gl.uniform4f(u.uRiv, RIV.a, RIV.b, RIV.w, 0); gl.uniform4fv(u.uBulge, BULGE); if (art) gl.uniform4fv(u.uStroke, art.stroke);
    for (const k of U3) gl.uniform3fv(u["u" + k[0].toUpperCase() + k.slice(1)], PAL[k]);
    gl.uniform3fv(u.uEmber, EMBER); gl.uniform3fv(u.uStoneA, STONE); gl.uniform3fv(u.uStoneB, STONE2); gl.uniform3fv(u.uRockA, ROCK); gl.uniform3fv(u.uRockB, ROCK2);
    gl.uniform3fv(u.uLightPos, lightPos); gl.uniform3fv(u.uLightCol, lightCol); gl.uniform1fv(u.uLightRad, lightRad); gl.uniform4fv(u.uCards, cardU); gl.uniform4fv(u.uDecals, decals);
    gl.uniform3fv(u.uGemGlow, GEM_GLOW); gl.uniform3fv(u.uGemCore, GEM_CORE); gl.uniform1f(u.uGemGain, GEM.gain);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rt.shadowTex); gl.uniform1i(u.uShadow, 0);
    TEXNAMES.forEach((k, i) => { gl.activeTexture(gl.TEXTURE1 + i); gl.bindTexture(gl.TEXTURE_2D, tex[k]); gl.uniform1i(u["u" + k[0].toUpperCase() + k.slice(1)], 1 + i); });
    gl.activeTexture(gl.TEXTURE1 + TEXNAMES.length); gl.bindTexture(gl.TEXTURE_2D, tex.court); gl.uniform1i(u.uCourt, 1 + TEXNAMES.length);
  }
  /* depthPass skips what casts no shadow; vp is the light's matrix for the shadow map */
  function drawScene(P, t, depthPass, vp) {
    setSurfUniforms(P, t, vp); const u = P.u; const g = geom;
    const draw = (m, mode, tint) => { if (u.uMode) { gl.uniform1f(u.uMode, mode); gl.uniform3fv(u.uTint, tint || [1, 1, 1]); } gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n); };
    draw(g.terrain, 1); if (!depthPass) draw(g.lava, 2); draw(g.board, 0); draw(g.plinth, 7); draw(g.columns, 3); draw(g.crystals, 6);
    if (!depthPass) draw(g.reeds, 4);
    for (const [k, m] of Object.entries(g.pads)) draw(m, 5, SEAT_TINT[k]);
  }
  function blit(P, fbo, w, h, texture, extra) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h); gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(P.u.uColor, 0); if (extra) extra(P.u); gl.bindVertexArray(rt.quadVao); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  function drawPoints(set, color, size) { gl.bindVertexArray(set.vao); gl.bindBuffer(gl.ARRAY_BUFFER, set.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, set.data); gl.useProgram(prog.pts.p); gl.uniformMatrix4fv(prog.pts.u.uVP, false, VP); gl.uniform3fv(prog.pts.u.uColor, color); gl.uniform1f(prog.pts.u.uSize, size); gl.drawArrays(gl.POINTS, 0, set.n); }

  /** The units are DOM; their footprints become the board's contact shadows.
   * At rest the rows are placed by EmberViewport.minion(), so the footprints
   * come from that geometry without touching layout; only while an effect is
   * animating units (EmberFX.busy) are the live boxes measured, so a lunge or
   * a lifted card drags its shadow along. Forcing layout every frame would
   * make every other animation on the page pay for the shadows. */
  let lastMeasure = -1, measuredBusy = false;
  function measureCards(nowMs) {
    const busy = typeof EmberFX !== "undefined" && EmberFX.busy;
    if (!busy && !measuredBusy && lastMeasure >= 0 && nowMs - lastMeasure < 250) return;
    lastMeasure = nowMs; measuredBusy = busy;
    cardU.fill(0); let n = 0;
    const Vp = EmberViewport;
    for (const side of ["e", "p"]) {
      const els = document.querySelectorAll(`#minions .minion[data-side="${side}"]`), count = els.length;
      for (let i = 0; i < count && n < 16; i++) {
        let cx, cy, w;
        if (busy) { const b = Vp.pos(els[i]); if (!b) continue; cx = b.x; cy = b.y + b.h * 0.42; w = b.w; }
        else { const g = Vp.minion(side, i, count); cx = g.x + g.w / 2; cy = g.y + g.h * 0.92; w = g.w; }
        const c = floorAt(cx, cy), l = floorAt(cx - w / 2, cy), r = floorAt(cx + w / 2, cy);
        if (!c || !l || !r) continue;
        const hw = Math.abs(r[0] - l[0]) / 2; cardU.set([c[0], c[1], hw, hw * 0.92], n * 4); n++;
      }
    }
  }
  function frame(t, q) {
    if (!active || !ensure()) return;
    if (q) quality = q;
    const nowMs = performance.now();
    if (lastFrameAt) {
      gapEma += (Math.min(nowMs - lastFrameAt, 100) - gapEma) * 0.1;
      if (++tierFrames > 90 && gapEma > 26 && tier < 3) { tier++; tierFrames = 0; gapEma = 16; layoutDirty = true; }
    }
    lastFrameAt = nowMs;
    if (layoutDirty) relayout();
    if (quality.reduced) { if (stillDrawn) return; t = 0; }
    /* Every present costs a compositor frame; touch layouts show the arena at
     * half rate, and the last tier at a quarter. */
    frameCount++; const T = effTier(); if ((T >= 3 && frameCount % 4) || (T >= 1 && frameCount % 2)) return;
    if (SKIP.has("all") || !canvas.offsetWidth) return;
    ensureTargets(); measureCards(nowMs);
    for (let i = 0; i < 6; i++) { const s = particles.lavaLights[i] || [0, -9999], fl = 1.9 * (0.85 + 0.15 * Math.sin(t * 1.3 + i * 1.7)); lightPos.set([s[0], LAVA_Y + 70, s[1]], i * 3); lightCol.set(EMBER.map((v) => v * fl), i * 3); lightRad[i] = 640; }
    for (const [slot, k] of [[6, "p"], [7, "e"]]) { const s = PADS[k]; lightPos.set(s ? [s[0], 30, s[1]] : [0, -9999, 0], slot * 3); lightCol.set(s ? SEAT_TINT[k].map((v) => v * 0.55) : [0, 0, 0], slot * 3); lightRad[slot] = s ? 240 * ornK : 1; }
    lightPos.set([0, 1150, 140], 24); lightCol.set([0.7, 0.64, 0.55], 24); lightRad[8] = 1500;
    for (let i = 0; i < 7; i++) { const g = particles.gemLights[i], slot = 9 + i, c = g ? GEM.glow[g.hue] : [0, 0, 0], f = GEM.light * (0.92 + 0.08 * Math.sin(t * 1.1 + i * 2.3)); lightPos.set(g ? [g.x, g.g0 + 42 * g.sc, g.z] : [0, -9999, 0], slot * 3); lightCol.set([c[0] * f, c[1] * f, c[2] * f], slot * 3); lightRad[slot] = g ? 250 * g.sc : 1; }
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.shadowFbo); gl.viewport(0, 0, SM, SM); gl.clear(gl.DEPTH_BUFFER_BIT); if (!SKIP.has("shadow")) drawScene(prog.depth, t, true, lightVP);
    gl.bindFramebuffer(gl.FRAMEBUFFER, samples ? rt.msFbo : rt.rsFbo); gl.viewport(0, 0, PW, PH); gl.clearColor(PAL.fog[0], PAL.fog[1], PAL.fog[2], 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); if (!SKIP.has("scene")) drawScene(prog.surf, t, false);
    /* embers and ash into the same HDR target */
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    if (!quality.reduced && !SKIP.has("fx")) {
      const em = particles.embers, ash = particles.ash;
      for (let i = 0; i < em.n; i++) { const p = em.st[i]; p.life += 1 / 60; if (p.life > p.max) spawnEmber(i); p.y += p.vy / 60; const k = 1 - p.life / p.max; em.data.set([p.x + Math.sin(t * 1.3 + p.ph) * 14 * p.life, p.y, p.z + Math.cos(t * 0.9 + p.ph) * 10 * p.life, k * Math.min(1, p.life * 3)], i * 4); }
      for (let i = 0; i < ash.n; i++) { const p = ash.st[i]; p.life += 1 / 60; if (p.life > p.max || p.y < -100) spawnAsh(i); p.y += p.vy / 60; p.x += Math.sin(t * 0.7 + p.ph) * 0.4; ash.data.set([p.x, p.y, p.z, 0.55 * Math.min(1, p.life * 2) * Math.min(1, p.max - p.life)], i * 4); }
      drawPoints(em, [1.7, 0.66, 0.15], 2.8);
      /* motes drift up off the druses; alpha is masked so they bloom a little and never shimmer */
      gl.colorMask(true, true, true, false);
      particles.motes.forEach((set, h) => { for (let i = 0; i < set.n; i++) { const p = set.st[i]; p.life += 1 / 60; if (p.life > p.max) spawnMote(set, i); p.y += p.vy / 60; set.data.set([p.x + Math.sin(t * 0.9 + p.ph) * 8 * p.life, p.y, p.z + Math.cos(t * 0.7 + p.ph) * 8 * p.life, Math.sin(Math.PI * Math.min(1, p.life / p.max)) * (0.65 + 0.35 * Math.sin(t * 5 + p.ph * 3))], i * 4); } drawPoints(set, MOTE[h], 2.4 * gemK); });
      gl.colorMask(true, true, true, true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); drawPoints(ash, [0.42, 0.4, 0.42], 1.6);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    if (samples) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rt.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rt.rsFbo); gl.blitFramebuffer(0, 0, PW, PH, 0, 0, PW, PH, gl.COLOR_BUFFER_BIT, gl.NEAREST); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.rsFbo); gl.colorMask(false, false, false, false); gl.clear(gl.DEPTH_BUFFER_BIT); drawScene(prog.depth, t, true); gl.colorMask(true, true, true, true); }
    gl.disable(gl.DEPTH_TEST);
    const BW = rt.bw, BH = rt.bh;
    if (!SKIP.has("bloom")) { blit(prog.bright, rt.bloomFboA, BW, BH, rt.colorTex); blit(prog.blur, rt.bloomFboB, BW, BH, rt.bloomA, (u) => gl.uniform2f(u.uDir, 1 / BW, 0)); blit(prog.blur, rt.bloomFboA, BW, BH, rt.bloomB, (u) => gl.uniform2f(u.uDir, 0, 1 / BH)); blit(prog.blur, rt.bloomFboB, BW, BH, rt.bloomA, (u) => gl.uniform2f(u.uDir, 2 / BW, 0)); blit(prog.blur, rt.bloomFboA, BW, BH, rt.bloomB, (u) => gl.uniform2f(u.uDir, 0, 2 / BH)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, PW, PH); gl.useProgram(prog.post.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rt.colorTex); gl.uniform1i(prog.post.u.uColor, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rt.depthTex); gl.uniform1i(prog.post.u.uDepth, 1); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, rt.bloomA); gl.uniform1i(prog.post.u.uBloom, 2);
    gl.uniform2f(prog.post.u.uRes, PW, PH); gl.uniform1f(prog.post.u.uNear, NEAR); gl.uniform1f(prog.post.u.uFar, FAR); gl.uniform1f(prog.post.u.uFocus, cam.dist); gl.uniform1f(prog.post.u.uTime, t); gl.uniform1f(prog.post.u.uDof, quality.low || effTier() >= 1 ? 0 : 1); gl.uniform1f(prog.post.u.uFocusScale, cam.dist / 2600);
    gl.bindVertexArray(rt.quadVao); if (!SKIP.has("post")) gl.drawArrays(gl.TRIANGLES, 0, 6);
    stillDrawn = pending === 0;
  }

  /* ------------------------------------------------------------------ api */
  return Object.freeze({
    /** Battle view on/off. The canvas only draws while a battle is on screen. */
    setActive(on) { active = !!on; if (active) { layoutDirty = true; stillDrawn = false; seatTries = 0; } },
    /** Any layout change (viewport, orientation, hand geometry) re-solves the camera on the next frame. */
    resize() { layoutDirty = true; stillDrawn = false; seatTries = 0; },
    setQuality(q) { quality = { reduced: !!q?.reduced, low: !!q?.low }; layoutDirty = true; stillDrawn = false; },
    /** Which boss is fought. One scene ships today; the id is kept for per-encounter palettes. */
    setEncounter(id) { encounter = id || "warden"; },
    /** Start the context and texture loads early (the mulligan hides the decode). */
    preload() { ensure(); },
    /** A spell impact scorches the board at a stage box. */
    scorch(at) { if (!gl || !basis || !at) return false; const p = floorAt(at.x, at.y + (at.h || 0) * 0.3); if (!p || Math.abs(p[0]) > HX || Math.abs(p[1]) > HZ) return false; decals.set([p[0], p[1], 70 + Math.random() * 40, performance.now() / 1000], decalI * 4); decalI = (decalI + 1) % 8; stillDrawn = false; return true; },
    frame,
    get sceneId() { return SCENE_ID; },
    get encounter() { return encounter; },
    get active() { return active; },
    get ready() { return !!gl && pending === 0 && !!geom; },
    get failed() { return failed; },
    /** Diagnostics: the solved court and camera, the court's screen box in stage pixels, the render tier. */
    get board() {
      const c = VP && [[-HX, -HZ], [HX, -HZ], [HX, HZ], [-HX, HZ]].map(([x, z]) => project([x, 0, z])), xs = c && c.map((p) => p[0]), ys = c && c.map((p) => p[1]);
      return { hx: HX, hz: HZ, dist: cam.dist, tz: cam.tz, court: c && [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], gems: geom ? geom.gems : 0, width: W, height: H, backing: [PW, PH], tier: effTier(), samples, gap: Math.round(gapEma * 10) / 10, artMs };
    },
  });
})();
