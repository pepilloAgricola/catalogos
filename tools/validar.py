#!/usr/bin/env python3
"""Revisa el catálogo antes de publicarlo.

Uso (desde la carpeta del proyecto):   python tools/validar.py

Comprueba que productos.json esté bien escrito, que cada producto tenga
sus datos y sus fotos, y que la página no apunte a archivos que no existen.
Si encuentra errores los lista y termina con código 1 (no hagas push).
"""
import json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errores, avisos = [], []


def ruta(*p):
    return os.path.join(RAIZ, *p)


def leer(p):
    with open(ruta(p), encoding="utf-8") as f:
        return f.read()


# ---------- 1. productos.json ----------
try:
    datos = json.loads(leer("data/productos.json"))
except FileNotFoundError:
    print("ERROR: no existe data/productos.json"); sys.exit(1)
except json.JSONDecodeError as e:
    print(f"ERROR: data/productos.json está mal escrito (línea {e.lineno}, columna {e.colno}): {e.msg}"); sys.exit(1)

tienda = datos.get("tienda") or {}
productos = datos.get("productos")
if not isinstance(productos, list):
    print('ERROR: falta la lista "productos" en data/productos.json'); sys.exit(1)

wa = str(tienda.get("whatsapp", ""))
if not re.fullmatch(r"\d{8,15}", wa):
    errores.append(f'tienda.whatsapp debe ser solo números con el código del país (ahora: "{wa}")')
if not tienda.get("nombre"):
    avisos.append("la tienda no tiene nombre")

vistos, usadas = set(), set()
for n, p in enumerate(productos, 1):
    pid = p.get("id") or f"(producto nº {n} sin id)"
    if not p.get("id"):
        errores.append(f"{pid}: falta el id")
    elif not re.fullmatch(r"[a-z0-9-]+", str(p["id"])):
        errores.append(f"{pid}: el id solo puede llevar minúsculas, números y guiones")
    if p.get("id") in vistos:
        errores.append(f"{pid}: id repetido")
    vistos.add(p.get("id"))
    for campo in ("marca", "modelo"):
        if not str(p.get(campo) or "").strip():
            errores.append(f"{pid}: falta {campo}")
    if p.get("categoria") not in ("uso", "nueva", "gaming"):
        errores.append(f'{pid}: categoría no válida ("{p.get("categoria")}")')
    precio = p.get("precio")
    if not isinstance(precio, (int, float)) or isinstance(precio, bool) or precio <= 0:
        errores.append(f"{pid}: precio no válido ({precio!r})")
    fotos = p.get("imagenes") or []
    if not fotos:
        (avisos if p.get("oculto") else errores).append(f"{pid}: no tiene fotos")
    for f in fotos:
        if re.match(r"^([a-z]+:|//)", str(f), re.I) or ".." in str(f):
            errores.append(f"{pid}: la foto debe ser un archivo de la carpeta img/ ({f})")
        elif not os.path.isfile(ruta(*str(f).split("/"))):
            errores.append(f"{pid}: no existe la foto {f}")
        else:
            usadas.add(str(f))
            kb = os.path.getsize(ruta(*str(f).split("/"))) // 1024
            if kb > 400:
                avisos.append(f"{pid}: la foto {f} pesa {kb} KB (conviene menos de 400)")

if os.path.isdir(ruta("img")):
    sobran = sorted("img/" + f for f in os.listdir(ruta("img")) if "img/" + f not in usadas)
    if sobran:
        avisos.append("fotos que ningún producto usa: " + ", ".join(sobran))

# ---------- 2. archivos que usa la página ----------
for pagina in ("index.html", "admin.html"):
    if not os.path.isfile(ruta(pagina)):
        errores.append(f"falta {pagina}"); continue
    html = leer(pagina)
    for ref in re.findall(r'(?:src|href)="([^"#?]+)', html):
        if re.match(r"^([a-z]+:|//|\./?$)", ref, re.I):
            continue
        if not os.path.exists(ruta(*ref.split("/"))):
            errores.append(f"{pagina} usa un archivo que no existe: {ref}")
    if "Content-Security-Policy" not in html:
        avisos.append(f"{pagina} no tiene la etiqueta de seguridad Content-Security-Policy")

if os.path.isfile(ruta("index.html")):
    html = leer("index.html")
    urls = re.findall(r'property="og:(?:url|image)" content="([^"]+)"', html)
    bases = {re.match(r"https://[^/]+/[^/]+/", u).group(0) for u in urls if re.match(r"https://[^/]+/[^/]+/", u)}
    if len(bases) > 1:
        errores.append("og:url y og:image apuntan a direcciones distintas: " + ", ".join(sorted(bases)))
    for u in urls:
        if u.startswith("http://"):
            errores.append(f"la vista previa usa http en vez de https: {u}")

for css in ("assets/styles.css", "assets/admin.css"):
    if os.path.isfile(ruta(*css.split("/"))):
        for ref in re.findall(r"url\(([^)\"']+)\)", leer(css)):
            if not ref.startswith("data:") and not os.path.exists(ruta("assets", *ref.split("/"))):
                errores.append(f"{css} usa un archivo que no existe: {ref}")

# ---------- 3. que no se cuele un token ----------
for carpeta, _, archivos in os.walk(RAIZ):
    if ".git" in carpeta.split(os.sep):
        continue
    for a in archivos:
        if a.lower().endswith((".html", ".js", ".json", ".md", ".css", ".txt", ".py")):
            try:
                txt = open(os.path.join(carpeta, a), encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            if re.search(r"github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,}", txt):
                errores.append(f"¡hay un token de GitHub escrito en {os.path.relpath(os.path.join(carpeta, a), RAIZ)}! Bórralo y revoca ese token.")

# ---------- resultado ----------
disp = [p for p in productos if p.get("disponible") is not False and not p.get("oculto")]
print(f"{len(productos)} productos ({len(disp)} disponibles)")
for a in avisos:
    print("  aviso:", a)
if errores:
    print(f"\n{len(errores)} ERROR(ES), no publiques todavía:")
    for e in errores:
        print("  -", e)
    sys.exit(1)
print("Todo correcto: se puede publicar.")
