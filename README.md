# 🧠 Sketch-UI

Bocetá interfaces con rectángulos / lápiz / texto, obtené **ASCII en vivo** y exportá esquemas (JSON, Tk grid/place/hybrid).

## Novedad
- **Imagen de fondo + Auto detectar (OpenCV.js)**: cargás una screenshot, detecta bloques y los convierte en rects editables.
- **Live ASCII**: el panel ASCII se actualiza mientras dibujás.

## Cómo usar
1. Abrí `index.html` con un server estático (p. ej. `npx serve`).
2. Herramientas: **Rect**, **Pencil**, **Text**. Doble‑clic para renombrar rects.
3. **Fondo**: cargá imagen; **Opacidad**: ajustá; **Auto detectar**: propone rectángulos.
4. Mirá **Salida ASCII** en vivo y/o **Export JSON / Tk** cuando quieras.

## Exportadores
- **JSON**: lista de widgets con bboxes en grilla, componentes inferidos y layout sugerido.
- **ASCII genérico**: resumen de bloques con % respecto a la grilla.
- **Tk grid/place**: mapea contenedores a `grid()` o `place()` proporcional.
- **Tk hybrid**: arma un árbol de `paned` (vertical/horizontal) según contención y orientación inferida.

## Detección (OpenCV.js)
- Canny → contornos → `boundingRect` → merge por IoU.
- Parámetros tunables en código: `minSize`, `canny1/2`, `approxEps`, `iouThresh`.
- Carga automática desde múltiples CDNs (ver `opencv-loader.js`).

## Estructura
- `index.html` – UI + panels
- `styles.css` – estilos
- `app.js` – interacción, drawing, export hooks, fondo, live ASCII
- `image_detect.js` – visión por computadora (detección de rects)
- `opencv-loader.js` – descarga OpenCV desde CDNs
- `heuristics.js` – inferencia de contención/orientación/componentes
- `exporter.js` – exportadores JSON/ASCII/Tk

## Roadmap
- Panel de parámetros (Canny/IoU) desde UI.
- OCR (Tesseract.js) para labels automáticos.
- Undo/Redo, mover/redimensionar rects, selección múltiple.

## Licencia
MIT
