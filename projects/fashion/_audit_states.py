import pathlib
from playwright.sync_api import sync_playwright

DIR = pathlib.Path(r"c:\Users\227728\cloonk.com\cloonk.com\projects\fashion")

MEASURE = """() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1 && r.right > vw + 1) {
      let cls = (el.className && el.className.toString) ? el.className.toString() : '';
      const st = getComputedStyle(el);
      // ignore elements that scroll internally (their overflow is contained)
      if (st.overflowX === 'auto' || st.overflowX === 'scroll' || st.overflowX === 'hidden') return;
      offenders.push({sel: el.tagName.toLowerCase()+(el.id?('#'+el.id):'')+(cls?('.'+cls.trim().split(/\\s+/).slice(0,2).join('.')):''),
                      w: Math.round(r.width), right: Math.round(r.right)});
    }
  });
  const seen=new Set(); const uniq=[];
  offenders.sort((a,b)=>b.right-a.right).forEach(o=>{if(!seen.has(o.sel)){seen.add(o.sel);uniq.push(o);}});
  return { scrollW: document.documentElement.scrollWidth, clientW: vw,
           overflow: document.documentElement.scrollWidth - vw, offenders: uniq.slice(0,8) };
}"""

def report(label, m, errs, pg=None, shot=None):
    flag = "OVERFLOW" if m["overflow"] > 2 else "ok"
    print(f"### {label}  [{flag}]  scrollW={m['scrollW']} overflow={m['overflow']}px errors={len(errs)}")
    for o in m["offenders"]:
        print(f"      w={o['w']:<5} right={o['right']:<5} {o['sel']}")
    for e in errs[:2]:
        print("      ! " + e[:120])
    if pg and shot:
        pg.screenshot(path=str(DIR / shot), full_page=False)

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)

    # 1) selling-analysis: story view + loaded charts
    pg = ctx.new_page(); errs=[]
    pg.on("console", lambda m,e=errs: e.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda ex,e=errs: e.append("PAGEERR "+str(ex)))
    pg.goto((DIR/"selling-analysis.html").as_uri(), wait_until="load")
    pg.wait_for_function("()=>window.SOA&&typeof XLSX!=='undefined'", timeout=15000)
    pg.click("#projectChips .project-chip:first-child"); pg.wait_for_timeout(300)
    report("selling-analysis :: story view (integrity)", pg.evaluate(MEASURE), errs)
    # load sample → charts render
    pg.evaluate("()=>document.getElementById('modePasteBtn').click()"); pg.wait_for_timeout(80)
    pg.evaluate("()=>document.getElementById('loadPasteBtn').click()")
    pg.wait_for_function("()=>document.body.classList.contains('has-data')", timeout=8000); pg.wait_for_timeout(300)
    report("selling-analysis :: loaded charts (velocity)", pg.evaluate(MEASURE), errs, pg, "_s_sa_loaded.png")
    # a generic read with a wide table (replenishment-style) via velocity already; switch to whitespace
    pg.evaluate("""()=>{const c=document.querySelector('#projectChips .project-chip[data-story-id="whitespace"]'); if(c) c.click();}"""); pg.wait_for_timeout(300)
    report("selling-analysis :: whitespace heatmap", pg.evaluate(MEASURE), errs)
    pg.close()

    # 2) door-tracker: enter demo/guest → matrix app
    pg = ctx.new_page(); errs=[]
    pg.on("console", lambda m,e=errs: e.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda ex,e=errs: e.append("PAGEERR "+str(ex)))
    pg.goto((DIR/"retailer-door-tracker.html").as_uri(), wait_until="load"); pg.wait_for_timeout(800)
    try:
        pg.click("#guestBtn", timeout=4000); pg.wait_for_timeout(1200)
    except Exception as ex:
        print("   (guest button:", ex, ")")
    report("door-tracker :: matrix app (demo data)", pg.evaluate(MEASURE), errs, pg, "_s_dt_matrix.png")
    pg.close()

    # 3) sellout: paste mode + open configuration
    pg = ctx.new_page(); errs=[]
    pg.on("console", lambda m,e=errs: e.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda ex,e=errs: e.append("PAGEERR "+str(ex)))
    pg.goto((DIR/"sellout-standardizer.html").as_uri(), wait_until="load"); pg.wait_for_timeout(600)
    report("sellout :: initial (mobile header)", pg.evaluate(MEASURE), errs, pg, "_s_sellout_hdr.png")
    pg.close()

    b.close()
print("done")
