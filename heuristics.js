// heuristics.js — layout heuristics mínimas para el árbol de contención y orientación

export function buildContainmentTree(state, toGridBBox){
  const rects = state.elements.filter(e=>e.type==='rect').map(r=> ({ id:r.id, label:r.label||'', bb: toGridBBox(r), children:[], x:r.x, y:r.y, w:r.w, h:r.h }));
  const root = { id:'root', label:'root', bb:{ x:0, y:0, w: state.cols, h: state.rows }, children:[] };
  rects.sort((a,b)=> (b.bb.w*b.bb.h) - (a.bb.w*a.bb.h));
  const contains = (A,B)=> A.x <= B.x && A.y <= B.y && (A.x+A.w) >= (B.x+B.w) && (A.y+A.h) >= (B.y+B.h);
  const buckets = [];
  rects.forEach(r=>{ let parent = null; for (const c of buckets){ if (contains(c.bb, r.bb)){ parent = c; break; } } if (!parent){ buckets.push(r); } else { parent.children.push(r); } });
  root.children = buckets;
  return root;
}

export function inferOrientationForChildren(node){
  if (!node.children || node.children.length < 2) return null;
  const xs = node.children.map(ch=> ch.bb.x + ch.bb.w/2);
  const ys = node.children.map(ch=> ch.bb.y + ch.bb.h/2);
  const varX = variance(xs), varY = variance(ys);
  if (varY > varX * 1.2) return 'vertical';
  if (varX > varY * 1.2) return 'horizontal';
  const W = node.bb.w, H = node.bb.h;
  return (W >= H) ? 'horizontal' : 'vertical';
}

export function inferLayout(state, toGridBBox){ return { mode:'grid', grid:{ rows: state.rows, cols: state.cols } }; }

export function inferComponents(state){
  const components = [];
  state.elements.forEach(e=>{
    if (e.type==='rect'){
      const hint = (e.label||'').toLowerCase();
      let type = 'container';
      if (/side(bar)?/.test(hint)) type = 'sidebar';
      if (/nav|menu/.test(hint)) type = 'navbar';
      if (/footer/.test(hint)) type = 'footer';
      components.push({ id:e.id, type, hint: e.label||'' });
    } else if (e.type==='text'){ components.push({ id:e.id, type:'text', text:e.text }); }
  });
  return components;
}
function variance(arr){ const m = arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length); return arr.reduce((s,v)=> s + (v-m)*(v-m), 0)/Math.max(1,arr.length); }
