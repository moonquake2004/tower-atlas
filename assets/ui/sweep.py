# -*- coding: utf-8 -*-
"""遍历全部塔型：切 3D 详情，收集 JS 报错与标注"""
import os, re, io, sys, threading, http.server, socketserver, functools, time, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PORT = 8923
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

src = io.open(os.path.join(ROOT, 'assets', 'ui', 'd_towers.js'), encoding='utf-8').read()
ids = re.findall(r"\{ id:'([^']+)'", src)

errs, rows = [], []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome', args=[
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 760, 'height': 980})
    pg.set_default_timeout(90000)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e)[:160])))
    pg.on('console', lambda m: errs.append(('console', m.text[:160])) if (m.type == 'error' and '404' not in m.text and 'favicon' not in m.text) else None)
    pg.goto('http://127.0.0.1:%d/' % PORT + PAGE, wait_until='load')
    pg.wait_for_timeout(1200)
    for tid in ids:
        pg.evaluate("location.hash='#/t/%s'" % tid)
        pg.wait_for_timeout(320)
        info = pg.evaluate("""() => {
          const g = window.__towerGroup;
          const d = g && g.userData;
          return {u: d ? {h:d.totalHigh, c:d.callHigh, r:d.rootOpen, s:d.shape} : null,
                  labels: [...document.querySelectorAll('.lbl')].map(e=>e.textContent.trim())};
        }""")
        rows.append((tid, info))
    b.close()

for tid, info in rows:
    u = info.get('u') or {}
    lab = ' | '.join(info.get('labels') or [])
    print('%-12s H=%s call=%s R=%s  %s' % (tid, u.get('h'), (round(u['c'],1) if u.get('c') else u.get('c')), u.get('r'), lab))
print('ERRORS:', errs if errs else 'none')
