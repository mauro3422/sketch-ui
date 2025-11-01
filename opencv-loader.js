const SOURCES = [
  'libs/opencv.js',
  'https://cdn.jsdelivr.net/npm/opencv.js@4.10.0/opencv.js',
  'https://unpkg.com/opencv.js@4.10.0/opencv.js',
  'https://docs.opencv.org/4.x/opencv.js'
];

let cvReadyPromise = null;

function injectScript(src, resolve, reject) {
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  if (src.startsWith('http')) {
    script.crossOrigin = 'anonymous';
  }
  script.onload = () => {
    const wait = () => {
      if (window.cv && window.cv.Mat) {
        resolve(window.cv);
      } else {
        setTimeout(wait, 50);
      }
    };
    wait();
  };
  script.onerror = () => reject(new Error(`Fallo al cargar OpenCV desde ${src}`));
  document.head.appendChild(script);
}

export function loadOpenCV() {
  if (window.cv && window.cv.Mat) {
    return Promise.resolve(window.cv);
  }
  if (cvReadyPromise) return cvReadyPromise;

  cvReadyPromise = new Promise((resolve, reject) => {
    let attempt = 0;
    const tryNext = () => {
      if (attempt >= SOURCES.length) {
        reject(new Error('No se pudo cargar OpenCV.js desde las fuentes configuradas.'));
        return;
      }
      const src = SOURCES[attempt++];
      injectScript(src, resolve, () => {
        tryNext();
      });
    };
    tryNext();
  });

  return cvReadyPromise;
}
