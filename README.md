# 🧠 Sketch-UI (General): Bocetado visual → Layouts para IA/Tkinter/ASCII (Live ASCII)

## Novedad
Ahora incluye **Live ASCII**: el wireframe en ASCII se actualiza automáticamente mientras dibujás (toggle en la toolbar).

## Cómo usar
1. Serví la carpeta (p. ej. `npx serve`) y abrí el `localhost` indicado.
2. Dibujá rectángulos, renombrá con doble‑clic (hints).
3. Mirá el panel **Salida ASCII** en vivo. Exportá cuando quieras JSON / Tk Grid / Tk Place / Hybrid.

## Fixes
- **Pencil**: ahora acumula puntos correctamente durante el arrastre y persiste el trazo al soltar.
- **Text**: si el input de la toolbar está vacío, aparece un `prompt` para escribir la etiqueta en el click.
- **Grid**: corrección de líneas horizontales (canvas.width).
