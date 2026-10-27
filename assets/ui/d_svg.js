/* ===================== SVG 立面轮廓（正视图 · 格构化） ===================== */
/* 说明：按各型式族的真实结构特征绘制，不冒充任何具体工程
   - 描边使用 vector-effect:non-scaling-stroke，缩略图与卡片大图线宽一致不糊
   - 赭橙圆点 = 导线挂点；灰蓝圆点 = 地线挂点 */
function svgTower(shape){
  const W=220, gY=278, cx=110;
  const ST='#2d4a63';
  const L=(x1,y1,x2,y2,w=1.3,o=1)=>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${ST}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const P=(d,sw=1.4)=>
    `<path d="${d}" fill="none" stroke="${ST}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  // 导线挂点（含绝缘子串短线；st 可指定引线长度，0 = 不画引线）
  const C=(x,y,r=3.8,st=19)=>
    (st>0
      ? `<line x1="${x.toFixed(1)}" y1="${(y-st).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y-r-1).toFixed(1)}" stroke="${ST}" stroke-opacity=".55" stroke-width="1" vector-effect="non-scaling-stroke"/>`
      : '')+
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#c4761a"/>`;
  // 地线挂点（含支架短线）
  const GW=(x,y)=>
    `<line x1="${x.toFixed(1)}" y1="${(y-13).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y-2.5).toFixed(1)}" stroke="${ST}" stroke-opacity=".5" stroke-width="1" vector-effect="non-scaling-stroke"/>`+
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.9" fill="#6d8ba4"/>`;

  let s='';

  /* 格构塔身：(xL0,y0)-(xR0,y0) 底部 → (xL1,y1)-(xR1,y1) 顶部，n 个节间 */
  const shaft=(xL0,xR0,y0,xL1,xR1,y1,n)=>{
    const at=t=>[xL0+(xL1-xL0)*t, xR0+(xR1-xR0)*t, y0+(y1-y0)*t];
    s+=L(xL0,y0,xL1,y1)+L(xR0,y0,xR1,y1);
    for(let i=1;i<=n;i++){
      const [xl,xr,y]=at(i/n);
      s+=L(xl,y,xr,y,0.85,0.72);
    }
    for(let i=0;i<n;i++){
      const [xlA,xrA,yA]=at(i/n), [xlB,xrB,yB]=at((i+1)/n);
      s+=L(xlA,yA,xrB,yB,0.85,0.62);
      s+=L(xrA,yA,xlB,yB,0.85,0.62);
    }
  };

  /* 横担：根在 (xIn,y)，端在 (xOut, y+drop)；hd 为根部高度 */
  const arm=(xIn,xOut,y,hd,drop)=>{
    const d=drop==null?hd*0.26:drop;
    const yOut=y+d;
    s+=L(xIn,y,xOut,yOut,1.25);
    s+=L(xIn,y+hd,xOut,yOut+hd*0.5,1.1);
    for(let i=0;i<=3;i++){
      const t=i/3;
      const x=xIn+(xOut-xIn)*t, yt=y+d*t, yb=y+hd+(d-hd*0.5)*t;
      s+=L(x,yt,x,yb,0.8,0.66);
      if(i<3){
        const t2=(i+1)/3;
        s+=L(x,yb,xIn+(xOut-xIn)*t2,y+d*t2,0.8,0.58);
      }
    }
  };

  s+=`<line x1="6" y1="${gY}" x2="${W-6}" y2="${gY}" stroke="${ST}" stroke-opacity=".26" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/>`;

  if(shape==='cup'){
    /* 酒杯型（单回路，500/1000kV 主力直线塔）
       窄塔身 → 杯腰一道长导线横担 → 杯壁向上外弧张开 → 杯口挂地线 */
    const yWaist=126, yRim=58;
    shaft(76,144,gY, 99,121,yWaist,7);
    // 杯壁：左右各两条弦杆，构成向上张开的瓶形开口
    s+=P(`M99,${yWaist} C92,104 62,86 44,${yRim}`);
    s+=P(`M121,${yWaist} C128,104 158,86 176,${yRim}`);
    s+=P(`M99,${yWaist} C98,110 92,100 88,${yRim+6}`);
    s+=P(`M121,${yWaist} C122,110 128,100 132,${yRim+6}`);
    // 杯壁中段横撑 + 杯口横梁
    s+=L(70,96,150,96,0.85,0.6);
    s+=L(88,yRim+6,132,yRim+6,1.1,0.9);
    s+=L(44,yRim,176,yRim,1.3);
    // 杯口上挑羊角（地线支架）
    s+=L(44,yRim,36,yRim-14,1.1)+L(176,yRim,184,yRim-14,1.1);
    s+=GW(34,yRim-19); s+=GW(186,yRim-19);
    // 三相：两边相挂横担端，中相挂杯腰中央
    s+=C(52,144); s+=C(168,144); s+=C(cx,144);
  }else if(shape==='cat'){
    /* 猫头型（单回路直线塔）—— 按 3A4 山地单回线猫头塔真实结构，自上而下：
       ① 顶部格构横梁（上下双弦 + 交替斜腹杆），两端短竖地线支架
       ② 两侧面颊墙由横梁端向下微外张
       ③ 面颊墙底 = 边相挂点，带两级外伸挂线板
       ④ 面颊底向中心汇合成 V 形下颌（猫嘴）：双弦 + 竖斜腹杆，两臂上弦越过中线互交
       ⑤ 猫鼻小箱，中相挂于其下
       ⑥ 塔身细长近直、微收分
       尺寸按参考图逐行像素归一化：头部宽/高≈0.89，塔身顶半宽 8 → 根开半宽 19 */
    const yGw=38, yBT=44, yBB=51, yCB=88, yNT=102, yNB=110;
    const hBeam=24, hCheek=30, hTop=8, hBase=19;
    // ⑥ 塔身（顶半宽 8 → 根开半宽 19，细长微收分）
    shaft(cx-hBase,cx+hBase,gY, cx-hTop,cx+hTop,yNB,8);
    // ④ V 形下颌：面颊底 → 猫鼻，上弦越过中线与对侧交叉
    [-1,1].forEach(sg=>{
      const xo=cx+sg*hCheek, xu=cx-sg*3, xl=cx+sg*7;
      s+=L(xo,yCB, xu,yNT+2, 1.35);
      s+=L(xo,yCB+7, xl,yNB, 1.1);
      for(let i=1;i<=2;i++){
        const t=i/3;
        const yU=yCB+(yNT+2-yCB)*t, yL=yCB+7+(yNB-yCB-7)*t;
        const xU=xo+(xu-xo)*t, xL=xo+(xl-xo)*t;
        s+=L(xU,yU, xL,yL, 0.78,0.6);
        s+=L(xL,yL, xo+(xu-xo)*((i+1)/3), yCB+(yNT+2-yCB)*((i+1)/3), 0.78,0.5);
      }
    });
    // ②③ 面颊墙（外弦 + 内弦 + 横隔/斜腹杆）+ 两级外伸挂线板
    [-1,1].forEach(sg=>{
      const xtO=cx+sg*hBeam, xtI=cx+sg*(hBeam-8);
      const xbO=cx+sg*hCheek, xbI=cx+sg*(hCheek-8);
      s+=L(xtO,yBB, xbO,yCB, 1.35);
      s+=L(xtI,yBB, xbI,yCB, 1.15);
      for(let i=0;i<=2;i++){
        const t=i/2, yo=yBB+(yCB-yBB)*t;
        const oX=xtO+(xbO-xtO)*t, iX=xtI+(xbI-xtI)*t;
        s+=L(oX,yo, iX,yo, 0.75,0.55);
        if(i<2) s+=L(oX,yo, xtI+(xbI-xtI)*((i+1)/2), yBB+(yCB-yBB)*((i+1)/2), 0.75,0.5);
      }
      s+=L(xbO,yCB, xbO+sg*5,yCB, 1.15);
      s+=L(xbO,yCB-6, xbO+sg*5,yCB-6, 1.05);
      s+=L(xbO+sg*5,yCB-6, xbO+sg*5,yCB, 1.05);
    });
    // ① 顶部格构横梁（上下双弦 + 竖杆 + 交替斜腹杆）+ 两端短竖地线支架
    s+=L(cx-hBeam,yBT, cx+hBeam,yBT, 1.4);
    s+=L(cx-hBeam,yBB, cx+hBeam,yBB, 1.3);
    for(let i=0;i<=4;i++){
      const x=cx-hBeam+2*hBeam*i/4;
      s+=L(x,yBT, x,yBB, 0.72,0.58);
      if(i<4){
        const xn=cx-hBeam+2*hBeam*(i+1)/4;
        s+= i%2===0 ? L(x,yBB,xn,yBT,0.72,0.5) : L(x,yBT,xn,yBB,0.72,0.5);
      }
    }
    s+=L(cx-hBeam,yBT, cx-hBeam-1.5,yGw, 1.15);
    s+=L(cx+hBeam,yBT, cx+hBeam+1.5,yGw, 1.15);
    s+=GW(cx-hBeam-1.5,yGw); s+=GW(cx+hBeam+1.5,yGw);
    // ⑤ 猫鼻小箱（上下横杆 + 交叉腹杆）
    s+=L(cx-hTop,yNT,cx+hTop,yNT,1.2)+L(cx-hTop,yNB,cx+hTop,yNB,1.2);
    s+=L(cx-hTop,yNT,cx-hTop,yNB,1.1)+L(cx+hTop,yNT,cx+hTop,yNB,1.1);
    s+=L(cx-hTop,yNT,cx+hTop,yNB,0.78,0.55)+L(cx+hTop,yNT,cx-hTop,yNB,0.78,0.55);
    // 三相：边相挂面颊底外伸板端，中相挂猫鼻箱下方（引线短，贴构件不外露）
    s+=C(cx-hCheek-5, yCB+2, 3.8, 7); s+=C(cx+hCheek+5, yCB+2, 3.8, 7);
    s+=C(cx, yNB+6, 3.8, 7);
}else if(shape==='stem'){
    /* 干字型（单回路耐张/转角）：塔身近直，上下两层横担，形似「干」字 */
    const yUp=80, yLow=146;
    shaft(84,136,gY, 102,118,64,8);
    arm(103,58,yUp,20);
    arm(117,162,yUp,20);
    arm(102,54,yLow,22);
    arm(118,166,yLow,22);
    // 地线支架
    s+=L(103,64,90,50,1.1)+L(117,64,130,50,1.1);
    s+=GW(88,46); s+=GW(132,46);
    // 中相在上横担中央下方，两边相在下横担两端
    s+=C(cx,96); s+=C(54,166); s+=C(166,166);
  }else if(shape==='drum'){
    /* 鼓型（双回路）：窄高直身，三层横担、中横担最长形成「鼓」形轮廓 */
    const yA=86, yB=132, yC=178;
    shaft(96,124,gY, 104,116,56,10);
    [[yA,50],[yB,74],[yC,54]].forEach(pair=>{
      arm(105,cx-pair[1],pair[0],18);
      arm(115,cx+pair[1],pair[0],18);
    });
    // 三层横担之间的连系杆（鼓形轮廓）
    s+=L(cx-50,yA,cx-74,yB,0.8,0.5)+L(cx+50,yA,cx+74,yB,0.8,0.5);
    s+=L(cx-74,yB,cx-54,yC,0.8,0.5)+L(cx+74,yB,cx+54,yC,0.8,0.5);
    // 地线支架
    s+=L(105,56,92,44,1)+L(115,56,128,44,1);
    s+=GW(90,40); s+=GW(130,40);
    // 双回 6 相：每层横担两端各一相
    s+=C(cx-50,yA+22); s+=C(cx+50,yA+22);
    s+=C(cx-74,yB+22); s+=C(cx+74,yB+22);
    s+=C(cx-54,yC+22); s+=C(cx+54,yC+22);
  }else if(shape==='portal'){
    /* 门型（双柱 + 顶梁）：大跨越、双回或多回共用 */
    const yTop=62;
    shaft(52,74,gY, 58,68,yTop,9);
    shaft(146,168,gY, 152,162,yTop,9);
    // 顶梁（格构梁）
    s+=L(54,yTop,166,yTop,1.4);
    s+=L(54,yTop+18,166,yTop+18,1.3);
    for(let i=0;i<=4;i++){
      const x=54+(166-54)*i/4;
      s+=L(x,yTop,x,yTop+18,0.8,0.62);
      if(i<4) s+=L(x,yTop+18,54+(166-54)*(i+1)/4,yTop,0.8,0.55);
    }
    // 柱间交叉支撑（门型塔显著特征）
    [0.30,0.52,0.74].forEach(f=>{
      const y0=gY-(gY-yTop)*f, y1=gY-(gY-yTop)*(f+0.20);
      s+=L(70,y0,150,y1,0.8,0.5)+L(150,y0,70,y1,0.8,0.5);
      s+=L(70,y1,150,y1,0.75,0.42);
    });
    s+=GW(60,yTop-8); s+=GW(160,yTop-8);
    // 导线均匀挂于顶梁下（多回水平排列）
    [72,98,122,148].forEach(x=>{s+=C(x,yTop+44);});
  }else if(shape==='ramhorn'){
    /* 羊角型（直流）：塔身向上分叉为两只向外上方弯出的羊角，极导线挂角端 */
    const yFork=136;
    shaft(80,140,gY, 100,120,yFork,7);
    // 分叉短柱
    s+=L(103,yFork,106,118,1.2)+L(117,yFork,114,118,1.2);
    // 左右羊角：向外上方弯出
    s+=P(`M106,118 C104,96 128,84 152,62`,1.6);
    s+=P(`M114,118 C116,96 92,84 68,62`,1.6);
    // 羊角内侧收弦
    s+=P(`M106,118 C112,100 126,94 148,72`,1.1);
    s+=P(`M114,118 C108,100 94,94 72,72`,1.1);
    // 角尖上扬
    s+=L(152,62,158,50,1.3)+L(68,62,62,50,1.3);
    s+=GW(57,45); s+=GW(163,45);
    // 直流两极：挂两角端，无中相
    s+=C(150,80); s+=C(70,80);
  }else if(shape==='shang'){
    /* 上字型（单柱）：单顶相 + 双底相，形似「上」字 */
    const yLow=152;
    shaft(92,128,gY, 104,116,58,9);
    arm(104,52,yLow,20);
    arm(116,168,yLow,20);
    // 顶相支架
    s+=L(cx,58,cx,86,1.2);
    // 地线支架
    s+=L(cx,58,96,46,1)+L(cx,58,124,46,1);
    s+=GW(94,42); s+=GW(126,42);
    // 一相在顶、两相在下横担两端
    s+=C(cx,100); s+=C(52,172); s+=C(168,172);
  }else{
    shaft(86,134,gY, 104,116,60,8);
  }

  return `<svg viewBox="4 12 212 284" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/* ===================== 首页主视觉：程序化格构塔立面 ===================== */
function heroTowerSVG(){
  const W=232, H=470, cx=118, gy=H-10;
  const bodyH=H*0.58;                       /* 塔身段高度 */
  const prof=[[0,1],[0.42,0.64],[0.72,0.50],[1,0.42]];
  const half=t=>{
    for(let i=0;i<prof.length-1;i++){
      const a=prof[i], b=prof[i+1];
      if(t<=b[0]){ const u=(t-a[0])/((b[0]-a[0])||1); return (a[1]+(b[1]-a[1])*u)*54; }
    }
    return prof[prof.length-1][1]*54;
  };
  let s='';
  const ln=(x1,y1,x2,y2,w,o)=>s+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#2d4a63" stroke-opacity="'+(o==null?1:o)+'" stroke-width="'+(w==null?1.3:w)+'" stroke-linecap="round"/>';
  const dot=(x,y,r,f)=>s+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r+'" fill="'+f+'"/>';

  /* ---- 塔身 ---- */
  const N=15, P=[];
  for(let i=0;i<=N;i++){
    const t=i/N, y=gy-bodyH*t, h=half(t);
    P.push([cx-h,y,cx+h,y]);
  }
  for(let i=0;i<N;i++){
    ln(P[i][0],P[i][1],P[i+1][0],P[i+1][1],1.75,1);
    ln(P[i][2],P[i][1],P[i+1][2],P[i+1][1],1.75,1);
  }
  for(let i=0;i<=N;i++) ln(P[i][0],P[i][1],P[i][2],P[i][1],0.85,.5);
  for(let i=0;i<N;i++){
    ln(P[i][0],P[i][1],P[i+1][2],P[i+1][1],0.85,.62);
    ln(P[i][2],P[i][1],P[i+1][0],P[i+1][1],0.85,.62);
  }

  /* ---- 上段（颈部） ---- */
  const yNeck=gy-bodyH, wNeck=half(1);
  const yTop=gy-H*0.94, wTop=wNeck*0.46;
  const MN=4, MP=[];
  for(let i=0;i<=MN;i++){
    const t=i/MN, y=yNeck+(yTop-yNeck)*t, h=wNeck+(wTop-wNeck)*t;
    MP.push([cx-h,y,cx+h,y]);
  }
  for(let i=0;i<MN;i++){
    ln(MP[i][0],MP[i][1],MP[i+1][0],MP[i+1][1],1.4,1);
    ln(MP[i][2],MP[i][1],MP[i+1][2],MP[i+1][1],1.4,1);
  }
  for(let i=0;i<=MN;i++) ln(MP[i][0],MP[i][1],MP[i][2],MP[i][1],0.75,.45);
  for(let i=0;i<MN;i++){
    ln(MP[i][0],MP[i][1],MP[i+1][2],MP[i+1][1],0.75,.55);
    ln(MP[i][2],MP[i][1],MP[i+1][0],MP[i+1][1],0.75,.55);
  }

  /* ---- 三层横担 ---- */
  const arms=[
    {t:0.42, reach:84, drop:0},
    {t:0.62, reach:92, drop:0},
    {t:0.82, reach:82, drop:0}
  ];
  const attach=[];
  arms.forEach(a=>{
    const y=yNeck+(yTop-yNeck)*a.t;
    [-1,1].forEach(sg=>{
      const x0=cx+sg*wNeck, x1=cx+sg*a.reach, y1=y-a.drop;
      ln(x0,y,x1,y1,1.5,1);
      ln(x0,y+9,x1,y1,1.1,.7);
      for(let k=1;k<=3;k++){
        const f=k/4, xa=x0+(x1-x0)*f, ya=y+9+(y1-y-9)*f;
        ln(xa,ya,x0+(x1-x0)*(k-1)/4,y+9,0.7,.5);
        ln(xa,ya,x0+(x1-x0)*(k-1)/4,y+9,0.7,.5);
      }
      /* 绝缘子串 + 导线挂点 */
      const yIns=y1+6, yEnd=yIns+34;
      ln(x1,y1,x1,yIns,0.9,.8);
      for(let d=0; d<4; d++) ln(x1,yIns+d*8,x1,yIns+d*8+5,1.9,.95);
      attach.push([x1,yEnd]);
    });
  });
  attach.forEach(p=>dot(p[0],p[1],3.4,'#c4761a'));

  /* ---- 地线支架 ---- */
  const yGw=yTop-2, gwR=30;
  [-1,1].forEach(sg=>{
    const xt=cx+sg*gwR;
    ln(cx,yTop,xt,yGw,1.2,.9);
    ln(xt,yGw,xt,yGw-10,1.6,.9);
    dot(xt,yGw-14,2.8,'#6d8ba4');
  });

  /* ---- 尺寸标注线 ---- */
  const dx=14;
  ln(dx,gy,dx,yTop,0.8,.32);
  ln(dx-5,gy,dx+5,gy,1.0,.55);
  ln(dx-5,yTop,dx+5,yTop,1.0,.55);
  ln(dx-5,gy-bodyH,dx+5,gy-bodyH,0.9,.4);

  /* ---- 地面线 ---- */
  s+='<line x1="0" y1="'+gy+'" x2="'+W+'" y2="'+gy+'" stroke="#2d4a63" stroke-opacity=".22" stroke-width="1" stroke-dasharray="3 6"/>';

  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+s+'</svg>';
}
