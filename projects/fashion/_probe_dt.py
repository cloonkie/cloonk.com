import pathlib
from playwright.sync_api import sync_playwright
DIR = pathlib.Path(r"c:\Users\227728\cloonk.com\cloonk.com\projects\fashion")
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True)
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.goto((DIR/"retailer-door-tracker.html").as_uri(),wait_until="load"); pg.wait_for_timeout(800)
    try: pg.click("#guestBtn",timeout=4000); pg.wait_for_timeout(1200)
    except Exception as ex: print("guest:",ex)
    info = pg.evaluate("""() => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      const out = {vw, sw, items: []};
      const mw = document.querySelector('.matrix-wrap');
      if (mw){ const cs=getComputedStyle(mw); out.matrixWrap={w:Math.round(mw.getBoundingClientRect().width), overflowX:cs.overflowX, display:cs.display}; }
      // find static (non-overflow-contained) elements that reach the right edge
      document.querySelectorAll('body *').forEach(el=>{
        const r=el.getBoundingClientRect();
        if (r.right >= sw-2 && r.width>vw){
          // is it inside a scroll container?
          let anc=el.parentElement, contained=false;
          while(anc){ const o=getComputedStyle(anc).overflowX; if(o==='auto'||o==='scroll'||o==='hidden'){contained=true;break;} anc=anc.parentElement; }
          const cls=(el.className&&el.className.toString)?el.className.toString():'';
          out.items.push({sel: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(cls?'.'+cls.trim().split(/\\s+/)[0]:''),
                          w:Math.round(r.width), right:Math.round(r.right), pos:getComputedStyle(el).position, contained});
        }
      });
      const seen=new Set(); out.items=out.items.filter(i=>{const k=i.sel+i.w; if(seen.has(k))return false; seen.add(k); return true;}).slice(0,14);
      return out;
    }""")
    print("vw=",info["vw"],"scrollW=",info["sw"])
    print("matrix-wrap:",info.get("matrixWrap"))
    for i in info["items"]:
        print(f"  w={i['w']:<5} right={i['right']:<5} pos={i['pos']:<8} contained={i['contained']!s:<5} {i['sel']}")
    b.close()
print("done")
