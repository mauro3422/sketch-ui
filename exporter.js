import { inferOrientationForChildren } from './heuristics.js';

export function exportJSON(state, toGridBBox, toGridPoint, inferLayout, inferComponents){
  const widgets = state.elements.filter(e=> e.type!=='path').map(e=>{
    if (e.type==='rect') return { id:e.id, kind:'container', label:e.label||'box', bbox: toGridBBox(e) };
    if (e.type==='text') return { id:e.id, kind:'text', text:e.text, position: toGridPoint(e) };
  }).filter(Boolean);
  const layout = inferLayout(state, toGridBBox);
  const components = inferComponents(state);
  return { meta:{ grid:{ cols:state.cols, rows:state.rows } }, widgets, layout, components };
}

export function exportASCIIGeneric(state, toGridBBox){
  const canvas = createAsciiCanvas(state.cols, state.rows);
  const baseRects = state.elements
    .filter(e=> e.type==='rect')
    .map(r=> ({ kind:'rect', label: r.label || 'bloque', bb: toGridBBox(r) }));

  baseRects.forEach(r=> drawRect(canvas, r.bb, r.label));

  const textElements = state.elements.filter(e=> e.type==='text' && (e.text||'').trim().length);

  const rawPaths = state.elements
    .filter(e=> e.type==='path' && Array.isArray(e.points) && e.points.length);
  const pathEntries = rawPaths.map((p, idx)=>{
    const xs = p.points.map(pt=> pt.x);
    const ys = p.points.map(pt=> pt.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const pseudoRect = { x:minX, y:minY, w:Math.max(1, maxX - minX), h:Math.max(1, maxY - minY) };
    const bb = toGridBBox(pseudoRect);
    const widthCells = Math.max(1, bb.w);
    const heightCells = Math.max(1, bb.h);
    let orientation = 'mixed';
    if (widthCells >= heightCells * 2) orientation = 'horizontal';
    else if (heightCells >= widthCells * 2) orientation = 'vertical';
    return {
      kind:'line',
      label: p.label || `trazo#${String(idx+1).padStart(2,'0')}`,
      bb,
      orientation,
      index: idx,
    };
  });
  const { rectanglesFromPaths, remainingPaths } = deriveRectanglesFromPaths(pathEntries);
  const allRects = [...baseRects, ...rectanglesFromPaths];
  assignLabelsFromTexts(allRects, textElements, toGridBBox);
  allRects.forEach(r=> drawRect(canvas, r.bb, r.label));
  remainingPaths.forEach(entry=> drawPath(canvas, entry));

  const summary = buildSummary(allRects, remainingPaths, state.rows, state.cols);
  const ascii = canvasToString(canvas);
  return `${ascii}\n\n${summary}`;
}

function center(text, width){ const inside = width-2; const left = Math.floor((inside - text.length)/2); const right = inside - text.length - left; return '|' + ' '.repeat(Math.max(0,left)) + text + ' '.repeat(Math.max(0,right)) + '|'; }

export function exportTkGrid(state, toGridBBox){
  const rows = state.rows, cols = state.cols;
  const guts = { padx: 8, pady: 8 };
  const widgets = state.elements.filter(e=>e.type==='rect').map(r=>{
    const bb = toGridBBox(r);
    return { id:r.id, type:'container', grid:{ row:bb.y, column:bb.x, rowspan:bb.h, columnspan:bb.w, sticky:'nsew' }, hint:(r.label||'') };
  });
  const rowWeights = {}; const colWeights = {};
  widgets.forEach(w=>{ for(let y=w.grid.row; y<w.grid.row+w.grid.rowspan; y++) rowWeights[y]=1; for(let x=w.grid.column; x<w.grid.column+w.grid.columnspan; x++) colWeights[x]=1; });
  return { toolkit:'tkinter', layout:{ mode:'grid', grid:{ rows, cols, weights:{ rows: rowWeights, cols: colWeights }, gutters: guts } }, widgets };
}

export function exportTkPlace(state, toGridBBox){
  const rows = state.rows, cols = state.cols;
  const widgets = state.elements.filter(e=>e.type==='rect').map(r=>{
    const bb = toGridBBox(r);
    const relx = bb.x/cols, rely = bb.y/rows, relwidth = bb.w/cols, relheight = bb.h/rows;
    return { id:r.id, type:'container', place:{ relx, rely, relwidth, relheight }, hint:(r.label||'') };
  });
  return { toolkit:'tkinter', layout:{ mode:'place' }, widgets };
}

export function exportTkHybrid(tree, state){
  function toPane(node, axis){ return { id: node.id, percent: calcPercent(node, axis), hint: node.label||'' }; }
  function calcPercent(node, axis){
    const total = axis==='vertical' ? state.rows : state.cols;
    const size = axis==='vertical' ? node.bb.h : node.bb.w;
    return Math.max(1, Math.round((size/total)*100));
  }
  function normalize(panes){
    const sum = panes.reduce((a,b)=> a + b.percent, 0) || 1;
    panes.forEach(p=> p.percent = Math.max(1, Math.round(p.percent * (100/sum))));
    return panes;
  }
  function walk(node){
    if (!node.children || node.children.length===0){
      return { mode:'leaf', id:node.id, hint: node.label||'' };
    }
    const orient = inferOrientationForChildren(node) || 'vertical';
    const panes = node.children.map(ch=> toPane(ch, orient));
    normalize(panes);
    panes.forEach((p, i)=>{ const ch = node.children[i]; if (ch.children && ch.children.length){ p.inner = walk(ch); } });
    return { mode:'paned', orient, panes };
  }
  const root = walk(tree);
  return { toolkit:'tkinter', layout: root };
}

function createAsciiCanvas(cols, rows){
  const width = cols * 4 + 1;
  const height = rows * 2 + 1;
  return {
    cols,
    rows,
    width,
    height,
    data: Array.from({length: height}, ()=> Array(width).fill(' ')),
  };
}

function setChar(canvas, y, x, char, force=false){
  if (y < 0 || x < 0 || y >= canvas.height || x >= canvas.width) return;
  const current = canvas.data[y][x];
  if (force){
    canvas.data[y][x] = char;
    return;
  }
  if (current === ' '){
    canvas.data[y][x] = char;
    return;
  }
  if (current === char) return;
  const needsPlus = (current === '-' && char === '|') || (current === '|' && char === '-') ||
    (current === '+' && (char === '-' || char === '|')) ||
    (char === '+' && (current === '-' || current === '|'));
  if (needsPlus){
    canvas.data[y][x] = '+';
  }
}

function drawRect(canvas, bb, label){
  const left = Math.max(0, bb.x * 4);
  const right = Math.min(canvas.width - 1, (bb.x + bb.w) * 4);
  const top = Math.max(0, bb.y * 2);
  const bottom = Math.min(canvas.height - 1, (bb.y + bb.h) * 2);
  if (right - left < 2 || bottom - top < 2) return;

  for (let x = left + 1; x < right; x++){
    setChar(canvas, top, x, '-');
    setChar(canvas, bottom, x, '-');
  }
  for (let y = top + 1; y < bottom; y++){
    setChar(canvas, y, left, '|');
    setChar(canvas, y, right, '|');
  }
  setChar(canvas, top, left, '+', true);
  setChar(canvas, top, right, '+', true);
  setChar(canvas, bottom, left, '+', true);
  setChar(canvas, bottom, right, '+', true);

  const text = (label || '').trim();
  if (text){
    const trimmed = text.slice(0, Math.max(0, right - left - 2));
    if (trimmed.length){
      const row = Math.min(bottom - 1, top + 1);
      const pattern = ` ${trimmed} `;
      const totalWidth = right - left - 1;
      let startCol = left + 1;
      if (pattern.length < totalWidth){
        startCol = left + Math.floor((totalWidth - pattern.length) / 2) + 1;
      }
      const textRow = Array.from(pattern.padEnd(totalWidth, ' '));
      for (let offset = 0; offset < textRow.length && (startCol + offset) < right; offset++){
        const char = textRow[offset];
        const x = startCol + offset;
        if (x === left + 1){
          setChar(canvas, row, left + 1, '-', true);
        } else if (x === right - 1){
          setChar(canvas, row, right - 1, '-', true);
        }
        if (char !== ' ' && x > left + 1 && x < right - 1){
          setChar(canvas, row, x, char, true);
        }
      }
      setChar(canvas, row, left + 1, '-');
      setChar(canvas, row, right - 1, '-');
      let col = left + 2;
      for (let i = 0; i < trimmed.length && col < right - 1; i++, col++){
        setChar(canvas, row, col, trimmed[i], true);
      }
    }
  }
}

function drawPath(canvas, entry){
  const bb = entry.bb;
  const isHorizontal = entry.orientation === 'horizontal';
  const isVertical = entry.orientation === 'vertical';

  if (!isHorizontal && !isVertical){
    drawRect(canvas, bb, '');
    return;
  }

  if (isHorizontal){
    const midRow = Math.max(0, Math.min(canvas.rows - 1, Math.round(bb.y + bb.h / 2)));
    const y = Math.min(canvas.height - 1, Math.max(0, midRow * 2 + 1));
    const xStart = Math.max(0, bb.x * 4);
    const xEnd = Math.min(canvas.width - 1, (bb.x + bb.w) * 4);
    for (let x = xStart; x <= xEnd; x++){
      setChar(canvas, y, x, '-');
    }
    setChar(canvas, y, xStart, '|');
    setChar(canvas, y, xEnd, '|');
  } else {
    const midCol = Math.max(0, Math.min(canvas.cols - 1, Math.round(bb.x + bb.w / 2)));
    const x = Math.min(canvas.width - 1, Math.max(0, midCol * 4 + 2));
    const yStart = Math.max(0, bb.y * 2);
    const yEnd = Math.min(canvas.height - 1, (bb.y + bb.h) * 2);
    for (let y = yStart; y <= yEnd; y++){
      setChar(canvas, y, x, '|');
    }
    setChar(canvas, yStart, x, '+', true);
    setChar(canvas, yEnd, x, '+', true);
  }
}

function canvasToString(canvas){
  return canvas.data
    .map(row => row.join('').replace(/\s+$/,''))
    .join('\n')
    .replace(/\n+$/,'');
}

function buildSummary(rects, paths, totalRows, totalCols){
  const cols = 62;
  const sep = '+'.padEnd(cols-1, '-') + '+';
  const entries = [
    ...rects.map(r=> ({ kind:'rect', label:r.label, bb:r.bb })),
    ...paths.map(p=> ({ kind:'line', label:p.label, bb:p.bb })),
  ].sort((a,b)=> a.bb.y - b.bb.y || a.bb.x - b.bb.x);
  const out = [];
  out.push(sep);
  out.push(center(` SKETCH ASCII (${entries.length} elementos) `, cols));
  out.push(sep);
  entries.forEach((entry,i)=>{
    const pctH = Math.round((entry.bb.h/totalRows)*100);
    const pctW = Math.round((entry.bb.w/totalCols)*100);
    const typeTag = entry.kind === 'rect' ? 'rect' : 'line';
    out.push(`| ${String(i+1).padStart(2,'0')} -> ${typeTag} ${entry.label}  [h:${pctH}% w:${pctW}%]`.padEnd(cols-1,' ') + '|');
  });
  out.push(sep);
  return out.join('\n');
}

function deriveRectanglesFromPaths(pathEntries){
  const horizontals = [];
  const verticals = [];
  pathEntries.forEach(entry=>{
    const bb = entry.bb;
    const x1 = bb.x;
    const x2 = bb.x + bb.w;
    const y1 = bb.y;
    const y2 = bb.y + bb.h;
    if (entry.orientation === 'horizontal'){
      horizontals.push({
        entry,
        index: entry.index,
        x1, x2,
        y1, y2,
      });
    } else if (entry.orientation === 'vertical'){
      verticals.push({
        entry,
        index: entry.index,
        x1, x2,
        y1, y2,
      });
    }
  });

  horizontals.sort((a,b)=> a.y1 - b.y1 || a.x1 - b.x1);
  verticals.sort((a,b)=> a.x1 - b.x1 || a.y1 - b.y1);

  const usedPaths = new Set();
  const usedHoriz = new Set();
  const usedVert = new Set();
  const rectangles = [];
  const tolerance = 2;

  for (let i=0; i<horizontals.length; i++){
    const top = horizontals[i];
    if (usedHoriz.has(top.index)) continue;
    for (let j=i+1; j<horizontals.length; j++){
      const bottom = horizontals[j];
      if (usedHoriz.has(bottom.index)) continue;
      if (bottom.y1 <= top.y1) continue;
      if (Math.abs(top.x1 - bottom.x1) > tolerance) continue;
      if (Math.abs(top.x2 - bottom.x2) > tolerance) continue;

      const left = verticals.find(v =>
        !usedVert.has(v.index) &&
        Math.abs(((v.x1 + v.x2)/2) - top.x1) <= tolerance &&
        v.y1 <= top.y1 &&
        v.y2 >= bottom.y2
      );
      if (!left) continue;

      const right = verticals.find(v =>
        !usedVert.has(v.index) &&
        Math.abs(((v.x1 + v.x2)/2) - top.x2) <= tolerance &&
        v.y1 <= top.y1 &&
        v.y2 >= bottom.y2 &&
        v.index !== left.index
      );
      if (!right) continue;

      const x = Math.min(top.x1, bottom.x1, left.x1, right.x1);
      const y = Math.min(top.y1, left.y1);
      const w = Math.max(top.x2, bottom.x2, left.x2, right.x2) - x;
      const h = Math.max(bottom.y2, right.y2) - y;
      rectangles.push({ kind:'rect', label:'', bb:{ x, y, w: Math.max(1, w), h: Math.max(1, h) } });

      usedHoriz.add(top.index);
      usedHoriz.add(bottom.index);
      usedVert.add(left.index);
      usedVert.add(right.index);
      usedPaths.add(top.index);
      usedPaths.add(bottom.index);
      usedPaths.add(left.index);
      usedPaths.add(right.index);
      break;
    }
  }

  const remainingPaths = pathEntries.filter(entry=> !usedPaths.has(entry.index));
  return { rectanglesFromPaths: rectangles, remainingPaths };
}

function assignLabelsFromTexts(rects, textElements, toGridBBox){
  if (!textElements.length) return;
  const infos = textElements.map(t=>{
    const cell = toGridBBox({ x:t.x, y:t.y, w:1, h:1 });
    return { text:(t.text||'').trim(), x:cell.x, y:cell.y };
  }).filter(info=> info.text);
  if (!infos.length) return;
  rects.forEach(rect=>{
    const current = (rect.label || '').trim();
    if (current && !/^bloque$/i.test(current)) return;
    const hits = infos.filter(info=>
      info.x >= rect.bb.x &&
      info.x <= rect.bb.x + rect.bb.w &&
      info.y >= rect.bb.y &&
      info.y <= rect.bb.y + rect.bb.h
    );
    if (hits.length){
      rect.label = hits[0].text;
    }
  });
}
