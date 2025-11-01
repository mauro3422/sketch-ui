(function(){
  class Mat {
    constructor(cols = 0, rows = 0, data = null) {
      this.cols = cols;
      this.rows = rows;
      this.data = data;
    }
    delete() {}
  }

  class MatVector {
    constructor() {
      this._items = [];
    }
    push(item) {
      this._items.push(item);
    }
    get(index) {
      return this._items[index];
    }
    size() {
      return this._items.length;
    }
    delete() {
      this._items.length = 0;
    }
  }

  class FakeContour {
    constructor(rect) {
      this._rect = rect;
    }
    delete() {}
  }

  function cloneData(source) {
    if (!source) {
      return null;
    }
    return new Uint8ClampedArray(source);
  }

  function matFromImageData(imageData) {
    const data = cloneData(imageData.data);
    return new Mat(imageData.width, imageData.height, data);
  }

  function resize(src, dst, size) {
    dst.cols = size.width;
    dst.rows = size.height;
    dst.data = cloneData(src.data);
  }

  function cvtColor(src, dst) {
    dst.cols = src.cols;
    dst.rows = src.rows;
    dst.data = cloneData(src.data);
  }

  function gaussianBlur(src, dst) {
    dst.cols = src.cols;
    dst.rows = src.rows;
    dst.data = cloneData(src.data);
  }

  function canny(src, dst) {
    dst.cols = src.cols;
    dst.rows = src.rows;
    dst.data = cloneData(src.data);
  }

  function findContours(src, contours) {
    if (!src?.data || !src.cols || !src.rows) {
      return;
    }
    const width = src.cols;
    const height = src.rows;
    const data = src.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a > 0 && (r < 250 || g < 250 || b < 250)) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      const rect = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
      contours.push(new FakeContour(rect));
    }
  }

  function approxPolyDP(cnt, approx) {
    approx._rect = cnt._rect;
  }

  function boundingRect(approx) {
    return {
      x: approx._rect.x,
      y: approx._rect.y,
      width: approx._rect.width,
      height: approx._rect.height,
    };
  }

  const cv = {
    matFromImageData,
    resize,
    cvtColor,
    GaussianBlur: gaussianBlur,
    Canny: canny,
    findContours,
    approxPolyDP,
    boundingRect,
    Mat,
    MatVector,
    MatVectorVector: MatVector,
    INTER_AREA: 0,
    COLOR_RGBA2GRAY: 0,
    Size: function(width, height) {
      return { width, height };
    },
  };

  self.cv = cv;
})();
