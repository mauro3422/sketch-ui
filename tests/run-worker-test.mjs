import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const workerPath = resolve(projectRoot, 'detect-worker.js');
const stubPath = resolve(projectRoot, 'tests', 'stubs', 'opencv-stub.js');

class ImageDataPolyfill {
  constructor(data, width, height) {
    if (!(data instanceof Uint8ClampedArray)) {
      throw new TypeError('ImageData espera Uint8ClampedArray');
    }
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

function createContext(handleMessage) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Uint8ClampedArray,
    ImageData: ImageDataPolyfill,
  };
  context.self = context;
  context.postMessage = handleMessage;
  context.importScripts = (...urls) => {
    for (const url of urls) {
      let target;
      if (url === 'libs/opencv.js') {
        target = stubPath;
      } else if (/^https?:/i.test(url)) {
        throw new Error(`importScripts no soporta URLs remotas en pruebas: ${url}`);
      } else {
        target = resolve(projectRoot, url);
      }
      const code = readFileSyncCompat(target);
      vm.runInContext(code, context);
    }
  };
  return context;
}

const codeCache = new Map();
function readFileSyncCompat(path) {
  if (!codeCache.has(path)) {
    const content = readFileSync(path, 'utf8');
    codeCache.set(path, content);
  }
  return codeCache.get(path);
}

async function loadWorker(context) {
  const source = await readFile(workerPath, 'utf8');
  vm.createContext(context);
  vm.runInContext(source, context);
  if (typeof context.onmessage !== 'function') {
    throw new Error('El worker no registró onmessage');
  }
}

function createTestImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const startX = 32;
  const startY = 24;
  const rectW = 112;
  const rectH = 72;
  for (let y = startY; y < startY + rectH; y++) {
    for (let x = startX; x < startX + rectW; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 34;
      data[idx + 1] = 34;
      data[idx + 2] = 34;
      data[idx + 3] = 255;
    }
  }
  return data;
}

async function main() {
  const logs = [];
  let resolveResult;
  let rejectResult;
  const resultPromise = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const context = createContext((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'log') {
      logs.push(msg.message);
      return;
    }
    if (msg.type === 'result') {
      resolveResult({ rects: msg.rects, logs });
      return;
    }
    if (msg.type === 'error') {
      rejectResult(new Error(msg.message || 'Error en worker'));
    }
  });

  await loadWorker(context);

  const width = 200;
  const height = 150;
  const pixels = createTestImage(width, height);

  context.onmessage({
    data: {
      type: 'detect',
      id: 1,
      width,
      height,
      buffer: pixels.buffer,
      opts: { minSize: 20 },
    },
  });

  let result;
  try {
    result = await Promise.race([
      resultPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout esperando al worker')), 5000)),
    ]);
  } catch (err) {
    console.error('La prueba del worker falló:', err);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(result.rects) || result.rects.length !== 1) {
    console.error('Se esperaba un rectángulo en la respuesta y se obtuvo:', result.rects);
    process.exitCode = 1;
    return;
  }

  const rect = result.rects[0];
  const condiciones = [
    rect.x >= 30 && rect.x <= 40,
    rect.y >= 20 && rect.y <= 40,
    rect.w > 80 && rect.w <= 120,
    rect.h > 60 && rect.h <= 90,
  ];

  if (!condiciones.every(Boolean)) {
    console.error('Rectángulo fuera del rango esperado:', rect);
    process.exitCode = 1;
    return;
  }

  if (!result.logs.some((msg) => typeof msg === 'string' && msg.includes('OpenCV listo en worker'))) {
    console.error('No se registró el mensaje de OpenCV listo. Logs:', result.logs);
    process.exitCode = 1;
    return;
  }

  console.log('Prueba del worker exitosa. Rectángulo detectado:', rect);
}

main().catch((err) => {
  console.error('Error inesperado ejecutando la prueba del worker:', err);
  process.exitCode = 1;
});
