# Nueva web — Alejandro Morales

Sitio web original, multipágina y adaptable a móviles, preparado para GitHub Pages.

## Archivos que debes subir al nuevo repositorio

Sube **todo el contenido** de esta carpeta conservando exactamente la estructura:

- `index.html` — página de inicio.
- `servicios.html` — catálogo con buscador y filtros.
- `condiciones.html` — condiciones, proceso de trabajo y procedimiento.
- `contacto.html` — contacto por WhatsApp.
- `404.html` — página de error.
- `data/catalogo.json` — fuente central de servicios, precios, condiciones y datos.
- `assets/css/site.css` — diseño y estilos.
- `assets/js/site.js` — menú móvil.
- `assets/js/catalog.js` — buscador y filtros del catálogo.
- `assets/js/conditions.js` — carga de condiciones y procedimiento.

## Identidad visual inicial

- Fondo principal: `#101820`
- Fondo profundo: `#0B1218`
- Aguamarina: `#78CFC0`
- Verde petróleo: `#245B55`
- Paneles: `#15232C` y `#192A34`

Los colores están centralizados al inicio de `assets/css/site.css`, dentro de `:root`, por lo que se pueden ajustar desde un solo lugar.

## Notas

- El catálogo conserva las descripciones, precios y condiciones que estaban en el `index.html` del repositorio consultado para esta primera versión.
- Los precios se mantienen tal como aparecen en ese catálogo, incluyendo valores `A partir de` y `Desde`.
- El enlace de contacto usa `https://wa.me/5359216497`.
- No necesita frameworks, compilación ni dependencias de Node. Se sirve como HTML/CSS/JavaScript estático.
- La fuente DM Sans / Space Grotesk se carga desde Google Fonts; si no hay conexión, el navegador usa fuentes alternativas.
