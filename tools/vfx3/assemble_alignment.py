"""Assemble the actual sampled frames; no image generation or asset replacement.
Requires Pillow/NumPy and FFmpeg. Supply BENCHMARK_FONT for caption typography.
"""
from pathlib import Path
import os,json,subprocess,math,wave
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2];REC=ROOT/"output/benchmark-r8/recording"
OUT=ROOT/"output/benchmark-r8";VIDEO=OUT/"video";VIDEO.mkdir(exist_ok=True)
def find_font():
 p=os.getenv("BENCHMARK_FONT")
 if p and Path(p).is_file():return p
 try:
  p=subprocess.check_output(["fc-match","Noto Sans CJK SC","-f","%{file}"],text=True).strip()
  if Path(p).is_file():return p
 except (FileNotFoundError,subprocess.SubprocessError):pass
 raise RuntimeError("Set BENCHMARK_FONT to an installed caption font; fonts are not shipped.")
def main():
 m=json.loads((REC/"manifest.json").read_text());fp=find_font()
 large=ImageFont.truetype(fp,31);small=ImageFont.truetype(fp,18);tiny=ImageFont.truetype(fp,15)
 # Produce the SAME dry samples that the game's dedicated mixer consumes.
 js="""const fs=require('fs'),C=require('./src/vfx3/benchmark-cues.js');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));for(const c of m.clips){const a=C.timeline(c.descriptor,44100,1);fs.writeFileSync(c.folder+'/audio.f32',Buffer.from(a.buffer));}"""
 subprocess.run(["node","-e",js,str(REC/"manifest.json")],cwd=ROOT,check=True)
 fps=30;total=0;segments=[]
 for speed in [1,.5]:
  for c in m["clips"]:
   indices=list(range(0,c["frames"],2 if speed==1 else 1))
   start=total
   for idx in indices:
    src=Image.open(Path(c["folder"])/f"{idx:05}.jpg").convert("RGB")
    if speed==.5:src=src.crop((420,65,1220,565)).resize((1440,900),Image.Resampling.LANCZOS)
    draw=ImageDraw.Draw(src)
    label=c["name"];x=42
    draw.rounded_rectangle((26,756,760,878),radius=12,fill=(10,18,27))
    draw.text((x,768),label,font=large,fill=(235,229,208))
    mode="R8 · 1× 原速 / 同步音效" if speed==1 else "R8 · ½× 局部慢放 / 静音"
    draw.text((x,816),mode,font=small,fill=(161,184,199))
    draw.text((x,848),"实际程序演出回看 · 结算数值保留 · 不代表设备实时帧率",font=tiny,fill=(126,149,166))
    src.save(VIDEO/f"{total:05}.jpg",quality=88)
    total+=1
   segments.append({"role":c["role"],"speed":speed,"start_frame":start,"frames":len(indices)})
 rate=44100;audio=np.zeros(math.ceil(total/fps*rate),dtype=np.float32)
 for s,c in zip(segments[:3],m["clips"]):
  a=np.fromfile(Path(c["folder"])/"audio.f32",dtype="<f4")*.64
  off=round(s["start_frame"]/fps*rate);length=min(len(a),round(s["frames"]/fps*rate),len(audio)-off)
  audio[off:off+length]+=a[:length]
 audio=np.clip(audio,-.95,.95)
 with wave.open(str(OUT/"runtime-cues.wav"),"wb") as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((audio*32767).astype("<i2").tobytes())
 cmd=["ffmpeg","-hide_banner","-loglevel","warning","-y","-framerate","30","-i",str(VIDEO/"%05d.jpg"),
      "-i",str(OUT/"runtime-cues.wav"),"-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p",
      "-c:a","aac","-b:a","160k","-movflags","+faststart","-shortest",str(OUT/"Benchmark_Sword_Arts_R8.mp4")]
 subprocess.run(cmd,check=True)
 (OUT/"video-manifest.json").write_text(json.dumps({"fps":fps,"frames":total,"duration":total/fps,"segments":segments,
  "audio":"Same procedural runtime cues, synchronized off-line; original-speed section only.","image_source":"Actual browser program frames; close section is a uniform crop/scale.","performance_claim":False},ensure_ascii=False,indent=2))
 print("Encoded",total,"frames",total/fps,"seconds",flush=True)
if __name__=="__main__":main()
