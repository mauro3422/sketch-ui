// Dinámicamente intenta cargar OpenCV.js desde múltiples CDNs y expone una promesa window.cvReady
(function(){
  const SOURCES = [
    'https://cdn.jsdelivr.net/npm/opencv.js@4.10.0/opencv.js',
    'https://unpkg.com/opencv.js@4.10.0/opencv.js',
    'https://docs.opencv.org/4.x/opencv.js'
  ];
  window.cvReady = new Promise((resolve, reject)=>{
    let tries = 0;
    const next = ()=>{
      if (tries >= SOURCES.length){ reject(new Error('No se pudo cargar OpenCV.js desde CDNs.')); return; }
      const src = SOURCES[tries++];
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = ()=>{ const wait = ()=>{ if (window.cv && window.cv.Mat){ resolve(window.cv); } else setTimeout(wait, 50); }; wait(); };
      s.onerror = ()=>{ next(); };
      document.head.appendChild(s);
    };
    next();
  });
})();
