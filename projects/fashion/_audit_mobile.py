import json, pathlib, glob
from playwright.sync_api import sync_playwright

DIR = pathlib.Path(r"c:\Users\227728\cloonk.com\cloonk.com\projects\fashion")
pages = sorted(p.name for p in DIR.glob("*.html"))

MEASURE = """() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1) {
      let cls = (el.className && el.className.toString) ? el.className.toString() : '';
      offenders.push({sel: el.tagName.toLowerCase()+(el.id?('#'+el.id):'')+(cls?('.'+cls.trim().split(/\\s+/).slice(0,2).join('.')):''),
                      w: Math.round(r.width), right: Math.round(r.right)});
    }
  });
  const seen = new Set(); const uniq = [];
  offenders.sort((a,b)=>b.w-a.w).forEach(o=>{ if(!seen.has(o.sel)){seen.add(o.sel); uniq.push(o);} });
  return { scrollW: document.documentElement.scrollWidth, clientW: vw, innerW: window.innerWidth,
           overflow: document.documentElement.scrollWidth - vw, offenders: uniq.slice(0,12) };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True)
    for name in pages:
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m, e=errs: e.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda ex, e=errs: e.append("PAGEERR " + str(ex)))
        try:
            pg.goto((DIR / name).as_uri(), wait_until="load", timeout=20000)
        except Exception as ex:
            print(f"### {name}: LOAD FAIL {ex}"); pg.close(); continue
        pg.wait_for_timeout(900)
        m = pg.evaluate(MEASURE)
        pg.screenshot(path=str(DIR / ("_m_" + name.replace(".html", "") + ".png")), full_page=False)
        flag = "OVERFLOW" if m["overflow"] > 2 else "ok"
        print(f"### {name}  [{flag}]  scrollW={m['scrollW']} client={m['clientW']} overflow={m['overflow']}px  errors={len(errs)}")
        for o in m["offenders"]:
            print(f"      w={o['w']:<5} right={o['right']:<5} {o['sel']}")
        for e in errs[:3]:
            print("      ! " + e[:120])
        pg.close()
    b.close()
print("done")
