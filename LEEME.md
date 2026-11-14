# Catálogo de laptops – Guía de montaje en GitHub Pages

Todo es gratis. Lo que hay en esta carpeta:

| Archivo / carpeta | Qué es |
|---|---|
| `index.html` | El catálogo que ven los clientes |
| `admin.html` | Tu panel para añadir, editar, marcar vendidas y publicar |
| `data/productos.json` | Los productos (ya cargados con tus 25 laptops) |
| `img/` | Fotos de los productos |
| `assets/` | Estilos y código |

> **Nunca compartas tu contraseña de GitHub con nadie** (tampoco conmigo). El panel funciona con un *token* que creas tú y que solo se guarda en tu navegador.

---

## Paso 1 – Crear la cuenta

1. Entra en https://github.com/signup y crea la cuenta con tu correo.
2. Elige bien el **nombre de usuario**: forma parte del link del catálogo. Ejemplo: si tu usuario es `laptopshabana`, el link será `https://laptopshabana.github.io/catalogo/`.
3. Verifica el correo.

## Paso 2 – Crear el repositorio

1. Arriba a la derecha: **+** → **New repository**.
2. **Repository name:** `catalogo`.
3. Márcalo como **Public**. GitHub Pages gratis solo funciona con repos públicos.
4. No marques nada más y pulsa **Create repository**.

## Paso 3 – Subir los archivos (mejor desde la PC)

1. Descomprime el `.zip` que te mandé.
2. En la página del repo vacío, pulsa el enlace **uploading an existing file**.
3. Abre la carpeta descomprimida, selecciona **todo su contenido** (`index.html`, `admin.html`, `assets`, `data`, `img`…) y **arrástralo** a la página de GitHub. Arrastra el contenido, no la carpeta que lo contiene.
4. Espera a que termine de cargar y pulsa **Commit changes**.
5. Comprueba que en el repo ves `index.html` en la raíz, no dentro de otra carpeta.

## Paso 4 – Activar GitHub Pages

1. En el repo: **Settings** → menú izquierdo **Pages**.
2. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
3. En **Branch**, elige `main` y la carpeta `/ (root)`. Pulsa **Save**.
4. Espera 1–2 minutos y recarga la página. Arriba saldrá **“Your site is live at …”**.
5. Abre ese link: ya es tu catálogo, y ese es el link que les mandas a los clientes.

## Paso 5 – Crear el token para el panel

1. Toca tu foto (arriba a la derecha) → **Settings**.
2. Abajo del todo a la izquierda: **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Rellena así:
   - **Token name:** `panel catalogo`
   - **Expiration:** la más larga que te deje. Cuando venza, creas otro igual.
   - **Repository access:** **Only select repositories** → elige `catalogo`.
   - **Permissions** → **Repository permissions** → **Contents** → **Read and write**. No hace falta tocar nada más.
4. Pulsa **Generate token** y **cópialo ya** (empieza por `github_pat_…`). GitHub solo te lo enseña una vez.

## Paso 6 – Conectar el panel

1. Abre `https://TU-USUARIO.github.io/catalogo/admin.html`. Guárdalo en favoritos del móvil.
2. Usuario y repositorio deberían salir rellenos solos; si no, escríbelos.
3. Pega el token y pulsa **Guardar y conectar**.
4. Abre **Datos de la tienda** y pon el nombre real de tu negocio. Puse “Laptops La Habana” de relleno.

---

## Uso diario

- **Nuevo producto:** `+ Nuevo` → rellena → añade fotos (se comprimen solas) → **Guardar**.
- **Marcar vendida:** pulsa el ✓ verde y pasa a ✕. La laptop sale con la etiqueta “Vendida” al final del catálogo y sin botón de WhatsApp.
- **Ocultar sin borrar:** dentro del producto, marca “Ocultar del catálogo”.
- **Reordenar:** ▲ ▼. El orden de la lista es el orden en que salen en el catálogo.
- **Publicar:** los cambios se acumulan en el panel. Cuando termines, pulsa **Publicar** en la barra amarilla de abajo. En 1–2 minutos los clientes ven la versión nueva.

Cada producto tiene su propio link: el cliente abre una laptop, le da a **↗** y la comparte. El botón de WhatsApp manda un mensaje con el modelo, el precio y el link.

## Si algo sale mal

- **“Token inválido”**: venció o lo copiaste mal. Crea otro (Paso 5) y pégalo en ⚙ Conexión.
- **“No tiene permiso”**: al token le falta **Contents: Read and write** o no tiene acceso al repo `catalogo`.
- **Publiqué algo mal**: en GitHub, repo → **Commits**. Ahí está el historial completo de cambios y puedes ver o recuperar cualquier versión anterior.
- **Perdí el móvil**: en GitHub → Settings → Developer settings → Fine-grained tokens, borra ese token y crea uno nuevo. Sin token nadie puede tocar el catálogo, aunque abra `admin.html`.
- **No veo los cambios**: espera 2 minutos y recarga. En el móvil, a veces hay que cerrar y volver a abrir la pestaña.

## La página pública (landing)

`index.html` ya no es solo la lista: es una página con portada, tipos de laptop, el catálogo, «Cómo comprar» y un cierre con WhatsApp.

- **Lo que sale solo de los productos del panel**: las tres laptops de la portada (la primera de uso, la gaming más cara y la primera nueva), la franja de marcas, y los «X disponibles, desde $Y» de cada tipo.
- **Nombre, WhatsApp y moneda**: en *Datos de la tienda* del panel, como siempre.
- **Frase de la portada**: el campo *Frase* de *Datos de la tienda*. Si se deja la frase de fábrica, la página usa su propio texto.
- **Titular, textos de los tipos y pasos de compra**: se editan directamente en `index.html`.
- **Tipografía**: Archivo, incluida en `assets/fonts/` (licencia libre OFL). No carga nada de internet.
