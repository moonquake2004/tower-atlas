# -*- coding: utf-8 -*-
"""towers.json  →  assets/ui/d_towers.gen.js

单一数据源在 towers.json。这个脚本把它转成浏览器直接可用的 JS 字面量。
生成物不要手改 —— 下次构建会被覆盖，校验器也会报「生成物与数据源不一致」。

用法：
    python assets/data/gen_towers_js.py            # 生成并写盘
    python assets/data/gen_towers_js.py --check    # 只比对，不写盘（CI 用）
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'towers.json')
OUT = os.path.join(ROOT, 'assets', 'ui', 'd_towers.gen.js')

HEADER = (
    '/* ===================== 塔型数据（自动生成，勿手改） =====================\n'
    '   数据源：assets/data/towers.json   生成器：assets/data/gen_towers_js.py\n'
    '   要改塔型参数改 JSON，然后重新构建；schema 见 assets/data/towers.schema.json */\n'
)


def js_str(s):
    """把 Python 字符串转成单引号 JS 字符串字面量（含必要转义）。"""
    if s is None:
        return 'null'
    out = []
    for ch in str(s):
        if ch == '\\':
            out.append('\\\\')
        elif ch == "'":
            out.append("\\'")
        elif ch == '\n':
            out.append('\\n')
        elif ch == '\r':
            out.append('\\r')
        elif ch == '\t':
            out.append('\\t')
        else:
            out.append(ch)
    return "'" + ''.join(out) + "'"


def js_num(v):
    """数值：整数不带小数点，浮点原样，None → null。"""
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if abs(v - round(v)) < 1e-9:
            return str(int(round(v)))
        return repr(v)
    return js_str(v)


def gen_object(t):
    """单座塔 → JS 对象字面量。字段名保持旧版扁平结构，另加显式推导字段。"""
    r = t['ranges']
    s = t['spec']
    v = t['render']
    lines = [
        "  { id:%s, name:%s, shape:%s, voltage:%s, circuit:%s, func:%s," % (
            js_str(t['id']), js_str(t['name']), js_str(t['shape']),
            js_str(t['voltage']), js_str(t['circuit']), js_str(t['func'])),
        "    code:%s, hCall:%s, hTotal:%s, rootOpen:%s," % (
            js_str(t['code']), js_str(r['hCall']['text']),
            js_str(r['hTotal']['text']), js_str(r['rootOpen']['text'])),
        "    conductor:%s, gw:%s, insulator:%s," % (
            js_str(s['conductor']), js_str(s['gw']), js_str(s['insulator'])),
        "    wind:%s, ice:%s, weight:%s, spanH:%s," % (
            js_str(s['wind']), js_str(s['ice']), js_str(s['weight']), js_str(s['spanH'])),
        "    apply:%s, desc:%s," % (js_str(t['apply']), js_str(t['desc'])),
        "    ht3d:%s, ro3d:%s, conductorArr:%s, verified:%s," % (
            js_num(v['height']), js_num(v['rootOpen']),
            js_str(v['arrangement']),
            'true' if t['source']['verified'] else 'false'),
        "    line:%s," % js_str(t['source']['line']),
        "    /* 显式推导字段：不再靠正则从中文描述里猜 */",
        "    bundle:%s, itype:%s, callBasis:%s," % (
            js_num(s['bundle']), js_str(s['insulatorType']), js_str(v['callBasis'])),
    ]
    return '\n'.join(lines) + '\n  },'


def build_js(src_path=SRC):
    with io.open(src_path, encoding='utf-8') as f:
        doc = json.load(f)
    body = '\n\n'.join(gen_object(t) for t in doc['towers'])
    return HEADER + 'const TOWERS = [\n' + body + '\n];\n'


def main(argv):
    check = '--check' in argv
    js = build_js()
    if check:
        if not os.path.exists(OUT):
            print('MISSING %s' % OUT)
            return 1
        with io.open(OUT, encoding='utf-8') as f:
            cur = f.read()
        if cur != js:
            print('STALE   %s 与 towers.json 不一致，请运行 python assets/data/gen_towers_js.py'
                  % os.path.relpath(OUT, ROOT))
            return 1
        print('OK      %s 与数据源一致' % os.path.relpath(OUT, ROOT))
        return 0
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('generated %s  %d chars' % (os.path.relpath(OUT, ROOT), len(js)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
