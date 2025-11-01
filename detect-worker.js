let cvReady = null;

function postLog(message, id) {
  try {
    self.postMessage({ type: 'log', message, id });
  } catch (_) {
    // No-op
  }
}

function loadOpenCV() {
  if (cvReady) {
    return cvReady;
  }
  cvReady = new Promise((resolve, reject) => {
    try {
      postLog('Cargando OpenCV en worker...');
      self.importScripts('libs/opencv.js');
      const poll = () => {
        if (self.cv && self.cv.Mat) {
          postLog('OpenCV listo en worker.');
          resolve(self.cv);
        } else {
          setTimeout(poll, 50);
        }
      };
      poll();
    } catch (err) {
      reject(err);
    }
  });
  return cvReady;
}

function IoU(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  return inter / Math.max(1, areaA + areaB - inter);
}

function mergeOverlaps(rects, iouThresh = 0.15) {
  const out = [];
  rects.sort((a, b) => a.x - b.x || a.y - b.y);
  for (const r of rects) {
    let merged = false;
    for (const o of out) {
      const iou = IoU(r, o);
      if (iou >= iouThresh) {
        const x1 = Math.min(o.x, r.x);
        const y1 = Math.min(o.y, r.y);
        const x2 = Math.max(o.x + o.w, r.x + r.w);
        const y2 = Math.max(o.y + o.h, r.y + r.h);
        o.x = x1;
        o.y = y1;
        o.w = x2 - x1;
        o.h = y2 - y1;
        merged = true;
        break;
      }
    }
    if (!merged) {
      out.push({ ...r });
    }
  }
  return out;
}

self.onmessage = async (event) => {
  const { id, type, width, height, buffer, opts } = event.data || {};
  if (type !== 'detect' || typeof id === 'undefined') return;

  try {
    postLog(`Worker recibio solicitud #${id} (${width}x${height}).`, id);
    const cv = await loadOpenCV();
    const data = new Uint8ClampedArray(buffer);
    const imageData = new ImageData(data, width, height);
    let src = cv.matFromImageData(imageData);
    postLog(`Imagen convertida a Mat (${src.cols}x${src.rows}).`, id);

    const maxDim = opts?.maxDim ?? 1400;
    const currentMax = Math.max(src.cols, src.rows);
    let scale = 1;
    if (currentMax > maxDim) {
      scale = maxDim / currentMax;
      const size = new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale));
      const resized = new cv.Mat();
      cv.resize(src, resized, size, 0, 0, cv.INTER_AREA);
      src.delete();
      src = resized;
      postLog(`Escalando imagen a ${src.cols}x${src.rows} (scale=${scale.toFixed(3)})`, id);
    }

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    postLog('Convertido a escala de grises.', id);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0);
    postLog('Aplicado blur.', id);
    const edges = new cv.Mat();
    const { canny1 = 50, canny2 = 150, approxEps = 8, iouThresh = 0.15, minSize = 40 } = opts || {};
    cv.Canny(gray, edges, canny1, canny2, 3, false);
    postLog('Canny completado.', id);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    postLog(`findContours -> ${contours.size()} contornos.`, id);

    const rects = [];
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, approxEps, true);
      const rect = cv.boundingRect(approx);
      approx.delete();
      cnt.delete();

      if (rect.width > minSize && rect.height > minSize) {
        if (scale !== 1) {
          rects.push({
            x: Math.round(rect.x / scale),
            y: Math.round(rect.y / scale),
            w: Math.round(rect.width / scale),
            h: Math.round(rect.height / scale),
          });
        } else {
          rects.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
        }
      }
    }

    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    const merged = mergeOverlaps(rects, iouThresh);
    self.postMessage({ type: 'result', id, rects: merged });
    postLog(`Worker #${id}: ${rects.length} rectangulos (tras merge: ${merged.length}).`, id);
  } catch (err) {
    const msg = err?.message || String(err);
    postLog(`Error en worker: ${msg}`, id);
    self.postMessage({ type: 'error', id, message: msg });
  }
};
