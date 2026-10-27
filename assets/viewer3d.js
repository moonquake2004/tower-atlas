/* ===================== 3D 铁塔（重制版 · 真实格构） ===================== */
const canvas=document.getElementById('three');
const stage=canvas.parentElement;
const load3d=document.getElementById('load3d');
let renderer,labelRenderer,scene,camera,controls,towerGroup,labelGroup;
let wireMode=false,autoRotate=false,SUN=null,GROUND=null,SKY=null,CONTACT=null;

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const UPV=new THREE.Vector3(0,1,0);
const IDQ=new THREE.Quaternion();
const SUN_AZ=-0.74, SUN_EL=0.86;   // 太阳方位/仰角（弧度）：左侧前上方，形体分明

/* ---------- 单位几何（共享，不随塔销毁） ---------- */
const GEO_ROD=new THREE.CylinderGeometry(1,1,1,6,1,false);
const GEO_ANGLE=new THREE.CylinderGeometry(1,1,1,4,1,false); GEO_ANGLE.rotateY(Math.PI/4);
const GEO_DISC=new THREE.CylinderGeometry(1,0.62,0.30,14,1,false);
const GEO_BOX=new THREE.BoxGeometry(1,1,1);

/* ---------- 材质（镀锌钢 + 环境反射） ---------- */
const M_LEG   =new THREE.MeshStandardMaterial({color:0x8d97a5,metalness:0.50,roughness:0.50,envMapIntensity:0.60});
const M_BRACE =new THREE.MeshStandardMaterial({color:0x818b99,metalness:0.46,roughness:0.56,envMapIntensity:0.55});
const M_ARM   =new THREE.MeshStandardMaterial({color:0x949eac,metalness:0.50,roughness:0.48,envMapIntensity:0.60});
const M_COND  =new THREE.MeshStandardMaterial({color:0x545c66,metalness:0.34,roughness:0.52,envMapIntensity:0.45});
const M_GW    =new THREE.MeshStandardMaterial({color:0xaeb5be,metalness:0.44,roughness:0.52,envMapIntensity:0.55});
const M_CER   =new THREE.MeshStandardMaterial({color:0x8d6350,metalness:0.10,roughness:0.36,envMapIntensity:0.90});
const M_CAP   =new THREE.MeshStandardMaterial({color:0x9ba4ae,metalness:0.48,roughness:0.48,envMapIntensity:0.6});
const M_CONC  =new THREE.MeshStandardMaterial({color:0x8d939a,metalness:0.02,roughness:0.96});

const INST_DEF={
  leg:{geo:GEO_ANGLE,mat:M_LEG},
  brace:{geo:GEO_ROD,mat:M_BRACE},
  arm:{geo:GEO_ANGLE,mat:M_ARM},
  web:{geo:GEO_ROD,mat:M_BRACE},
  disc:{geo:GEO_DISC,mat:M_CER},
  cond:{geo:GEO_ROD,mat:M_COND},
  gw:{geo:GEO_ROD,mat:M_GW},
  cap:{geo:GEO_ROD,mat:M_CAP},
  conc:{geo:GEO_BOX,mat:M_CONC}
};

/* ---------- 实例批处理 ---------- */
let BATCH=null;
function resetBatch(){ BATCH={}; for(const k in INST_DEF) BATCH[k]=[]; }
const _d=new THREE.Vector3(), _q=new THREE.Quaternion();
function mem(key,a,b,r){
  const dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
  const len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-5;
  _d.set(dx/len,dy/len,dz/len);
  _q.setFromUnitVectors(UPV,_d);
  BATCH[key].push([(a.x+b.x)*0.5,(a.y+b.y)*0.5,(a.z+b.z)*0.5,_q.x,_q.y,_q.z,_q.w,r,len,r]);
}
function put(key,p,q,sx,sy,sz){
  BATCH[key].push([p.x,p.y,p.z,q.x,q.y,q.z,q.w,sx,sy,sz]);
}
function flushBatches(group){

  for(const k in BATCH){
    const arr=BATCH[k]; if(!arr.length) continue;
    const def=INST_DEF[k];
    const mesh=new THREE.InstancedMesh(def.geo,def.mat,arr.length);
    const o=new THREE.Object3D();
    for(let i=0;i<arr.length;i++){
      const a=arr[i];
      o.position.set(a[0],a[1],a[2]);
      o.quaternion.set(a[3],a[4],a[5],a[6]);
      o.scale.set(a[7],a[8],a[9]);
      o.updateMatrix(); mesh.setMatrixAt(i,o.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    // 格构塔杆件远小于阴影贴图纹素，实时投影只会糊成脏影，故统一关闭
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    mesh.frustumCulled=false;
    group.add(mesh);
  }
  BATCH=null;
}

/* ---------- 塔身轮廓（分段变坡，接近真实） ---------- */
function profileFn(pts,baseHalf){
  return (t)=>{
    if(t<=pts[0][0]) return baseHalf*pts[0][1];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1];
      if(t<=b[0]){ const u=(t-a[0])/((b[0]-a[0])||1); return baseHalf*(a[1]+(b[1]-a[1])*u); }
    }
    return baseHalf*pts[pts.length-1][1];
  };
}
function buildBody(o){
  const baseHalf=o.baseHalf, y0=o.y0||0, height=o.height, panels=o.panels;
  const prof=profileFn(o.profile,baseHalf);
  const rings=[];
  for(let i=0;i<=panels;i++){
    const t=i/panels, h=y0+height*t;
    const half=Math.max(baseHalf*0.06,prof(t));
    rings.push([V(-half,h,-half),V(half,h,-half),V(half,h,half),V(-half,h,half)]);
  }
  const legR=o.legR, braceR=o.braceR, topLegR=o.topLegR||legR*0.55;
  for(let i=0;i<panels;i++){
    const r=legR+(topLegR-legR)*(i/panels);
    for(let c=0;c<4;c++) mem('leg',rings[i][c],rings[i+1][c],r);
  }
  for(let i=0;i<=panels;i++){
    const r=braceR*(1-0.40*i/panels);
    for(let c=0;c<4;c++){ const c2=(c+1)%4; mem('brace',rings[i][c],rings[i][c2],r); }
  }
  for(let i=0;i<panels;i++){
    const r=braceR*(1-0.40*i/panels);
    for(let c=0;c<4;c++){
      const c2=(c+1)%4;
      mem('brace',rings[i][c],rings[i+1][c2],r);
      mem('brace',rings[i][c2],rings[i+1][c],r);
    }
  }
  const topHalf=Math.max(baseHalf*0.06,prof(1));
  return {topHalf, topY:y0+height};
}

/* ---------- 横担（空间桁架） ---------- */
function buildArm(x0,y0,x1,y1,w,h,steps,chordR,webR){
  const P=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    const x=x0+(x1-x0)*t, y=y0+(y1-y0)*t;
    const ww=w*(1-0.28*t), hh=h*(1-0.18*t);
    P.push({
      a:V(x,y+hh*0.5,-ww*0.5), b:V(x,y+hh*0.5,ww*0.5),
      c:V(x,y-hh*0.5,-ww*0.5), d:V(x,y-hh*0.5,ww*0.5)
    });
  }
  for(let i=0;i<steps;i++){
    mem('arm',P[i].a,P[i+1].a,chordR); mem('arm',P[i].b,P[i+1].b,chordR);
    mem('arm',P[i].c,P[i+1].c,chordR); mem('arm',P[i].d,P[i+1].d,chordR);
  }
  for(let i=0;i<=steps;i++){
    mem('web',P[i].a,P[i].b,webR); mem('web',P[i].c,P[i].d,webR);
    mem('web',P[i].a,P[i].c,webR); mem('web',P[i].b,P[i].d,webR);
  }
  for(let i=0;i<steps;i++){
    mem('web',P[i].a,P[i+1].c,webR); mem('web',P[i+1].a,P[i].c,webR);
    mem('web',P[i].b,P[i+1].d,webR); mem('web',P[i+1].b,P[i].d,webR);
    mem('web',P[i].a,P[i+1].b,webR); mem('web',P[i+1].a,P[i].b,webR);
    mem('web',P[i].c,P[i+1].d,webR); mem('web',P[i+1].c,P[i].d,webR);
  }
  return {x:x1,y:y1};
}

/* ---------- 绝缘子串 ---------- */
function insChain(a,b,discR){
  const dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
  const len=Math.sqrt(dx*dx+dy*dy+dz*dz);
  if(len<0.4) return;
  _d.set(dx/len,dy/len,dz/len);
  _q.setFromUnitVectors(UPV,_d);
  const n=Math.max(4,Math.round(len/(discR*1.32)));
  const step=len/n;
  const p=new THREE.Vector3();
  for(let i=0;i<n;i++){
    p.set(a.x+_d.x*(i+0.5)*step, a.y+_d.y*(i+0.5)*step, a.z+_d.z*(i+0.5)*step);
    put('disc',p,_q,discR,discR*1.5,discR);
  }
  mem('cap',a,b,Math.max(discR*0.15,0.02));
  put('cap',a,_q,discR*0.6,discR*1.2,discR*0.6);
  put('cap',b,_q,discR*0.6,discR*1.2,discR*0.6);
}

/* ---------- 导线 ---------- */
function bundleOffsets(n,R){
  if(n<=1) return [[0,0]];
  if(n===2) return [[-R,0],[R,0]];
  const out=[];
  for(let i=0;i<n;i++){
    const ang=Math.PI*2*i/n+(n===4?Math.PI/4:0);
    out.push([Math.cos(ang)*R,Math.sin(ang)*R]);
  }
  return out;
}
/* 弧垂公式：塔位（z=z0）是导线的**最高点**，向两侧渐降，到半档处降到 -sag。
   曾写成 sag*(1-(z/half)²)，符号反了——这样塔位处反而最低、半档处最高，
   于是每根线都从挂点往下掉一个 sag，看起来就是「导线悬浮在挂点下方」。
   sag 在 stem110 上只有 0.92 m 不明显，但 cross1000 半档 66.6 m / sag 5.7 m，
   整根导线会离挂点悬空近 6 m。 */
function drawBundle(attach,half,sag,n,bR,r){
  const offs=bundleOffsets(n,bR);
  const N=16;
  const z0=attach.z||0;            // 耐张串沿 z 外伸，导线须从串端接起
  for(let k=0;k<offs.length;k++){
    const ox=offs[k][0], oy=offs[k][1];
    let prev=null;
    for(let i=0;i<=N;i++){
      const t=i/N, z=z0-half+2*half*t;
      const dz=(z-z0)/half;
      const y=attach.y+oy-sag*dz*dz;
      const cur=V(attach.x+ox,y,z);
      if(prev) mem('cond',prev,cur,r);
      prev=cur;
    }
  }
}
function drawGW(x,yTop,half,sag,r){
  const N=14; let prev=null;
  for(let i=0;i<=N;i++){
    const t=i/N, z=-half+2*half*t;
    const dz=z/half;
    const cur=V(x,yTop-sag*dz*dz,z);
    if(prev) mem('gw',prev,cur,r);
    prev=cur;
  }
}

/* ---------- 相别解析 ---------- */
function deriveData(t){
  const isDC=/直流/.test(t.voltage||'');
  const circ=t.circuit||'';
  let phases=3;
  if(isDC) phases=/双回/.test(circ)?4:2;
  else if(/四回/.test(circ)) phases=12;
  else if(/三回/.test(circ)) phases=9;
  else if(/双回/.test(circ)) phases=6;
  // 分裂数与绝缘串型优先取数据里的显式字段（assets/data/towers.json 的 spec.bundle /
  // spec.insulatorType）。这两个值原来是从中文描述里正则猜的，猜错过：
  // 「直流悬垂/耐张」被「耐张」抢先命中，把直线塔画成了耐张塔。
  // 只有老数据缺字段时才回落到文本解析。
  let bundle;
  if(typeof t.bundle==='number'&&t.bundle>=1&&t.bundle<=8){
    bundle=t.bundle;
  }else{
    const cs=t.conductor||'';
    let m=/(\d+)\s*×\s*(?:LGJ|JL|AACSR|JLHA|LGJK)/i.exec(cs);
    if(!m) m=/(\d+)\s*×/.exec(cs);
    bundle=m?parseInt(m[1],10):1;
    if(bundle>8||bundle<1) bundle=1;
  }
  let itype;
  if(t.itype==='I'||t.itype==='V'||t.itype==='II'||t.itype==='T'){
    itype=t.itype;
  }else{
    const ins=t.insulator||'';
    itype='I';
    if(/耐张/.test(ins)) itype='T';
    else if(/V/.test(ins)) itype='V';
    else if(/双|多串|II/.test(ins)) itype='II';
  }
  return {isDC,phases,bundle,itype,circ};
}

/* ---------- 挂一相 ---------- */
let _minAttach=Infinity;
function addPhase(mount,o){
  const len=o.insLen, R=o.discR, spanHalf=o.spanHalf, sag=o.sag;
  const n=o.bundle, bR=o.bundleR, cR=o.cR;
  let attach;
  if(o.itype==='T'){
    const end=V(mount.x,mount.y,mount.z+spanHalf*0.09);
    insChain(mount,end,R);
    attach=end;
  } else if(o.itype==='V'){
    const off=Math.min(len*0.42,o.baseHalf*0.38);
    const bot=V(mount.x,mount.y-len,mount.z);
    insChain(V(mount.x-off,mount.y,mount.z),bot,R);
    insChain(V(mount.x+off,mount.y,mount.z),bot,R);
    attach=bot;
  } else if(o.itype==='II'){
    const off=Math.max(R*1.5,0.3);
    const b1=V(mount.x,mount.y-len,mount.z-off), b2=V(mount.x,mount.y-len,mount.z+off);
    insChain(mount,b1,R); insChain(mount,b2,R);
    attach=V(mount.x,mount.y-len,mount.z);
  } else {
    const bot=V(mount.x,mount.y-len,mount.z);
    insChain(mount,bot,R);
    attach=bot;
  }
  drawBundle(attach,spanHalf,sag,n,bR,cR);
  if(mount.y<_minAttach) _minAttach=mount.y;   // 呼称高按横担悬挂点计，不含绝缘子串
  return attach;
}

/* ---------- 建塔 ---------- */
function buildTower(t){
  resetBatch();
  const g=new THREE.Group();
  const H=t.ht3d, R=t.ro3d;
  const baseHalf=Math.max(1.4,R*0.5);
  const D=deriveData(t);
  const shape=t.shape;

  const insLen=Math.max(1.6,Math.min(13,H*0.095));
  const discR=Math.max(0.28,Math.min(0.86,H*0.0066));
  // 线径/档距（导线细而可见，档距不抢占画面）
  const spanHalf=Math.min(H*0.40,Math.max(H*0.24,baseHalf*1.65));
  const sag=spanHalf*0.085;
  const cR=Math.max(0.026,H*0.00085);
  const bundleR=Math.max(0.30,H*0.0054);
  const gwR=Math.max(0.032,H*0.0010);

  const opt={insLen,discR,spanHalf,sag,bundle:D.bundle,bundleR,itype:D.itype,cR,baseHalf};
  _minAttach=Infinity;

  const P=Math.max(5,Math.round(H/7));

  if(shape==='cup'){
    /* 酒杯型：塔身 →「杯腰」导线横担（边相）→ 窄颈 → 顶部外张的杯口（地线）
       这个三段式轮廓才是酒杯塔，而不是简单的 V 形曲臂 */
    const yArm=H*0.615, bodyH=yArm;
    const body=buildBody({baseHalf,y0:0,height:bodyH,panels:P,
      profile:[[0,1],[0.45,0.70],[1,0.56]],
      legR:baseHalf*0.076,braceR:baseHalf*0.030});
    const th=body.topHalf;
    // 杯腰：贯穿塔身的导线横担
    const reach=baseHalf*1.58;
    [-1,1].forEach(s=>{
      buildArm(0,yArm, s*reach,yArm, baseHalf*0.30, baseHalf*0.25, 4, baseHalf*0.023, baseHalf*0.0105);
    });
    // 窄颈：自横担向上明显收窄
    const yNeck=H*0.845, neckHalf=th*0.62;
    buildBody({baseHalf:th,y0:yArm,height:yNeck-yArm,panels:3,
      profile:[[0,1],[1,0.62]],legR:th*0.30,braceR:th*0.13,topLegR:th*0.20});
    // 杯口：自颈顶向两侧外张
    const yRim=H*0.952, gwReach=reach*0.76;
    [-1,1].forEach(s=>{
      buildArm(s*neckHalf,yNeck, s*gwReach,yRim, baseHalf*0.23, baseHalf*0.19, 3, baseHalf*0.019, baseHalf*0.0090);
    });
    // 杯口横梁：两壁顶之间的水平桁架。中相就挂在它跨中——
    // 「杯口托住中相」是酒杯塔的判据；中相若挂在杯腰中央，悬垂串会整根埋进塔身
    buildArm(-gwReach,yRim, gwReach,yRim, baseHalf*0.21, baseHalf*0.175,
             Math.max(3,Math.round(gwReach)), baseHalf*0.018, baseHalf*0.0085);
    // 杯口顶部：每片杯壁各自向外上挑一枚地线小支架（杯沿）
    [-1,1].forEach(s=>{
      buildArm(s*gwReach*0.70,yRim, s*gwReach,yRim+H*0.016, baseHalf*0.20, baseHalf*0.17, 2, baseHalf*0.017, baseHalf*0.0082);
    });
    // 三相三角形排列：两边相挂下横担端（低），中相自杯口横梁跨中垂入杯内（高）
    addPhase(V(-reach*0.94,yArm,0),opt);
    addPhase(V( reach*0.94,yArm,0),opt);
    // 中相串不能长过杯内净高，否则导线会压在窄颈顶上——留 25% 余量
    addPhase(V(0,yRim,0), Object.assign({},opt,{
      insLen:Math.min(insLen,(yRim-yNeck)*0.75)
    }));
    // 地线：杯口两端
    drawGW(-gwReach,yRim+H*0.016,spanHalf,sag*0.72,gwR);
    drawGW( gwReach,yRim+H*0.016,spanHalf,sag*0.72,gwR);
  }

  else if(shape==='cat'){
    /* 猫头型 3D —— 对照 3A4 山地单回线猫头塔立面图，自上而下：
       ① 顶部格构横梁（沿 X 的空间桁架梁）+ 两端短地线支架
       ② 两侧面颊墙由横梁端向下微外张
       ③ 面颊墙底 = 边相挂点（外伸挂线板）
       ④ 面颊底向中心汇合成 V 形下颌（猫嘴）
       ⑤ 猫鼻箱，中相挂于其下（中相比边相低，这是猫头塔的相序特征）
       ⑥ 塔身细长近直、微收分
       竖向比例取自参考图归一化值：塔身顶 0.700 / 猫鼻顶 0.733 / 面颊底 0.792 / 梁底 0.946 / 梁顶 0.975 */
    const yBodyTop=H*0.700;
    // 塔身顶半宽按全高定（参考图塔身顶半宽≈0.028H，与头半宽之比 0.22）；
    // 若沿用 profile 固定 0.42×根开，1000kV 塔顶部会宽到 4m，猫鼻和中相都没处安放
    const profTop=Math.max(0.16,Math.min(0.45,(H*0.030)/baseHalf));
    const body=buildBody({baseHalf,y0:0,height:yBodyTop,panels:P,
      profile:[[0,1],[0.30,0.78],[0.62,0.55],[1,profTop]],
      legR:baseHalf*0.074,braceR:baseHalf*0.029});
    const th=body.topHalf;
    const yNoseT=H*0.733, yCheekBot=H*0.792, yBeamT=H*0.975, yBeamB=H*0.972;
    const noseHalf=th;
    // 头部宽度按全高取比例（参考图头部宽 0.25H、高 0.275H，宽高比 0.91），
    // 不能绑根开：1000kV 塔根开/全高达 0.25，绑根开会把猫头压成扁宽状
    const cheekHalf=H*0.130, beamHalf=H*0.098;
    const zW=H*0.016, yD=H*0.011;
    // ⑤ 猫鼻箱（塔身顶正上方一小段，与塔身顶等宽）
    buildBody({baseHalf:noseHalf,y0:yBodyTop,height:yNoseT-yBodyTop,panels:1,
      profile:[[0,1],[1,1]],legR:noseHalf*0.32,braceR:noseHalf*0.14,topLegR:noseHalf*0.32});
    // ④ V 形下颌：面颊底 → 猫鼻顶
    [-1,1].forEach(s=>{
      buildArm(s*cheekHalf,yCheekBot, s*noseHalf,yNoseT, zW*0.82,yD*0.82,2, baseHalf*0.020, baseHalf*0.0092);
    });
    // ②③ 两侧面颊墙：横梁底 → 面颊底（微外张）
    [-1,1].forEach(s=>{
      buildArm(s*beamHalf,yBeamB, s*cheekHalf,yCheekBot, zW,yD,3, baseHalf*0.021, baseHalf*0.0095);
    });
    // ① 顶部格构横梁
    buildArm(-beamHalf,yBeamT, beamHalf,yBeamT, zW*1.04,yD*1.04,4, baseHalf*0.022, baseHalf*0.0100);
    // 地线短支架（梁端上挑）+ 地线
    const gwHalf=beamHalf+H*0.006, yGw=yBeamT+H*0.021;
    [-1,1].forEach(s=>{
      buildArm(s*beamHalf,yBeamT, s*gwHalf,yGw, zW*0.44,yD*0.44,1, baseHalf*0.016, baseHalf*0.0080);
    });
    drawGW(-gwHalf,yGw,spanHalf,sag*0.70,gwR);
    drawGW( gwHalf,yGw,spanHalf,sag*0.70,gwR);
    // 边相：面颊底外伸挂线板端
    const stub=H*0.007;
    [-1,1].forEach(s=>{
      buildArm(s*cheekHalf,yCheekBot, s*(cheekHalf+stub),yCheekBot, zW*0.40,yD*0.40,1, baseHalf*0.015, baseHalf*0.0075);
      addPhase(V(s*(cheekHalf+stub),yCheekBot,0),opt);
    });
    // 中相：猫鼻箱底中央，比两边相低。串长必须短于「塔身顶到猫鼻」的空间，
    // 否则长串会把导线压进塔身内部——参考图里中相导线正好落在塔身顶部开口处
    addPhase(V(0,yBodyTop,0), Object.assign({},opt,{
      itype:'I', insLen:Math.min(insLen,H*0.022)
    }));
  }

  else if(shape==='shang'){
    const yArm=H*0.70, bodyH=yArm;
    const body=buildBody({baseHalf,y0:0,height:bodyH,panels:P,
      profile:[[0,1],[0.45,0.64],[0.78,0.46],[1,0.40]],
      legR:baseHalf*0.074,braceR:baseHalf*0.029});
    const th=body.topHalf;
    buildBody({baseHalf:th,y0:bodyH,height:H*0.30,panels:3,
      profile:[[0,1],[1,0.55]],legR:th*0.34,braceR:th*0.15,topLegR:th*0.22});
    const reach=baseHalf*1.68;
    [-1,1].forEach(s=>{
      buildArm(0,yArm, s*reach,yArm, baseHalf*0.26, baseHalf*0.22, 3, baseHalf*0.020, baseHalf*0.009);
    });
    // 顶相（塔顶中央，地线之下）
    addPhase(V(0,H*0.935,0),opt);
    // 两下相
    addPhase(V(-reach*0.94,yArm,0),opt);
    addPhase(V(reach*0.94,yArm,0),opt);
    drawGW(0,H,spanHalf,sag*0.7,gwR);
  }

  else if(shape==='stem'){
    const bodyH=H*0.68;
    const body=buildBody({baseHalf,y0:0,height:bodyH,panels:P,
      profile:[[0,1],[0.45,0.66],[1,0.42]],
      legR:baseHalf*0.076,braceR:baseHalf*0.030});
    const th=body.topHalf;
    buildBody({baseHalf:th,y0:bodyH,height:H*0.32,panels:3,
      profile:[[0,1],[1,0.62]],legR:th*0.32,braceR:th*0.14,topLegR:th*0.20});
    if(D.isDC){
      const reach=baseHalf*1.48, yPole=bodyH;
      [-1,1].forEach(s=>{ buildArm(0,yPole, s*reach,yPole, baseHalf*0.30, baseHalf*0.24, 3, baseHalf*0.021, baseHalf*0.010); });
      addPhase(V(-reach*0.95,yPole,0),opt);
      addPhase(V(reach*0.95,yPole,0),opt);
      // 地线支架：自塔顶斜率外伸，接到地线点（否则地线悬在塔身外）
      [-1,1].forEach(s=>{ mem('arm',V(s*th*0.55,H*0.985,0),V(s*baseHalf*0.62,H*0.965,0),baseHalf*0.016); });
      drawGW(-baseHalf*0.62,H*0.965,spanHalf,sag*0.7,gwR);
      drawGW(baseHalf*0.62,H*0.965,spanHalf,sag*0.7,gwR);
    } else {
      const reach=baseHalf*1.36, yArm=bodyH, yTop=H*0.855;
      [-1,1].forEach(s=>{ buildArm(0,yArm, s*reach,yArm, baseHalf*0.28, baseHalf*0.22, 3, baseHalf*0.021, baseHalf*0.010); });
      addPhase(V(0,yTop,0),opt);
      addPhase(V(-reach*0.95,yArm,0),opt);
      addPhase(V(reach*0.95,yArm,0),opt);
      [-1,1].forEach(s=>{ mem('arm',V(s*th*0.58,H*0.995,0),V(s*baseHalf*0.66,H*0.975,0),baseHalf*0.016); });
      drawGW(-baseHalf*0.66,H*0.975,spanHalf,sag*0.7,gwR);
      drawGW(baseHalf*0.66,H*0.975,spanHalf,sag*0.7,gwR);
    }
  }

  else if(shape==='drum'){
    const bodyH=H*0.88;
    // 鼓型：塔身中下部外凸成"鼓"，再收至塔顶
    const DRUM_PROF=[[0,1],[0.30,0.945],[0.52,0.905],[0.74,0.720],[1,0.500]];
    const body=buildBody({baseHalf,y0:0,height:bodyH,panels:Math.max(6,Math.round(H/6)),
      profile:DRUM_PROF,
      legR:baseHalf*0.074,braceR:baseHalf*0.029});
    const th=body.topHalf;
    const lv=Math.max(1,Math.round(D.phases/2));
    const yTopArm=H*(D.isDC?0.80:0.84);
    const yBotArm=H*(D.isDC?0.60:0.46);
    for(let i=0;i<lv;i++){
      const t=lv===1?0.5:i/(lv-1);
      const y=yBotArm+(yTopArm-yBotArm)*t;
      const bulge=1-Math.abs(t-0.5)*0.72;
      const reach=baseHalf*(1.00+0.52*bulge);
      const wAt=profileFn(DRUM_PROF,baseHalf)(y/bodyH);
      [-1,1].forEach(s=>{
        buildArm(s*Math.max(wAt*0.96,baseHalf*0.12),y, s*reach,y, baseHalf*0.25, baseHalf*0.21, 3, baseHalf*0.020, baseHalf*0.0095);
      });
      addPhase(V(-reach,y,0),opt);
      addPhase(V(reach,y,0),opt);
    }
    const gwOut=baseHalf*0.72, yGw=H*0.965;
    [-1,1].forEach(s=>{
      // 起点必须落在塔身顶（bodyH）上；曾写成 bodyH+H*0.04，支架整体悬空 0.04H
      buildArm(s*th*0.9,bodyH, s*gwOut,yGw, baseHalf*0.20, baseHalf*0.18, 2, baseHalf*0.017, baseHalf*0.008);
    });
    drawGW(-gwOut,yGw,spanHalf,sag*0.7,gwR);
    drawGW(gwOut,yGw,spanHalf,sag*0.7,gwR);
  }

  else if(shape==='portal'){
    const colX=Math.max(baseHalf*1.08,1.2);
    const colHalf=Math.max(baseHalf*0.30,0.55);
    const panels=Math.max(8,Math.round(H/6.5));
    const taperX=t=>1-0.16*t, taperW=t=>1-0.52*t;
    const beamY=H*0.945;                 // 横梁高度：塔柱止于此，不再空伸到 1.0H
    // 双柱（各自格构，自下向上收分）
    [-1,1].forEach(s=>{
      const rings=[];
      for(let i=0;i<=panels;i++){
        const t=i/panels,h=beamY*t;
        const hw=colHalf*taperW(t);
        const cx=s*colX*taperX(t);
        rings.push([V(cx-hw,h,-hw),V(cx+hw,h,-hw),V(cx+hw,h,hw),V(cx-hw,h,hw)]);
      }
      for(let c=0;c<4;c++) for(let i=0;i<panels;i++){
        mem('leg',rings[i][c],rings[i+1][c],colHalf*(0.145-0.055*i/panels));
      }
      for(let i=0;i<=panels;i++) for(let c=0;c<4;c++){ const c2=(c+1)%4; mem('brace',rings[i][c],rings[i][c2],colHalf*0.052); }
      for(let i=0;i<panels;i++) for(let c=0;c<4;c++){
        const c2=(c+1)%4;
        mem('brace',rings[i][c],rings[i+1][c2],colHalf*0.052);
        mem('brace',rings[i][c2],rings[i+1][c],colHalf*0.052);
      }
    });
    // 顶部大梁（贯通两柱）
    const bx=colX*taperX(0.945), bhw=colHalf*taperW(0.945);
    buildArm(-bx,beamY, bx,beamY, bhw*2.4, bhw*3.2, Math.max(4,Math.round(bx/2.6)), bhw*0.16, bhw*0.072);
    // 梁端外伸横担
    const outX=colX*1.46;
    [-1,1].forEach(s=>{
      buildArm(s*bx,beamY, s*outX,beamY, bhw*1.5, bhw*1.7, 3, bhw*0.13, bhw*0.062);
      // 地线支架：自梁端上挑（原来地线直接挂在 1.0H，比横梁高 0.055H，看着悬空）
      buildArm(s*outX,beamY, s*(outX+bhw*1.7),H*0.988, bhw*0.9, bhw*1.0, 2, bhw*0.11, bhw*0.052);
    });
    // 柱间交叉支撑（多层，含水平系杆）
    const nbr=Math.max(5,Math.round(H/28));
    for(let i=0;i<nbr;i++){
      const t0=0.16+0.76*i/nbr, t1=0.16+0.76*(i+1)/nbr;
      const x0=colX*taperX(t0), x1=colX*taperX(t1);
      const y0=H*t0, y1=H*t1;
      mem('brace',V(-x0,y0,0),V(x1,y1,0),colHalf*0.080);
      mem('brace',V(x0,y0,0),V(-x1,y1,0),colHalf*0.080);
      mem('brace',V(-x1,y1,0),V(x1,y1,0),colHalf*0.060);
    }
    // 导线均布挂于梁下（含外伸段）
    const n=D.phases, half=outX*0.86;
    for(let i=0;i<n;i++){
      const f=(i+0.5)/n;
      addPhase(V(-half+2*half*f,beamY,0),opt);
    }
    drawGW(-(outX+bhw*1.7),H*0.988,spanHalf,sag*0.7,gwR);
    drawGW(outX+bhw*1.7,H*0.988,spanHalf,sag*0.7,gwR);
  }

  else { // ramhorn 羊角型（直流）
    const bodyH=H*0.62;
    const body=buildBody({baseHalf,y0:0,height:bodyH,panels:P,
      profile:[[0,1],[0.45,0.66],[1,0.46]],
      legR:baseHalf*0.076,braceR:baseHalf*0.030});
    const th=body.topHalf;
    const reach=baseHalf*1.72;
    const yKnuckle=bodyH, yTip=H*0.925;
    [-1,1].forEach(s=>{
      // 外伸臂（自塔顶向外上抬）
      buildArm(s*th*0.85,yKnuckle, s*reach*0.78,yTip, baseHalf*0.26, baseHalf*0.22, 3, baseHalf*0.021, baseHalf*0.010);
      // 羊角尖上扬
      buildArm(s*reach*0.78,yTip, s*reach,yTip+H*0.052, baseHalf*0.20, baseHalf*0.17, 2, baseHalf*0.018, baseHalf*0.009);
    });
    // 中央立柱封顶 + 地线支架
    buildBody({baseHalf:th*0.9,y0:bodyH,height:H*0.33,panels:3,
      profile:[[0,1],[1,0.60]],legR:th*0.30,braceR:th*0.13,topLegR:th*0.18});
    const gwOut=baseHalf*0.58;
    [-1,1].forEach(s=>{ mem('arm',V(s*th*0.5,H*0.918,0),V(s*gwOut,H*0.985,0),baseHalf*0.016); });
    // 两极
    addPhase(V(-reach,yTip+H*0.042,0),opt);
    addPhase(V(reach,yTip+H*0.042,0),opt);
    drawGW(-gwOut,H*0.985,spanHalf,sag*0.7,gwR);
    drawGW(gwOut,H*0.985,spanHalf,sag*0.7,gwR);
  }

  // 基础（4 个混凝土墩，半埋于地面）
  const bs=Math.max(0.42,baseHalf*0.19);
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sz])=>{
    put('conc',V(sx*baseHalf,bs*0.28,sz*baseHalf),IDQ,bs*1.5,bs*0.9,bs*1.5);
  });

  flushBatches(g);
  g.userData={totalHigh:H, callHigh:(isFinite(_minAttach)&&_minAttach>0&&_minAttach<H)?_minAttach:H*0.7,
              rootOpen:R, condText:t.conductorArr||'', shape:shape,
              // 数据侧是否给出了呼称高（'attachment' = 资料没给，标注只能说「导线挂点」）
              callBasis:t.callBasis||'hCall'};
  return g;
}

/* ---------- 标注 ---------- */
function makeLabel(text,pos,cls){
  const div=document.createElement('div');
  div.className='lbl'+(cls?(' '+cls):'');
  div.textContent=text;
  const obj=new CSS2DObject(div);
  obj.position.copy(pos);
  return obj;
}
function addAnnotations(g){
  labelGroup=new THREE.Group();
  const d=g.userData;
  const near=Math.abs(d.totalHigh-d.callHigh)<d.totalHigh*0.10;
  const off=Math.max(d.rootOpen*2.25,d.totalHigh*0.30);
  // 猫头的顶梁几乎贴着全高值（0.975H），标注间距要留大一点，否则压住顶梁
  const topOff=d.shape==='cat'?1.105:1.052;
  labelGroup.add(makeLabel('全高 '+d.totalHigh.toFixed(1)+' m',V(0,d.totalHigh*topOff,0)));
  // 耐张塔/跨越塔/门型塔的导线挂在结构顶部附近，「呼高」会逼近全高（实测 94%~97%），
  // 与旁边的「全高」自相矛盾。两个条件任一成立就改称「导线挂点」——数值不变，只是叫法准确：
  //   ① 资料本身没给出呼称高（数据侧 render.callBasis = 'attachment'）
  //   ② 几何算出的挂点高度超过 0.90 全高，这个数就不是呼称高
  const callTxt=(d.callBasis==='attachment'||d.callHigh>d.totalHigh*0.90)?'导线挂点':'呼高';
  labelGroup.add(makeLabel(callTxt+' '+d.callHigh.toFixed(1)+' m',V(near?-off*1.15:-off,d.callHigh,0),'lbl-call'));
  labelGroup.add(makeLabel('根开 '+d.rootOpen.toFixed(1)+' m',V(d.rootOpen*0.5,1.2,0),'lbl-root'));
  g.add(labelGroup);
}

/* ---------- 环境贴图（程序生成，用于金属反射） ---------- */
function buildEnvMap(r){
  const c=document.createElement('canvas'); c.width=1024; c.height=512;
  const x=c.getContext('2d');
  const grd=x.createLinearGradient(0,0,0,512);
  grd.addColorStop(0.00,'#a9c6e8');
  grd.addColorStop(0.34,'#d8e6f6');
  grd.addColorStop(0.48,'#f6fafe');
  grd.addColorStop(0.52,'#dfe8f2');
  grd.addColorStop(0.74,'#a7b4c4');
  grd.addColorStop(1.00,'#778493');
  x.fillStyle=grd; x.fillRect(0,0,1024,512);
  const rg=x.createRadialGradient(260,110,0,260,110,240);
  rg.addColorStop(0,'rgba(255,255,255,0.98)');
  rg.addColorStop(0.35,'rgba(255,255,255,0.42)');
  rg.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=rg; x.fillRect(0,0,1024,512);
  const tex=new THREE.CanvasTexture(c);
  tex.mapping=THREE.EquirectangularReflectionMapping;
  tex.colorSpace=THREE.SRGBColorSpace;
  const pm=new THREE.PMREMGenerator(r);
  pm.compileEquirectangularShader();
  const env=pm.fromEquirectangular(tex).texture;
  tex.dispose(); pm.dispose();
  return env;
}

/* ---------- 地面 / 天空 ---------- */
function buildGroundTex(){
  const c=document.createElement('canvas'); c.width=c.height=512;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(256,256,0,256,256,256);
  g.addColorStop(0.00,'#94a6ba');
  g.addColorStop(0.10,'#a3b3c6');
  g.addColorStop(0.30,'#b6c4d5');
  g.addColorStop(0.58,'#cbd7e5');
  g.addColorStop(1.00,'#dde7f2');
  x.fillStyle=g; x.fillRect(0,0,512,512);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function buildGroundAlpha(){
  const c=document.createElement('canvas'); c.width=c.height=512;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(256,256,0,256,256,256);
  g.addColorStop(0.00,'#ffffff');
  g.addColorStop(0.32,'#ffffff');
  g.addColorStop(0.46,'#ececec');
  g.addColorStop(0.60,'#b4b4b4');
  g.addColorStop(0.76,'#6a6a6a');
  g.addColorStop(0.90,'#242424');
  g.addColorStop(1.00,'#000000');
  x.fillStyle=g; x.fillRect(0,0,512,512);
  const t=new THREE.CanvasTexture(c);
  return t;
}
function buildContactTex(){
  const c=document.createElement('canvas'); c.width=c.height=256;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0.00,'rgba(255,255,255,0.95)');
  g.addColorStop(0.34,'rgba(255,255,255,0.62)');
  g.addColorStop(0.62,'rgba(255,255,255,0.22)');
  g.addColorStop(0.84,'rgba(255,255,255,0.05)');
  g.addColorStop(1.00,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function buildSky(){
  const mat=new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{
      cTop:{value:new THREE.Color(0x93b6e0)},
      cMid:{value:new THREE.Color(0xe3ecf7)},
      cBot:{value:new THREE.Color(0xcdd8e8)}
    },
    vertexShader:'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:[
      'uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cBot; varying vec3 vP;',
      'void main(){',
      '  float h=clamp(vP.y*0.5+0.5,0.0,1.0);',
      '  vec3 c = h<0.5 ? mix(cBot,cMid,h/0.5) : mix(cMid,cTop,(h-0.5)/0.5);',
      '  gl_FragColor=vec4(c,1.0);',
      '}'
    ].join('\n')
  });
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,18),mat);
  m.frustumCulled=false;
  return m;
}

/* ---------- 场景 ---------- */
function initThree(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio));
  renderer.setSize(stage.clientWidth,Math.max(360,stage.clientHeight||520),false);
  renderer.shadowMap.enabled=false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.94;
  if('outputColorSpace' in renderer) renderer.outputColorSpace=THREE.SRGBColorSpace;

  labelRenderer=new CSS2DRenderer();
  labelRenderer.setSize(stage.clientWidth,Math.max(360,stage.clientHeight||520));
  labelRenderer.domElement.style.position='absolute';
  labelRenderer.domElement.style.top='0';
  labelRenderer.domElement.style.left='0';
  labelRenderer.domElement.style.pointerEvents='none';
  stage.appendChild(labelRenderer.domElement);

  scene=new THREE.Scene();
  scene.fog=new THREE.Fog(0xe3ecf7,600,1800);
  var __envOK=false;
  try{
    if(THREE.PMREMGenerator){ scene.environment=buildEnvMap(renderer); __envOK=true; }
  }catch(e){ console.warn('环境贴图生成失败，降级为漫反射材质',e); }
  if(!__envOK){
    [M_LEG,M_BRACE,M_ARM,M_GW,M_COND,M_CAP].forEach(function(m){
      m.metalness=0.22; m.roughness=0.62; m.color.multiplyScalar(1.06); m.needsUpdate=true;
    });
  }

  SKY=buildSky();
  SKY.scale.setScalar(20000);
  scene.add(SKY);

  camera=new THREE.PerspectiveCamera(34,stage.clientWidth/520,0.5,80000);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  controls.dampingFactor=0.08;
  controls.maxPolarAngle=Math.PI*0.505;
  controls.minPolarAngle=Math.PI*0.04;
  controls.enablePan=false;
  controls.autoRotateSpeed=1.1;

  scene.add(new THREE.HemisphereLight(0xdcebff,0x5f6b76,0.34));

  SUN=new THREE.DirectionalLight(0xfff1d8,3.5);
  scene.add(SUN);
  scene.add(SUN.target);

  const fill=new THREE.DirectionalLight(0xcfe2ff,0.30);
  fill.position.set(140,90,-150);
  scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,0.24);
  rim.position.set(90,-30,-120);
  scene.add(rim);

  // 地面
  const gg=new THREE.CircleGeometry(1,96); gg.rotateX(-Math.PI/2);
  GROUND=new THREE.Mesh(gg,new THREE.MeshStandardMaterial({
    color:0xffffff, map:buildGroundTex(), alphaMap:buildGroundAlpha(),
    transparent:true, depthWrite:false, roughness:0.97, metalness:0.0, envMapIntensity:0.25
  }));
  GROUND.receiveShadow=false;
  scene.add(GROUND);

  // 塔基接触阴影（软性椭圆，增强"落地感"）
  const cg=new THREE.CircleGeometry(1,64); cg.rotateX(-Math.PI/2);
  CONTACT=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({
    map:buildContactTex(), color:0x121a24, transparent:true, opacity:0.26,
    depthWrite:false, fog:true
  }));
  CONTACT.position.y=0.05;
  CONTACT.renderOrder=2;
  scene.add(CONTACT);

  load3d.style.display='none';
  window.addEventListener('resize',onResize);
  animate();
}
function onResize(){
  if(!renderer) return;
  const w=stage.clientWidth,h=Math.max(360,stage.clientHeight||520);
  renderer.setSize(w,h,false);
  labelRenderer.setSize(w,h);
  camera.aspect=w/h; camera.updateProjectionMatrix();
}
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
  labelRenderer.render(scene,camera);
}

/* ---------- 相机与阴影 ---------- */
function fitCamera(H,R,shape){
  const h=Math.max(360,stage.clientHeight||520);
  camera.aspect=stage.clientWidth/h;
  const vFov=camera.fov*Math.PI/180;
  // 竖向：塔占画面 79%（留出标注空间）；横向：横担+导线根部占 90%
  let dist=(H*0.5)/Math.tan(vFov/2)/0.80;
  const halfW=Math.max(R*1.55,H*0.30);
  dist=Math.max(dist, halfW/(Math.tan(vFov/2)*camera.aspect*0.90));
  // 猫头塔的判据就是头部横向宽度，方位角过大时 X 向被压扁（cos56°≈0.56），故取近正面
  const az=(shape==='cat')?0.34:0.98, el=0.105;
  const tgtY=H*0.52;
  camera.position.set(
    Math.sin(az)*Math.cos(el)*dist,
    tgtY+Math.sin(el)*dist,
    Math.cos(az)*Math.cos(el)*dist
  );
  camera.near=Math.max(0.2,dist*0.006);
  camera.far=dist*70;
  if(SKY) SKY.scale.setScalar(Math.max(dist*22,200));
  camera.updateProjectionMatrix();
  controls.target.set(0,tgtY,0);
  controls.minDistance=dist*0.30;
  controls.maxDistance=dist*2.6;
  controls.update();

  // 太阳方位（侧前上方），塑造塔身四方明暗
  const sd=Math.max(H,R*2)*3.0;
  SUN.position.set(
    Math.sin(SUN_AZ)*Math.cos(SUN_EL)*sd,
    Math.sin(SUN_EL)*sd,
    Math.cos(SUN_AZ)*Math.cos(SUN_EL)*sd
  );
  SUN.target.position.set(0,H*0.34,0);
  SUN.target.updateMatrixWorld();

  if(GROUND){
    GROUND.scale.setScalar(dist*9);
    GROUND.position.y=-0.06;
  }
  if(CONTACT){
    const bh=Math.max(1.4,R*0.5);
    // 沿背光方向拉长的软影，替代实时投影
    const dx=-Math.sin(SUN_AZ), dz=-Math.cos(SUN_AZ);
    CONTACT.rotation.y=Math.atan2(dx,dz);
    CONTACT.scale.set(bh*5.4,1,bh*3.1);
    CONTACT.position.set(dx*bh*1.5,0.05,dz*bh*1.5);
  }
  scene.fog.near=dist*2.6;
  scene.fog.far=dist*9.5;
}

function toggleWire(){
  wireMode=!wireMode;
  if(!towerGroup) return;
  towerGroup.traverse(o=>{ if(o.isMesh&&o.material){ o.material.wireframe=wireMode; } });
}
function toggleAuto(){
  autoRotate=!autoRotate;
  controls.autoRotate=autoRotate;
  const b=document.getElementById('autoBtn');
  if(b) b.textContent=autoRotate?'停止旋转':'自动旋转';
}

/* ---------- 加载 ---------- */
const towerSel=document.getElementById('towerSel');
TOWERS.forEach(t=>{
  const o=document.createElement('option');
  o.value=t.id; o.textContent=t.name+' · '+t.voltage;
  towerSel.appendChild(o);
});
function disposeGroup(g){
  g.traverse(o=>{
    if(o.isCSS2DObject&&o.element&&o.element.parentNode) o.element.parentNode.removeChild(o.element);
    if(o.isInstancedMesh&&o.dispose) o.dispose();
  });
}
function loadTower(id){
  const t=TOWERS.find(x=>x.id===id); if(!t||!renderer) return;
  if(towerGroup){ disposeGroup(towerGroup); scene.remove(towerGroup); }
  towerGroup=buildTower(t);
  scene.add(towerGroup);
  addAnnotations(towerGroup);
  // 供自动化校验读取（assets/data/validate.py --live 与 assets/ui/sweep.py）
  window.__towerGroup=towerGroup;
  fitCamera(t.ht3d,t.ro3d,t.shape);
  document.getElementById('hud').textContent=t.name;
  document.getElementById('sideName').textContent=t.name;
  document.getElementById('sideBadges').innerHTML=
    `<span class="badge cy">${t.voltage}</span><span class="badge">${t.circuit}</span><span class="badge">${t.func}</span><span class="badge">${t.code}</span>`+
    (t.verified?'<span class="badge gn">✓已校验</span>':'<span class="badge am">型式示意</span>');
  const rows=[
    ['标杆线路',t.line],['呼称高',t.hCall+' m'],['全高',t.hTotal+' m'],['根开',t.rootOpen+' m'],
    ['导线布置',t.conductorArr],['导线型号',t.conductor],['地线',t.gw],
    ['绝缘串型',t.insulator],['设计风速',t.wind],['覆冰',t.ice],['塔重',t.weight+' t'],
    ['档距',t.spanH+' m'],['适用',t.apply]
  ];
  document.getElementById('sideParams').innerHTML=rows.map(r=>`<div class="prow"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('');
}
towerSel.addEventListener('change',()=>loadTower(towerSel.value));
document.getElementById('annChk').addEventListener('change',e=>{ if(labelGroup) labelGroup.visible=e.target.checked; });
document.getElementById('resetView').addEventListener('click',()=>{
  const t=TOWERS.find(x=>x.id===towerSel.value); if(t) fitCamera(t.ht3d,t.ro3d,t.shape);
});
document.getElementById('wireBtn').addEventListener('click',toggleWire);
const autoBtn=document.getElementById('autoBtn');
if(autoBtn) autoBtn.addEventListener('click',toggleAuto);

/* ---------- 启动（由路由按需调用） ---------- */
let viewerReady=false;
window.__startViewer=function(id){
  if(!viewerReady){
    try{
      initThree();
      viewerReady=true;
    }catch(err){
      load3d.style.display='block';
      load3d.textContent='3D 渲染初始化失败：'+(err&&err.message?err.message:err);
      console.error(err);
      return;
    }
  }
  const tid=TOWERS.some(x=>x.id===id)?id:((TOWERS.find(x=>x.id==='cup1000')||TOWERS[0]).id);
  towerSel.value=tid;
  loadTower(tid);
  onResize();
};
