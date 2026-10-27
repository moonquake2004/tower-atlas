# -*- coding: utf-8 -*-
"""渲染 7 种基本型式的立面总览板，用于横向比对各型式是否相互协调
   用法: python board.py [out.png]"""
import io, os, sys
from playwright.sync_api import sync_playwright

UI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(UI, '..', '..'))
outp = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'svg_board.png')
SHAPES = ['shang', 'cat', 'cup', 'stem', 'drum', 'portal', 'ramhorn']

dsvg = io.open(os.path.join(UI, 'd_svg.js'), encoding='utf-8').read()
cells = ''.join('<figure><div class="b"></div><figcaption>%s</figcaption></figure>' % s for s in SHAPES)
html = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#f2f5f9;font-family:system-ui,'Segoe UI','Microsoft YaHei',sans-serif}
.wrap{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;padding:16px}
figure{margin:0;background:#fff;border:1px solid #dbe3ec;border-radius:10px;padding:8px}
.b svg{width:100%%;height:auto;display:block}
figcaption{text-align:center;font-size:12px;color:#41536b;padding-top:6px}
</style></head><body><div class="wrap">__CELLS__</div>
<script>__JS__</script>
<script>const S=__SHAPES__;
document.querySelectorAll('figure .b').forEach((el,i)=>{el.innerHTML=svgTower(S[i]);});</script>
</body></html>"""
html = (html.replace('__CELLS__', cells).replace('__JS__', dsvg)
            .replace('__SHAPES__', str(SHAPES).replace("'", '"')))

tmp = os.path.join(ROOT, 'assets', '_board.html')
io.open(tmp, 'w', encoding='utf-8').write(html)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='chrome')
    pg = b.new_page(viewport={'width': 1560, 'height': 700}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    pg.goto('file:///' + tmp.replace('\\', '/'), wait_until='load')
    pg.wait_for_timeout(400)
    pg.screenshot(path=outp, full_page=True)
    print('saved', outp, 'errors=', errs)
    b.close()
os.remove(tmp)
