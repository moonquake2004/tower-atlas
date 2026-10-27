# -*- coding: utf-8 -*-
"""只截 3D 详情页：验证某个塔型的建模效果
   用法: python shot3d.py <towerId> [out.png] [宽] [高]"""
import os, sys, threading, http.server, socketserver, functools, time
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PORT = 8917
tid = sys.argv[1] if len(sys.argv) > 1 else 'cat110'
outp = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets', '3d_%s.png' % tid)
VW = int(sys.argv[3]) if len(sys.argv) > 3 else 900
VH = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
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

errs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome', args=[
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': VW, 'height': VH},
                    device_scale_factor=int(os.environ.get('DSF', '1')))
    pg.set_default_timeout(90000)
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append('console:' + m.text[:200]) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:%d/' % PORT + PAGE, wait_until='load')
    pg.wait_for_timeout(1000)
    pg.evaluate("location.hash='#/t/%s'" % tid)
    pg.wait_for_timeout(7000)
    info = pg.evaluate("""() => {
      const c=document.getElementById('three'), h=document.getElementById('viewerHost');
      return {canvas: c?[c.width,c.height]:null, stageH: h?h.querySelector('.stage').clientHeight:null,
              labels: Array.from(document.querySelectorAll('.lbl')).map(e=>e.textContent)};
    }""")
    el = pg.query_selector('#viewerHost .stage')
    (el or pg).screenshot(path=outp)
    print('saved', outp, info, 'errors=', errs[:4])
    b.close()
