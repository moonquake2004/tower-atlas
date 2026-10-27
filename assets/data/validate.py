# -*- coding: utf-8 -*-
"""铁塔数据集校验器。

四层检查，从「结构对不对」到「渲染出来对不对」：

  L1  schema       towers.json 是否符合 towers.schema.json
  L2  一致性       区间文本 ↔ min/max、min ≤ max、呼高 ≤ 全高、渲染基准落在数据区间内
  L3  完整性       型式是否都有渲染分支、生成物 d_towers.gen.js 是否与数据源同步
  L4  实测         打开构建好的 HTML，逐塔读取三维实际算出的全高/挂点/根开，
                   反查数据区间，并核对「呼高 / 导线挂点」标注用词

用法：
    python assets/data/validate.py              # L1~L3
    python assets/data/validate.py --live       # 追加 L4（需要 playwright + 已构建 HTML）
    python assets/data/validate.py --strict     # 把 WARNING 也当作失败

退出码：0 通过，1 有 ERROR（或 --strict 下有 WARNING）。
"""
import argparse
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

import rangeutil  # noqa: E402

SRC = os.path.join(HERE, 'towers.json')
SCHEMA = os.path.join(HERE, 'towers.schema.json')
GEN_JS = os.path.join(ROOT, 'assets', 'ui', 'd_towers.gen.js')
VIEWER = os.path.join(ROOT, 'assets', 'viewer3d.js')
SVG = os.path.join(ROOT, 'assets', 'ui', 'd_svg.js')
HTML = os.path.join(ROOT, '铁塔大全.html')

CALL_RATIO_LIMIT = 0.90   # 挂点高度超过全高的这个比例，就不能再叫「呼高」

errs = []
warns = []


def err(code, msg):
    errs.append((code, msg))


def warn(code, msg):
    warns.append((code, msg))


def load_doc():
    with io.open(SRC, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------- L1 schema
def check_schema(doc):
    try:
        import jsonschema
    except ImportError:
        warn('W000', '未安装 jsonschema，跳过 L1 结构校验（pip install jsonschema）')
        return
    with io.open(SCHEMA, encoding='utf-8') as f:
        schema = json.load(f)
    validator = jsonschema.Draft7Validator(schema)
    bad = sorted(validator.iter_errors(doc), key=lambda e: [str(p) for p in e.absolute_path])
    for e in bad:
        path = '/'.join(str(p) for p in e.absolute_path) or '(根)'
        where = path
        if isinstance(e.instance, dict) and 'id' in e.instance:
            where = '%s @ %s' % (path, e.instance['id'])
        err('E001', 'schema: %s → %s' % (where, e.message.split('\n')[0][:160]))


# ------------------------------------------------------------ L2 consistency
def check_range(tid, name, r):
    """区间文本与结构化数值必须一致，且 min ≤ max。"""
    reparsed = rangeutil.parse_range_text(r['text'])
    keys = ('min', 'max', 'note', 'approx', 'openEnded')
    diff = [k for k in keys if reparsed[k] != r.get(k)]
    if diff:
        detail = ', '.join('%s: 文本解析=%r 存储=%r' % (k, reparsed[k], r.get(k)) for k in diff)
        err('E004', '%s 的 %s 文本与数值不一致（%s）' % (tid, name, detail))
    if r['min'] is not None and r['max'] is not None and r['min'] > r['max']:
        err('E005', '%s 的 %s 下限 %s 大于上限 %s'
            % (tid, name, rangeutil.fmt(r['min']), rangeutil.fmt(r['max'])))
    if r['openEnded'] and (r['min'] is not None and r['max'] is not None):
        err('E005', '%s 的 %s 标了 openEnded=%s 但两侧都有界限'
            % (tid, name, r['openEnded']))


def check_tower(t, seen_ids, shapes):
    tid = t['id']
    if tid in seen_ids:
        err('E002', 'id 重复：%s' % tid)
    seen_ids.add(tid)

    if t['shape'] not in shapes:
        err('E003', '%s 的 shape=%s 不在 shapeCatalog 中' % (tid, t['shape']))

    r = t['ranges']
    for k in ('hCall', 'hTotal', 'rootOpen'):
        check_range(tid, k, r[k])

    hc, ht, ro = r['hCall'], r['hTotal'], r['rootOpen']

    # 呼高不可能超过全高
    if hc['max'] is not None and ht['max'] is not None and hc['max'] > ht['max'] + 1e-9:
        err('E006', '%s 呼高上限 %s 超过全高上限 %s'
            % (tid, rangeutil.fmt(hc['max']), rangeutil.fmt(ht['max'])))
    if hc['min'] is not None and ht['min'] is not None and hc['min'] < ht['min'] * 0.4:
        warn('W004', '%s 呼高下限 %s 明显低于全高下限 %s，确认是否同一口径'
             % (tid, rangeutil.fmt(hc['min']), rangeutil.fmt(ht['min'])))

    # 三维基准尺寸必须落在资料区间内
    rv = t['render']
    if ht['min'] is not None and not (ht['min'] - 1e-9 <= rv['height'] <= ht['max'] + 1e-9):
        err('E007', '%s 三维全高 %s 落在数据区间 %s 之外'
            % (tid, rangeutil.fmt(rv['height']), ht['text']))
    if ro['min'] is not None and not (ro['min'] - 1e-9 <= rv['rootOpen'] <= ro['max'] + 1e-9):
        err('E008', '%s 三维根开 %s 落在数据区间 %s 之外'
            % (tid, rangeutil.fmt(rv['rootOpen']), ro['text']))

    # 数据侧「有没有呼称高」必须与区间一致
    want = 'hCall' if rangeutil.has_bound(hc) else 'attachment'
    if rv['callBasis'] != want:
        err('E009', '%s 的 render.callBasis=%s，但呼高区间「%s」应当推出 %s'
            % (tid, rv['callBasis'], hc['text'], want))

    # 数据缺口（不阻断构建，但应当逐步补齐）
    s = t['spec']
    if s['bundle'] is None:
        warn('W001', '%s 分裂数未给出（原文：%s），三维按 1 分裂示意'
             % (tid, s['conductor'][:28]))
    if s['bundleSource'] == 'manual':
        warn('W002', '%s 分裂数为人工裁定（%d），原文：%s'
             % (tid, s['bundle'], s['conductor'][:28]))
    if s['insulatorTypeSource'] == 'manual':
        warn('W003', '%s 绝缘串型为人工裁定（%s），原文：%s'
             % (tid, s['insulatorType'], s['insulator'][:28]))


# ------------------------------------------------------------- L3 integrity
def check_branches(doc):
    shapes = set(doc['shapeCatalog'])
    with io.open(VIEWER, encoding='utf-8') as f:
        v3 = f.read()
    with io.open(SVG, encoding='utf-8') as f:
        svg = f.read()
    for shape, meta in doc['shapeCatalog'].items():
        if meta.get('branch', True) is False:
            continue
        for label, src in (('viewer3d.js', v3), ('d_svg.js', svg)):
            hit = re.search(r"shape\s*===\s*['\"]%s['\"]" % re.escape(shape), src) \
                or re.search(r'//\s*%s\b' % re.escape(shape), src)
            if not hit:
                err('E011', '型式 %s 在 %s 里找不到渲染分支' % (shape, label))

    used = {t['shape'] for t in doc['towers']}
    for shape in shapes - used:
        warn('W005', 'shapeCatalog 里的 %s 没有任何塔使用' % shape)


def check_generated():
    import gen_towers_js
    expected = gen_towers_js.build_js(SRC)
    if not os.path.exists(GEN_JS):
        err('E010', '缺少生成物 %s，运行 python assets/data/gen_towers_js.py'
            % os.path.relpath(GEN_JS, ROOT))
        return
    with io.open(GEN_JS, encoding='utf-8') as f:
        cur = f.read()
    if cur != expected:
        err('E010', '%s 与 towers.json 不一致（改完 JSON 忘了重新生成）'
            % os.path.relpath(GEN_JS, ROOT))


# ------------------------------------------------------------------ L4 live
def check_live(doc):
    try:
        import threading
        import time
        import functools
        import http.server
        import socketserver
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        warn('W000', '未安装 playwright，跳过 L4 实测（%s）' % e)
        return

    if not os.path.exists(HTML):
        err('E020', '找不到构建产物 %s，先运行 python assets/ui/build_site.py'
            % os.path.relpath(HTML, ROOT))
        return

    port = 8931

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    def serve():
        h = functools.partial(Handler, directory=ROOT)
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(('127.0.0.1', port), h) as httpd:
            httpd.serve_forever()

    threading.Thread(target=serve, daemon=True).start()
    time.sleep(0.8)

    from urllib.parse import quote
    url = 'http://127.0.0.1:%d/%s?v=%d' % (port, quote(os.path.basename(HTML)), int(time.time()))

    page_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel='chrome', args=[
            '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = browser.new_page(viewport={'width': 900, 'height': 900})
        pg.set_default_timeout(90000)
        pg.on('pageerror', lambda e: page_errors.append(str(e)[:180]))
        pg.goto(url, wait_until='load')
        pg.wait_for_timeout(1500)

        for t in doc['towers']:
            tid = t['id']
            pg.evaluate("location.hash='#/t/%s'" % tid)
            pg.wait_for_timeout(700)
            got = pg.evaluate("""() => {
              const g = window.__towerGroup;
              if (!g || !g.userData) return null;
              const d = g.userData;
              const calls = [...document.querySelectorAll('.lbl-call')].map(e=>e.textContent.trim());
              return {h:d.totalHigh, c:d.callHigh, r:d.rootOpen, s:d.shape,
                      basis:d.callBasis, call: calls[0]||null};
            }""")
            if not got:
                err('E021', '%s 三维未生成（window.__towerGroup 为空）' % tid)
                continue
            rv = t['render']
            if abs(got['h'] - rv['height']) > 0.05:
                err('E020', '%s 三维全高实测 %.2f，数据要求 %.2f' % (tid, got['h'], rv['height']))
            if abs(got['r'] - rv['rootOpen']) > 0.05:
                err('E020', '%s 三维根开实测 %.2f，数据要求 %.2f' % (tid, got['r'], rv['rootOpen']))
            if got['s'] != t['shape']:
                err('E020', '%s 渲染分支为 %s，数据是 %s' % (tid, got['s'], t['shape']))
            if not got['call']:
                err('E022', '%s 找不到呼高/导线挂点标注' % tid)
                continue
            # 标注用词必须由「数据有没有呼高」或「几何比例」共同决定
            ratio = got['c'] / got['h'] if got['h'] else 0
            want = '导线挂点' if (t['render']['callBasis'] == 'attachment'
                                 or ratio > CALL_RATIO_LIMIT) else '呼高'
            if not got['call'].startswith(want):
                err('E023', '%s 标注为「%s」，按规则(s=%s, 挂点比=%.1f%%)应为「%s」'
                    % (tid, got['call'], t['render']['callBasis'], ratio * 100, want))
        browser.close()

    for e in page_errors:
        if 'favicon' in e:
            continue
        err('E024', '页面 JS 报错：%s' % e)


# ---------------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description='铁塔数据集校验')
    ap.add_argument('--live', action='store_true', help='追加三维实测（需 playwright + 已构建 HTML）')
    ap.add_argument('--strict', action='store_true', help='WARNING 也视为失败')
    ap.add_argument('-q', '--quiet', action='store_true', help='只输出汇总')
    args = ap.parse_args(argv)

    doc = load_doc()
    seen = set()
    check_schema(doc)
    for t in doc['towers']:
        check_tower(t, seen, doc['shapeCatalog'])
    check_branches(doc)
    check_generated()
    if args.live:
        check_live(doc)

    if not args.quiet:
        for code, msg in errs:
            print('ERROR  %s  %s' % (code, msg))
        for code, msg in warns:
            print('WARN   %s  %s' % (code, msg))
    print('─' * 60)
    print('%d 座塔 · ERROR %d · WARNING %d' % (len(doc['towers']), len(errs), len(warns)))
    if errs:
        print('结果：不通过')
        return 1
    if warns and args.strict:
        print('结果：--strict 下 WARNING 视为不通过')
        return 1
    print('结果：通过')
    return 0


if __name__ == '__main__':
    sys.exit(main())
