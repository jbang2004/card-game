"""Build the disposable, offline inspection edition; production remains unchanged."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
html=(ROOT/'index.html').read_text()
# Only this generated inspection copy exposes the testing API. It never uses real storage.
html=html.replace('["127.0.0.1", "localhost"].includes(location.hostname)','true')
html=html.replace('new URLSearchParams(location.search).get("debug") === "1"','true')
html=html.replace('new URLSearchParams(location.search).has("debug")','true')
html=html.replace('() => localStorage','() => window.__VFXMemory')
memory="<script>window.__VFXMemory=(()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}})();</script>"
html=html.replace('<head>','<head>'+memory,1)
tools = ['replay-state.js', 'lab.js']
html=html.replace('</body>', ''.join('<script>'+(ROOT/'tools/vfx3'/name).read_text()+'</script>' for name in tools)+'</body>')
out=ROOT/'Card_Game_3D_VFX_Demo.html';out.write_text(html)
print(out, out.stat().st_size)
