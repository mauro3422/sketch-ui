let workerInstance = null;
let messageId = 0;
const pending = new Map();
const listeners = new Set();

export function onDetectLog(fn){
  if (typeof fn !== 'function') return ()=>{};
  listeners.add(fn);
  return ()=> listeners.delete(fn);
}

function getWorker() {
  if (workerInstance) return workerInstance;
  const url = new URL('./detect-worker.js', import.meta.url);
  workerInstance = new Worker(url, { type: 'classic' });
  workerInstance.onmessage = (event) => {
    const { id, type, rects, message } = event.data || {};
    if (type === 'log'){
      listeners.forEach(fn => {
        try { fn(message, id); } catch (_) {}
      });
      return;
    }
    if (!pending.has(id)) return;
    const { resolve, reject } = pending.get(id);
    pending.delete(id);
    if (type === 'result') {
      resolve(rects || []);
    } else {
      reject(new Error(message || 'Error en deteccion con OpenCV.'));
    }
  };
  workerInstance.onerror = (err) => {
    pending.forEach(({ reject }) => reject(err));
    pending.clear();
  };
  return workerInstance;
}

export function detectRectsWithOpenCV(canvasEl, opts = {}) {
  const worker = getWorker();
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas sin contexto 2D'));

  const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
  const id = ++messageId;

  worker.postMessage(
    {
      type: 'detect',
      id,
      width: imageData.width,
      height: imageData.height,
      buffer: imageData.data.buffer,
      opts,
    },
    [imageData.data.buffer]
  );

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}
