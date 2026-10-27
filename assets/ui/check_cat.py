# -*- coding: utf-8 -*-
"""单型式立面放大复核：把指定 shape 的 SVG 放大渲染成 PNG，便于与真实图纸逐一对照
   用法: python check_cat.py cat [out.png] [宽]"""
import io, os, sys
from playwright.sync_api import sync_playwright

UI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(UI, '..', '..'))
shape = sys.argv[1] if len(sys.argv) > 1 else 'cat'
outp = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets', 'svg_%s.png' % shape)
W = int(sys.argv[3]) if len(sys.argv) > 3 else 300

with io.open(os.path.join(UI, 'd_svg.js'), encoding='utf-8') as f:
    dsvg = f.read()

html = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#fff}
#box{width:__W__px;padding:6px;box-sizing:content-box}
#box svg{width:100%%;height:auto;display:block}
</style></head><body><div id="box"></div>
<script>__JS__</script>
<script>document.getElementById('box').innerHTML = svgTower('__SHAPE__');</script>
</body></html>""".replace('__JS__', dsvg).replace('__SHAPE__', shape).replace('__W__', str(W))

tmp = os.path.join(ROOT, 'assets', '_check_%s.html' % shape)
with io.open(tmp, 'w', encoding='utf-8') as f:
    f.write(html)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    pg = b.new_page(viewport={'width': W + 40, 'height': 900}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file:///' + tmp.replace('\\', '/'), wait_until='load')
    pg.wait_for_timeout(300)
    el = pg.query_selector('#box')
    el.screenshot(path=outp)
    print('saved', outp, os.path.getsize(outp), 'bytes', 'errors=', errs)
    b.close()
os.remove(tmp)
