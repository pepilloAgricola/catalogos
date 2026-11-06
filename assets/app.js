(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const CATS = [
    { id: "", label: "Todas" },
    { id: "uso", label: "De uso" },
    { id: "nueva", label: "Nuevas" },
    { id: "gaming", label: "Gaming" },
  ];
  let store = { whatsapp: "", moneda: "USD" };
  let all = [];
  let state = { cat: "", q: "", sort: "" };
  let pushed = false;     // la ficha se abrió desde la lista (hay que volver atrás al cerrar)
  let lastFocus = null;   // tarjeta a la que devolver el foco al cerrar
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hashFor = (p) => "#p/" + encodeURIComponent(p.id);

  function badgeText(p) {
    if (p.categoria === "gaming") return "Gaming · Nueva";
    if (p.categoria === "nueva") return "Nueva";
    return "De uso" + (p.grado ? " · Grado " + p.grado : "");
  }
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
  const waLink = (text) => "https://wa.me/" + String(store.whatsapp || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text);
  const productUrl = (p) => location.origin + location.pathname + "#p/" + encodeURIComponent(p.id);
  const fullName = (p) => (p.marca ? p.marca + " " : "") + p.modelo;

  function shortSpecs(p) {
    return [p.procesador && p.procesador.replace(/\s*\(.*\)/, ""), [p.ram, p.almacenamiento].filter(Boolean).join(" · "), p.graficos && /rtx|radeon vega|iris/i.test(p.graficos) ? p.graficos : p.pantalla && p.pantalla.replace(/\s*\(.*\)/, "")]
      .filter(Boolean).join(" · ");
  }

  function matches(p) {
    if (state.cat && p.categoria !== state.cat) return false;
    if (!state.q) return true;
    const hay = norm([p.marca, p.modelo, p.procesador, p.ram, p.almacenamiento, p.graficos, p.pantalla, p.color, badgeText(p)].join(" "));
    return norm(state.q).split(/\s+/).every((w) => hay.includes(w));
  }

  function renderChips() {
    $("#chips").innerHTML = CATS.map((c) => {
      const n = all.filter((p) => !c.id || p.categoria === c.id).length;
      return `<button class="chip" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${c.label}<span class="n">${n}</span></button>`;
    }).join("");
  }

  function render() {
    let list = all.filter(matches);
    if (state.sort) list = list.slice().sort((a, b) => (state.sort === "asc" ? a.precio - b.precio : b.precio - a.precio));
    // vendidas siempre al final
    list = list.filter((p) => p.disponible !== false).concat(list.filter((p) => p.disponible === false));
    $("#count").textContent = list.length + (list.length === 1 ? " laptop" : " laptops");
    $("#grid").innerHTML = list.length
      ? list.map((p) => `
      <a class="card ${esc(p.categoria)}${p.disponible === false ? " sold" : ""}" href="${hashFor(p)}" data-id="${esc(p.id)}">
        <div class="ph"><img loading="lazy" decoding="async" width="900" height="503" src="${esc((p.imagenes || [])[0] || "")}" alt="">
          ${p.disponible === false ? '<span class="sold-tag">Vendida</span>' : ""}</div>
        <div class="bd">
          <span class="badge ${esc(p.categoria)}">${esc(badgeText(p))}</span>
          <p class="mk">${esc(p.marca)}</p>
          <h3 class="md" title="${esc(p.modelo)}">${esc(p.modelo)}</h3>
          <p class="sp">${esc(shortSpecs(p))}</p>
        </div>
        <div class="pr"><span class="amt"><b>${money(p.precio)}</b><small>${esc(store.moneda)}</small></span><span class="go" aria-hidden="true"><em>Ver detalles</em><span>›</span></span></div>
      </a>`).join("")
      : `<div class="empty">No hay laptops que coincidan con la búsqueda.</div>`;
  }

  /* ---------- Detalle ---------- */
  function openDetail(id, push) {
    const p = all.find((x) => x.id === id);
    if (!p) { history.replaceState(null, "", location.pathname + location.search); return; }
    const imgs = (p.imagenes || []).filter(Boolean);
    const rows = [
      ["Pantalla", p.pantalla], ["Procesador", p.procesador], ["Memoria RAM", p.ram], ["Almacenamiento", p.almacenamiento],
      ["Gráficos", p.graficos], ["Batería", p.bateria], ["Sistema", p.so], ["Puertos", p.puertos], ["Color", p.color], ["Incluye", p.incluye],
    ].filter((r) => r[1]);
    const sold = p.disponible === false;
    const msg = `Hola, me interesa la ${fullName(p)} de ${money(p.precio)} ${store.moneda}. ¿Sigue disponible?\n${productUrl(p)}`;
    $("#panel").innerHTML = `
      <div class="d-top"><span class="grab"></span><button class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
      <div class="d-wrap ${esc(p.categoria)}">
        <div class="d-media">
          <div class="gal"><img id="gMain" src="${esc(imgs[0] || "")}" alt="${esc(fullName(p))}"></div>
          ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((s, i) => `<button data-img="${esc(s)}" aria-current="${i === 0}"><img src="${esc(s)}" alt=""></button>`).join("")}</div>` : ""}
        </div>
        <div class="d-info">
          <p class="mk">${esc(p.marca)}</p>
          <h2 id="dTitle">${esc(p.modelo)}</h2>
          <div class="d-meta"><span class="badge ${esc(p.categoria)}">${esc(badgeText(p))}</span>${p.color ? `<span class="pill">${esc(p.color)}</span>` : ""}${sold ? '<span class="pill sold">Vendida</span>' : ""}</div>
          <div class="d-price">${money(p.precio)}<small>${esc(store.moneda)}</small></div>
          ${p.nota ? `<div class="note">🎁 ${esc(p.nota)}</div>` : ""}
          ${p.descripcion ? `<p class="d-desc">${esc(p.descripcion)}</p>` : ""}
          <dl class="specs">${rows.map((r) => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>
          <div class="d-cta">
            ${sold ? '<span class="btn-wa off">Vendida</span>' : `<a class="btn-wa" href="${esc(waLink(msg))}" target="_blank" rel="noopener">💬 Pedir por WhatsApp</a>`}
            <button class="btn-sh" id="shareBtn" aria-label="Compartir">↗</button>
          </div>
        </div>
      </div>`;
    const wasOpen = $("#sheet").classList.contains("open");
    $("#sheet").classList.add("open");
    $("#sheet").setAttribute("aria-hidden", "false");
    setBackgroundInert(true);
    document.body.classList.add("lock");
    $("#panel").scrollTop = 0;
    if (push && location.hash !== hashFor(p)) { history.pushState(null, "", hashFor(p)); pushed = true; }
    if (!wasOpen) $("#panel").focus({ preventScroll: true });

    $("#shareBtn").onclick = async () => {
      const url = productUrl(p);
      try {
        if (navigator.share) await navigator.share({ title: fullName(p), text: `${fullName(p)} – ${money(p.precio)} ${store.moneda}`, url });
        else { await navigator.clipboard.writeText(url); toast("Enlace copiado"); }
      } catch (e) { /* cancelado */ }
    };
  }

  function setBackgroundInert(on) {
    document.querySelectorAll("body > header, body > .tools, body > main, body > footer").forEach((el) => {
      if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
    });
  }

  function hideDetail() {
    if (!$("#sheet").classList.contains("open")) return;
    $("#sheet").classList.remove("open");
    $("#sheet").setAttribute("aria-hidden", "true");
    setBackgroundInert(false);
    document.body.classList.remove("lock");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  // Cerrar: si la ficha se abrió desde la lista, volvemos atrás en el historial
  // (así el botón "atrás" del móvil también la cierra sin ensuciar el historial).
  function closeDetail() {
    if (pushed) { pushed = false; history.back(); return; }
    hideDetail();
    if (location.hash.startsWith("#p/")) history.replaceState(null, "", location.pathname + location.search);
  }

  function routeFromHash() {
    const m = location.hash.match(/^#p\/(.+)$/);
    if (m) openDetail(decodeURIComponent(m[1]), false);
    else { pushed = false; hideDetail(); }
  }

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 1800); }

  /* ---------- Eventos ---------- */
  $("#chips").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; state.cat = b.dataset.cat; renderChips(); render(); });
  $("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#grid").addEventListener("click", (e) => {
    const c = e.target.closest(".card");
    if (!c || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abrir en pestaña nueva sigue funcionando
    e.preventDefault();
    lastFocus = c;
    openDetail(c.dataset.id, true);
  });
  $("#sheet").addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeDetail();
    const t = e.target.closest("[data-img]");
    if (t) { $("#gMain").src = t.dataset.img; document.querySelectorAll(".thumbs button").forEach((b) => b.setAttribute("aria-current", b === t)); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#sheet").classList.contains("open")) closeDetail(); });
  window.addEventListener("popstate", routeFromHash);

  /* ---------- Carga ---------- */
  fetch("data/productos.json?v=" + Date.now(), { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      store = Object.assign(store, data.tienda || {});
      all = (data.productos || []).filter((p) => !p.oculto);
      if (store.nombre) { $("#brand").textContent = store.nombre; document.title = store.nombre + " – Catálogo"; }
      if (store.mensaje) $("#brandSub").textContent = store.mensaje;
      $("#waTop").href = waLink("Hola, vi el catálogo y quisiera más información.");
      $("#foot").textContent = [store.nombre, "Precios en " + store.moneda, store.whatsapp && "Pide por WhatsApp +" + store.whatsapp].filter(Boolean).join(" · ");
      renderChips(); render(); routeFromHash();
    })
    .catch(() => { $("#count").textContent = ""; $("#grid").innerHTML = '<div class="empty">No se pudo cargar el catálogo. Revisa tu conexión y recarga la página.</div>'; });
})();
