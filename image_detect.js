// image_detect.js — utilidades de visión por computadora (OpenCV.js)
// Requiere que opencv-loader.js exponga window.cvReady (Promise que resuelve con window.cv)

export async function detectRectsWithOpenCV(canvasEl, opts={}){
  const cv = await (window.cvReady || Promise.reject(new Error('cvReady no disponible')));
  const { minSize=40, canny1=50, canny2=150, approxEps=8, iouThresh=0.15 } = opts;

  const src = cv.imread(canvasEl);        // RGBA desde el canvas de fondo (bg-layer)
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(gray, gray, new cv.Size(5,5), 0, 0);
  const edges = new cv.Mat();
  cv.Canny(gray, edges, canny1, canny2, 3, false);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const rects = [];
  for (let i=0; i<contours.size(); i++){
    const cnt = contours.get(i);
    const approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, approxEps, true);
    const rect = cv.boundingRect(approx);
    if (rect.width > minSize && rect.height > minSize){
      rects.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
    }
    approx.delete(); cnt.delete();
  }
  src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();

  return mergeOverlaps(rects, iouThresh);
}

export function mergeOverlaps(rects, iouThresh=0.15){
  const out = [];
  rects.sort((a,b)=> a.x - b.x || a.y - b.y);
  for (const r of rects){
    let merged = false;
    for (const o of out){
      const iou = IoU(r,o);
      if (iou >= iouThresh){
        const x1 = Math.min(o.x, r.x), y1 = Math.min(o.y, r.y);
        const x2 = Math.max(o.x+o.w, r.x+r.w), y2 = Math.max(o.y+o.h, r.y+r.h);
        o.x = x1; o.y = y1; o.w = x2 - x1; o.h = y2 - y1;
        merged = true; break;
      }
    }
    if (!merged) out.push({...r});
  }
  return out;
}

export function IoU(a,b){
  const x1 = Math.max(a.x,b.x), y1=Math.max(a.y,b.y);
  const x2 = Math.min(a.x+a.w, b.x+b.w), y2=Math.min(a.y+a.h, b.y+b.h);
  const inter = Math.max(0, x2-x1) * Math.max(0, y2-y1);
  const areaA = a.w*a.h, areaB = b.w*b.h;
  return inter / Math.max(1, (areaA + areaB - inter));
}
