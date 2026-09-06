"""Extract approved world illustration layers. Never extract baked cards, heroes,
resources or turn buttons. All interface text remains live. No image upscaling
is described as new high-resolution original artwork.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageEnhance,ImageOps
import numpy as np,json,base64,hashlib,math
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'assets/windborne';OUT.mkdir(exist_ok=True)
source=ROOT/'assets/references/world/approved-village.png'
im=Image.open(source).convert('RGB');W,H=im.size
assert (W,H)==(1536,1024)
polys={
 'brewery':[(0,0),(553,0),(551,157),(558,225),(527,275),(484,300),(390,309),(315,334),(288,394),(278,471),(243,523),(0,543)],
 'observatory':[(1245,0),(1536,0),(1536,547),(1440,520),(1380,480),(1379,405),(1361,355),(1257,325),(1140,300),(1130,253),(1180,207),(1220,129),(1234,50)],
 'mine':[(0,491),(157,491),(192,500),(224,558),(284,614),(301,650),(384,696),(450,718),(482,773),(520,799),(501,827),(434,834),(341,851),(340,889),(0,889)],
 'forge':[(1410,478),(1536,468),(1536,1024),(1352,1024),(1310,944),(1347,911),(1347,871),(1330,811),(1315,769),(1253,751),(1191,731),(1186,663),(1272,611),(1365,564)]
}
manifest={'version':'0.7.0','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'source':'approved-village.png','method':'polygon extraction from approved environment concept; authored board surface and UI materials','assets':{}}
cache={}
def save(key,img,quality=91,**meta):
 p=OUT/(key+'.webp');img.save(p,'WEBP',quality=quality,method=6)
 cache[key]='data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode()
 manifest['assets'][key]={'file':p.name,'size':list(img.size),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),**meta}
for key,points in polys.items():
 mask=Image.new('L',im.size);d=ImageDraw.Draw(mask);d.polygon(points,fill=255)
 # One-pixel soft edge removes jaggies, not a broad blurred backdrop.
 mask=mask.filter(ImageFilter.GaussianBlur(.65))
 box=(min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points))
 layer=im.convert('RGBA');layer.putalpha(mask);layer=layer.crop(box)
 # Blend the last cut edge into the courtyard, retaining the original detailed contour.
 a=np.array(layer.getchannel('A'),dtype=np.float32)
 feather=min(32,layer.height//10);a[-feather:]*=np.linspace(1,0,feather)[:,None]
 layer.putalpha(Image.fromarray(a.astype('uint8')))
 save('building-'+key,layer,crop=list(box),maskPolygon=points,kind='approved concept cutout')
save('horizon',im.crop((0,0,1536,130)),crop=[0,0,1536,130],kind='native-width approved concept skyline; above all gameplay pixels')
# Texture cache uses deterministic noise, not character illustrations.
rng=np.random.default_rng(719)
def material(w,h,base):
 v=np.zeros((h,w),dtype=np.float32)
 for grain,amp in [(4,14),(12,8),(40,5),(128,2)]:
  n=Image.fromarray(rng.integers(0,255,(grain,grain),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC)
  v+=(np.asarray(n,dtype=np.float32)/255-.5)*amp
 v+=rng.normal(0,.9,(h,w))
 return Image.fromarray(np.clip(np.array(base)[None,None,:]+v[:,:,None],0,255).astype('uint8'))
paper=material(512,512,(236,223,187));save('paper',paper,kind='authored paper texture')
wood=material(512,256,(113,102,78));wd=ImageDraw.Draw(wood)
for j in range(35):
 y=7*j+3;points=[(x,y+2*math.sin(x/100+j*.4)) for x in range(0,512,6)];wd.line(points,fill=(119+j%7,105+j%9,80+j%5),width=1)
save('wood',wood,kind='authored muted wood material')
# Parchment/stone board; no fixed numeric labels, minions, hand or hero portraits.
board=Image.new('RGBA',(1600,940)); draw=ImageDraw.Draw(board)
outer=[(155,315),(204,259),(624,184),(686,178),(704,111),(754,85),(844,85),(896,112),(914,179),(976,186),(1374,260),(1435,321),(1446,569),(1400,627),(1123,698),(949,719),(880,757),(724,757),(651,723),(458,701),(220,645),(155,582)]
# Rounded path rendered with a polygon+smoothed mask preserves authored irregularity.
def plate(points,fill,stroke=None,width=1):
 draw.polygon(points,fill=fill)
 if stroke:draw.line(points+[points[0]],fill=stroke,width=width,joint='curve')
plate([(x,y+15) for x,y in outer],(64,58,46,255),(76,66,50,255),8)
plate(outer,(131,118,86,255),(79,75,59,255),4)
for ratio,col,w in [(0.989,(199,187,149,255),3),(.975,(162,145,106,255),8),(.959,(86,81,61,255),2),(.947,(220,204,160,255),3)]:
 pts=[(800+(x-800)*ratio,441+(y-441)*ratio) for x,y in outer];draw.line(pts+[pts[0]],fill=col,width=w,joint='curve')
inner=[(210,315),(240,285),(643,215),(699,207),(736,239),(862,239),(903,211),(952,216),(1333,284),(1382,330),(1391,548),(1341,597),(944,688),(865,716),(739,716),(661,691),(259,610),(210,567),(197,356)]
m=Image.new('L',board.size);ImageDraw.Draw(m).polygon(inner,fill=255)
mat=material(1600,940,(218,195,145)).convert('RGBA')
# Overlay a clean painted patch at low opacity; generated stroke texture is retained.
patch=im.crop((1055,343,1175,450)).resize((420,375),Image.Resampling.BICUBIC).convert('RGBA')
tiled=Image.new('RGBA',board.size)
for y in range(0,940,375):
 for x in range(0,1600,420):
  tile=ImageOps.mirror(patch) if (x//420)%2 else patch
  if (y//375)%2:tile=ImageOps.flip(tile)
  tiled.alpha_composite(tile,(x,y))
patch=tiled
mat=Image.blend(mat,patch,.32);board.alpha_composite(Image.composite(mat,Image.new('RGBA',board.size),m))
draw=ImageDraw.Draw(board);draw.line(inner+[inner[0]],fill=(245,225,174,235),width=3,joint='curve')
# Quiet central seam and four leaf-shaped inlays.
draw.line([(235,433),(580,435),(800,433),(1080,436),(1364,433)],fill=(161,136,86,175),width=2)
for x,y,sx,sy in [(264,302,1,1),(1335,302,-1,1),(264,584,1,-1),(1335,584,-1,-1)]:
 draw.line([(x,y+sy*22),(x,y),(x+sx*46,y)],fill=(153,132,88,160),width=2)
 for j in range(3):
  xx=x+sx*(12+j*12); yy=y+sy*11;draw.polygon([(xx-3,yy),(xx,yy-4),(xx+3,yy),(xx,yy+4)],fill=(159,139,94,130))
# Grain glaze across the whole material, with the transparent silhouette preserved.
glaze=material(1600,940,(154,141,108)).convert('RGBA');glaze.putalpha(board.getchannel('A'))
board=Image.blend(board,glaze,.08)
save('board',board,quality=92,kind='authored transparent stone/wood board, no gameplay pixels')
# A carved leaf medallion for card backs and small UI use; no typography.
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="none" stroke="#d9c79c" stroke-width="2"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="34" opacity=".45"/><path d="M31 69Q24 29 70 26Q82 65 34 72M31 72L69 28M42 61L38 43M49 54L66 56M57 44L55 32"/><path d="M50 2v10M50 88v10M2 50h10M88 50h10"/></g></svg>'''
p=OUT/'leaf-seal.svg';p.write_text(svg);cache['leaf-seal']='data:image/svg+xml;base64,'+base64.b64encode(svg.encode()).decode();manifest['assets']['leaf-seal']={'file':p.name,'kind':'authored vector UI emblem'}
(ROOT/'src/world-assets.js').write_text('/* Approved illustration layers + authored interface textures. */\nconst WindborneAssets='+json.dumps(cache,separators=(',',':'))+';\n')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
# Visual audit of extracted source layers, not a concept design pretending to be gameplay.
contact=Image.new('RGB',(1200,420),(229,221,195))
for j,key in enumerate(polys):
 a=Image.open(OUT/('building-'+key+'.webp')).convert('RGBA');a.thumbnail((294,396));contact.paste(a,(300*j+(294-a.width)//2,(400-a.height)//2),a)
contact.save(OUT/'architecture-contact.jpg',quality=93)
print('Created',len(cache),'world assets; no game-state pixels in board asset')
