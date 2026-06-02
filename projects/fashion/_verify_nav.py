import sys, pathlib
from playwright.sync_api import sync_playwright
DIR = pathlib.Path(r"c:\Users\227728\cloonk.com\cloonk.com\projects\fashion")
PAGES = sys.argv[1:] or ["sellout-standardizer.html"]
EXT = ["fontshare","googleapis","gstatic","cdnjs","mapbox","unpkg","jsdelivr"]
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True)
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True)
    ctx.route("**/*", lambda r: r.abort() if any(h in r.request.url for h in EXT) else r.continue_())
    for name in PAGES:
        pg=ctx.new_page(); errs=[]
        pg.on("console", lambda m,e=errs: e.append(m.text) if m.type=="error" else None)
        pg.on("pageerror", lambda ex,e=errs: e.append("ERR "+str(ex)))
        pg.goto((DIR/name).as_uri(), wait_until="domcontentloaded")
        try: pg.wait_for_selector("#navBurger", timeout=8000)
        except Exception as ex: print(f"### {name}: NO BURGER ({ex})"); pg.close(); continue
        pg.wait_for_timeout(400)
        def st():
            return pg.evaluate("""() => {
              const bg=document.getElementById('navBurger'), ac=document.getElementById('headerActions');
              return { burger: getComputedStyle(bg).display!=='none',
                       acts: ac?getComputedStyle(ac).display:'(none el)',
                       actsRight: ac?Math.round(ac.getBoundingClientRect().right):0,
                       open: document.body.classList.contains('nav-open'),
                       scrollW: document.documentElement.scrollWidth, vw: window.innerWidth };
            }""")
        a=st(); pg.click("#navBurger"); pg.wait_for_timeout(180); o=st()
        pg.mouse.click(120,640); pg.wait_for_timeout(180); c=st()
        ok = (a["burger"] and a["acts"]=="none" and a["scrollW"]<=a["vw"]+1 and
              o["acts"]=="flex" and o["actsRight"]<=o["vw"]+1 and o["scrollW"]<=o["vw"]+1 and c["acts"]=="none")
        print(f"### {name}  {'PASS' if ok else 'CHECK'}")
        print(f"    initial burger={a['burger']} acts={a['acts']} scrollW={a['scrollW']}")
        print(f"    opened  acts={o['acts']} right={o['actsRight']}/{o['vw']} scrollW={o['scrollW']}")
        print(f"    closed  acts={c['acts']}  errors(non-CDN)={[e for e in errs if 'net::' not in e and 'ERR_FAILED' not in e][:3]}")
        pg.close()
    b.close()
