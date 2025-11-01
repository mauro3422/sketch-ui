# Metodologia UI Comunicacion OS

## Proposito
- Documentar la estructura visual base de la pestana "Comunicacion OS" y las reglas para futuros redisenos.
- Garantizar que equipo humano y Codex utilicen el mismo formato ASCII para discutir layouts.

## Alcance
- Aplica a la interfaz HospitalTesterUI definida en parte_diario/ui/comunicacion_os/ui_prueba.py.
- Puede extenderse a otras pantallas que usen el mismo esquema de contenedores y PanedWindow.

## Flujo de trabajo recomendado
1. Disenar o modificar la distribucion de la UI.
2. Escribir un wireframe ASCII siguiendo las convenciones de la seccion siguiente.
3. Guardar el wireframe en un bloque de codigo dentro de la documentacion (o compartirlo en la conversacion) antes de implementar cambios.
4. Usar el wireframe como referencia durante la implementacion y revisarlo contra el resultado final.

## Convenciones para Wireframes ASCII
- Encabezado del bloque: titulo general de la pantalla.
- Utilizar +, - y | para dibujar bordes principales.
- Indicar porcentajes o pesos aproximados de cada area cuando dependan de PanedWindow.
- Separar acciones o componentes clave con anotaciones breves (botones, textos, etc.).
- Mantener el bloque dentro de triple backtick ``` para preservar el espaciado.

## Wireframe base actual
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

## Buenas practicas adicionales
- Mantener las proporciones de altura en 40/20/20/20 a menos que exista una justificacion distinta.
- Documentar cambios en este archivo con fecha y motivo.
- Cuando la UI requiera nuevos paneles, reflejar el orden vertical u horizontal segun corresponda.
- Incluir notas sobre estados especiales (pantalla vacia, placeholders, errores) para que el wireframe cubra los casos principales.

## Proximos pasos sugeridos
- Automatizar la generacion de estos diagramas desde el programa auxiliar mencionado por el equipo.
- Utilizar enlaces directos al archivo markdown en los mensajes de coordinacion para que todos consulten la misma referencia.

