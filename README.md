# Sketch-UI

Bocetá interfaces con rectángulos, texto o trazos y obtené ASCII/JSON/Tk para que una IA lo consuma.

## Ejemplo de salida (ASCII de referencia)

    +--------------------------------------------------------------+
    |                        SKETCH ASCII (7 bloques)              |
    +--------------------------------------------------------------+
    | 01 • ventana_principal [h:100% w:100%]                      |
    | 02 • barra_superior     [h:10%  w:100%]                      |
    | 03 • menu_lateral       [h:90%  w:25%]                       |
    | 04 • area_contenido     [h:90%  w:75%]                       |
    | 05 • boton_aceptar      [h:10%  w:15%]                       |
    | 06 • boton_cancelar     [h:10%  w:15%]                       |
    | 07 • pie_de_pagina      [h:10%  w:100%]                      |
    +--------------------------------------------------------------+

Nota: porcentajes respecto a la grilla (Rows/Cols).

## Equivalente JSON (para IA/Tk)

    {
      "toolkit": "tkinter",
      "layout": {
        "mode": "grid",
        "grid": { "rows": 12, "cols": 12 },
        "widgets": [
          { "id": "ventana_principal", "grid": { "row": 0,  "column": 0, "rowspan": 12, "columnspan": 12 } },
          { "id": "barra_superior",    "grid": { "row": 0,  "column": 0, "rowspan": 1,  "columnspan": 12 } },
          { "id": "menu_lateral",      "grid": { "row": 1,  "column": 0, "rowspan": 10, "columnspan": 3 } },
          { "id": "area_contenido",    "grid": { "row": 1,  "column": 3, "rowspan": 10, "columnspan": 9 } },
          { "id": "boton_aceptar",     "grid": { "row": 11, "column": 7, "rowspan": 1,  "columnspan": 2 } },
          { "id": "boton_cancelar",    "grid": { "row": 11, "column": 9, "rowspan": 1,  "columnspan": 2 } },
          { "id": "pie_de_pagina",     "grid": { "row": 11, "column": 0, "rowspan": 1,  "columnspan": 12 } }
        ]
      }
    }

## Uso
- Dibujá con Rect/Pencil/Text, renombrá con doble clic.
- Podés cargar imagen de fondo y usar \"Auto detectar\" (OpenCV.js).
- Exportá ASCII/JSON/Tk o copiá del panel.
