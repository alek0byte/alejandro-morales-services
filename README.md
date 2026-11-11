# Alejandro Morales · Servicios Informáticos

Sitio web estático (HTML, CSS y JavaScript, sin frameworks) publicado con GitHub Pages
desde la rama `main`, carpeta raíz. URL: https://alek0byte.github.io/alejandro-morales-services/

## Dónde se edita cada cosa

| Quieres cambiar… | Edita… |
|---|---|
| Servicios, precios, condiciones, proceso de trabajo | `data/catalogo.json` |
| Teléfono, mensaje de WhatsApp, nombre, fecha de actualización | `data/catalogo.json` (`phone`, `whatsapp_message`, `owner`, `updated_date`) |
| Preguntas frecuentes de Contacto | `data/catalogo.json` (`faq`) |
| Las 4 tarjetas de la portada | `data/catalogo.json` (`home_cards`; la categoría debe existir en `services`) |
| El generador de presupuestos (texto, botones, campos) | `src/pages/presupuesto.html` |
| La lógica del generador (PDF, WhatsApp, cálculos) | `assets/js/presupuesto.js` |
| Diseño del generador | `assets/css/site.css` (sección `Generador de presupuestos`, al final) |
| El texto de una página | `src/pages/<página>.html` |
| El menú (añadir o quitar páginas) | `src/config.json` (`nav`) |
| Cabecera o pie | `src/partials/header.html` y `footer.html` |
| Estructura común del `<head>` | `src/layout.html` |
| URL del sitio o nombre del repositorio | `src/config.json` (`site_url`, `base_path`) |
| Colores, tipografías, diseño | `assets/css/site.css` (colores y alturas al inicio, en `:root`) |

## Flujo de trabajo

1. Edita los archivos de la tabla.
2. Ejecuta `python3 tools/build.py` (solo usa la biblioteca estándar de Python).
3. Revisa el sitio y haz *commit* de **todo**, incluidos los archivos generados.
4. Al hacer *push* a `main`, GitHub Pages lo publica en uno o dos minutos.

`python3 tools/build.py --check` no escribe nada: avisa si algún archivo generado está
desactualizado. El script también se detiene con un mensaje claro si `catalogo.json` tiene un
error de sintaxis, si un servicio no tiene precio, si una tarjeta de la portada apunta a una
categoría que no existe o si una página enlaza a un archivo que no existe.

**No edites a mano** `index.html`, `servicios.html`, `condiciones.html`, `contacto.html`,
`presupuesto.html`, `404.html`, `sitemap.xml` ni `robots.txt`: se generan desde `src/` y
`data/`, y la próxima ejecución del script sobrescribiría los cambios.

## Estructura

```
data/catalogo.json     datos del sitio (única fuente)
src/                   plantillas: layout, parciales, páginas y config
tools/build.py         genera las páginas, sitemap.xml y robots.txt
assets/css/            fonts.css (fuentes locales) y site.css (diseño)
assets/js/             site.js (menú, copiar teléfono, botón flotante),
                       shared.js (utilidades), catalog.js (catálogo),
                       conditions.js (condiciones y proceso),
                       presupuesto.js (generador de presupuestos)
assets/js/vendor/      jspdf.umd.min.js (generación local de PDF, sin CDN)
assets/fonts, img/     tipografías DM Sans y Space Grotesk, imágenes
.nojekyll              GitHub Pages sirve los archivos tal cual, sin Jekyll
```

## Cómo funciona el catálogo

`servicios.html` y `condiciones.html` cargan `data/catalogo.json` desde el navegador y dibujan el
contenido con JavaScript. El resto (pie, menú, teléfono, FAQ, tarjetas, fecha) queda escrito
en el HTML al ejecutar `build.py`, así que funciona aunque JavaScript falle.

## Cómo funciona el generador de presupuestos

`presupuesto.html` (en el menú como «Presupuestos») también carga `data/catalogo.json`: al
marcar servicios se arma el desglose con cantidades y precios editables (los precios «desde»
se marcan como mínimos orientativos), más desplazamiento, descuento y observaciones. El
borrador se guarda solo en el navegador (`localStorage`) y el número (`PR-AAAA-NNNN`) avanza
por año en cada navegador. «Generar PDF» descarga un documento A4 con la identidad visual del
sitio (logo, banda oscura, acento turquesa, condiciones y pie con paginación) usando jsPDF
incluido en `assets/js/vendor/`. «Compartir por WhatsApp» abre un chat con el teléfono del
cliente (si el número tiene 8 dígitos se le añade el prefijo 53) y el resumen ya escrito; el
PDF se adjunta después en el chat.

## Probar en local

```
python3 tools/build.py
python3 -m http.server 8000
```

Abre http://localhost:8000. La página `404.html` usa rutas con el nombre del repositorio
(`base_path`), por eso en local se ve sin estilos; en GitHub Pages es correcto.

## Notas

- Los precios son texto libre; usa `Desde X USD` para importes variables y `X USD` para importes fijos.
- Las fuentes están incluidas en `assets/fonts/`; no se descargan de Google Fonts.
- Para cambiar de nombre el repositorio o usar un dominio propio, actualiza `site_url` y
  `base_path` en `src/config.json` y vuelve a ejecutar el script.
