/* Amber pieces (docs/design/AMBER_HAND.md): a card in the hand is a piece of World
 * Tree amber with what it seals — a creature, a spell, a weapon — suspended inside.
 * One WebGL2 context paints every piece into its own 2D canvas: resting pieces are
 * painted once per state, the piece being held is painted every frame. The shader
 * is the whole look: a refracting dome over the illustration, absorption tinted by
 * the kind of amber, bubbles and sun spangles caught at depth, the crust of a raw
 * stone, the cracks of awakening, and the mount that says how rare it is.
 * Presentation only: no game state. */
const EmberAmber = (() => {
  "use strict";

  /* Silhouette families by what is sealed. Piece space: y up, the box spans
   * x ∈ [-A, A], y ∈ [-1, 1] where A = width / height. c = centre, r = radii,
   * taper narrows the top (a resin tear), n > 2 cuts the outline to an n-gon. */
  const SHAPES = {
    minion: { c: [0, -0.035], r: [0.585, 0.83], taper: 0.13, dome: 0.17, n: 0, phase: 0 },
    spell: { c: [0, 0.14], r: [0.625, 0.625], taper: 0, dome: 0.26, n: 0, phase: 0 },
    weapon: { c: [0, -0.04], r: [0.56, 0.9], taper: 0.04, dome: 0.15, n: 6, phase: (2 * Math.PI) / 3 },
  };
  /* Rarity is the lapidary's grade: the cut and the setting. */
  const CUTS = {
    common: { irregular: 1, facets: 0, gloss: 0.35, mount: 0 }, // 随形 · 皮绳
    rare: { irregular: 0, facets: 0, gloss: 1, mount: 1 }, // 素面 · 银托
    epic: { irregular: 0, facets: 12, gloss: 1, mount: 2 }, // 刻面 · 包边
    legendary: { irregular: 0, facets: 0, gloss: 1, mount: 3 }, // 雕件 · 金冠
  };
  /* The class is the kind of amber: absorption per unit path, the body colour its
   * haze and rim glow take, and (blue amber only) surface fluorescence. */
  const BODIES = {
    neutral: { sigma: [0.2, 1.15, 3.4], body: [1.0, 0.6, 0.2], fluor: [0, 0, 0], name: "蜜珀" },
    paladin: { sigma: [0.06, 0.7, 2.7], body: [1.0, 0.8, 0.4], fluor: [0, 0, 0], name: "金珀" },
    ranger: { sigma: [1.05, 0.28, 2.6], body: [0.74, 0.9, 0.32], fluor: [0, 0, 0], name: "绿珀" },
    mage: { sigma: [0.16, 0.85, 2.5], body: [1.0, 0.7, 0.3], fluor: [0.3, 0.55, 1.0], name: "蓝珀" },
  };
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
uniform vec4 uArtMap;
uniform vec4 uShape;   // cx cy rx ry
uniform vec4 uForm;    // taper irregular polygonN phase
uniform vec4 uCut;     // dome facets gloss mount
uniform vec3 uSigma,uBody,uFluor;
uniform vec4 uState;   // warm crust crack jet
uniform vec4 uMisc;    // seed time token halo
uniform vec2 uTilt;
uniform vec4 uExtra;   // mountAlpha

const float IOR=1.54, DART=.11;
const vec3 LK=normalize(vec3(-.5,.62,.6));
vec3 V,I;
float gRim=1.;

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

float radiusX(float dy){return uShape.z*(1.-uForm.x*clamp(dy/uShape.w,-1.,1.));}
// Normalised radius: < 1 inside the amber.
float rho(vec2 p){
  vec2 d=p-uShape.xy;
  vec2 q=vec2(d.x/radiusX(d.y),d.y/uShape.w);
  float r=length(q),th=atan(q.y,q.x);
  if(uForm.y>0.){float s=uMisc.x*6.2831;
    r/=1.+uForm.y*(.05*sin(3.*th+s)+.032*sin(5.*th+s*1.7)+.02*sin(8.*th+s*2.3));}
  if(uForm.z>2.){float sec=6.2831853/uForm.z;float a=mod(th-uForm.w+sec*.5,sec)-sec*.5;r*=cos(a)/cos(sec*.5);}
  return r;
}
float dome(float r){r/=gRim;return uCut.x*sqrt(max(0.,1.-pow(min(r,1.),2.2)));}
vec3 domeNormal(vec2 p){
  float e=.004;
  vec2 g=vec2(dome(rho(p+vec2(e,0)))-dome(rho(p-vec2(e,0))),dome(rho(p+vec2(0,e)))-dome(rho(p-vec2(0,e))))/(2.*e);
  float l=length(g);if(l>3.2)g*=3.2/l;
  return normalize(vec3(-g,1.));
}
// Epic cut: the window stays a smooth dome so the sealed figure reads; only the
// girdle is faceted — two rings of small facets, offset, that throw fire.
vec3 facetNormal(vec2 p,float r,vec3 smoothN,out float line,out float zone){
  vec2 d=p-uShape.xy;float rx=radiusX(d.y);
  vec2 q=vec2(d.x/rx,d.y/uShape.w);
  float th=atan(q.y,q.x),N=max(uForm.z,6.)*(uForm.z>6.?2.:1.),sec=6.2831853/N;
  float rr=r/gRim;
  float inner=uForm.z>6.?.68:.52;
  zone=smoothstep(inner-.01,inner+.01,rr);
  float tier=rr<inner?0.:(rr<.86?1.:2.);
  float off=tier==1.?sec*.5:0.;
  float x=(th-uForm.w-off)/sec,k=floor(x+.5);
  float az=uForm.w+off+k*sec,pol=tier==1.?.3:.62;
  float px=fwidth(rr)*1.3;
  float toSector=(.5-abs(x-k))*sec*rr;
  float toTier=min(abs(rr-inner),abs(rr-.86));
  line=tier==0.?smoothstep(px,0.,toTier):smoothstep(px,0.,min(toSector,toTier));
  if(tier==0.)return uForm.z>6.?smoothN:normalize(vec3(0.,0.,1.)+smoothN*.25);
  vec2 dir=normalize(vec2(cos(az)/rx,sin(az)/uShape.w));
  return normalize(vec3(dir*sin(pol),cos(pol)));
}

vec3 studioTile(vec2 p,float tile){vec3 v=textureLod(uStudio,vec2((tile+clamp(p.x,.004,.996))/6.,p.y),0.).rgb;return v*v*6.;}
vec3 studio(vec3 dir,float roughness){
  dir=normalize(vec3(dir.xy,max(dir.z,.001)));
  vec2 p=dir.xy/(1.+dir.z)/2.2+.5;
  float level=clamp(roughness,0.,1.)*5.,tile=min(floor(level),4.);
  return mix(studioTile(p,tile),studioTile(p,tile+1.),level-tile);
}
vec2 artUv(vec2 p){return p*uArtMap.xy+uArtMap.zw;}
vec3 art(vec2 p,float lod){return pow(textureLod(uArt,artUv(p),lod).rgb,vec3(2.2));}

vec3 shadeMetal(vec3 n,vec3 base,float rough){
  vec3 R=reflect(I,n);
  vec3 c=base*(studio(R,rough)*1.35+.05);
  vec3 H=normalize(LK+V);
  c+=mix(base,vec3(1.),.35)*pow(max(dot(n,H),0.),mix(18.,140.,1.-rough))*1.1;
  return c;
}

void main(){
  vec2 p=(vUv*2.-1.)*uBox;
  float seed=uMisc.x,warm=uState.x,crust=uState.y,crack=uState.z,jet=uState.w;
  V=normalize(vec3(uTilt,1.6));I=-V;
  float mount=uCut.w,gloss=uCut.z;
  gRim=mount>=2.?.935:1.;
  float r=rho(p);
  float aa=fwidth(r)*1.25+1e-4;
  float inside=1.-smoothstep(1.-aa,1.,r);
  vec3 col=vec3(0.);float alpha=0.;
  vec2 d0=p-uShape.xy;float rxHere=radiusX(d0.y);

  if(r<1.+aa){
    float h=dome(r);
    vec3 N=domeNormal(p);
    float fline=0.,fzone=0.;
    if(uCut.y>0.)N=facetNormal(p,r,N,fline,fzone);
    if(gloss<.9){N=normalize(N+vec3(vnoise(p*9.+seed*7.)-.5,vnoise(p*9.+31.+seed*5.)-.5,0.)*.14);}
    // Refract into the resin and find the sealed thing at depth.
    vec3 T=refract(I,N,1./IOR);
    if(dot(T,T)<.01)T=reflect(I,N);
    float down=max(-T.z,.25);
    float t=(h+DART)/down;
    vec2 hit=p+T.xy*t;
    float fig=texture(uHeight,artUv(hit)).r;
    t=(h+DART-fig*.07)/down;
    hit=p+T.xy*t;
    float rr=r/gRim;
    float lod=rr*rr*rr*1.6+(1.-gloss)*.9;
    vec2 disp=T.xy*t*(.028+fzone*.05)*smoothstep(.35,1.,rr);
    vec3 a=vec3(art(hit+disp,lod).r,art(hit,lod).g,art(hit-disp,lod).b);
    // Thicker toward the rim: deeper, redder, darker — the stone has a body.
    float L=t+.05+.3*pow(rr,3.);
    vec3 trans=exp(-uSigma*L*1.1);
    a=pow(a,vec3(1.12))*1.08;
    col=a*trans*.94;
    // Light that passes through the bright parts of the scene glows in the resin.
    col+=uBody*uBody*dot(a,vec3(.3,.5,.2))*trans.r*.12;
    float cloud=.1+(1.-gloss)*.22;
    col=mix(col,uBody*uBody*.2,(1.-exp(-L*1.3))*cloud);
    // Resin flow layers, stronger in a tumbled stone.
    col*=1.+.05*(1.-gloss*.6)*sin((hit.y*3.+fbm(hit*2.+seed)*2.4)*13.);

    // Sealed matter: bubbles near the surface, sun spangles deeper (they bloom when warmed).
    for(int layer=0;layer<2;layer++){
      float zl=layer==0?.035:-.035;
      float tl=(h-zl)/down;
      if(tl<=0.)continue;
      vec2 q=p+T.xy*tl;
      float cell=layer==0?.085:.15;
      vec2 gi=floor(q/cell);
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
        vec2 id=gi+vec2(i,j);
        vec2 hs=hash2(id+seed*31.+float(layer)*7.3);
        float pr=hash1(id*1.7+seed*13.+float(layer)*3.1);
        vec2 c=(id+.2+.6*hs)*cell;
        if(rho(c)>.86*gRim)continue;
        if(layer==0){
          float dens=gloss<.9?.26:.12;
          if(pr<dens){
            float rad=cell*mix(.05,.15,hs.x);
            float dd=length(q-c)/rad;
            float ring=smoothstep(.7,.92,dd)*smoothstep(1.1,.95,dd);
            float inner=smoothstep(.95,.5,dd);
            col=col*(1.-.2*inner)+ring*vec3(1.,.86,.62)*.5;
            col+=smoothstep(.34,0.,length((q-c)/rad-vec2(-.35,.38)))*vec3(1.,.95,.85)*.9;
          }else if(pr>.97){
            float dd=length(q-c)/(cell*.05);
            col*=1.-.55*smoothstep(1.,.3,dd);
          }
        }else{
          float dens=mount==3.?.16:(gloss<.9?.05:.09);
          if(pr<dens){
            float rad=cell*mix(.16,.32,hs.y);
            vec2 v=(q-c)/rad;float dd=length(v);
            if(dd<1.){
              float ang=atan(v.y,v.x);
              float streak=.5+.5*sin(ang*13.+hs.x*20.);
              float lum=(1.-dd)*(.35+.65*streak)*smoothstep(1.,.8,dd);
              vec3 film=.5+.5*cos(6.2831*(dd*1.2+vec3(0.,.33,.67)+hs.y));
              float shimmer=.65+.35*sin(dot(uTilt,vec2(9.,7.))*2.+hs.x*30.+uMisc.y*.8);
              col+=mix(vec3(1.,.7,.28),film,.3)*lum*shimmer*(.18+warm*.95+(mount==3.?.35:0.));
            }
          }
        }
      }
    }

    // Warmth: the holder's spark lights the stone from inside.
    float core=1.-rr*rr;
    float luma=dot(col,vec3(.2126,.7152,.0722));
    col=mix(vec3(luma),col,mix(.72,1.,min(warm,1.)));
    col*=mix(.74,1.04,min(warm,1.))*(1.+warm*.22*core);
    col+=mix(vec3(1.,.5,.16),uBody,.35)*warm*warm*(.02+.1*core);
    // Light trapped at the rim, and the caustic opposite the key light.
    col+=uBody*uBody*pow(smoothstep(.72,1.,rr),4.)*(.1+.32*min(warm,1.2));
    vec2 cc=uShape.xy+vec2(.24*rxHere,-.34*uShape.w);
    col+=uBody*uBody*exp(-dot(p-cc,p-cc)*18.)*(.06+.26*warm);
    if(uCut.y>0.){
      col+=fline*(uBody*.3+.1)*(.5+warm*.5);
      // Fire: facet edges catch thin spectral glints as the stone turns.
      float glint=pow(max(dot(N,normalize(LK+V)),0.),180.)*fzone;
      vec3 fire=.6+.4*cos(6.2831*(dot(N.xy,vec2(3.1,2.3))+vec3(0.,.33,.67)));
      col+=(glint*.5+fline*glint*2.)*fire;
      col+=fline*fzone*fire*.12*(.4+.6*sin(dot(uTilt,vec2(13.,9.))+dot(N.xy,vec2(40.,31.))));
    }

    // Surface: reflection, key glint, blue amber's fluorescence.
    float cv=max(dot(N,V),0.);
    float F=.045+.955*pow(1.-cv,5.);
    // Only the softboxes reflect; the dark room around a hand of stones does not.
    vec3 env=studio(reflect(I,N),mix(.55,.04,gloss));
    col+=(max(env-vec3(1.),0.)*.8+env*.05)*F*mix(.5,1.1,gloss);
    vec3 H=normalize(LK+V);
    col+=pow(max(dot(N,H),0.),mix(28.,260.,gloss))*mix(.2,1.6,gloss)*vec3(1.,.97,.9);
    col+=uFluor*uFluor*(.02+.34*pow(1.-cv,2.6));
    // A crisp line where the stone ends (a bezel covers it instead).
    if(mount<2.)col*=mix(1.,.5,smoothstep(.955,1.,r));

    // Awakening: cracks of light spread before the stone gives way.
    if(crack>0.){
      vec2 vo=voronoi(p*4.6+seed*9.);
      float on=step(vo.y,crack*1.15);
      float ln=smoothstep(.045,0.,vo.x)*on;
      col+=ln*vec3(1.,.8,.5)*(1.6+crack*2.2);
      col+=uBody*crack*crack*.8;
    }

    // Raw stone: an oxidised crust that is ground away to open a window.
    if(crust>0.){
      float field=.6*pow(rr,1.3)+.4*fbm(p*4.+seed*13.);
      float thr=(1.-crust)*1.25-.12;
      float m=smoothstep(thr-.025,thr+.025,field);
      // Oxidised skin: dark red-brown, a little amber still glowing where it is thin.
      float fb=fbm(p*9.+3.);
      vec3 base=mix(vec3(.028,.009,.003),vec3(.1,.036,.012),fb);
      base*=.75+.5*vnoise(p*48.+seed*9.);
      base=mix(base,mix(vec3(.012,.01,.016),vec3(.04,.034,.05),fb),jet);
      vec2 cr=voronoi(p*13.+seed*5.);
      base*=mix(1.,.45,smoothstep(.06,0.,cr.x));
      float e=.01;
      vec2 bump=vec2(fbm(p*14.+vec2(e,0))-fbm(p*14.-vec2(e,0)),fbm(p*14.+vec2(0,e))-fbm(p*14.-vec2(0,e)))/(2.*e);
      vec3 Nc=normalize(domeNormal(p)+vec3(-bump*.05,0.));
      vec3 cc2=base*(.45+1.*max(dot(Nc,LK),0.));
      cc2+=pow(max(dot(Nc,normalize(LK+V)),0.),mix(22.,70.,jet))*mix(.05,.3,jet);
      // Where the skin is thin the amber shows through as a dull glow.
      float thin=smoothstep(.33,.18,fbm(p*6.+seed*3.))*(1.-jet);
      cc2+=uBody*uBody*thin*(.07+.2*warm);
      // A pale weathered bloom sits in the hollows.
      cc2=mix(cc2,vec3(.16,.12,.08),smoothstep(.62,.8,fbm(p*7.+seed*11.))*.35*(1.-jet));
      cc2+=jet*vec3(.55,.35,.9)*pow(vnoise(p*70.+seed),18.)*1.2;
      col=mix(col,cc2,m);
      float edge=smoothstep(.04,0.,abs(field-thr))*step(.001,crust)*step(crust,.999);
      col+=edge*vec3(1.,.55,.18)*1.3;
    }
    alpha=inside;
    if(uMisc.z>.5){alpha*=.8;col=mix(col,vec3(.55,.8,1.)*luma*1.4,.35)*(.92+.08*sin(p.y*220.));}
  }

  // The mount: what a lapidary sets a stone in says what it is worth.
  float topY=uShape.y+uShape.w;
  float dy=topY-p.y;
  vec3 N0=domeNormal(p);
  float mm=0.;vec3 mc=vec3(0.);
  if(mount==0.){
    // Common: three wraps of leather cord around the neck.
    float band=step(.035,dy)*step(dy,.175)*step(r,1.07);
    float s=(dy+p.x*.18)/.047;
    float u=fract(s)*2.-1.;
    float strand=band*smoothstep(1.,.8,abs(u));
    if(strand>0.){
      vec2 pd=normalize(vec2(-.18,1.));
      vec3 n=normalize(vec3(pd*(-u)*.95,sqrt(max(1.-u*u,.03))));
      n=normalize(n+vec3(N0.xy*.6,0.));
      float twist=.5+.5*sin((p.x*1.+p.y*.18)*150.+u*2.4+floor(s)*1.3);
      vec3 base=vec3(.34,.2,.11)*(.72+.28*twist);
      vec3 c=base*(.22+.9*max(dot(n,LK),0.))+pow(max(dot(n,normalize(LK+V)),0.),24.)*.12;
      mm=strand*(1.-smoothstep(1.035,1.07,r));mc=c;
    }
  }else if(mount>0.){
    vec3 metal=mount==1.?vec3(.86,.89,.94):(mount==2.?vec3(.8,.78,.9):vec3(1.,.77,.34));
    float rough=mount==3.?.14:.2;
    // Bezel rim (epic, legendary).
    if(mount>=2.){
      float u=(r-.975)/.045;
      if(abs(u)<1.){
        vec2 d=p-uShape.xy;vec2 gdir=normalize(vec2(d.x/(rxHere*rxHere),d.y/(uShape.w*uShape.w))+1e-5);
        vec3 n=normalize(vec3(gdir*u*.95,sqrt(max(1.-u*u,.02))));
        float m=smoothstep(1.,.82,abs(u));
        float bead=mount==3.?.85+.15*sin(atan(d.y,d.x)*48.):1.;
        mm=max(mm,m);mc=mix(mc,shadeMetal(n,metal*bead,rough),m);
      }
    }
    // Bell cap with a scalloped lip.
    float capH=.12+.03*cos(clamp(p.x/.34,-1.,1.)*3.14159)+.016*abs(sin(p.x*23.));
    if(mount<3.&&dy>-.02&&dy<capH&&r<1.05){
      float lip=smoothstep(.022,0.,capH-dy);
      vec3 n=normalize(N0+vec3(0.,-lip*.9,0.)+vec3(0.,.25,0.)*step(dy,.0));
      float engr=.9+.1*sin(atan(p.y-topY,p.x)*30.);
      float m=smoothstep(capH,capH-.01,dy)*(1.-smoothstep(1.02,1.05,r));
      mm=max(mm,m);mc=mix(mc,shadeMetal(n,metal*engr,rough),m);
    }
    // Four claws hold a rare stone.
    if(mount==1.){
      vec2 d=p-uShape.xy;vec2 q=vec2(d.x/rxHere,d.y/uShape.w);
      for(int k=0;k<4;k++){
        float ang=radians(k==0?205.:k==1?335.:k==2?25.:155.);
        vec2 dir=vec2(cos(ang),sin(ang));vec2 pr=vec2(-dir.y,dir.x);
        vec2 l=vec2((dot(q,dir)-1.)/.1,dot(q,pr)/.07);
        float e=dot(l,l);
        if(e<1.){
          vec2 pdir=normalize(vec2(dir.x/rxHere,dir.y/uShape.w));
          vec3 n=normalize(vec3((pdir*l.x+normalize(vec2(-pdir.y,pdir.x))*l.y)*.8,sqrt(1.-e)));
          float m=smoothstep(1.,.8,e);
          mm=max(mm,m);mc=mix(mc,shadeMetal(n,metal,rough),m);
        }
      }
    }
    // World Tree leaves crown a legendary stone.
    if(mount==3.){
      vec2 T0=vec2(uShape.x,topY);
      for(int k=0;k<5;k++){
        float ang=radians(-90.+float(k-2)*30.);
        vec2 dir=vec2(cos(ang),sin(ang));vec2 pr=vec2(-dir.y,dir.x);
        float len=k==2?.2:(k==1||k==3?.17:.13);
        vec2 c=T0+dir*(len*.62+.01);
        float al=dot(p-c,dir)/(len*.62),ac=dot(p-c,pr);
        float w=.042*pow(max(1.-al*al,0.),.7);
        if(abs(al)<1.&&abs(ac)<w){
          float u=ac/w;
          vec3 n=normalize(vec3(pr*u*.8+dir*al*.25,sqrt(max(1.-u*u,.05))));
          float rib=smoothstep(.16,0.,abs(u));
          float m=smoothstep(1.,.85,abs(u));
          vec3 c2=shadeMetal(n,metal*(1.-.35*rib),rough);
          mm=max(mm,m);mc=mix(mc,c2,m);
        }
      }
    }
    // A stone in the cap: rarity's own colour, as on every card frame.
    vec2 gemC=vec2(uShape.x,topY-(mount==3.?.035:.07));
    float gr=mount==3.?.036:.03;
    float gd=length(p-gemC)/gr;
    if(gd<1.){
      vec3 gcol=mount==1.?vec3(.2,.5,1.):(mount==2.?vec3(.62,.32,1.):vec3(.95,.22,.1));
      vec3 n=normalize(vec3((p-gemC)/gr*.9,sqrt(max(1.-gd*gd,.05))));
      vec3 c=gcol*(.35+.65*max(dot(n,LK),0.))+pow(max(dot(n,normalize(LK+V)),0.),90.)*1.2;
      c+=studio(reflect(I,n),.05)*.25;
      float m=smoothstep(1.,.85,gd);
      mm=max(mm,m);mc=mix(mc,c,m);
    }
  }
  mm*=uExtra.x;
  col=mix(col,mc,mm);
  alpha=max(alpha,mm);

  // Legendary halo.
  if(uMisc.w>0.&&r>1.){
    float g=exp(-(r-1.)*5.)*uMisc.w*smoothstep(0.,.16,min(uBox.x-abs(p.x),1.-abs(p.y)));
    vec2 d=p-uShape.xy;
    float rays=.7+.3*sin(atan(d.y,d.x)*18.+uMisc.y*.35);
    float ga=g*rays*.75*(1.-alpha);
    col=col*alpha+vec3(1.,.72,.3)*ga*1.3;
    alpha=alpha+ga;
    col/=max(alpha,1e-4);
  }
  col=mix(col,.8+.2*(1.-exp(-(col-.8)*4.)),step(.8,col));
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  outColor=vec4(col*alpha,alpha);
}`;

  let canvas, gl, program, uniforms, studioTex, resolveUrl = (u) => u;
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
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    uniforms = {};
    for (const name of ["uArt", "uHeight", "uStudio", "uBox", "uArtMap", "uShape", "uForm", "uCut", "uSigma", "uBody", "uFluor", "uState", "uMisc", "uTilt", "uExtra"])
      uniforms[name] = gl.getUniformLocation(program, name);
    gl.uniform1i(uniforms.uArt, 0);
    gl.uniform1i(uniforms.uHeight, 1);
    gl.uniform1i(uniforms.uStudio, 2);
    gl.clearColor(0, 0, 0, 0);
    return gl;
  }

  function texture(url, mips) {
    url = resolveUrl(url);
    if (textures.has(url)) return textures.get(url);
    const job = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
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

  /* Everything the shader needs about one card, derived once. */
  function spec(card, urls) {
    const type = card.type === "spell" ? "spell" : card.type === "weapon" ? "weapon" : "minion";
    const shape = SHAPES[type];
    const cut = { ...CUTS[card.rarity] || CUTS.common };
    if (type === "weapon") cut.facets = 6;
    const body = BODIES[card.class] || BODIES.neutral;
    let seed = 0;
    for (const ch of card.id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    return {
      id: card.id,
      type,
      rarity: card.rarity,
      cls: card.class,
      token: !!card.token,
      focus: (card.focus ?? 20) / 100,
      seed: seed / 9973,
      shape,
      cut,
      body,
      art: urls.art,
      height: urls.height,
    };
  }

  function artMap(s, A) {
    const { c, r, taper } = s.shape;
    const rx = r[0] * (1 + taper);
    const w = Math.max(2 * rx * 1.16, 2 * r[1] * ART_ASPECT * 1.08);
    const h = w / ART_ASPECT;
    const top = c[1] + r[1],
      bottom = c[1] - r[1];
    const target = c[1] + r[1] * (s.type === "spell" ? 0.05 : 0.4);
    let artTop = target + s.focus * h;
    artTop = Math.min(Math.max(artTop, top + 0.05), bottom - 0.05 + h);
    const left = c[0] - w / 2;
    return [1 / w, -1 / h, -left / w, artTop / h];
  }

  /* Paint `s` in `state` into the 2D canvas `target` (its own pixel size). */
  async function paint(target, s, state = {}) {
    ensureContext();
    const [art, height, studio] = await Promise.all([texture(s.art, true), texture(s.height, false), studioTex]);
    const w = target.width,
      h = target.height;
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.max(canvas.width, w);
      canvas.height = Math.max(canvas.height, h);
    }
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, art);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, height);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, studio);
    const A = w / h;
    const { c, r, taper, dome, n, phase } = s.shape;
    gl.uniform2f(uniforms.uBox, A, 1);
    const map = artMap(s, A);
    if (state.breathe) {
      const z = 1 + state.breathe,
        py = c[1] + r[1] * 0.35;
      map[2] += c[0] * map[0] * (1 - 1 / z);
      map[3] += py * map[1] * (1 - 1 / z);
      map[0] /= z;
      map[1] /= z;
    }
    gl.uniform4f(uniforms.uArtMap, ...map);
    gl.uniform4f(uniforms.uShape, c[0], c[1], r[0], r[1]);
    const facets = s.cut.facets || n;
    const facetPhase = s.type === "weapon" ? phase : Math.PI / 2;
    gl.uniform4f(uniforms.uForm, taper, s.cut.irregular, facets, facetPhase);
    gl.uniform4f(uniforms.uCut, dome, s.cut.facets ? 1 : 0, s.cut.gloss, state.bare ? -1 : s.cut.mount);
    gl.uniform4f(uniforms.uExtra, state.mount ?? 1, 0, 0, 0);
    gl.uniform3f(uniforms.uSigma, ...s.body.sigma);
    gl.uniform3f(uniforms.uBody, ...s.body.body);
    gl.uniform3f(uniforms.uFluor, ...s.body.fluor);
    gl.uniform4f(uniforms.uState, state.warm ?? 0, state.crust ?? 0, state.crack ?? 0, state.jet ? 1 : 0);
    gl.uniform4f(uniforms.uMisc, s.seed, state.time ?? 0, s.token ? 1 : 0, s.rarity === "legendary" ? state.halo ?? 1 : 0);
    gl.uniform2f(uniforms.uTilt, state.tilt?.[0] ?? 0, state.tilt?.[1] ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const ctx = target.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
  }

  function configure({ studio, resolve }) {
    if (resolve) resolveUrl = resolve;
    ensureContext();
    studioTex = texture(studio, false);
  }

  return Object.freeze({ SHAPES, CUTS, BODIES, configure, spec, paint });
})();
