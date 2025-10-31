// Containment tree + orientation inference + basic layout rows-first
export function buildContainmentTree(state, toGridBBox){
  const rects = state.elements.filter(e=>e.type==='rect').map(r=> ({...r, bb: toGridBBox(r)}));
  rects.sort((a,b)=> (b.bb.w*b.bb.h) - (a.bb.w*b.bb.h));
  const nodes = rects.map(r=> ({ id:r.id, label:(r.label||'').toLowerCase(), bb:r.bb, children:[] }));
  const contains = (A,B)=> A.bb.x<=B.bb.x && A.bb.y<=B.bb.y && (A.bb.x+A.bb.w)>= (B.bb.x+B.bb.w) && (A.bb.y+A.bb.h)>= (B.bb.y+B.bb.h);
  for (let i=0;i<nodes.length;i++){
    let parent = null; let parentArea = Infinity;
    for (let j=0;j<nodes.length;j++) if (i!==j){
      if (contains(nodes[j], nodes[i])){
        const area = nodes[j].bb.w*nodes[j].bb.h;
        if (area < parentArea){ parent = nodes[j]; parentArea = area; }
      }
    }
    nodes[i].parent = parent || null;
    if (parent) parent.children.push(nodes[i]);
  }
  const roots = nodes.filter(n=> !n.parent);
  if (roots.length>1){
    const synthetic = { id:'root', label:'root', bb:{x:0,y:0,w:state.cols,h:state.rows}, children: roots, parent:null };
    synthetic.children.sort((a,b)=> a.bb.y - b.bb.y);
    return synthetic;
  }
  return roots[0] || { id:'root', label:'root', bb:{x:0,y:0,w:state.cols,h:state.rows}, children:[], parent:null };
}

export function inferOrientationForChildren(node){
  if (!node.children || node.children.length<2) return null;
  const xs = node.children.map(c=> c.bb.x);
  const xe = node.children.map(c=> c.bb.x + c.bb.w);
  const ys = node.children.map(c=> c.bb.y);
  const ye = node.children.map(c=> c.bb.y + c.bb.h);
  const spanX = (Math.max(...xe) - Math.min(...xs));
  const totalW = Math.max(1, node.bb.w);
  const spanY = (Math.max(...ye) - Math.min(...ys));
  const totalH = Math.max(1, node.bb.h);
  const fracX = spanX/totalW;
  const fracY = spanY/totalH;
  return (fracX >= fracY) ? 'horizontal' : 'vertical';
}

export function inferLayout(state, toGridBBox){
  const rects = state.elements.filter(e=>e.type==='rect').map(r=> ({...r, bb: toGridBBox(r)}));
  rects.sort((a,b)=> a.bb.y - b.bb.y || a.bb.x - b.bb.x);
  const rows = []; const tol=1;
  for(const r of rects){
    let placed=false;
    for(const row of rows){ if (Math.abs(r.bb.y - row.y) <= tol){ row.items.push(r); row.y = Math.min(row.y, r.bb.y); placed=true; break; } }
    if(!placed) rows.push({ y:r.bb.y, items:[r] });
  }
  rows.forEach(row=> row.items.sort((a,b)=> a.bb.x - b.bb.x));
  return { strategy:'rows-first', rows: rows.map((row,i)=> ({ type:'row', index:i, columns: row.items.map((r,j)=> ({ type:'col', index:j, span:r.bb.w, widgetId:r.id })) })) };
}

export function inferComponents(state){
  const texts = state.elements.filter(e=>e.type==='text');
  const rects = state.elements.filter(e=>e.type==='rect');
  const out = {};
  for(const r of rects){
    const near = nearestText(texts, r);
    const hint = near?.text?.toLowerCase() || (r.label||'');
    out[r.id] = classify(hint);
  }
  return out;
}

function nearestText(texts, rect){
  let best=null, bestD=Infinity;
  for(const t of texts){ const dx = (t.x - (rect.x+rect.w/2)); const dy = (t.y - (rect.y+rect.h/2)); const d = Math.hypot(dx,dy); if (d<bestD){ bestD=d; best=t; } }
  return best;
}

function classify(hint){
  const map = [
    { type:'navbar', kw:['nav','navbar','menu','header'] },
    { type:'hero', kw:['hero','jumbotron','cover'] },
    { type:'card', kw:['card','tarjeta','panel','box'] },
    { type:'button', kw:['btn','button','botón','cta'] },
    { type:'form', kw:['form','formulario','input','login','signup'] },
    { type:'list', kw:['list','lista','feed','items'] },
    { type:'image', kw:['img','image','foto','logo','avatar'] },
  ];
  const hit = (k)=> hint?.includes(k);
  for(const m of map){ if (m.kw.some(hit)) return { type:m.type, confidence:0.9, hint }; }
  if ((hint||'').trim().length>=3) return { type:'card', confidence:0.5, hint };
  return { type:'unknown', confidence:0.2, hint };
}
