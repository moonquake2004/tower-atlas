# -*- coding: utf-8 -*-
"""参数区间文本的解析与格式化。

数据里既存展示文本（"8–12(柱距)"），也存结构化数值（min/max/note/approx/openEnded）。
两者必须一致 —— validate.py 会用本模块把 text 重新解析一遍，与数值逐字段比对。
"""
import re

_EMPTY = {'—', '-', '–', '', '--'}


def parse_range_text(txt):
    """'12–18' / '≤63' / '~35' / '8–12(柱距)' / '54.5–69.5（一般段）' / '—' → dict"""
    s = (txt or '').strip()
    r = {'text': s, 'min': None, 'max': None, 'note': None,
         'approx': False, 'openEnded': None}
    if s in _EMPTY:
        return r

    m = re.search(r'[（(]([^）)]*)[）)]', s)
    if m:
        r['note'] = m.group(1).strip()
        s = (s[:m.start()] + s[m.end():]).strip()

    if s.startswith('约'):
        r['approx'] = True
        s = s[1:].strip()
    if s.startswith('~') or s.startswith('～'):
        r['approx'] = True
        s = s[1:].strip()
    if s.startswith('≤'):
        r['openEnded'] = 'upper'
        s = s[1:].strip()
    if s.startswith('≥'):
        r['openEnded'] = 'lower'
        s = s[1:].strip()

    nums = re.findall(r'\d+(?:\.\d+)?', s)
    if not nums:
        return r

    vals = [float(x) for x in nums]
    if len(vals) == 1:
        r['min'] = r['max'] = vals[0]
        if r['openEnded'] == 'upper':
            r['min'] = None
        elif r['openEnded'] == 'lower':
            r['max'] = None
    else:
        r['min'], r['max'] = vals[0], vals[1]

    for k in ('min', 'max'):
        if r[k] is not None and abs(r[k] - round(r[k])) < 1e-9:
            r[k] = int(round(r[k]))
    return r


def has_bound(r):
    """区间是否至少给出了一侧界限（'—' 视为完全未给出）。"""
    return r['min'] is not None or r['max'] is not None


def fmt(v):
    if v is None:
        return '—'
    if abs(v - round(v)) < 1e-9:
        return '%d' % int(round(v))
    return ('%.2f' % v).rstrip('0').rstrip('.')
