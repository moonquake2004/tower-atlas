# -*- coding: utf-8 -*-
"""组装 铁塔大全.html（暗色科技版 · 三级检索）

塔型数据不在这里维护：数据源是 assets/data/towers.json，
本脚本调用 assets/data/gen_towers_js.py 生成 assets/ui/d_towers.gen.js 再内联。
"""
import io, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
UI   = os.path.join(ROOT, 'assets', 'ui')
DATA = os.path.join(ROOT, 'assets', 'data')
OUT  = os.path.join(ROOT, '铁塔大全.html')

sys.path.insert(0, DATA)
import gen_towers_js

def rd(name):
    with io.open(os.path.join(UI, name), encoding='utf-8') as f:
        return f.read()

importmap = rd('d_importmap.html')
imports  = rd('d_imports.js')
style    = rd('style.css')
body     = rd('body.html')
# 由 towers.json 生成，顺带写盘：审查 diff 时能直接看到数据变成了什么 JS
towers   = gen_towers_js.build_js()
with io.open(os.path.join(UI, 'd_towers.gen.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(towers)
vlevels  = rd('d_vlevels.js')
terms    = rd('d_terms.js')
svg      = rd('d_svg.js')
app      = rd('app.js')

with io.open(os.path.join(ROOT, 'assets', 'viewer3d.js'), encoding='utf-8') as f:
    viewer = f.read()

html = u'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="输电铁塔型式图鉴与参数检索：110kV–±1100kV 共 31 座典型塔型，参数化三维模型、呼高全高根开标注、出处可追溯。" />
<title>铁塔大全 · 输电铁塔型式图鉴与检索</title>
%s
<style>
%s
</style>
</head>
<body>
%s
<script type="module">
%s

/* ===================== 数据 ===================== */
%s

%s

%s

/* ===================== 视图与检索 ===================== */
%s

%s
</script>
</body>
</html>
''' % (importmap, style, body, imports, towers, vlevels, terms, svg + '\n' + app, viewer)

with io.open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)
print('built %s  %.2f MB  %d chars' % (os.path.basename(OUT), len(html.encode('utf-8')) / 1048576.0, len(html)))
