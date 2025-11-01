import { inferLayout, inferComponents, buildContainmentTree } from './heuristics.js';
import { exportJSON, exportASCIIGeneric, exportTkGrid, exportTkPlace, exportTkHybrid } from './exporter.js';
import { detectRectsWithOpenCV, onDetectLog } from './image_detect.js';

const TOOL = { SELECT:'select', RECT:'rect', PENCIL:'pencil', TEXT:'text' };
const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const overlay = $('#overlay');
const ctx = canvas.getContext('2d');
const ov = overlay.getContext('2d');
const progressBox = $('#detectProgress');
const progressLabel = $('#progressLabel');
const logBox = $('#logBox');

// Fondo: canvas debajo del lienzo para dibujar la imagen
const bgCanvas = document.createElement('canvas');
bgCanvas.className = 'bg-layer';
bgCanvas.width = canvas.width;
bgCanvas.height = canvas.height;
document.querySelector('.canvas-wrap').prepend(bgCanvas);
const bg = bgCanvas.getContext('2d');

let state = {
  tool: TOOL.RECT,
  elements: [], // {id,type:'rect'|'path'|'text', x,y,w,h, points, label, text}
  drawing:false,
  start:null,
  currentPath:[],
  cols: 12,
  rows: 12,
  snap: true,
  liveAscii: true,
  bg: { image:null, opacity:0.35 },
  selectedId: null,
  dragContext: null,
  detecting:false,
};

const history = {
  undo: [],
  redo: [],
  max: 100,
};

const LOG_LIMIT = 200;
const logEntries = [];

function logMessage(message){
  const ts = new Date().toLocaleTimeString();
  const entry = `[${ts}] ${message}`;
  logEntries.push(entry);
  if (logEntries.length > LOG_LIMIT){
    logEntries.shift();
  }
  if (logBox){
    logBox.textContent = logEntries.join('\n');
    logBox.scrollTop = logBox.scrollHeight;
  }
  console.log(entry);
}

onDetectLog((msg)=> logMessage(`[worker] ${msg}`));

function showProgress(message){
  if (!progressBox) return;
  if (progressLabel) progressLabel.textContent = message || 'Analizando imagen...';
  progressBox.classList.remove('hidden');
  logMessage(message || 'Analizando imagen...');
}

function hideProgress(){
  progressBox?.classList.add('hidden');
}

function nextFrame(){ return new Promise(resolve=> requestAnimationFrame(()=> resolve())); }

function cloneElements(list){
  return list.map(el=>{
    if (el.type === 'path'){
      return { ...el, points: el.points.map(pt=> ({...pt})) };
    }
    return { ...el };
  });
}

function elementsEqual(a, b){
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++){
    const left = a[i], right = b[i];
    if (left.type !== right.type) return false;
    if (left.id !== right.id) return false;
    if ((left.label||'') !== (right.label||'')) return false;
    if ((left.text||'') !== (right.text||'')) return false;
    if ((left.x||0) !== (right.x||0) || (left.y||0) !== (right.y||0) || (left.w||0) !== (right.w||0) || (left.h||0) !== (right.h||0)) return false;
    const lp = left.points || null;
    const rp = right.points || null;
    if (!!lp !== !!rp) return false;
    if (lp && rp){
      if (lp.length !== rp.length) return false;
      for (let j = 0; j < lp.length; j++){
        if (lp[j].x !== rp[j].x || lp[j].y !== rp[j].y) return false;
      }
    }
  }
  return true;
}

function pushSnapshot(snapshot){
  if (!snapshot) return;
  const clone = cloneElements(snapshot);
  const last = history.undo[history.undo.length - 1];
  if (last && elementsEqual(last, clone)) return;
  history.undo.push(clone);
  if (history.undo.length > history.max){
    history.undo.shift();
  }
}

function pushHistory(){
  const last = history.undo[history.undo.length - 1];
  if (last && elementsEqual(last, state.elements)){
    return;
  }
  history.undo.push(cloneElements(state.elements));
  if (history.undo.length > history.max){
    history.undo.shift();
  }
}

function applySnapshot(snapshot){
  state.elements = cloneElements(snapshot);
  state.selectedId = null;
  state.dragContext = null;
  draw();
  if (state.liveAscii) scheduleAscii();
}

function undo(){
  if (!history.undo.length) return;
  history.redo.push(cloneElements(state.elements));
  const snapshot = history.undo.pop();
  applySnapshot(snapshot);
}

function redo(){
  if (!history.redo.length) return;
  history.undo.push(cloneElements(state.elements));
  const snapshot = history.redo.pop();
  applySnapshot(snapshot);
}

function discardRedo(){ history.redo = []; }

pushHistory();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch((err)=>{
      console.error('Service worker registration failed', err);
    });
  });
}

// UI
const toolButtons = document.querySelectorAll('[data-tool]');
toolButtons.forEach(b=> b.addEventListener('click', ()=>{
  toolButtons.forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  state.tool = b.dataset.tool;
}));
$('#cols').addEventListener('change', e=> { state.cols = clampInt(e.target.value, 2, 48); drawGrid(); draw(); });
$('#rows').addEventListener('change', e=> { state.rows = clampInt(e.target.value, 2, 48); drawGrid(); draw(); });
$('#snap').addEventListener('change', e=> state.snap = !!e.target.checked);
$('#liveAscii').addEventListener('change', e=> { state.liveAscii = !!e.target.checked; updateLiveAscii(); });

$('#exportJson').addEventListener('click', ()=> {
  const payload = exportJSON(state, toGridBBox, toGridPoint, inferLayout, inferComponents);
  $('#jsonOut').value = JSON.stringify(payload, null, 2);
  navigator.clipboard?.writeText($('#jsonOut').value).catch(()=>{});
});
$('#exportAscii').addEventListener('click', ()=> {
  const ascii = exportASCIIGeneric(state, toGridBBox);
  $('#asciiOut').value = ascii; navigator.clipboard?.writeText(ascii).catch(()=>{});
});
$('#exportTkGrid').addEventListener('click', ()=>{
  const schema = exportTkGrid(state, toGridBBox);
  $('#jsonOut').value = JSON.stringify(schema, null, 2);
});
$('#exportTkPlace').addEventListener('click', ()=>{
  const schema = exportTkPlace(state, toGridBBox);
  $('#jsonOut').value = JSON.stringify(schema, null, 2);
});
$('#exportTkHybrid').addEventListener('click', ()=>{
  const tree = buildContainmentTree(state, toGridBBox);
  const schema = exportTkHybrid(tree, state);
  $('#jsonOut').value = JSON.stringify(schema, null, 2);
});
$('#clear').addEventListener('click', ()=>{
  if (!state.elements.length) return;
  pushHistory();
  state.elements = [];
  discardRedo();
  state.selectedId = null;
  state.dragContext = null;
  draw();
  $('#jsonOut').value='';
  $('#asciiOut').value='';
});

// Fondo: carga y opacidad
$('#bgInput').addEventListener('change', (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = ()=>{
    state.bg.image = img;
    draw();
    logMessage(`Imagen de fondo cargada (${file.name || img.width + 'x' + img.height})`);
  };
  img.src = URL.createObjectURL(file);
});
$('#bgOpacity').addEventListener('input', (e)=>{ state.bg.opacity = parseFloat(e.target.value||'0.35'); draw(); });

// Auto-deteccion con OpenCV
$('#autoDetect').addEventListener('click', async ()=>{
  await runAutoDetect();
});

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
canvas.addEventListener('dblclick', onDoubleClickRename);

// Banner + reload (solo en GitHub Pages)
window.addEventListener('load', ()=>{
  const isPages = location.hostname.endsWith('github.io');
  const banner = $('#syncBanner');
  const btnDismiss = $('#dismissBanner');
  const btnReload = $('#forceReload');
  if (isPages && banner){ banner.classList.remove('hidden'); setTimeout(()=> banner.classList.add('hidden'), 4000); }
  btnDismiss?.addEventListener('click', ()=> banner.classList.add('hidden'));
  btnReload?.addEventListener('click', ()=> location.reload());
});

function onDown(e){
  if (e.button !== 0) return;
  const raw = getPos(e);

  if (state.tool === TOOL.SELECT){
    const hit = pickElement(raw.x, raw.y);
    state.selectedId = hit ? hit.id : null;
    state.dragContext = null;
    if (hit && (hit.type === 'rect' || hit.type === 'text')){
      state.dragContext = {
        id: hit.id,
        type: hit.type,
        start: raw,
        origin: { x: hit.x, y: hit.y },
        snapshot: cloneElements(state.elements),
        moved: false,
      };
    }
    draw();
    return;
  }

  state.selectedId = null;
  state.dragContext = null;

  if (e.detail > 1) return;

  if (state.tool === TOOL.RECT){
    const start = snap(raw);
    state.start = {x:start.x, y:start.y};
    state.drawing = true;
  } else if (state.tool === TOOL.PENCIL){
    state.currentPath = [{ x: raw.x, y: raw.y }];
    state.drawing = true;
  } else if (state.tool === TOOL.TEXT){
    let txt = $('#textInput').value.trim();
    if (!txt) { txt = prompt('Texto a insertar:', ''); }
    if (!txt) return;
    const pos = snap(raw);
    addEl({ type:'text', x:pos.x, y:pos.y, text:txt });
    $('#textInput').value='';
    state.selectedId = null;
    draw();
    if (state.liveAscii) scheduleAscii();
    return;
  }
  draw();
}

function onMove(e){
  const raw = getPos(e);
  if (state.tool === TOOL.SELECT){
    const drag = state.dragContext;
    if (!drag) return;
    const el = state.elements.find(item=> item.id === drag.id);
    if (!el) return;
    const dx = raw.x - drag.start.x;
    const dy = raw.y - drag.start.y;
    if (drag.type === 'rect'){
      const next = state.snap ? snap({ x: drag.origin.x + dx, y: drag.origin.y + dy }) : { x: drag.origin.x + dx, y: drag.origin.y + dy };
      el.x = next.x;
      el.y = next.y;
    } else if (drag.type === 'text'){
      el.x = drag.origin.x + dx;
      el.y = drag.origin.y + dy;
    }
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) drag.moved = true;
    draw();
    if (state.liveAscii) scheduleAscii();
    return;
  }

  if (!state.drawing) return;
  const p = state.tool === TOOL.PENCIL ? { x: raw.x, y: raw.y } : snap(raw);
  if (state.tool === TOOL.RECT && state.start){
    draw();
    const r = normalizeRect({ x:state.start.x, y:state.start.y, w:p.x - state.start.x, h:p.y - state.start.y });
    ctx.setLineDash([4,4]); ctx.strokeStyle = '#10b981'; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
  } else if (state.tool === TOOL.PENCIL){
    state.currentPath.push(p);
    draw();
    ctx.strokeStyle = '#10b981'; ctx.beginPath(); state.currentPath.forEach((pt,i)=> i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y)); ctx.stroke();
  }
  if (state.liveAscii) scheduleAscii();
}

function onUp(e){
  if (state.tool === TOOL.SELECT){
    const drag = state.dragContext;
    state.dragContext = null;
    if (drag && drag.moved){
      pushSnapshot(drag.snapshot);
      discardRedo();
      draw();
      if (state.liveAscii) scheduleAscii();
    }
    return;
  }

  if (!state.drawing) return;
  const raw = getPos(e);
  const p = state.tool === TOOL.PENCIL ? { x: raw.x, y: raw.y } : snap(raw);
  if (state.tool === TOOL.RECT && state.start){
    const r = normalizeRect({ x:state.start.x, y:state.start.y, w:p.x - state.start.x, h:p.y - state.start.y });
    if (r.w === 0 && r.h === 0){
      state.start = null;
      state.drawing = false;
      draw();
      return;
    }
    addEl({ type:'rect', ...r, label: `box#${state.elements.filter(e=>e.type==='rect').length+1}` });
    state.start = null;
  } else if (state.tool === TOOL.PENCIL){
    state.currentPath.push(p); addEl({ type:'path', points:[...state.currentPath] }); state.currentPath=[];
  }
  state.drawing = false; draw(); if (state.liveAscii) scheduleAscii();
}

function onDoubleClickRename(e){
  const p = getPos(e);
  const hit = hitRect(p.x, p.y);
  if (!hit) return;
  const name = prompt('Nombre / hint del bloque:', hit.label || '');
  if (name!==null){
    const trimmed = name.trim();
    if (trimmed !== (hit.label || '')){
      pushHistory();
      discardRedo();
      hit.label = trimmed;
      state.selectedId = hit.id;
      draw();
      if (state.liveAscii) scheduleAscii();
    }
  }
}

function hitRect(x,y){
  for(let i=state.elements.length-1;i>=0;i--){
    const el = state.elements[i];
    if (el.type==='rect' && x>=el.x && x<=el.x+el.w && y>=el.y && y<=el.y+el.h) return el;
  }
  return null;
}

function getTextBBox(el){
  const text = el.text || '';
  ctx.save();
  ctx.font = '14px sans-serif';
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const height = 16;
  ctx.restore();
  return { x: el.x, y: el.y - height + 4, w: width, h: height };
}

function pickElement(x,y){
  for(let i=state.elements.length-1;i>=0;i--){
    const el = state.elements[i];
    if (el.type === 'text'){
      const box = getTextBBox(el);
      if (x >= box.x - 4 && x <= box.x + box.w + 4 && y >= box.y - 4 && y <= box.y + box.h + 4){
        return el;
      }
    } else if (el.type === 'rect' && x>=el.x && x<=el.x+el.w && y>=el.y && y<=el.y+el.h){
      return el;
    }
  }
  return null;
}

function addEl(el){
  pushHistory();
  discardRedo();
  state.elements = [...state.elements, { id: uid(), ...el }];
  state.selectedId = null;
}
function uid(){ return Math.random().toString(36).slice(2,9); }
function getPos(e){ const r = canvas.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
function normalizeRect(r){ const x = r.w<0? r.x + r.w : r.x; const y = r.h<0? r.y + r.h : r.y; return { x, y, w:Math.abs(r.w), h:Math.abs(r.h) }; }
function clampInt(v,min,max){ v = parseInt(v||min,10); return Math.max(min, Math.min(max, v)); }
function snap(p){ if (!state.snap) return p; const cw = canvas.width/state.cols; const rh = canvas.height/state.rows; return { x: Math.round(p.x/cw)*cw, y: Math.round(p.y/rh)*rh }; }
function toGridBBox(r){ const cw = canvas.width/state.cols; const rh = canvas.height/state.rows; return { x:Math.floor(r.x/cw), y:Math.floor(r.y/rh), w:Math.max(1, Math.round(r.w/cw)), h:Math.max(1, Math.round(r.h/rh)) }; }
function toGridPoint(t){ const cw = canvas.width/state.cols; const rh = canvas.height/state.rows; return { x:Math.floor(t.x/cw), y:Math.floor(t.y/rh) }; }
function removeLastElement(){
  if (!state.elements.length) return false;
  const removed = state.elements[state.elements.length - 1];
  pushHistory();
  discardRedo();
  state.elements = state.elements.slice(0, state.elements.length - 1);
  if (state.selectedId === removed?.id || state.elements.length === 0){
    state.selectedId = null;
  }
  if (state.dragContext && state.dragContext.id === removed?.id){
    state.dragContext = null;
  }
  draw();
  if (state.liveAscii) scheduleAscii();
  return true;
}

function removeSelectedElement(){
  if (!state.selectedId) return false;
  const idx = state.elements.findIndex(el=> el.id === state.selectedId);
  if (idx === -1){
    state.selectedId = null;
    return false;
  }
  const removedId = state.selectedId;
  pushHistory();
  discardRedo();
  state.elements = state.elements.filter(el=> el.id !== state.selectedId);
  state.selectedId = null;
  if (state.dragContext && state.dragContext.id === removedId){
    state.dragContext = null;
  }
  draw();
  if (state.liveAscii) scheduleAscii();
  return true;
}

function draw(){
  // Fondo (imagen)
  bg.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  if (state.bg.image){
    bg.save(); bg.globalAlpha = state.bg.opacity;
    const img = state.bg.image;
    const scale = Math.min(bgCanvas.width/img.width, bgCanvas.height/img.height);
    const iw = img.width * scale, ih = img.height * scale;
    const ix = (bgCanvas.width - iw) / 2;
    const iy = (bgCanvas.height - ih) / 2;
    bg.drawImage(img, ix, iy, iw, ih);
    bg.restore();
  }

  // Vectorial
  ctx.clearRect(0,0,canvas.width, canvas.height);
  state.elements.forEach(el=>{
    if (el.type==='rect'){
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.strokeRect(el.x, el.y, el.w, el.h);
      ctx.fillStyle = '#334155'; ctx.font = '12px sans-serif'; ctx.fillText(el.label||'rect', el.x+6, el.y+14);
    } else if (el.type==='path'){
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.beginPath(); el.points.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.stroke();
    } else if (el.type==='text'){
      ctx.fillStyle = '#111827'; ctx.font = '14px sans-serif'; ctx.fillText(el.text||'', el.x, el.y);
    }
  });

  if (state.selectedId){
    const sel = state.elements.find(el=> el.id === state.selectedId);
    if (sel){
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6,4]);
      if (sel.type === 'rect'){
        ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
      } else if (sel.type === 'text'){
        const box = getTextBBox(sel);
        ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
      }
      ctx.restore();
    }
  }

  drawGrid(); if (state.liveAscii) scheduleAscii();
}

// GRID UI
function drawGrid(){
  overlay.width = canvas.width; overlay.height = canvas.height;
  ov.setTransform(1,0,0,1,0,0); ov.clearRect(0,0,overlay.width, overlay.height);
  ov.globalAlpha = 0.7; ov.lineWidth=1; ov.strokeStyle = '#4b5563';
  const cw = canvas.width/state.cols; const rh = canvas.height/state.rows;
  for(let c=1;c<state.cols;c++){ const x=c*cw; ov.beginPath(); ov.moveTo(x,0); ov.lineTo(x,canvas.height); ov.stroke(); }
  for(let r=1;r<state.rows;r++){ const y=r*rh; ov.beginPath(); ov.moveTo(0,y); ov.lineTo(canvas.width,y); ov.stroke(); }
  ov.globalAlpha=1; ov.fillStyle='#1f2937'; ov.font='11px sans-serif';
  for(let c=0;c<state.cols;c++){ ov.fillText(String(c), c*cw+4, 14); }
  for(let r=0;r<state.rows;r++){ ov.fillText(String(r), 4, Math.max(13, r*rh-2)); }
}

// LIVE ASCII (throttled)
let asciiQueued = false;
function scheduleAscii(){ if (asciiQueued) return; asciiQueued = true; requestAnimationFrame(()=>{ asciiQueued = false; updateLiveAscii(); }); }
function updateLiveAscii(){ if (!state.liveAscii) return; const ascii = exportASCIIGeneric(state, toGridBBox); $('#asciiOut').value = ascii; }

// Kick-off inicial
draw();

window.addEventListener('keydown', (e)=>{
  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (ctrl && key === 'z' && !e.shiftKey){
    e.preventDefault();
    undo();
    return;
  }
  if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z')){
    e.preventDefault();
    redo();
    return;
  }
  if (!ctrl && !e.metaKey && (key === 'delete' || key === 'backspace')){
    e.preventDefault();
    if (!removeSelectedElement()){
      removeLastElement();
    }
  }
});

window.addEventListener('paste', handlePasteImage);

async function runAutoDetect(skipNoBgAlert=false){
  if (state.detecting) return;
  if (!state.bg.image){
    if (!skipNoBgAlert) alert('Carga primero una imagen de fondo.');
    return;
  }
  logMessage('Iniciando detección con OpenCV (worker)…');
  state.detecting = true;
  const btn = $('#autoDetect');
  const prevLabel = btn?.textContent;
  if (btn){
    btn.disabled = true;
    btn.textContent = 'Detectando...';
  }
  showProgress('Analizando imagen...');
  await nextFrame();
  try{
    const rects = await detectRectsWithOpenCV(bgCanvas, { minSize:40, canny1:50, canny2:150, approxEps:8, iouThresh:0.15 });
    logMessage(`Detección completada. Rectángulos detectados: ${rects.length}.`);
    pushSnapshot(state.elements);
    discardRedo();
    const manual = state.elements.filter(el=> !(el.type==='rect' && (el.label||'').startsWith('auto#')));
    const autoRects = rects.map((r, idx)=> ({ id: uid(), type:'rect', x:r.x, y:r.y, w:r.w, h:r.h, label:`auto#${idx+1}` }));
    state.elements = [...manual, ...autoRects];
    state.selectedId = null;
    state.dragContext = null;
    draw();
    if (state.liveAscii) scheduleAscii();
  } catch(err){
    console.error(err);
    if (!skipNoBgAlert) alert(err?.message || 'OpenCV no disponible.');
    logMessage(`Error en detección: ${err?.message || err}`);
  } finally {
    hideProgress();
    if (btn){
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
    state.detecting = false;
  }
}

function handlePasteImage(e){
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items){
    if (item.type && item.type.startsWith('image/')){
      const file = item.getAsFile();
      if (!file) continue;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        state.bg.image = img;
        draw();
        logMessage(`Imagen pegada desde portapapeles (${img.width}x${img.height}).`);
        URL.revokeObjectURL(url);
      };
      img.src = url;
      e.preventDefault();
      break;
    }
  }
}
