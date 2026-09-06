"""Create a labelled audit contact sheet from actual shipped images. No fonts shipped."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,os,shutil
ROOT=Path(__file__).resolve().parents[1]
def main():
 m=json.loads((ROOT/'assets/anime/manifest.json').read_text())
 font_path=os.environ.get('EMBERFALL_FONT')
 if not font_path and shutil.which('fc-match'):
  font_path=subprocess.check_output(['fc-match','Noto Sans CJK SC','-f','%{file}']).decode().strip()
 if not font_path:
  candidates=[Path('/System/Library/Fonts/PingFang.ttc'),Path('/System/Library/Fonts/STHeiti Medium.ttc'),Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts/msyh.ttc']
  font_path=next((str(p) for p in candidates if p.is_file()),None)
 if not font_path or not Path(font_path).is_file():
  raise SystemExit('Set EMBERFALL_FONT to a local CJK font path for the optional contact sheet. No font is distributed.')
 font=ImageFont.truetype(font_path,15);heading=ImageFont.truetype(font_path,28);small=ImageFont.truetype(font_path,12)
 w,h=196,298;pad=20
 out=Image.new('RGB',(w*7+pad*2,8*h+104),'#ede3cd');d=ImageDraw.Draw(out)
 d.text((pad,15),'烬域 · 全卡池动漫原画',font=heading,fill='#443224')
 d.text((pad,56),'48 张可组牌卡 + 8 张衍生牌 · 56 张独立图版 · 从 8 张确认素材表拆分',font=font,fill='#886b4b')
 for i,(cid,item) in enumerate(m['items'].items()):
  x=pad+(i%7)*w;y=94+(i//7)*h
  im=Image.open(ROOT/'assets/anime'/item['file']).convert('RGB').resize((180,240),Image.Resampling.LANCZOS)
  out.paste(im,(x,y));d.text((x,y+244),item['name'],font=font,fill='#463424');d.text((x,y+267),cid+(' / 衍生牌' if item['token'] else ''),font=small,fill='#987f5b')
 out.save(ROOT/'assets/anime/Contact_Sheet.jpg',quality=94)
 out.resize((706,1244),Image.Resampling.LANCZOS).save(ROOT/'assets/anime/Contact_Sheet_small.jpg',quality=91)
 print('Created 56-card contact sheet')
if __name__=='__main__':main()
