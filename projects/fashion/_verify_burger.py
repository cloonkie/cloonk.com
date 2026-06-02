import pathlib
from playwright.sync_api import sync_playwright
DIR = pathlib.Path(r"c:\Users\227728\cloonk.com\cloonk.com\projects\fashion")
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True)
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True)
    # abort slow external CDNs (fonts, xlsx, mapbox) so the local page parses fast
    ctx.route("**/*", lambda route: route.abort() if any(h in route.request.url for h in
        ["fontshare","googleapis","gstatic","cdnjs","mapbox","unpkg","jsdelivr"]) else route.continue_())
    pg=ctx.new_page(); errs=[]
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERR "+str(e)))
    pg.goto((DIR/"selling-analysis.html").as_uri(),wait_until="domcontentloaded")
    pg.wait_for_selector("#navBurger", timeout=10000)
    pg.wait_for_timeout(500)
    def state():
        return pg.evaluate("""() => {
          const burger=document.getElementById('navBurger');
          const acts=document.getElementById('headerActions');
          const bs=getComputedStyle(burger), as=getComputedStyle(acts);
          const ar=acts.getBoundingClientRect();
          return { burgerVisible: bs.display!=='none',
                   actionsDisplay: as.display,
                   actionsRight: Math.round(ar.right), vw: window.innerWidth,
                   navOpen: document.body.classList.contains('nav-open'),
                   scrollW: document.documentElement.scrollWidth };
        }""")
    s0=state()
    pg.click("#navBurger"); pg.wait_for_timeout(200); s1=state()
    pg.screenshot(path=str(DIR/"_burger_open.png"))
    # click outside (the page body area)
    pg.mouse.click(120, 600); pg.wait_for_timeout(200); s2=state()
    print("errors:", errs)
    print("initial : burgerVisible=%s actionsDisplay=%s navOpen=%s scrollW=%s" % (s0['burgerVisible'], s0['actionsDisplay'], s0['navOpen'], s0['scrollW']))
    print("opened  : actionsDisplay=%s right=%s vw=%s navOpen=%s scrollW=%s" % (s1['actionsDisplay'], s1['actionsRight'], s1['vw'], s1['navOpen'], s1['scrollW']))
    print("outside : actionsDisplay=%s navOpen=%s" % (s2['actionsDisplay'], s2['navOpen']))
    b.close()
