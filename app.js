import { inferLayout, inferComponents, buildContainmentTree } from './heuristics.js';
import { exportJSON, exportASCIIGeneric, exportTkGrid, exportTkPlace, exportTkHybrid } from './exporter.js';
import { detectRectsWithOpenCV } from './image_detect.js';

const TOOL = { SELECT:'select', RECT:'rect', PENCIL:'pencil', TEXT:'text' };
const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const overlay = $('#overlay');
const ctx = canvas.getContext('2d');
const ov = overlay.getContext('2d');

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
};

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
$('#clear').addEventListener('click', ()=> { state.elements = []; draw(); $('#jsonOut').value=''; $('#asciiOut').value=''; });

// Fondo: carga y opacidad
$('#bgInput').addEventListener('change', (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = ()=>{ state.bg.image = img; draw(); };
  img.src = URL.createObjectURL(file);
});
$('#bgOpacity').addEventListener('input', (e)=>{ state.bg.opacity = parseFloat(e.target.value||'0.35'); draw(); });

// Auto-detección con OpenCV
$('#autoDetect').addEventListener('click', async ()=>{
  try{
    if (!state.bg.image) { alert('Cargá primero una imagen de fondo.'); return; }
    const rects = await detectRectsWithOpenCV(bgCanvas, { minSize:40, canny1:50, canny2:150, approxEps:8, iouThresh:0.15 });
    if (!rects.length){ alert('No se detectaron bloques. Ajustá opacidad/imagen/umbral.'); return; }
    rects.forEach(r=> addEl({ type:'rect', ...r, label:`auto#${uid().slice(0,4)}` }));
    draw(); if (state.liveAscii) scheduleAscii();
  } catch(err){ console.error(err); alert('OpenCV no disponible o error en detección.'); }
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
  const p = getPos(e);
  if (state.tool === TOOL.RECT){
    const {x,y} = snap(p); state.start = {x,y}; state.drawing = true;
  } else if (state.tool === TOOL.PENCIL){
    const {x,y} = snap(p); state.currentPath = [{x,y}]; state.drawing = true;
  } else if (state.tool === TOOL.TEXT){
    let txt = $('#textInput').value.trim(); if (!txt) { txt = prompt('Texto a insertar:',''); } if (!txt) return;
    const {x,y} = snap(p); addEl({ type:'text', x, y, text:txt }); $('#textInput').value='';
  }
  draw();
}

function onMove(e){
  if (!state.drawing) return;
  const p = snap(getPos(e));
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
  if (!state.drawing) return;
  const p = snap(getPos(e));
  if (state.tool === TOOL.RECT && state.start){
    const r = normalizeRect({ x:state.start.x, y:state.start.y, w:p.x - state.start.x, h:p.y - state.start.y });
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
  if (name!==null){ hit.label = name.trim(); draw(); if (state.liveAscii) scheduleAscii(); }
}

function hitRect(x,y){
  for(let i=state.elements.length-1;i>=0;i--){
    const el = state.elements[i];
    if (el.type==='rect' && x>=el.x && x<=el.x+el.w && y>=el.y && y<=el.y+el.h) return el;
  }
  return null;
}

function addEl(el){ state.elements = [...state.elements, { id: uid(), ...el }]; }
function uid(){ return Math.random().toString(36).slice(2,9); }
function getPos(e){ const r = canvas.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
function normalizeRect(r){ const x = r.w<0? r.x + r.w : r.x; const y = r.h<0? r.y + r.h : r.y; return { x, y, w:Math.abs(r.w), h:Math.abs(r.h) }; }
function clampInt(v,min,max){ v = parseInt(v||min,10); return Math.max(min, Math.min(max, v)); }
function snap(p){ if (!state.snap) return p; const cw = canvas.width/state.cols; const rh = canvas.height/state.rows; return { x: Math.round(p.x/cw)*cw, y: Math.round(p.y/rh)*rh }; }
function toGridBBox(r){ const cw = canvas.width/state.cols; const rh = canvas.height/state.rows; return { x:Math.floor(r.x/cw), y:Math.floor(r.y/rh), w:Math.max(1, Math.round(r.w/cw)), h:Math.max(1, Math.round(r.h/rh)) }; }
function toGridPoint(t){ const cw = canvas.width/state.cols; const rh = canvas.height/state.rows; return { x:Math.floor(t.x/cw), y:Math.floor(t.y/rh) }; }

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

  drawGrid(); if (state.liveAscii) scheduleAscii();
}

// GRID UI
function drawGrid(){
  overlay.width = canvas.width; overlay.height = canvas.height;
  ov.setTransform(1,0,0,1,0,0); ov.clearRect(0,0,overlay.width, overlay.height);
  ov.globalAlpha = .5; ov.lineWidth=1; ov.strokeStyle = '#e5e7eb';
  const cw = canvas.width/state.cols; const rh = canvas.height/state.rows;
  for(let c=1;c<state.cols;c++){ const x=c*cw; ov.beginPath(); ov.moveTo(x,0); ov.lineTo(x,canvas.height); ov.stroke(); }
  for(let r=1;r<state.rows;r++){ const y=r*rh; ov.beginPath(); ov.moveTo(0,y); ov.lineTo(canvas.width,y); ov.stroke(); }
  ov.globalAlpha=.8; ov.fillStyle='#9ca3af'; ov.font='10px sans-serif';
  for(let c=0;c<state.cols;c++){ ov.fillText(String(c), c*cw+4, 12); }
  for(let r=0;r<state.rows;r++){ ov.fillText(String(r), 2, Math.max(10, r*rh-2)); }
}

// LIVE ASCII (throttled)
let asciiQueued = false;
function scheduleAscii(){ if (asciiQueued) return; asciiQueued = true; requestAnimationFrame(()=>{ asciiQueued = false; updateLiveAscii(); }); }
function updateLiveAscii(){ if (!state.liveAscii) return; const ascii = exportASCIIGeneric(state, toGridBBox); $('#asciiOut').value = ascii; }

// Kick-off inicial
draw();
