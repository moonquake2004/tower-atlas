/* ===================== 铁塔大全 · 视图与检索 ===================== */
const FAMILIES = [
  { k:'cup',     n:'酒杯型', e:'Wine-glass', d:'曲臂自塔身向外上方扫开成杯口，边相挂曲臂近杯口处、中相吊在杯内横撑上，500kV 及以上单回线路的主力直线塔。' },
  { k:'cat',     n:'猫头型', e:'Cat-head',   d:'塔顶两侧外挑「猫耳」，中相在塔身中线偏高，三相呈三角形，220–750kV 常见直线塔。' },
  { k:'stem',    n:'干字型', e:'Stem',       d:'中柱上下两道横担，形似「干」字。直流极导线与耐张转角塔广泛采用。' },
  { k:'drum',    n:'鼓型',   e:'Drum',       d:'塔身中部外凸成鼓形，多层横担，同塔双回／多回直流与紧凑型线路的典型。' },
  { k:'portal',  n:'门型',   e:'Portal',     d:'双立柱加顶部大梁，通用于大跨越与变电构架。' },
  { k:'ramhorn', n:'羊角型', e:'Ram-horn',   d:'顶部曲臂上扬如羊角，见于早期直流与山区线路。' },
  { k:'shang',   n:'上字型', e:'Shang',      d:'单柱单相，结构最简，110kV 及以下轻载线路。' }
];
const FAM_MAP = Object.fromEntries(FAMILIES.map(f => [f.k, f]));
const VOL_ORDER = VLEVELS.map(o => o.v);

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const qsa = s => Array.from(document.querySelectorAll(s));
const byId = id => document.getElementById(id);

/* 3D 宿主只取一次引用：一旦被摘出文档，getElementById 就再也找不到它 */
const VHOST = document.getElementById('viewerHost');

/* ---------- 电压归组（数据里是自由文本，如「±660kV 直流」「220–500kV」） ---------- */
function volGroup(t) {
  const s = String(t.voltage || '');
  const ms = Array.from(s.matchAll(/(±?)\s*(\d{2,4})\s*kV/g));
  if (!ms.length) return '多电压';
  let n = -1, sign = '';
  ms.forEach(m => { const v = parseInt(m[2], 10); if (v > n) { n = v; sign = m[1]; } });
  return sign + n + 'kV';
}
const VOL_GROUPS = (() => {
  const seen = [];
  TOWERS.forEach(t => { const g = volGroup(t); if (seen.indexOf(g) < 0) seen.push(g); });
  // 按 VLEVELS 顺序排，未收录的排后面
  seen.sort((a, b) => {
    const ia = VOL_ORDER.indexOf(a), ib = VOL_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return seen;
})();

/* ---------- 统计 ---------- */
const STAT = {
  total: TOWERS.length,
  fam: {}, vol: {},
  verified: TOWERS.filter(t => t.verified).length
};
TOWERS.forEach(t => {
  STAT.fam[t.shape] = (STAT.fam[t.shape] || 0) + 1;
  const g = volGroup(t);
  STAT.vol[g] = (STAT.vol[g] || 0) + 1;
});
const has = v => v && v !== '—' && v !== '';
const hTotalOf = t => has(t.hTotal) ? t.hTotal : (t.ht3d != null ? String(t.ht3d) : '—');
const rootOf   = t => has(t.rootOpen) ? t.rootOpen : (t.ro3d != null ? String(t.ro3d) : '—');
const volOf = v => VLEVELS.find(o => o.v === v) || { v, t:'多电压通用', u:'覆盖多个电压等级', cls:'' };
const volRank = v => { const i = VOL_ORDER.indexOf(v); return i < 0 ? 90 : i; };

/* ---------- 立面示意图 ---------- */
function elevSVG(t) {
  return svgTower(t.shape);
}

/* ===================== 顶栏 KPI ===================== */
function paintTop() {
  byId('topmeta').innerHTML =
    '<div class="kpi"><b>' + STAT.total + '</b><span>塔型</span></div>' +
    '<div class="kpi"><b>' + Object.keys(STAT.fam).length + '</b><span>型式族</span></div>' +
    '<div class="kpi"><b>' + STAT.verified + '</b><span>已校验</span></div>';
}

/* ===================== 首页 ===================== */
function viewHome() {
  const hero = TOWERS.find(t => t.id === 'cup1000') || TOWERS[0];
  const picks = ['cup1000', 'cat1000', 'drum1000', 'cross1000', 'stem1100', 'drum750']
    .map(id => TOWERS.find(t => t.id === id)).filter(Boolean);

  const volCells = VOL_GROUPS.map(v => {
    const o = volOf(v);
    const n = STAT.vol[v] || 0;
    const cls = (o.cls || '');
    const inner = '<span class="dot"></span>' +
      '<div class="v">' + esc(String(v).replace('kV', '')) + (/kV$/.test(String(v)) ? '<small>kV</small>' : '') + '</div>' +
      '<div class="t">' + esc(o.t) + '</div>' +
      '<div class="u">' + esc(o.u) + ' · ' + n + ' 座</div>';
    return '<a class="vcell ' + cls + '" href="#/list?v=' + encodeURIComponent(v) + '">' + inner + '</a>';
  }).join('');

  const famCards = FAMILIES.map(f => {
    const n = STAT.fam[f.k] || 0;
    if (!n) return '';
    const sample = TOWERS.find(t => t.shape === f.k);
    return '<a class="fam" href="#/list?s=' + f.k + '">' +
      '<div class="thumb"><span class="cnt">' + n + '</span>' + (sample ? svgTower(f.k) : '') + '</div>' +
      '<div class="bd"><h4>' + f.n + '</h4><div class="en">' + f.e + '</div></div></a>';
  }).join('');

  const pickCards = picks.map(t => tCard(t)).join('');

  const html =
  '<div class="wrap">' +
    '<section class="hero">' +
      '<div>' +
        '<span class="eyebrow">Transmission Tower Atlas · 2026</span>' +
        '<h1>输电铁塔<em>型式图鉴</em><br>与参数检索</h1>' +
        '<p class="lede">从 110kV 到 ±1100kV，收录 ' + STAT.total + ' 座典型塔型，按<strong>电压等级</strong>、<strong>结构型式</strong>与<strong>功能</strong>三级检索。每座塔提供参数化三维模型、呼高／全高／根开标注，并标注数据是否经一手资料校验。</p>' +
        '<div class="search">' +
          '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/></svg>' +
          '<input id="qHome" type="search" placeholder="搜索塔型、电压等级、标杆线路，如 酒杯 / 1000kV / 昌吉" autocomplete="off">' +
          '<kbd>/</kbd>' +
        '</div>' +
        '<div class="hero-tags">' +
          '<span class="htag">7 结构型式族</span>' +
          '<span class="htag">' + VOL_GROUPS.length + ' 电压等级档</span>' +
          '<span class="htag">参数化 3D</span>' +
          '<span class="htag">出处可追溯</span>' +
        '</div>' +
      '</div>' +
      '<div class="hero-art"><div class="ring"></div><div class="ring"></div>' +
        '<div class="lineup"><div class="lu main" style="--h:100%">' + heroTowerSVG() + '</div></div></div>' +
    '</section>' +

    '<div class="hair"></div>' +

    '<section>' +
      '<div class="h2row"><div><span class="eyebrow">Browse by Voltage</span><h2>按电压等级检索</h2></div>' +
        '<span class="sub">' + VOL_GROUPS.length + ' 个等级档 · 交流 ' + VOL_GROUPS.filter(g=>g.indexOf('±')<0).length + ' / 直流 ' + VOL_GROUPS.filter(g=>g.indexOf('±')===0).length + '</span></div>' +
      '<div class="vgrid">' + volCells + '</div>' +
    '</section>' +

    '<div class="hair"></div>' +

    '<section>' +
      '<div class="h2row"><div><span class="eyebrow">Browse by Type</span><h2>按结构型式检索</h2></div>' +
        '<span class="sub">7 个型式族</span></div>' +
      '<div class="fam-grid">' + famCards + '</div>' +
    '</section>' +

    '<div class="hair"></div>' +

    '<section>' +
      '<div class="h2row"><div><span class="eyebrow">Selected</span><h2>重点塔型</h2></div>' +
        '<a class="sub" href="#/list" style="color:var(--cy)">查看全部 ' + STAT.total + ' 座 →</a></div>' +
      '<div class="cards">' + pickCards + '</div>' +
    '</section>' +

    '<div class="hair"></div>' +

    '<section>' +
      '<div class="h2row"><div><span class="eyebrow">Appendix</span><h2>附录</h2></div></div>' +
      '<div class="entry-grid">' +
        entry('#/terms', '术语释义', 'Glossary', '呼称高、全高、根开、代表档距、分裂导线等 12 条关键参数定义。') +
        entry('#/sources', '校验依据', 'Sources', '数据出处、校验方法与未校验项的说明。') +
        entry('#/list?view=table', '全量参数对照表', 'Parameter Table', '一屏对照全部塔型的几何与电气参数。') +
      '</div>' +
    '</section>' +
  '</div>';

  byId('view').innerHTML = html;
  const qi = byId('qHome');
  if (qi) {
    qi.addEventListener('keydown', e => {
      if (e.key === 'Enter') go('#/list?q=' + encodeURIComponent(qi.value.trim()));
    });
  }
}

function entry(href, n, e, d) {
  return '<a class="entry" href="' + href + '">' +
    '<div class="ico"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h13"/></svg></div>' +
    '<h3>' + n + '</h3><div class="en">' + e + '</div><p>' + d + '</p>' +
    '<span class="go">进入 →</span></a>';
}

/* ---------- 塔卡片 ---------- */
function tCard(t) {
  return '<a class="tcard" href="#/t/' + t.id + '">' +
    '<div class="ph"><span class="vh">' + esc(t.code) + '</span>' +
      (t.verified ? '<span class="ok">已校验</span>' : '<span class="ok warn">型式示意</span>') +
      elevSVG(t) + '</div>' +
    '<div class="bd">' +
      '<h4>' + esc(t.name) + '</h4>' +
      '<div class="meta">' + esc(t.voltage) + ' · ' + esc(t.circuit) + ' · ' + esc(t.func) + '</div>' +
      '<div class="nums">' +
        '<div>呼高<b>' + esc(t.hCall) + ' m</b></div>' +
        '<div>全高<b>' + esc(hTotalOf(t)) + ' m</b></div>' +
        '<div>根开<b>' + esc(rootOf(t)) + ' m</b></div>' +
      '</div>' +
      '<div class="ln">' + esc(t.line) + '</div>' +
    '</div></a>';
}

/* ===================== 列表页 ===================== */
function viewList(q) {
  const fV = q.get('v') || '';
  const fS = q.get('s') || '';
  const fF = q.get('f') || '';
  const kw = (q.get('q') || '').trim();
  const mode = q.get('view') === 'table' ? 'table' : 'card';

  let rows = TOWERS.slice();
  if (fV) rows = rows.filter(t => volGroup(t) === fV);
  if (fS) rows = rows.filter(t => t.shape === fS);
  if (fF) rows = rows.filter(t => t.func === fF);
  if (kw) {
    const k = kw.toLowerCase();
    rows = rows.filter(t => (t.name + t.voltage + t.circuit + t.func + t.code + t.line + t.conductor + t.apply).toLowerCase().includes(k));
  }
  rows.sort((a, b) => (volRank(volGroup(a)) - volRank(volGroup(b))) || a.ht3d - b.ht3d);

  const title = fV ? fV + ' 塔型' : fS ? (FAM_MAP[fS] ? FAM_MAP[fS].n : fS) : '塔型库';
  const sub = fV ? (volOf(fV).t + ' · ' + volOf(fV).u) : fS && FAM_MAP[fS] ? FAM_MAP[fS].d : '全部塔型，按电压等级升序';

  const volChips = VOL_GROUPS.map(v => {
    const n = STAT.vol[v] || 0;
    return '<button class="chip' + (fV === v ? ' on' : '') + '" data-f="v" data-v="' + esc(v) + '">' +
      esc(v) + '<span class="n">' + n + '</span></button>';
  }).join('');

  const famChips = FAMILIES.filter(f => STAT.fam[f.k]).map(f =>
    '<button class="chip' + (fS === f.k ? ' on' : '') + '" data-f="s" data-v="' + f.k + '">' + f.n + '<span class="n">' + STAT.fam[f.k] + '</span></button>'
  ).join('');

  const funcs = Array.from(new Set(TOWERS.map(t => t.func)));
  const funcChips = funcs.map(f =>
    '<button class="chip' + (fF === f ? ' on' : '') + '" data-f="f" data-v="' + esc(f) + '">' + esc(f) + '</button>'
  ).join('');

  const body = mode === 'table' ? tableHTML(rows) : rows.length
    ? '<div class="rlist">' + rows.map(t => {
        return '<a class="rrow" href="#/t/' + t.id + '">' +
          '<div class="mini">' + elevSVG(t) + '</div>' +
          '<div><h4>' + esc(t.name) + ' <span style="font-family:var(--fm);font-size:10px;color:var(--tx3)">' + esc(t.code) + '</span></h4>' +
            '<div class="m">' + esc(t.voltage) + ' · ' + esc(t.circuit) + ' · ' + esc(t.func) + (t.verified ? ' · <span style="color:var(--gn)">已校验</span>' : ' · <span style="color:var(--am)">型式示意</span>') + '</div></div>' +
          '<div class="p">' +
            '<div>呼高<b>' + esc(t.hCall) + '</b></div>' +
            '<div>全高<b>' + esc(hTotalOf(t)) + '</b></div>' +
            '<div>根开<b>' + esc(rootOf(t)) + '</b></div>' +
          '</div></a>';
      }).join('') + '</div>'
    : '<div class="panel" style="padding:44px;text-align:center;color:var(--tx3)">没有匹配的塔型，试试放宽筛选条件。</div>';

  byId('view').innerHTML =
  '<div class="wrap">' +
    '<div class="crumb"><a href="#/">检索</a><span class="sep">/</span>' +
      (fV || fS || kw ? '<a href="#/list">塔型库</a><span class="sep">/</span>' : '') +
      '<span>' + esc(title) + '</span></div>' +
    '<div class="dhead"><div><h1>' + esc(title) + '</h1>' +
      '<p style="margin:8px 0 0;color:var(--tx2);font-size:13.5px;max-width:760px">' + esc(sub) + '</p></div></div>' +
    '<div class="listwrap' + (mode === 'table' ? ' tblmode' : '') + '">' +
      '<aside class="filters">' +
        '<div class="fgroup"><h5>电压等级</h5><div class="chips">' + volChips + '</div></div>' +
        '<div class="fgroup"><h5>结构型式</h5><div class="chips">' + famChips + '</div></div>' +
        '<div class="fgroup"><h5>功能</h5><div class="chips">' + funcChips + '</div></div>' +
        '<button class="freset" id="fReset">清空筛选</button>' +
      '</aside>' +
      '<div>' +
        '<div class="resbar">' +
          '<span class="cnt"><b>' + rows.length + '</b> 座塔型' + (kw ? ' · 关键词「' + esc(kw) + '」' : '') + '</span>' +
          '<div class="segs">' +
            '<button data-mode="card" class="' + (mode === 'card' ? 'on' : '') + '">卡片</button>' +
            '<button data-mode="table" class="' + (mode === 'table' ? 'on' : '') + '">表格</button>' +
          '</div>' +
        '</div>' + body +
      '</div>' +
    '</div>' +
  '</div>';

  const base = () => {
    const p = new URLSearchParams();
    if (fV) p.set('v', fV);
    if (fS) p.set('s', fS);
    if (fF) p.set('f', fF);
    if (kw) p.set('q', kw);
    if (mode === 'table') p.set('view', 'table');
    return p;
  };
  qsa('.chip[data-f]').forEach(b => b.addEventListener('click', () => {
    const p = base();
    const key = b.dataset.f;
    if (p.get(key) === b.dataset.v) p.delete(key); else p.set(key, b.dataset.v);
    go('#/list?' + p.toString());
  }));
  const rs = byId('fReset');
  if (rs) rs.addEventListener('click', () => go('#/list'));
  qsa('.segs button').forEach(b => b.addEventListener('click', () => {
    const p = base();
    if (b.dataset.mode === 'table') p.set('view', 'table'); else p.delete('view');
    go('#/list?' + p.toString());
  }));
}

function tableHTML(rows) {
  const head = ['塔型 / 代号', '电压 / 回路', '功能', '呼高 m', '全高 m', '根开 m', '导线', '塔重 t'];
  return '<div class="tblwrap"><table class="tbl"><thead><tr>' +
    head.map(h => '<th>' + h + '</th>').join('') +
    '</tr></thead><tbody>' +
    rows.map(t => '<tr>' +
      '<td class="wrap"><a href="#/t/' + t.id + '" style="color:var(--cy)">' + esc(t.name) + '</a><div style="font-family:var(--fm);font-size:10px;color:var(--tx3);margin-top:2px">' + esc(t.code) + '</div></td>' +
      '<td class="num">' + esc(t.voltage) + '<span class="subcell">' + esc(t.circuit) + '</span></td>' +
      '<td>' + esc(t.func) + '</td>' +
      '<td class="num">' + esc(t.hCall) + '</td>' +
      '<td class="num">' + esc(hTotalOf(t)) + '</td>' +
      '<td class="num">' + esc(rootOf(t)) + '</td>' +
      '<td class="wrap">' + esc(t.conductor) + '</td>' +
      '<td class="num">' + esc(t.weight) + '</td>' +
    '</tr>').join('') + '</tbody></table></div>';
}

/* ===================== 详情页 ===================== */
let viewerBooted = false;
function viewDetail(id) {
  const t = TOWERS.find(x => x.id === id);
  if (!t) { byId('view').innerHTML = '<div class="wrap pad"><div class="panel" style="padding:40px">未找到该塔型。<a href="#/list" style="color:var(--cy)">返回塔型库</a></div></div>'; return; }
  const fam = FAM_MAP[t.shape] || { n:'—', d:'' };
  const rel = TOWERS.filter(x => x.shape === t.shape && x.id !== t.id)
    .sort((a, b) => volRank(a.voltage) - volRank(b.voltage)).slice(0, 4);
  const same = TOWERS.filter(x => volGroup(x) === volGroup(t) && x.id !== t.id).slice(0, 4);

  byId('view').innerHTML =
  '<div class="wrap">' +
    '<div class="crumb"><a href="#/">检索</a><span class="sep">/</span><a href="#/list?v=' + encodeURIComponent(t.voltage) + '">' + esc(t.voltage) + '</a><span class="sep">/</span><span>' + esc(t.name) + '</span></div>' +
    '<div class="dhead"><div>' +
      '<h1>' + esc(t.name) + '</h1>' +
      '<div class="dbadges">' +
        '<span class="badge cy">' + esc(t.voltage) + '</span>' +
        '<span class="badge">' + esc(t.circuit) + '</span>' +
        '<span class="badge">' + esc(t.func) + '</span>' +
        '<span class="badge">型代号 ' + esc(t.code) + '</span>' +
        '<span class="badge">' + fam.n + '</span>' +
        (t.verified ? '<span class="badge gn">✓ 已校验</span>' : '<span class="badge am">型式示意</span>') +
      '</div></div>' +
      '<a href="#/list?s=' + t.shape + '" class="sub" style="color:var(--cy);font-family:var(--fm);font-size:11.5px">同族塔型 →</a>' +
    '</div>' +
    '<div id="dViewerSlot"></div>' +
    '<div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:20px;margin-top:20px" class="dnotes">' +
      '<div class="note"><span class="k">结构说明</span>' + esc(t.desc) + '</div>' +
      '<div class="note"><span class="k">标杆线路 / 适用范围</span>' +
        '<div style="margin-bottom:10px"><b>' + esc(t.line) + '</b></div>' +
        '<div style="font-size:12.5px;color:var(--tx2)">' + esc(t.apply) + '</div>' +
        '<div style="margin-top:12px;font-family:var(--fm);font-size:10.5px;color:var(--tx3);letter-spacing:.06em">' +
          (t.verified ? '数据状态：已与一手资料核对' : '数据状态：型式示意，参数取典型值') + '</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px" class="drel">' +
      '<div><div class="h2row" style="margin-bottom:12px"><h2 style="font-size:16px">同型式族</h2></div><div class="rel">' +
        (rel.length ? rel.map(x => '<a href="#/t/' + x.id + '"><span class="d"></span>' + esc(x.name) + '<small>' + esc(x.voltage) + ' · ' + esc(x.code) + '</small></a>').join('') : '<div style="color:var(--tx3);font-size:13px">本族暂无其他塔型</div>') +
      '</div></div>' +
      '<div><div class="h2row" style="margin-bottom:12px"><h2 style="font-size:16px">同电压等级</h2></div><div class="rel">' +
        (same.length ? same.map(x => '<a href="#/t/' + x.id + '"><span class="d"></span>' + esc(x.name) + '<small>' + esc(x.func) + '</small></a>').join('') : '<div style="color:var(--tx3);font-size:13px">暂无其他塔型</div>') +
      '</div></div>' +
    '</div>' +
    '<div style="height:60px"></div>' +
  '</div>';

  byId('dViewerSlot').appendChild(VHOST);
  VHOST.hidden = false;
  if (window.__startViewer) {
    window.__startViewer(t.id);
    viewerBooted = true;
  } else {
    const l = byId('load3d');
    if (l) l.textContent = '3D 模块未加载';
  }
}

/* ===================== 术语 ===================== */
function viewTerms() {
  byId('view').innerHTML =
  '<div class="wrap">' +
    '<div class="crumb"><a href="#/">检索</a><span class="sep">/</span><span>术语</span></div>' +
    '<div class="dhead"><div><span class="eyebrow">Glossary</span><h1 style="margin-top:8px">关键技术参数术语</h1>' +
      '<p style="margin:8px 0 0;color:var(--tx2);font-size:13.5px">读懂一座塔的参数表，先要认得这几个词。</p></div></div>' +
    '<div class="tgrid">' + TERMS.map(o => '<div class="titem"><h4>' + esc(o.k) + '</h4><p>' + esc(o.v) + '</p></div>').join('') + '</div>' +
    '<div style="height:60px"></div>' +
  '</div>';
}

/* ===================== 校验依据 ===================== */
const REFS = [
  {
    k: '塔型定义与结构特征',
    t: 'DL/T 5154-2012《架空输电线路杆塔结构设计技术规定》',
    d: '国家电网公司输变电工程典型设计（杆塔分册）、湖北省电力设计院《酒杯型、猫头型、羊头型杆塔型式研究》、河北泰晶《鼓字型输电塔》。鼓型塔核心特征据此界定：三层横担、中横担长于上下横担、导线垂直排列。'
  },
  {
    k: '特高压真型试验参数',
    t: '中国电力科学研究院「皖电东送」真型试验',
    d: '1000kV SJ301 / SZT2 参数取自该试验公开报道（SZT2 全高 93.6m / 呼高 48m / 塔重 132t）；±1100kV 昌吉—古泉参数取自环球网、北极星电力网等工程报道；长江大跨越参数取自中国能建中电工程华东院。'
  },
  {
    k: '常规电压等级参数',
    t: '国家电网通用设计子模块 + 设计论文 + 厂家样本',
    d: '110kV 1B4-ZM1 取自厂家技术样本；220kV 鼓型同塔双回取自通用设计 2E/2F/2J 子模块；500kV 鼓型双回取自《500kV 双回路直线塔的串型组合研究》《500kV 同塔多回输电线路技术及其推广应用》（常规鼓型呼高 36m / 全高 64m / 塔重 30.6t；紧凑型呼高 33m / 全高 41m / 塔重 20.44t）；500kV ZB/ZM 系列取自通用设计 5A2 子模块；750kV 取自西北电网工程报道。'
  },
  {
    k: '制造标准',
    t: 'GB/T 2694-2018《输电线路铁塔制造技术条件》',
    d: '配套 DL/T 646《输电线路钢管杆制造技术条件》。杆件材质以 Q235、Q355、Q420 高强钢为主，特高压大跨越塔大量采用 Q420 及以上。'
  }
];

function viewSources() {
  const list = TOWERS.map(t => '<tr><td><a href="#/t/' + t.id + '" style="color:var(--cy)">' + esc(t.name) + '</a></td>' +
    '<td class="num">' + esc(t.voltage) + '</td><td class="num">' + esc(t.code) + '</td>' +
    '<td>' + (t.verified ? '<span style="color:var(--gn)">已校验</span>' : '<span style="color:var(--am)">型式示意</span>') + '</td></tr>').join('');

  const refs = REFS.map((r, i) =>
    '<div class="ref"><div class="no">' + String(i + 1).padStart(2, '0') + '</div>' +
    '<div class="bd"><b>' + esc(r.k) + '：</b>' + esc(r.t) + '<br><i>' + esc(r.d) + '</i></div></div>').join('');

  byId('view').innerHTML =
  '<div class="wrap">' +
    '<div class="crumb"><a href="#/">检索</a><span class="sep">/</span><span>校验依据</span></div>' +
    '<div class="dhead"><div><span class="eyebrow">Sources & Method</span><h1 style="margin-top:8px">数据来源与校验依据</h1></div></div>' +
    '<div class="note"><span class="k">校验原则</span>' +
      '本图鉴只写两类东西：<b>有一手出处的事实</b>，和<b>明确标注为「型式示意」的典型值</b>。凡无法在公开资料（国网通用设计、中国电科院真型试验报告、工程环评公示、设计单位论文）中核到的具体数字，一律不作为事实陈述，只给区间或标为示意。' +
    '</div>' +

    '<div class="h2row" style="margin-top:34px"><div><span class="eyebrow">Standards & References</span><h2>标准规范与文献引用</h2></div>' +
      '<span class="sub">共 ' + REFS.length + ' 类依据</span></div>' +
    '<div class="note" style="margin-top:0"><div class="reflist">' + refs + '</div></div>' +

    '<div class="note" style="margin-top:14px"><span class="k">三维模型说明</span>' +
      '三维视图由塔型的<b>全高、根开、回路数、分裂数、绝缘串型</b>等参数程序化生成，用于理解型式与挂点关系，<b>不是竣工图</b>；杆件截面尺寸、节点板构造与真实设计存在差异。' +
    '</div>' +
    '<div class="note" style="margin-top:14px"><span class="k">关于图片</span>' +
      '塔型卡片使用<b>程序化立面示意图</b>，而非实拍照片。原因：同一型式族内不同电压等级的塔外观差异很小，用一张实拍照片代表多座塔会造成张冠李戴；示意图按型式族的真实结构特征绘制，不冒充任何具体工程。' +
    '</div>' +
    '<div class="h2row" style="margin-top:34px"><div><span class="eyebrow">Verification Ledger</span><h2>逐塔校验台账</h2></div>' +
      '<span class="sub">共 ' + STAT.total + ' 座 · 已校验 ' + STAT.verified + ' 座</span></div>' +
    '<div class="tblwrap"><table class="tbl"><thead><tr><th>塔型</th><th>电压</th><th>型代号</th><th>状态</th></tr></thead><tbody>' + list + '</tbody></table></div>' +
    '<div style="height:60px"></div>' +
  '</div>';
}

/* ===================== 路由 ===================== */
function go(h) {
  if (location.hash === h) route();
  else location.hash = h;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const qi = raw.indexOf('?');
  const path = qi < 0 ? raw : raw.slice(0, qi);
  const q = new URLSearchParams(qi < 0 ? '' : raw.slice(qi + 1));

  // 离开详情页时把 3D 宿主摘出来，保留 WebGL 上下文
  if (VHOST.parentElement && path.indexOf('/t/') !== 0) {
    VHOST.parentElement.removeChild(VHOST);
    VHOST.hidden = true;
  }

  const nav = byId('topnav');
  qsa('a[data-nav]').forEach(a => a.classList.remove('on'));

  if (path === '/' || path === '') { viewHome(); nav.querySelector('[data-nav=home]').classList.add('on'); }
  else if (path === '/list') { viewList(q); nav.querySelector('[data-nav=list]').classList.add('on'); }
  else if (path.indexOf('/t/') === 0) { viewDetail(path.slice(3)); nav.querySelector('[data-nav=list]').classList.add('on'); }
  else if (path === '/terms') { viewTerms(); nav.querySelector('[data-nav=terms]').classList.add('on'); }
  else if (path === '/sources') { viewSources(); nav.querySelector('[data-nav=sources]').classList.add('on'); }
  else { viewHome(); nav.querySelector('[data-nav=home]').classList.add('on'); }

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/input|textarea|select/i.test((e.target.tagName || ''))) {
    const box = byId('qHome') || qsa('.search input')[0];
    if (box) { e.preventDefault(); box.focus(); }
  }
});
paintTop();
setTimeout(route,0);
