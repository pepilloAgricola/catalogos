(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DATA_PATH = "data/productos.json";
  const LS = "catalogo-admin-cfg";

  let cfg = {};
  let data = null;          // copia de trabajo
  let original = null;      // lo que hay publicado (texto)
  let fileSha = null;
  let pending = {};         // ruta -> { b64, preview }  fotos nuevas aún sin subir
  let editing = null;       // id del producto en edición (null = nuevo)
  let editImgs = [];

  /* ---------- utilidades ---------- */
  function loadCfg() {
    try { cfg = JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { cfg = {}; }
    // autodetectar usuario/repo cuando corre en usuario.github.io/repo/
    const h = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (h) {
      cfg.owner = cfg.owner || h[1];
      const seg = location.pathname.split("/").filter(Boolean)[0];
      cfg.repo = cfg.repo || (seg && !/\.html$/.test(seg) ? seg : h[1] + ".github.io");
    }
    cfg.branch = cfg.branch || "main";
  }
  function saveCfg() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} }
  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 2600); }
  function busy(on, txt) { $("#busy").hidden = !on; if (txt) $("#busyTxt").textContent = txt; }
  function show(v) { ["vCfg", "vList", "vEdit"].forEach((id) => ($("#" + id).hidden = id !== v)); window.scrollTo(0, 0); }

  const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  function bytesToB64(bytes) {
    let s = ""; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  const textToB64 = (t) => bytesToB64(new TextEncoder().encode(t));
  const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "producto";

  /* ---------- API de GitHub ---------- */
  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${path}`, {
      ...opts,
      headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) },
      cache: "no-store",
    });
    if (!r.ok) {
      let m = ""; try { m = (await r.json()).message; } catch (e) {}
      const err = new Error(m || "Error " + r.status); err.status = r.status; throw err;
    }
    return r.status === 204 ? null : r.json();
  }
  const getFile = (p) => gh(`contents/${p}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
  const putFile = (p, b64, message, sha) => gh(`contents/${p}`, { method: "PUT", body: JSON.stringify({ message, content: b64, branch: cfg.branch, ...(sha ? { sha } : {}) }) });
  async function delFile(p) {
    try { const f = await getFile(p); await gh(`contents/${p}`, { method: "DELETE", body: JSON.stringify({ message: "Borrar " + p, sha: f.sha, branch: cfg.branch }) }); }
    catch (e) { /* si ya no existe, da igual */ }
  }

  function humanError(e) {
    if (e.status === 401) return "Token inválido o vencido. Crea uno nuevo y pégalo en ⚙ Conexión.";
    if (e.status === 403) return "El token no tiene permiso de escritura (Contents: Read and write) sobre este repo.";
    if (e.status === 404) return "No encuentro el repositorio o el archivo. Revisa usuario, repo y rama, y que el token tenga acceso a ese repo.";
    if (e.status === 409) return "El catálogo cambió desde otro dispositivo. Recarga la página y vuelve a intentarlo.";
    if (e instanceof TypeError) return "Sin conexión con GitHub. Revisa internet e inténtalo de nuevo.";
    return e.message;
  }

  /* ---------- carga ---------- */
  async function connect() {
    busy(true, "Cargando catálogo…");
    try {
      const f = await getFile(DATA_PATH);
      fileSha = f.sha;
      original = b64ToText(f.content);
      data = JSON.parse(original);
      data.tienda = data.tienda || {};
      data.productos = data.productos || [];
      pending = {};
      fillStore(); renderList(); refreshPub(); show("vList");
    } catch (e) {
      show("vCfg"); $("#cMsg").className = "msg err"; $("#cMsg").textContent = humanError(e);
    } finally { busy(false); }
  }

  /* ---------- tienda ---------- */
  const storeMap = { sNombre: "nombre", sMensaje: "mensaje", sWa: "whatsapp", sMon: "moneda" };
  function fillStore() { Object.entries(storeMap).forEach(([id, k]) => ($("#" + id).value = data.tienda[k] || "")); }
  Object.entries(storeMap).forEach(([id, k]) => $("#" + id).addEventListener("input", (e) => {
    data.tienda[k] = id === "sWa" ? e.target.value.replace(/\D/g, "") : e.target.value; refreshPub();
  }));

  /* ---------- lista ---------- */
  const imgSrc = (path) => (pending[path] ? pending[path].preview : path);
  const catTxt = { uso: "De uso", nueva: "Nueva", gaming: "Gaming" };

  function renderList() {
    const q = $("#lq").value.trim().toLowerCase();
    const items = data.productos.map((p, i) => ({ p, i })).filter(({ p }) => !q || (p.marca + " " + p.modelo).toLowerCase().includes(q));
    $("#list").innerHTML = items.map(({ p, i }) => `
      <div class="item ${p.disponible === false || p.oculto ? "off" : ""}" data-i="${i}">
        <img src="${esc(imgSrc((p.imagenes || [])[0] || ""))}" alt="">
        <div class="t"><b>${esc(p.marca)} ${esc(p.modelo)}</b>
          <small>$${esc(p.precio)} · ${catTxt[p.categoria] || ""}${p.grado ? " " + esc(p.grado) : ""}</small>
          ${p.disponible === false ? '<span class="tag sold">Vendida</span>' : ""}${p.oculto ? '<span class="tag">Oculta</span>' : ""}
        </div>
        <div class="acts">
          ${q ? "" : `<button class="ib" data-a="up" title="Subir">▲</button><button class="ib" data-a="down" title="Bajar">▼</button>`}
          <button class="ib ${p.disponible === false ? "" : "on"}" data-a="toggle" title="Disponible / vendida">${p.disponible === false ? "✕" : "✓"}</button>
          <button class="ib" data-a="edit" title="Editar">✎</button>
        </div>
      </div>`).join("") || '<p class="hint">No hay productos.</p>';
  }
  $("#lq").addEventListener("input", renderList);
  $("#list").addEventListener("click", (e) => {
    const it = e.target.closest(".item"); if (!it) return;
    const i = +it.dataset.i, a = (e.target.closest("[data-a]") || {}).dataset?.a || "edit";
    const L = data.productos;
    if (a === "up" && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
    else if (a === "down" && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
    else if (a === "toggle") L[i].disponible = L[i].disponible === false;
    else if (a === "edit") return openEditor(L[i].id);
    renderList(); refreshPub();
  });

  function isDirty() { return Object.keys(pending).length > 0 || JSON.stringify(data, null, 2) !== JSON.stringify(JSON.parse(original), null, 2); }
  function refreshPub() {
    const d = isDirty(); $("#pubBar").hidden = !d;
    const n = Object.keys(pending).length;
    $("#pubTxt").textContent = "Cambios sin publicar" + (n ? ` · ${n} foto${n > 1 ? "s" : ""} nueva${n > 1 ? "s" : ""}` : "");
  }
  window.addEventListener("beforeunload", (e) => { if (data && isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- editor ---------- */
  const FIELDS = ["marca", "modelo", "categoria", "grado", "precio", "pantalla", "procesador", "ram", "almacenamiento", "graficos", "bateria", "so", "color", "puertos", "incluye", "nota", "descripcion"];
  function openEditor(id) {
    editing = id;
    const p = id ? data.productos.find((x) => x.id === id) : { categoria: "uso", so: "Windows 11", incluye: "Mouse inalámbrico", disponible: true, imagenes: [] };
    const f = $("#form");
    FIELDS.forEach((k) => (f.elements[k].value = p[k] ?? ""));
    f.elements.disponible.checked = p.disponible !== false;
    f.elements.oculto.checked = !!p.oculto;
    editImgs = (p.imagenes || []).slice();
    $("#eTitle").textContent = id ? "Editar producto" : "Nuevo producto";
    $("#eDel").hidden = !id;
    renderImgs(); show("vEdit");
  }
  function renderImgs() {
    $("#imgs").innerHTML = editImgs.map((s, i) => `
      <div class="im">${i === 0 ? '<span class="cover">Portada</span>' : ""}<img src="${esc(imgSrc(s))}" alt="">
        <div class="ctl"><button type="button" data-m="l" data-i="${i}">◀</button><button type="button" data-m="x" data-i="${i}">🗑</button><button type="button" data-m="r" data-i="${i}">▶</button></div>
      </div>`).join("");
  }
  $("#imgs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    const i = +b.dataset.i, m = b.dataset.m;
    if (m === "x") { const [gone] = editImgs.splice(i, 1); if (pending[gone]) delete pending[gone]; }
    if (m === "l" && i > 0) [editImgs[i - 1], editImgs[i]] = [editImgs[i], editImgs[i - 1]];
    if (m === "r" && i < editImgs.length - 1) [editImgs[i + 1], editImgs[i]] = [editImgs[i], editImgs[i + 1]];
    renderImgs();
  });

  async function compress(file) {
    const bmp = await createImageBitmap(file);
    const max = 1000, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
    if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { b64: bytesToB64(bytes), preview: URL.createObjectURL(blob), ext, kb: Math.round(bytes.length / 1024) };
  }
  $("#fileIn").addEventListener("change", async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    if (!files.length) return;
    busy(true, "Comprimiendo fotos…");
    try {
      const base = slug(($("#form").elements.marca.value + "-" + $("#form").elements.modelo.value).trim() || "producto");
      for (const f of files) {
        const r = await compress(f);
        const path = `img/${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${r.ext}`;
        pending[path] = { b64: r.b64, preview: r.preview };
        editImgs.push(path);
      }
      renderImgs();
    } catch (err) { toast("No se pudo leer una de las fotos."); }
    finally { busy(false); }
  });

  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, p = {};
    FIELDS.forEach((k) => (p[k] = f.elements[k].value.trim()));
    p.precio = Number(p.precio) || 0;
    p.disponible = f.elements.disponible.checked;
    if (f.elements.oculto.checked) p.oculto = true;
    p.imagenes = editImgs.slice();
    if (!p.imagenes.length && !confirm("Este producto no tiene fotos. ¿Guardar igual?")) return;
    if (editing) {
      const i = data.productos.findIndex((x) => x.id === editing);
      data.productos[i] = Object.assign({ id: editing }, p);
    } else {
      let id = slug(p.marca + "-" + p.modelo), n = 2; const base = id;
      while (data.productos.some((x) => x.id === id)) id = base + "-" + n++;
      data.productos.unshift(Object.assign({ id }, p));
    }
    dropOrphanPending(); renderList(); refreshPub(); show("vList");
    toast("Guardado. Pulsa Publicar para que lo vean los clientes.");
  });
  $("#eDel").addEventListener("click", () => {
    if (!confirm("¿Eliminar este producto del catálogo?")) return;
    data.productos = data.productos.filter((x) => x.id !== editing);
    dropOrphanPending(); renderList(); refreshPub(); show("vList");
  });
  $("#eBack").addEventListener("click", () => { dropOrphanPending(); show("vList"); });
  $("#btnNew").addEventListener("click", () => openEditor(null));

  function usedImgs(d) { const s = new Set(); (d.productos || []).forEach((p) => (p.imagenes || []).forEach((x) => s.add(x))); return s; }
  function dropOrphanPending() { const u = usedImgs(data); Object.keys(pending).forEach((k) => { if (!u.has(k)) delete pending[k]; }); }

  /* ---------- publicar ---------- */
  $("#btnPublish").addEventListener("click", async () => {
    dropOrphanPending();
    const keys = Object.keys(pending);
    try {
      for (let i = 0; i < keys.length; i++) {
        busy(true, `Subiendo foto ${i + 1} de ${keys.length}…`);
        await putFile(keys[i], pending[keys[i]].b64, "Foto " + keys[i]);
        delete pending[keys[i]];
      }
      busy(true, "Guardando catálogo…");
      const text = JSON.stringify(data, null, 2) + "\n";
      const r = await putFile(DATA_PATH, textToB64(text), "Actualizar catálogo", fileSha);
      fileSha = r.content.sha;
      // limpiar fotos que ya nadie usa
      const before = usedImgs(JSON.parse(original)), now = usedImgs(data);
      const gone = [...before].filter((x) => !now.has(x) && x.startsWith("img/"));
      for (let i = 0; i < gone.length; i++) { busy(true, `Borrando fotos sin usar (${i + 1}/${gone.length})…`); await delFile(gone[i]); }
      original = text;
      refreshPub(); renderList();
      toast("¡Publicado! En 1–2 minutos se ve en el catálogo.");
    } catch (e) { toast(humanError(e)); refreshPub(); }
    finally { busy(false); }
  });
  $("#btnDiscard").addEventListener("click", () => {
    if (!confirm("¿Descartar todos los cambios sin publicar?")) return;
    data = JSON.parse(original); pending = {}; fillStore(); renderList(); refreshPub();
  });

  /* ---------- conexión ---------- */
  function openCfg() {
    $("#cOwner").value = cfg.owner || ""; $("#cRepo").value = cfg.repo || ""; $("#cBranch").value = cfg.branch || "main";
    $("#cToken").value = cfg.token || ""; $("#cMsg").textContent = ""; show("vCfg");
  }
  $("#btnCfg").addEventListener("click", openCfg);
  $("#cSave").addEventListener("click", () => {
    cfg.owner = $("#cOwner").value.trim(); cfg.repo = $("#cRepo").value.trim();
    cfg.branch = $("#cBranch").value.trim() || "main"; cfg.token = $("#cToken").value.trim();
    if (!cfg.owner || !cfg.repo || !cfg.token) { $("#cMsg").className = "msg err"; $("#cMsg").textContent = "Rellena usuario, repositorio y token."; return; }
    saveCfg(); connect();
  });
  $("#cForget").addEventListener("click", () => { delete cfg.token; saveCfg(); $("#cToken").value = ""; $("#cMsg").className = "msg ok"; $("#cMsg").textContent = "Token borrado de este navegador."; });

  loadCfg();
  if (cfg.token && cfg.owner && cfg.repo) connect(); else openCfg();
})();
