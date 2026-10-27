# -*- coding: utf-8 -*-
"""快速视觉复核：首页 / 型式族 / 详情 / 移动端"""
import os, json, threading, http.server, socketserver, functools, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PORT = 8903
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

def shot(pg, name):
    try:
        pg.screenshot(path=os.path.join(ROOT, 'assets', name), animations='disabled', timeout=90000)
        print('ok', name)
    except Exception as e:
        print('FAIL', name, str(e)[:70])

rep, errs = {}, []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome', args=[
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1440, 'height': 1000})
    pg.set_default_timeout(90000)
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    url = 'http://127.0.0.1:%d/' % PORT

    pg.goto(url + PAGE, wait_until='load'); pg.wait_for_timeout(1200)
    shot(pg, 'ui_home.png')
    rep['heroOverflow'] = pg.evaluate("""() => {
        const a=document.querySelector('.hero-art'), l=document.querySelector('.lineup');
        const ar=a.getBoundingClientRect(), lr=l.getBoundingClientRect();
        return { artW: Math.round(ar.width), lineW: Math.round(lr.width),
                 overflowRight: Math.round(lr.right - ar.right) };
    }""")
    pg.evaluate("document.querySelector('.fam-grid').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(400); shot(pg, 'ui_home2.png')

    pg.evaluate("location.hash='#/t/cup1000'"); pg.wait_for_timeout(6500)
    rep['detail'] = pg.evaluate("""() => {
      const c=document.getElementById('three'), h=document.getElementById('viewerHost'), st=h.querySelector('.stage');
      return { canvasW:c.width, canvasH:c.height, stageH:st.clientHeight, hostH:Math.round(h.getBoundingClientRect().height),
               labels:Array.from(document.querySelectorAll('.lbl')).map(e=>e.textContent) };
    }""")
    shot(pg, 'ui_detail.png')

    pg.evaluate("location.hash='#/t/cross1100'"); pg.wait_for_timeout(2500)
    shot(pg, 'ui_detail_cross.png')
    pg.evaluate("location.hash='#/list'"); pg.wait_for_timeout(1500)
    shot(pg, 'ui_list.png')

    if os.environ.get('SKIP_MOBILE'): 
        rep['errors']=errs[:8]
        print(json.dumps(rep,ensure_ascii=False,indent=1)); b.close(); raise SystemExit
    m = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m.set_default_timeout(90000)
    m.goto(url + PAGE, wait_until='load'); m.wait_for_timeout(1200)
    shot(m, 'ui_mobile.png')
    m.evaluate("location.hash='#/t/cup1000'"); m.wait_for_timeout(6500)
    shot(m, 'ui_mobile_detail.png')

    rep['errors'] = errs[:8]
    with open(os.path.join(ROOT, 'assets', 'ui_report.json'), 'w', encoding='utf-8') as f:
        json.dump(rep, f, ensure_ascii=False, indent=1)
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    b.close()
