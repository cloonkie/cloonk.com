import pathlib
from playwright.sync_api import sync_playwright
DIR = pathlib.Path(r"c:\Users\227728\cloonk.com\cloonk.com\projects\fashion")
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True)
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.goto((DIR/"retailer-door-tracker.html").as_uri(),wait_until="load"); pg.wait_for_timeout(800)
    try: pg.click("#guestBtn",timeout=4000); pg.wait_for_timeout(1000)
    except Exception as ex: print("guest:",ex)
    print(pg.evaluate("""() => {
      const ov = document.getElementById('ovEdit');
      const cs = getComputedStyle(ov);
      const out = { parentChain: [], ov: {position:cs.position, inset:cs.inset, left:cs.left, right:cs.right, width:cs.width, offsetParent: ov.offsetParent ? (ov.offsetParent.tagName+'#'+ov.offsetParent.id) : null} };
      // walk ancestors looking for transform/filter/will-change/contain that create a containing block
      let a = ov.parentElement;
      while (a && a !== document.documentElement) {
        const s = getComputedStyle(a);
        if (s.transform!=='none' || s.filter!=='none' || s.backdropFilter!=='none' || s.perspective!=='none' || s.willChange!=='auto' || s.contain!=='none' || s.position==='relative') {
          out.parentChain.push({sel:a.tagName.toLowerCase()+(a.id?'#'+a.id:'')+'.'+(a.className&&a.className.toString?a.className.toString().trim().split(/\\s+/)[0]:''),
            transform:s.transform!=='none', filter:s.filter!=='none', backdrop:s.backdropFilter!=='none', willChange:s.willChange, contain:s.contain, w:Math.round(a.getBoundingClientRect().width)});
        }
        a = a.parentElement;
      }
      out.bodyW = Math.round(document.body.getBoundingClientRect().width);
      out.bodyParent = document.body.parentElement.tagName;
      return out;
    }"""))
    b.close()
