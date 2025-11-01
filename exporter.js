import { inferOrientationForChildren } from './heuristics.js';

export function exportJSON(state, toGridBBox, toGridPoint, inferLayout, inferComponents){
  const widgets = state.elements.filter(e=> e.type!=='path').map(e=>{ if (e.type==='rect') return { id:e.id, kind:'container', label:e.label||'box', bbox: toGridBBox(e) }; if (e.type==='text') return { id:e.id, kind:'text', text:e.text, position: toGridPoint(e) }; }).filter(Boolean);
  const layout = inferLayout(state, toGridBBox);
  const components = inferComponents(state);
  return { meta:{ grid:{ cols:state.cols, rows:state.rows } }, widgets, layout, components };
}

export function exportASCIIGeneric(state, toGridBBox){
  const cols = 62; const sep = '+'.padEnd(cols-1, '-') + '+';
  const rects = state.elements.filter(e=>e.type==='rect').map(r=> ({...r, bb: toGridBBox(r)})).sort((a,b)=> a.bb.y - b.bb.y);
  const out = []; out.push(sep); out.push(center(` SKETCH ASCII (${rects.length} bloques) `, cols)); out.push(sep);
  const totalRows = state.rows; const totalCols = state.cols;
  rects.forEach((r,i)=>{ const pctH = Math.round((r.bb.h/totalRows)*100); const pctW = Math.round((r.bb.w/totalCols)*100); out.push(`| ${String(i+1).padStart(2,'0')} • ${r.label||'bloque'}  [h:${pctH}% w:${pctW}%]`.padEnd(cols-1,' ') + '|'); });
  out.push(sep); return out.join('
');
}
function center(text, width){ const inside = width-2; const left = Math.floor((inside - text.length)/2); const right = inside - text.length - left; return '|' + ' '.repeat(Math.max(0,left)) + text + ' '.repeat(Math.max(0,right)) + '|'; }

export function exportTkGrid(state, toGridBBox){
  const rows = state.rows, cols = state.cols; const guts = { padx: 8, pady: 8 };
  const widgets = state.elements.filter(e=>e.type==='rect').map(r=>{ const bb = toGridBBox(r); return { id:r.id, type:'container', grid:{ row:bb.y, column:bb.x, rowspan:bb.h, columnspan:bb.w, sticky:'nsew' }, hint:(r.label||'') }; });
  const rowWeights = {}; const colWeights = {};
  widgets.forEach(w=>{ for(let y=w.grid.row; y<w.grid.row+w.grid.rowspan; y++) rowWeights[y]=1; for(let x=w.grid.column; x<w.grid.column+w.grid.columnspan; x++) colWeights[x]=1; });
  return { toolkit:'tkinter', layout:{ mode:'grid', grid:{ rows, cols, weights:{ rows: rowWeights, cols: colWeights }, gutters: guts } }, widgets };
}

export function exportTkPlace(state, toGridBBox){
  const rows = state.rows, cols = state.cols;
  const widgets = state.elements.filter(e=>e.type==='rect').map(r=>{ const bb = toGridBBox(r); const relx = bb.x/cols, rely = bb.y/rows, relwidth = bb.w/cols, relheight = bb.h/rows; return { id:r.id, type:'container', place:{ relx, rely, relwidth, relheight }, hint:(r.label||'') }; });
  return { toolkit:'tkinter', layout:{ mode:'place' }, widgets };
}

export function exportTkHybrid(tree, state){
  function toPane(node, axis){ return { id: node.id, percent: calcPercent(node, axis), hint: node.label||'' }; }
  function calcPercent(node, axis){ const total = axis==='vertical' ? state.rows : state.cols; const size = axis==='vertical' ? node.bb.h : node.bb.w; return Math.max(1, Math.round((size/total)*100)); }
  function normalize(panes){ const sum = panes.reduce((a,b)=> a + b.percent, 0) || 1; panes.forEach(p=> p.percent = Math.max(1, Math.round(p.percent * (100/sum)))); return panes; }
  function walk(node){
    if (!node.children || node.children.length===0){ return { mode:'leaf', id:node.id, hint: node.label||'' }; }
    const orient = inferOrientationForChildren(node) || 'vertical';
    const panes = node.children.map(ch=> toPane(ch, orient));
    normalize(panes);
    panes.forEach((p, i)=>{ const ch = node.children[i]; if (ch.children && ch.children.length){ p.inner = walk(ch); } });
    return { mode:'paned', orient, panes };
  }
  const root = walk(tree);
  return { toolkit:'tkinter', layout: root };
}
