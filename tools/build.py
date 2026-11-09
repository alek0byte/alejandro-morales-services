#!/usr/bin/env python3
"""Genera las páginas HTML, sitemap.xml y robots.txt a partir de src/ y data/catalogo.json.

Uso (desde la raíz del repositorio):
    python3 tools/build.py            # escribe los archivos generados
    python3 tools/build.py --check    # no escribe; falla si algo está desactualizado

Solo usa la biblioteca estándar de Python (no hay que instalar nada).
La web publicada sigue siendo HTML/CSS/JS estático: este script solo evita
copiar a mano la cabecera, el pie, el teléfono, el enlace de WhatsApp, etc.
"""
import html
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


class BuildError(Exception):
    pass


# ---------------------------------------------------------------- utilidades
def slug(text):
    """Misma regla que catalog.js: así los enlaces #ancla coinciden."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", text))


def esc(s):
    return html.escape(str(s), quote=True)


def esc_text(s):
    return html.escape(str(s), quote=False)


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise BuildError(f"{path.relative_to(ROOT)} no es JSON válido: {e}")


# ---------------------------------------------------------------- plantillas
def render(text, ctx, escape=True):
    """Mini-plantillas: {{> parcial}}, {{#if x}}..{{/if}}, {{{raw}}} y {{escapado}}."""
    def include(m):
        f = SRC / "partials" / f"{m.group(1)}.html"
        if not f.exists():
            raise BuildError(f"Falta el parcial src/partials/{m.group(1)}.html")
        return f.read_text(encoding="utf-8").rstrip("\n")

    prev = None
    while prev != text:  # permite parciales dentro de parciales
        prev, text = text, re.sub(r"\{\{>\s*(\w+)\s*\}\}", include, text)

    text = re.sub(r"\{\{#if (\w+)\}\}\n?(.*?)\{\{/if\}\}\n?",
                  lambda m: m.group(2) if ctx.get(m.group(1)) else "", text, flags=re.S)

    def var(m, raw):
        name = m.group(1)
        if name not in ctx:
            raise BuildError(f"Variable desconocida en una plantilla: {{{{{name}}}}}")
        return str(ctx[name]) if raw or not escape else esc(ctx[name])

    text = re.sub(r"\{\{\{\s*(\w+)\s*\}\}\}", lambda m: var(m, True), text)
    return re.sub(r"\{\{\s*(\w+)\s*\}\}", lambda m: var(m, False), text)


def split_front_matter(text, name):
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not m:
        raise BuildError(f"src/pages/{name} necesita un bloque inicial --- ... ---")
    fm = {}
    for line in m.group(1).split("\n"):
        k, _, v = line.partition(":")
        fm[k.strip()] = v.strip()
    return fm, m.group(2)


# ---------------------------------------------------------------- validación
def validate(data, cfg):
    def need(cond, msg):
        if not cond:
            raise BuildError("data/catalogo.json: " + msg)

    for key in ("owner", "phone", "whatsapp_message", "updated_date", "conditions",
                "procedure", "procedure_note", "faq", "home_cards", "services"):
        need(key in data, f"falta el campo «{key}»")
    need(len(re.sub(r"\D", "", data["phone"])) >= 8, "«phone» no parece un teléfono")
    try:
        date.fromisoformat(data["updated_date"])
    except ValueError:
        raise BuildError("data/catalogo.json: «updated_date» debe ser AAAA-MM-DD")
    cats = set()
    for g in data["services"]:
        need("category" in g and isinstance(g.get("items"), list), "cada categoría necesita «category» e «items»")
        cats.add(g["category"])
        for it in g["items"]:
            need("name" in it, f"un servicio de «{g['category']}» no tiene «name»")
            need("price" in it or "prices" in it, f"«{it.get('name')}» no tiene «price» ni «prices»")
    for q in data["faq"]:
        need("question" in q and "answer" in q, "cada pregunta frecuente necesita «question» y «answer»")
    for c in data["home_cards"]:
        for k in ("category", "icon", "title", "text"):
            need(k in c, f"una tarjeta de portada no tiene «{k}»")
        need(c["category"] in cats,
             f"la tarjeta «{c['title']}» apunta a la categoría «{c['category']}», que no existe. "
             f"Categorías disponibles: {', '.join(sorted(cats))}")
    for item in cfg["nav"]:
        need((SRC / "pages" / item["file"]).exists(), f"el menú apunta a {item['file']}, que no existe en src/pages/")


# ---------------------------------------------------------------- construcción
def build_outputs():
    cfg = load_json(SRC / "config.json")
    data = load_json(ROOT / "data" / "catalogo.json")
    validate(data, cfg)

    site_url, base = cfg["site_url"].rstrip("/"), cfg["base_path"].rstrip("/")
    owner = data["owner"]
    digits = re.sub(r"\D", "", data["phone"])
    d = date.fromisoformat(data["updated_date"])

    g = {  # variables disponibles en todas las páginas
        "owner": owner,
        "owner_upper": owner.upper(),
        "phone": data["phone"],
        "phone_e164": "+" + digits,
        "wa_link": f"https://wa.me/{digits}?text={quote(data['whatsapp_message'], safe='')}",
        "updated_suffix": f" · Actualizado {MESES[d.month - 1]} {d.year}",
        "og_image": f"{site_url}/{cfg['og_image']}",
    }
    g["faq_html"] = "\n    ".join(
        f"<details><summary>{esc_text(q['question'])}</summary><p>{esc_text(q['answer'])}</p></details>"
        for q in data["faq"])

    outputs = {}
    for page_file in sorted((SRC / "pages").glob("*.html")):
        name = page_file.name
        fm, body = split_front_matter(page_file.read_text(encoding="utf-8"), name)
        fm = {k: render(v, g, escape=False) for k, v in fm.items()}
        for k in ("title", "description"):
            if not fm.get(k):
                raise BuildError(f"src/pages/{name}: falta «{k}» en el bloque inicial")

        absolute = bool(fm.get("absolute"))  # la 404 se sirve desde cualquier ruta
        root = base + "/" if absolute else ""
        home = base + "/" if absolute else "index.html"
        ctx = dict(g, root=root, home=home)
        ctx["brand_inner"] = (
            f'<img class="brand-logo" src="{root}assets/img/logo.png" alt="" '
            f'width="98" height="144" decoding="async">'
            f'<span>{esc_text(owner.upper())}<small>SERVICIOS INFORMÁTICOS</small></span>'
        )

        ctx["home_cards"] = "\n      ".join(
            f'<a class="feature-card" href="{root}servicios.html#{slug(c["category"])}">'
            f'<span class="card-number">{i:02d}</span>'
            f'<span class="feature-icon" aria-hidden="true">{esc_text(c["icon"])}</span>'
            f'<h3>{esc_text(c["title"])}</h3><p>{esc_text(c["text"])}</p>'
            f'<span class="card-arrow" aria-hidden="true">↗</span></a>'
            for i, c in enumerate(data["home_cards"], 1))

        def nav(kind):
            links = []
            for item in cfg["nav"]:
                href = home if item["file"] == "index.html" else root + item["file"]
                active = (' class="active" aria-current="page"'
                          if kind == "main" and item["file"] == fm.get("nav") else "")
                links.append(f'<a{active} href="{href}">{esc_text(item["label"])}</a>')
            label, cls, ident = (("Navegación principal", "main-nav", ' id="main-nav"') if kind == "main"
                                 else ("Navegación del pie", "footer-nav", ""))
            return f'<nav{ident} class="{cls}" aria-label="{label}">{"".join(links)}</nav>'

        ctx["nav_main"], ctx["nav_footer"] = nav("main"), nav("footer")

        canonical_path = fm.get("canonical_path", "")
        ctx["canonical"] = f"{site_url}/{canonical_path}"
        for k in ("title", "description", "og_description", "twitter_description"):
            ctx[k] = fm.get(k) or fm.get("description", "")
        ctx["noindex"], ctx["full_meta"], ctx["floating"] = fm.get("noindex"), fm.get("full_meta"), fm.get("floating")

        jsonld = {}
        kind = fm.get("jsonld")
        if kind == "business":
            jsonld = {
                "@context": "https://schema.org", "@type": "ProfessionalService",
                "name": f"{owner} · Servicios informáticos", "description": cfg["business_description"],
                "url": site_url + "/", "image": g["og_image"], "telephone": data["phone"],
                "founder": {"@type": "Person", "name": owner}, "knowsLanguage": "es"}
        elif kind == "faq":
            jsonld = {
                "@context": "https://schema.org", "@type": "FAQPage",
                "mainEntity": [{"@type": "Question", "name": q["question"],
                                "acceptedAnswer": {"@type": "Answer", "text": q["answer"]}}
                               for q in data["faq"]]}
        elif kind:
            raise BuildError(f"src/pages/{name}: jsonld desconocido «{kind}»")
        ctx["jsonld"] = ("    " + json.dumps(jsonld, ensure_ascii=False, indent=2)
                         .replace("\n", "\n    ").replace("</", "<\\/")) if jsonld else ""

        scripts = [s.strip() for s in fm.get("scripts", "").split(",") if s.strip()]
        for s in scripts:
            if not (ROOT / "assets" / "js" / f"{s}.js").exists():
                raise BuildError(f"src/pages/{name}: no existe assets/js/{s}.js")
        ctx["extra_scripts"] = "".join(f'<script src="{root}assets/js/{s}.js"></script>' for s in scripts)

        ctx["content"] = render(body.rstrip("\n"), ctx)
        outputs[name] = render((SRC / "layout.html").read_text(encoding="utf-8"), ctx)

    pages_in_sitemap = [i["file"] for i in cfg["nav"]]
    urls = "".join(
        f"  <url>\n    <loc>{site_url}/{'' if f == 'index.html' else f}</loc>\n"
        f"    <lastmod>{d.isoformat()}</lastmod>\n  </url>\n" for f in pages_in_sitemap)
    outputs["sitemap.xml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "</urlset>\n")
    outputs["robots.txt"] = f"User-agent: *\nAllow: /\n\nSitemap: {site_url}/sitemap.xml\n"
    check_local_links(outputs, base)
    return outputs


def check_local_links(outputs, base):
    """Avisa si alguna página enlaza a un archivo local que no existe."""
    for name, text in outputs.items():
        if not name.endswith(".html"):
            continue
        for ref in re.findall(r'(?:href|src)="([^"]+)"', text):
            if re.match(r"(https?:|mailto:|tel:|#|data:)", ref):
                continue
            path = ref.split("#")[0].split("?")[0]
            if path.startswith(base + "/"):
                path = path[len(base) + 1:]
            path = path.lstrip("/") or "index.html"
            if path.endswith("/"):
                path += "index.html"
            if path.endswith(".html") and (SRC / "pages" / path).exists():
                continue  # página que se genera en esta misma ejecución
            if not (ROOT / path).exists():
                raise BuildError(f"{name} enlaza a «{ref}», pero ese archivo no existe")


def main():
    check = "--check" in sys.argv[1:]
    try:
        outputs = build_outputs()
    except BuildError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    stale = []
    for name, content in sorted(outputs.items()):
        target = ROOT / name
        current = target.read_text(encoding="utf-8") if target.exists() else None
        if current != content:
            stale.append(name)
            if not check:
                target.write_text(content, encoding="utf-8")
    if check:
        if stale:
            print("Desactualizados (ejecuta: python3 tools/build.py): " + ", ".join(stale), file=sys.stderr)
            return 1
        print("Todo al día.")
        return 0
    print("Actualizados: " + (", ".join(stale) if stale else "ninguno (ya estaba todo al día)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
