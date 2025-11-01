# Metodologia UI ASCII - Sketch-UI

## Proposito
- Documentar la estructura visual de interfaces dibujadas en el lienzo y las reglas para generar ASCII/JSON/Tk.
- Garantizar que el equipo humano y las IAs utilicen el mismo formato ASCII para discutir y generar layouts de UI.
- Permitir bocetar interfaces dibujando cuadrados, l&iacute;neas o texto en un lienzo y traducirlo autom&aacute;ticamente a representaciones ASCII estructuradas.

## Alcance
- Aplica a la herramienta Sketch-UI para bocetar interfaces web/desktop.
- Puede extenderse a otras herramientas que generen layouts basados en dibujos manuales o detecci&oacute;n autom&aacute;tica con OpenCV.

## Flujo de trabajo recomendado
1. Dise&ntilde;ar o modificar la distribuci&oacute;n de la UI dibujando en el lienzo (rect&aacute;ngulos, l&iacute;neas, texto).
2. Renombrar elementos con doble clic para asignar nombres descriptivos.
3. Opcionalmente, cargar una imagen de fondo y usar "Auto detectar" con OpenCV para detectar secciones autom&aacute;ticamente.
4. Generar el wireframe ASCII siguiendo las convenciones de la secci&oacute;n siguiente.
5. Exportar ASCII/JSON/Tk o copiar del panel para usar en IAs o implementaciones.
6. Revisar el wireframe generado contra el dise&ntilde;o dibujado y ajustarlo si es necesario.

## Convenciones para Wireframes ASCII
- Encabezado del bloque: t&iacute;tulo general de la interfaz y n&uacute;mero de bloques.
- Utilizar +, - y | para dibujar bordes principales.
- Indicar porcentajes de altura y ancho respecto a la grilla (Rows/Cols).
- Numerar y nombrar cada bloque con un ID descriptivo.
- Mantener el bloque dentro de triple backtick ``` para preservar el espaciado.
- Incluir coordenadas de grilla cuando se exporte a JSON/Tk.

## Wireframe base de ejemplo
```
+--------------------------------------------------------------+
|                        SKETCH ASCII (7 bloques)              |
+--------------------------------------------------------------+
| 01 -> ventana_principal [h:100% w:100%]                      |
| 02 -> barra_superior     [h:10%  w:100%]                      |
| 03 -> menu_lateral       [h:90%  w:25%]                       |
| 04 -> area_contenido     [h:90%  w:75%]                       |
| 05 -> boton_aceptar      [h:10%  w:15%]                       |
| 06 -> boton_cancelar     [h:10%  w:15%]                       |
| 07 -> pie_de_pagina      [h:10%  w:100%]                      |
+--------------------------------------------------------------+
```

Nota: porcentajes respecto a la grilla (Rows/Cols). Los bloques se numeran autom&aacute;ticamente y se nombran seg&uacute;n el dibujo.

## Segundo ejemplo: Interfaz de Comunicaci&oacute;n OS (Hospital)
```
+--------------------------------------------------------------+
| PRUEBA SISTEMA HOSPITALARIO - OCR + BD                       |
| [Progreso  ####.............. ]  Status: Listo para cargar doc|
+--------------------------------------------------------------+
| [ Cargar PDF ] [ Cargar Imagen ] [ Exportar... ]  Archivo: ...|
+--------------------------------------------------------------+
|                         (40%)                                |
|  +------------------ Documento Visual -------------------+   |
|  |                                                      |   |
|  |   preview / mensaje "Carga un documento..."          |   |
|  |                                                      |   |
|  +------------------------------------------------------+   |
+--------------------------------------------------------------+
|                         (20%)                                |
|  +------------ Texto OCR ------------+-- Campos Clave ---+   |
|  |  Texto OCR (ScrolledText)         |  DNI    [   ]     |   |
|  |                                   |  Paciente [   ]   |   |
|  |                                   |  ...              |   |
|  +-----------------------------------+-------------------+   |
+--------------------------------------------------------------+
|                         (20%)                                |
|  +--------------- Logs OCR ------------------------------+   |
|  |  ScrolledText: mensajes de progreso                   |   |
|  +------------------------------------------------------+   |
+--------------------------------------------------------------+
|                         (20%)                                |
|  +----------- Pipeline + Acciones ---------------------+     |
|  |  ScrolledText pipeline / validaciones               |     |
|  |  [Procesar OCR] [Guardar Comunicacion] [Limpiar]    |     |
|  +------------------------------------------------------+     |
+--------------------------------------------------------------+
```

Nota: Este ejemplo muestra una interfaz m&aacute;s compleja con paneles divididos y porcentajes de altura. Se puede bocetar dibujando rect&aacute;ngulos en el lienzo y asignando nombres para generar ASCII similar.

## Equivalente JSON (para IA/Tk)
```
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
```

## Buenas practicas adicionales
- Mantener una grilla de 12x12 por defecto para consistencia.
- Renombrar elementos inmediatamente despu&eacute;s de dibujarlos para claridad.
- Usar "Auto detectar" solo cuando la imagen de fondo tenga secciones claras detectables.
- Documentar cambios en el dise&ntilde;o con wireframes ASCII antes de exportar.
- Incluir notas sobre estados especiales (elementos invisibles, placeholders) en los wireframes.

## Uso de la herramienta
- Dibuj&aacute; con Rect/Pencil/Text, renombr&aacute; con doble clic.
- Pod&eacute;s cargar imagen de fondo y usar "Auto detectar" (OpenCV.js).
- Export&aacute; ASCII/JSON/Tk o copi&aacute; del panel.

## Proximos pasos sugeridos
- Automatizar la generaci&oacute;n de wireframes ASCII desde dibujos m&aacute;s complejos.
- Integrar con IAs para generar c&oacute;digo directamente desde los ASCII.
- Extender soporte para m&aacute;s toolkits (React, Flutter, etc.).
