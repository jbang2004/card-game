/* Amber-framed cards (docs/design/AMBER_HAND.md): the card keeps its shape and
 * layout — art on top, name, rules, cost and stats where they have always been —
 * but its frame is polished World Tree amber. The art sits in a window; the frame
 * is a bevelled band of resin that refracts the art sealed beneath it; the rules
 * panel is dark cognac amber. One WebGL2 context paints every card into its own
 * 2D canvas: resting cards once per state, the held card every frame. Text,
 * cost and stats stay live DOM above the canvas. Presentation only. */
const EmberAmber = (() => {
  "use strict";

  /* The class is the kind of amber: absorption per unit path, the colour the
   * resin glows, and (blue amber only) surface fluorescence. */
  const BODIES = {
    neutral: { sigma: [0.2, 1.15, 3.4], body: [1.0, 0.6, 0.2], fluor: [0, 0, 0], name: "蜜珀" },
    paladin: { sigma: [0.06, 0.7, 2.7], body: [1.0, 0.8, 0.4], fluor: [0, 0, 0], name: "金珀" },
    ranger: { sigma: [1.05, 0.28, 2.6], body: [0.74, 0.9, 0.32], fluor: [0, 0, 0], name: "绿珀" },
    mage: { sigma: [0.16, 0.85, 2.5], body: [1.0, 0.7, 0.3], fluor: [0.3, 0.55, 1.0], name: "蓝珀" },
    jet: { sigma: [9, 9, 8], body: [0.3, 0.22, 0.42], fluor: [0.25, 0.15, 0.45], name: "黑玉" },
  };
  const RARITY = { common: 0, rare: 1, epic: 2, legendary: 3 };
  /* Card geometry, as fractions of the card box, matching card-face.css. */
  const CARD = {
    aspect: 5 / 7.4,
    radius: 0.036, // of width
    rim: 0.066, // of width
    rimBottom: 0.1, // of width: the old rarity band becomes a thicker sill
    divider: 0.608, // centre, from the top, of height
    dividerHalf: 0.012, // of height
    artHeight: 0.6, // of height, as today
  };
  const MARGIN = 0.07; // canvas bleed on every side, of card width (crown, halo)
  const ART_ASPECT = 336 / 448;

  const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;

  const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uArt,uHeight,uStudio;
uniform vec2 uBox;
uniform vec4 uCard;   // hw hh radius rim
uniform vec4 uLay;    // rimBottom yDiv divHalf rarity
uniform vec4 uArtMap;
uniform vec3 uSigma,uBody,uFluor;
uniform vec4 uState;  // warm crack back jet
uniform vec4 uMisc;   // seed time token gloss
uniform vec2 uTilt;

const vec3 LK=normalize(vec3(-.5,.62,.6));
vec3 V,I;
float seed,warm,rarity,gloss,isBack,isJet;

float hash1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hash2(vec2 p){float n=hash1(p);return vec2(n,hash1(p+n*19.19+17.1));}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash1(i),hash1(i+vec2(1,0)),f.x),mix(hash1(i+vec2(0,1)),hash1(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+17.7;a*=.5;}return s;}
vec2 voronoi(vec2 x){
  vec2 n=floor(x),f=fract(x),mg=vec2(0),mr=vec2(0);float md=8.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(i,j),r=g+hash2(n+g)-f;float d=dot(r,r);if(d<md){md=d;mr=r;mg=g;}}
  md=8.;
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){vec2 g=mg+vec2(i,j),r=g+hash2(n+g)-f;
    if(dot(mr-r,mr-r)>1e-5)md=min(md,dot(.5*(mr+r),normalize(r-mr)));}
  return vec2(md,hash1(n+mg));
}
vec3 studioTile(vec2 p,float tile){vec3 v=textureLod(uStudio,vec2((tile+clamp(p.x,.004,.996))/6.,p.y),0.).rgb;return v*v*6.;}
vec3 studio(vec3 dir,float roughness){
  dir=normalize(vec3(dir.xy,max(dir.z,.001)));
  vec2 p=dir.xy/(1.+dir.z)/2.2+.5;
  float level=clamp(roughness,0.,1.)*5.,tile=min(floor(level),4.);
  return mix(studioTile(p,tile),studioTile(p,tile+1.),level-tile);
}

/* ---- geometry ---- */
float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float sdRound(vec2 p,vec2 b,float r){return sdBox(p,b-r)-r;}
float hw,hh,rad,rim,rimB,yDiv,divH;
float dOuter(vec2 p){return sdRound(p,vec2(hw,hh),rad);}
float dWin(vec2 p){
  float top=hh-rim,bot=isBack>.5?-hh+rimB:yDiv+divH;
  return sdRound(p-vec2(0.,(top+bot)*.5),vec2(hw-rim,(top-bot)*.5),rad*.45);
}
float dPan(vec2 p){
  if(isBack>.5)return 9.;
  float top=yDiv-divH,bot=-hh+rimB;
  return sdRound(p-vec2(0.,(top+bot)*.5),vec2(hw-rim,(top-bot)*.5),rad*.45);
}
/* The frame is the card minus its openings. A point in it lies in a band bounded
 * by its two nearest edges; the band is a rounded bead (or, cut, a flat table
 * with chamfers) whose height scales with the band's width. */
float frameH(vec2 p,out float w,out float t){
  float e3=-dOuter(p),e1=dWin(p),e2=dPan(p);
  w=0.;t=1.;
  if(e3<=0.||e1<=0.||e2<=0.)return 0.;
  float s1=min(min(e1,e2),e3);
  float s2=s1==e1?min(e2,e3):(s1==e2?min(e1,e3):min(e1,e2));
  w=(s1+s2)*.5;t=(s2-s1)/(s1+s2);
  float prof=rarity==2.?(t<.42?1.:1.-(t-.42)/.58*.78):sqrt(max(0.,1.-t*t));
  float h=w*.9*prof;
  if(gloss<.9)h+=w*.08*(vnoise(p*26.+seed*7.)-.5);
  return h;
}
vec3 frameNormal(vec2 p){
  float e=.0025,w,t;
  vec2 g=vec2(frameH(p+vec2(e,0),w,t)-frameH(p-vec2(e,0),w,t),frameH(p+vec2(0,e),w,t)-frameH(p-vec2(0,e),w,t))/(2.*e);
  float l=length(g);if(l>3.)g*=3./l;
  return normalize(vec3(-g,1.));
}

/* ---- what lies in and under the card ---- */
// The saturated colour polished amber glows with.
vec3 amberGlow(){return pow(uBody,vec3(2.2));}
vec2 artUv(vec2 p){return p*uArtMap.xy+uArtMap.zw;}
vec3 art(vec2 p,float lod){return pow(textureLod(uArt,artUv(p),lod).rgb,vec3(2.2));}
vec3 panelBase(vec2 q){
  float top=isBack>.5?hh-rim:yDiv-divH,bot=-hh+rimB;
  float k=smoothstep(bot,top,q.y);
  // Dark cognac amber, a little of the class's colour in it, lighter toward the top.
  vec3 cognac=mix(vec3(.034,.009,.0016),vec3(.12,.036,.006),k);
  vec3 c=mix(cognac,cognac*amberGlow()*2.2,.3);
  float flow=fbm(q*2.5+seed);
  c*=1.+.08*sin((q.y*3.+flow*2.2)*14.)+.18*(flow-.5);
  // Jet is black, with a violet depth.
  c=mix(c,mix(vec3(.004,.003,.007),vec3(.018,.012,.03),k)*(1.+.3*(flow-.5)),isJet);
  return c;
}
vec3 scene(vec2 q,float lod){
  if(dOuter(q)>0.)return uBody*uBody*.015;
  if(isBack>.5)return panelBase(q);
  return q.y>yDiv?art(q,lod):panelBase(q);
}

/* Sealed matter: bubbles near the surface, sun spangles deeper (they bloom when warmed). */
vec3 inclusions(vec2 p,vec3 T,float h,float down,float dens,vec3 col){
  for(int layer=0;layer<2;layer++){
    float zl=layer==0?.012:-.03;
    float tl=(h-zl)/down;
    if(tl<=0.)continue;
    vec2 q=p+T.xy*tl;
    float cell=layer==0?.05:.09;
    vec2 gi=floor(q/cell);
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
      vec2 id=gi+vec2(i,j);
      vec2 hs=hash2(id+seed*31.+float(layer)*7.3);
      float pr=hash1(id*1.7+seed*13.+float(layer)*3.1);
      vec2 c=(id+.2+.6*hs)*cell;
      if(layer==0){
        if(pr<dens){
          float r=cell*mix(.06,.16,hs.x),dd=length(q-c)/r;
          float ring=smoothstep(.7,.92,dd)*smoothstep(1.1,.95,dd);
          col=col*(1.-.18*smoothstep(.95,.5,dd))+ring*vec3(1.,.86,.62)*.45;
          col+=smoothstep(.34,0.,length((q-c)/r-vec2(-.35,.38)))*vec3(1.,.95,.85)*.8;
        }
      }else if(pr<dens*(rarity==3.?.9:.45)){
        float r=cell*mix(.16,.32,hs.y);vec2 v=(q-c)/r;float dd=length(v);
        if(dd<1.){
          float ang=atan(v.y,v.x);
          float lum=(1.-dd)*(.35+.65*(.5+.5*sin(ang*13.+hs.x*20.)))*smoothstep(1.,.8,dd);
          vec3 film=.5+.5*cos(6.2831*(dd*1.2+vec3(0.,.33,.67)+hs.y));
          float shimmer=.65+.35*sin(dot(uTilt,vec2(9.,7.))*2.+hs.x*30.+uMisc.y*.8);
          col+=mix(vec3(1.,.7,.28),film,.3)*lum*shimmer*(.15+warm*.8+(rarity==3.?.3:0.));
        }
      }
    }
  }
  return col;
}

vec3 shadeMetal(vec3 n,vec3 base,float rough){
  vec3 c=base*(studio(reflect(I,n),rough)*1.3+.05);
  c+=mix(base,vec3(1.),.35)*pow(max(dot(n,normalize(LK+V)),0.),mix(18.,140.,1.-rough))*1.1;
  return c;
}

void main(){
  vec2 p=(vUv*2.-1.)*uBox;
  hw=uCard.x;hh=uCard.y;rad=uCard.z;rim=uCard.w;rimB=uLay.x;yDiv=uLay.y;divH=uLay.z;
  rarity=uLay.w;seed=uMisc.x;gloss=uMisc.w;warm=uState.x;isBack=uState.z;isJet=uState.w;
  float crack=uState.y,jet=uState.w;
  V=normalize(vec3(uTilt,1.6));I=-V;
  float dO=dOuter(p);
  float px=fwidth(p.x);
  float cardA=1.-smoothstep(-px,px,dO);
  float e1=dWin(p),e2=dPan(p);
  float inWin=1.-smoothstep(-px,px,e1);
  float inPan=1.-smoothstep(-px,px,e2);
  vec3 cw=vec3(0.),cp=vec3(0.),cf=vec3(0.);

  // Window: the art, under a thin clear coat; the frame's lip warms and shades its edge.
  if(e1<px){
    float e=max(-e1,0.);
    if(isBack>.5){
      cw=panelBase(p);
      // The back: a sun spangle — the spark — sealed at the centre.
      vec2 v=(p-vec2(0.,.02))/.23;float dd=length(v),ang=atan(v.y,v.x);
      float rays=.5+.5*sin(ang*17.+sin(ang*3.)*2.);
      float lum=smoothstep(1.,.0,dd)*(.35+.65*rays)*(1.+.6*smoothstep(1.,0.,dd));
      vec3 sc=mix(amberGlow(),vec3(1.,.82,.55),.45);
      cw+=sc*lum*(.55+.6*warm)*(1.-jet*.35);
      cw+=vec3(1.,.9,.7)*exp(-dd*dd*40.)*.6*(1.-jet*.3);
      cw+=amberGlow()*exp(-abs(dd-1.18)*38.)*.45;
      cw+=amberGlow()*exp(-abs(dd-1.34)*60.)*.25;
      cw*=1.-.45*exp(-e/.008);
    }else{
      vec3 a=art(p,0.);
      float lip=exp(-e/.03);
      a=mix(a,a*exp(-uSigma*.22)*1.05,lip*.8);
      a*=mix(1.,.8,smoothstep(yDiv+divH+.16,yDiv+divH,p.y));
      cw=a*mix(.9,1.,min(warm,1.));
      cw+=uBody*uBody*lip*(.02+.07*warm);
      cw*=1.-.4*exp(-e/.008);
      vec3 T=refract(I,vec3(0.,0.,1.),1./1.54);
      cw=inclusions(p,T,.02,max(-T.z,.25),.02,cw);
      vec3 env=studio(reflect(I,vec3(0.,0.,1.)),.1);
      cw+=max(env-vec3(1.),0.)*.06;
    }
  }
  if(e2<px){
    float e=max(-e2,0.);
    cp=panelBase(p);
    cp+=uBody*uBody*exp(-e/.03)*(.05+.12*warm);
    cp*=1.-.45*exp(-e/.008);
    vec3 T=refract(I,vec3(0.,0.,1.),1./1.54);
    cp=inclusions(p,T,.02,max(-T.z,.25),.05,cp);
  }
  if(e1>-px&&e2>-px&&dO<px){
    float w,t;
    float h=frameH(p,w,t);
    vec3 N=frameNormal(p);
    vec3 T=refract(I,N,1./1.54);
    if(dot(T,T)<.01)T=reflect(I,N);
    float down=max(-T.z,.25);
    float tt=(h+.05)/down;
    vec2 hit=p+T.xy*tt;
    vec2 disp=T.xy*tt*.05;
    vec3 s=vec3(scene(hit+disp,1.2).r,scene(hit,1.2).g,scene(hit-disp,1.2).b);
    vec3 trans=exp(-uSigma*(tt+.04)*2.3);
    cf=s*trans*.55;
    // The resin glows with the light it carries: a bright core down the bead,
    // deep and saturated toward its flanks.
    float thick=h/max(w*.9,1e-4);
    vec3 glow=amberGlow();
    cf+=glow*(.05+.1*min(warm,1.4))*(.35+.65*thick);
    cf+=glow*pow(thick,6.)*(.06+.22*min(warm,1.4));
    cf+=glow*smoothstep(.55,1.,t)*(.03+.08*warm);
    cf=inclusions(p,T,h,down,gloss<.9?.2:.1,cf);
    float cv=max(dot(N,V),0.);
    float F=.045+.955*pow(1.-cv,5.);
    vec3 env=studio(reflect(I,N),mix(.5,.04,gloss));
    cf+=(max(env-vec3(1.),0.)*.8+env*.04)*F*mix(.6,1.2,gloss);
    float nh=max(dot(N,normalize(LK+V)),0.);
    cf+=(pow(nh,mix(30.,200.,gloss))*mix(.3,2.,gloss)+pow(nh,24.)*.12*gloss)*vec3(1.,.97,.9);
    // Light that enters one flank leaves brighter through the other.
    cf+=amberGlow()*pow(max(dot(N.xy,normalize(vec2(.6,-.8))),0.),1.5)*(.05+.12*warm);
    cf+=uFluor*uFluor*(.04+.6*pow(1.-cv,1.6))*(.6+.4*min(warm,1.));
    if(rarity==2.){
      float fline=smoothstep(.06,0.,abs(t-.42));
      cf+=fline*(uBody*.35+.12)*(.5+.5*warm);
      float glint=pow(max(dot(N,normalize(LK+V)),0.),160.);
      cf+=glint*(.6+.4*cos(6.2831*(dot(N.xy,vec2(3.1,2.3))+vec3(0.,.33,.67))))*.8;
    }
    // A dark hairline where the bead meets the card's edge, for definition.
    cf*=mix(1.,.55,smoothstep(-.012,0.,dO));
    if(jet>.5)cf+=vec3(.55,.35,.9)*pow(vnoise(p*90.+seed),18.)*.9;
  }
  vec3 col=cf;
  col=mix(col,cw,inWin);
  col=mix(col,cp,inPan);
  float alpha=cardA;

  // Fittings: the setting says how rare the card is (colours as on today's band).
  float mm=0.;vec3 mc=vec3(0.);
  if(rarity>0.&&isBack<.5){
    vec3 metal=rarity==1.?vec3(.86,.89,.94):(rarity==2.?vec3(.8,.78,.9):vec3(1.,.77,.34));
    float rough=rarity==3.?.14:.2;
    vec2 cq=vec2(hw-abs(p.x),hh-abs(p.y));
    float L=p.y>0.?rim*2.4:rimB*1.55;
    float cap=cq.x/L+cq.y/L;
    float inF=step(0.,e1)*step(0.,e2);
    if(cap<1.25&&dO<.004&&inF>0.){
      vec3 n=normalize(frameNormal(p)+vec3(0.,0.,.4));
      float engr=rarity==3.?.86+.14*sin((cq.x-cq.y)*160.):(rarity==2.?.9+.1*step(.5,fract((cq.x+cq.y)*40.)):1.);
      float m=smoothstep(1.25,1.18,cap)*(1.-smoothstep(-.002,.004,dO));
      vec3 c=shadeMetal(n,metal*engr,rough);
      if(rarity==2.)c=mix(c,vec3(.45,.22,.8)*(.6+.8*max(dot(n,LK),0.)),smoothstep(.012,.0,abs(cap-.95))*.9);
      mm=max(mm,m);mc=mix(mc,c,m);
    }
    // The stone set at the top centre of the frame.
    vec2 gc=vec2(0.,hh-rim*.5);
    float gr=rim*.62;
    float gd=length(p-gc);
    if(gd<gr*1.45){
      float ring=smoothstep(gr*1.45,gr*1.3,gd);
      vec3 rn=normalize(vec3((p-gc)/(gr*1.45)*.8,.6));
      vec3 c=shadeMetal(rn,metal,rough);
      if(gd<gr){
        vec3 gcol=rarity==1.?vec3(.2,.5,1.):(rarity==2.?vec3(.62,.32,1.):vec3(.95,.22,.1));
        float q=gd/gr;
        vec3 n=normalize(vec3((p-gc)/gr*.9,sqrt(max(1.-q*q,.05))));
        c=gcol*(.35+.65*max(dot(n,LK),0.))+pow(max(dot(n,normalize(LK+V)),0.),90.)*1.2+studio(reflect(I,n),.05)*.2;
      }
      mm=max(mm,ring);mc=mix(mc,c,ring);
    }
    // World Tree leaves crown a legendary card.
    if(rarity==3.){
      for(int k=0;k<5;k++){
        float ang=radians(90.+float(k-2)*30.);
        vec2 dir=vec2(cos(ang),sin(ang)),pr=vec2(-dir.y,dir.x);
        float len=k==2?.13:(k==1||k==3?.11:.085);
        vec2 c=gc+dir*(gr*1.2+len*.55);
        float al=dot(p-c,dir)/(len*.55),ac=dot(p-c,pr);
        float w=.022*pow(max(1.-al*al,0.),.7);
        if(abs(al)<1.&&abs(ac)<w){
          float u=ac/w;
          vec3 n=normalize(vec3(pr*u*.8+dir*al*.25,sqrt(max(1.-u*u,.05))));
          float m=smoothstep(1.,.85,abs(u));
          mm=max(mm,m);mc=mix(mc,shadeMetal(n,metal*(1.-.35*smoothstep(.16,0.,abs(u))),rough),m);
        }
      }
    }
  }
  col=mix(col,mc,mm);
  alpha=max(alpha,mm);

  // Awakening: cracks of light run through the whole slab.
  if(crack>0.&&alpha>0.){
    vec2 vo=voronoi(p*5.2+seed*9.);
    float ln=smoothstep(.04,0.,vo.x)*step(vo.y,crack*1.15);
    col+=ln*vec3(1.,.8,.5)*(1.6+crack*2.2)*cardA;
    col+=uBody*crack*crack*.7*cardA;
  }
  if(uMisc.z>.5)alpha*=.85;

  // Legendary halo.
  if(rarity==3.&&isBack<.5&&dO>0.){
    float edge=smoothstep(0.,.1,min(uBox.x-abs(p.x),1.-abs(p.y)));
    float g=exp(-dO*16.)*edge;
    float rays=.7+.3*sin(atan(p.y,p.x)*22.+uMisc.y*.35);
    float ga=g*rays*.7*(1.-alpha);
    col=col*alpha+vec3(1.,.72,.3)*ga*1.3;
    alpha+=ga;
    col/=max(alpha,1e-4);
  }
  col=mix(col,.8+.2*(1.-exp(-(col-.8)*4.)),step(.8,col));
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  outColor=vec4(col*alpha,alpha);
}`;

  let canvas, gl, uniforms, studioTex;
  const textures = new Map();

  function ensureContext() {
    if (gl) return gl;
    canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 720;
    gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    uniforms = {};
    for (const name of ["uArt", "uHeight", "uStudio", "uBox", "uCard", "uLay", "uArtMap", "uSigma", "uBody", "uFluor", "uState", "uMisc", "uTilt"])
      uniforms[name] = gl.getUniformLocation(program, name);
    gl.uniform1i(uniforms.uArt, 0);
    gl.uniform1i(uniforms.uHeight, 1);
    gl.uniform1i(uniforms.uStudio, 2);
    gl.clearColor(0, 0, 0, 0);
    return gl;
  }

  function texture(url, mips) {
    if (textures.has(url)) return textures.get(url);
    const job = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ensureContext();
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (mips) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        resolve(tex);
      };
      img.onerror = () => reject(new Error("texture " + url));
      img.src = url;
    });
    textures.set(url, job);
    return job;
  }

  function spec(card, urls) {
    let seed = 0;
    for (const ch of card.id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    return {
      id: card.id,
      type: card.type,
      rarity: RARITY[card.rarity] ?? 0,
      body: BODIES[card.class] || BODIES.neutral,
      token: !!card.token,
      focus: (card.focus ?? 22) / 100,
      seed: seed / 9973,
      art: urls.art,
      height: urls.height,
    };
  }

  /* Canvas box for a card `w` CSS px wide: the card plus its bleed. */
  function box(w) {
    const h = w / CARD.aspect,
      m = Math.round(w * MARGIN);
    return { w, h, m, cw: w + 2 * m, ch: h + 2 * m };
  }

  async function paint(target, s, state = {}) {
    ensureContext();
    const [art, height, studio] = await Promise.all([texture(s.art, true), texture(s.height, false), studioTex]);
    const W = target.width,
      H = target.height;
    if (canvas.width < W || canvas.height < H) {
      canvas.width = Math.max(canvas.width, W);
      canvas.height = Math.max(canvas.height, H);
    }
    gl.viewport(0, 0, W, H);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, art);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, height);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, studio);
    // Piece units: the canvas is 2 tall; the card is the canvas minus its bleed.
    const A = W / H;
    const cardW = (2 * A) / (1 + 2 * MARGIN);
    const hw = cardW / 2,
      hh = hw / CARD.aspect,
      cardH = 2 * hh;
    gl.uniform2f(uniforms.uBox, A, 1);
    gl.uniform4f(uniforms.uCard, hw, hh, CARD.radius * cardW, CARD.rim * cardW);
    const yDiv = hh - CARD.divider * cardH;
    gl.uniform4f(uniforms.uLay, CARD.rimBottom * cardW, yDiv, CARD.dividerHalf * cardH, state.back ? 0 : s.rarity);
    // The art covers the card's width and its top 60%, cropped like object-fit: cover.
    const artW = cardW,
      artH = artW / ART_ASPECT,
      over = artH - CARD.artHeight * cardH;
    const artTop = hh + over * Math.min(1, Math.max(0, s.focus * 1.1));
    const map = [1 / artW, -1 / artH, 0.5, artTop / artH];
    if (state.breathe) {
      const z = 1 + state.breathe,
        py = hh - CARD.artHeight * cardH * 0.35;
      map[3] += py * map[1] * (1 - 1 / z);
      map[0] /= z;
      map[1] /= z;
    }
    gl.uniform4f(uniforms.uArtMap, ...map);
    const body = state.jet ? BODIES.jet : s.body;
    gl.uniform3f(uniforms.uSigma, ...body.sigma);
    gl.uniform3f(uniforms.uBody, ...body.body);
    gl.uniform3f(uniforms.uFluor, ...body.fluor);
    gl.uniform4f(uniforms.uState, state.warm ?? 0, state.crack ?? 0, state.back ? 1 : 0, state.jet ? 1 : 0);
    gl.uniform4f(uniforms.uMisc, s.seed, state.time ?? 0, s.token ? 1 : 0, s.rarity === 0 && !state.back ? 0.5 : 1);
    gl.uniform2f(uniforms.uTilt, state.tilt?.[0] ?? 0, state.tilt?.[1] ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const ctx = target.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(canvas, 0, canvas.height - H, W, H, 0, 0, W, H);
  }

  function configure({ studio }) {
    ensureContext();
    studioTex = texture(studio, false);
  }

  return Object.freeze({ BODIES, CARD, MARGIN, box, configure, spec, paint });
})();
