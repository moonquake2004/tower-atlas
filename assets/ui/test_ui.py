# -*- coding: utf-8 -*-
"""新版 UI 全流程校验：首页 / 列表 / 详情(3D) / 术语 / 校验依据 / 移动端"""
import os, json, threading, http.server, socketserver, functools, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PORT = 8901
PAGE = '%E9%93%81%E5%A1%94%E5%A4%A7%E5%85%A8.html?v=' + str(int(time.time()))

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    h = functools.partial(Q, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), h) as httpd:
        httpd.serve_forever()

threading.Thread(target=serve, daemon=True).start()
time.sleep(0.8)

from playwright.sync_api import sync_playwright

errors, failed, out = [], [], {}
def step(name, fn):
    try:
        out[name] = fn()
    except Exception as e:
        out[name] = 'ERR: ' + str(e)[:180]

def shot(pg, name):
    try:
        pg.screenshot(path=os.path.join(ROOT, 'assets', name), animations='disabled', timeout=90000)
    except Exception as e:
        print('shot fail', name, str(e)[:80])

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome', args=[
        '--use-gl=angle', '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.set_default_timeout(90000)
    page.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))
    page.on('requestfailed', lambda r: failed.append(r.url[:90]))
    url = 'http://127.0.0.1:%d/' % PORT

    page.goto(url + PAGE, wait_until='load', timeout=90000)
    page.wait_for_timeout(1500)
    step('home', lambda: page.evaluate("""() => ({
        h1: (document.querySelector('.hero h1')||{}).innerText,
        vcells: document.querySelectorAll('.vcell').length,
        fams: document.querySelectorAll('.fam').length,
        cards: document.querySelectorAll('.tcard').length,
        entries: document.querySelectorAll('.entry').length,
        lineup: document.querySelectorAll('.lineup .lu').length,
        tag: (document.querySelectorAll('.htag')[1]||{}).textContent,
        hasUndef: /undefined|NaN/.test(document.body.innerText)
    })"""))
    shot(page, 'ui_home.png')
    page.evaluate("document.querySelector('.fam-grid').scrollIntoView({block:'center'})")
    page.wait_for_timeout(500)
    shot(page, 'ui_home2.png')

    page.evaluate("location.hash='#/list'"); page.wait_for_timeout(1300)
    step('list', lambda: page.evaluate("() => ({ rows: document.querySelectorAll('.rrow').length, chips: document.querySelectorAll('.chip').length, cnt: (document.querySelector('.resbar .cnt')||{}).innerText })"))
    shot(page, 'ui_list.png')

    step('table', lambda: (page.click('.segs button[data-mode=table]'), page.wait_for_timeout(900),
        page.evaluate("() => ({ rows: document.querySelectorAll('table.tbl tbody tr').length, cols: document.querySelectorAll('table.tbl thead th').length })"))[2])
    shot(page, 'ui_table.png')

    step('filter', lambda: (page.evaluate("location.hash='#/list?v=1000kV'"), page.wait_for_timeout(1000),
        page.evaluate("() => ({ rows: document.querySelectorAll('.rrow').length, h1: (document.querySelector('.dhead h1')||{}).textContent })"))[2])
    shot(page, 'ui_list_filter.png')

    page.evaluate("location.hash='#/t/cup1000'"); page.wait_for_timeout(7000)
    step('detail', lambda: page.evaluate("""() => {
        const c = document.getElementById('three'), h = document.getElementById('viewerHost');
        const st = h ? h.querySelector('.stage') : null;
        return { h1:(document.querySelector('.dhead h1')||{}).textContent,
          canvasW:c?c.width:0, canvasH:c?c.height:0,
          stageH: st?st.clientHeight:0,
          hud:(document.getElementById('hud')||{}).textContent,
          sideName:(document.getElementById('sideName')||{}).textContent,
          params:document.querySelectorAll('#sideParams .prow').length,
          labels:Array.from(document.querySelectorAll('.lbl')).map(e=>e.textContent),
          rel:document.querySelectorAll('.rel a').length,
          loadDisplay:getComputedStyle(document.getElementById('load3d')).display };
    }"""))
    shot(page, 'ui_detail.png')

    for tid in ['cat110', 'drum500vh', 'cross1100']:
        page.evaluate("location.hash='#/t/%s'" % tid); page.wait_for_timeout(1600)
    step('after_route', lambda: page.evaluate("() => ({ name:(document.getElementById('sideName')||{}).textContent, labels:Array.from(document.querySelectorAll('.lbl')).map(e=>e.textContent) })"))
    shot(page, 'ui_detail2.png')

    page.evaluate("location.hash='#/'"); page.wait_for_timeout(800)
    page.evaluate("location.hash='#/t/drum1000'"); page.wait_for_timeout(2600)
    step('reenter', lambda: page.evaluate("() => ({ name:(document.getElementById('sideName')||{}).textContent, cw:document.getElementById('three').width })"))

    page.evaluate("location.hash='#/terms'"); page.wait_for_timeout(800)
    step('terms', lambda: page.evaluate("document.querySelectorAll('.titem').length"))
    shot(page, 'ui_terms.png')

    page.evaluate("location.hash='#/sources'"); page.wait_for_timeout(800)
    step('sources', lambda: page.evaluate("document.querySelectorAll('table.tbl tbody tr').length"))
    shot(page, 'ui_sources.png')

    page.evaluate("location.hash='#/'"); page.wait_for_timeout(800)
    page.fill('#qHome', '酒杯'); page.press('#qHome', 'Enter'); page.wait_for_timeout(1000)
    step('search', lambda: page.evaluate("() => ({ hash: decodeURIComponent(location.hash), rows: document.querySelectorAll('.rrow').length })"))

    out['errors'] = errors[:12]
    out['failed'] = failed[:8]
    print(json.dumps(out, ensure_ascii=False, indent=2))

    # ---------- 移动端 ----------
    m = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m.set_default_timeout(90000)
    merr = []
    m.on('pageerror', lambda e: merr.append(str(e)[:160]))
    m.on('console', lambda x: merr.append(x.type + ': ' + x.text) if x.type == 'error' else None)
    m.goto(url + PAGE, wait_until='load', timeout=90000)
    m.wait_for_timeout(1500)
    shot(m, 'ui_mobile.png')
    m.evaluate("location.hash='#/t/cup1000'")
    m.wait_for_timeout(6500)
    print('MOBILE', json.dumps(m.evaluate("""() => {
        const h=document.getElementById('viewerHost');
        const dn=document.querySelector('.dnotes');
        return { hostInDom: !!(h && h.parentElement), hidden: h?h.hidden:null,
                 stageH: h?h.querySelector('.stage').clientHeight:0,
                 canvasW: document.getElementById('three')?document.getElementById('three').width:0,
                 dnotesCols: dn?getComputedStyle(dn).gridTemplateColumns:'none' };
    }"""), ensure_ascii=False))
    print('MOBILE ERR', merr[:6])
    shot(m, 'ui_mobile_detail.png')
    browser.close()
