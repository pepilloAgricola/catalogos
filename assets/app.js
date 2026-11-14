(function () {
  "use strict";
  document.documentElement.classList.add("js");
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-wa"/></svg>';
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
  const avail = (p) => p.disponible !== false;
  const firstImg = (p) => (p.imagenes || []).filter(Boolean)[0] || "";

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

  function cardHTML(p, i) {
    return `
      <a class="card ${esc(p.categoria)}${p.disponible === false ? " sold" : ""}" href="${hashFor(p)}" data-id="${esc(p.id)}" style="--i:${Math.min(i || 0, 11)}">
        <div class="ph"><img loading="lazy" decoding="async" width="900" height="503" src="${esc((p.imagenes || [])[0] || "")}" alt="">
          ${p.disponible === false ? '<span class="sold-tag">Vendida</span>' : ""}</div>
        <div class="bd">
          <span class="badge ${esc(p.categoria)}">${esc(badgeText(p))}</span>
          <p class="mk">${esc(p.marca)}</p>
          <h3 class="md" title="${esc(p.modelo)}">${esc(p.modelo)}</h3>
          <p class="sp">${esc(shortSpecs(p))}</p>
        </div>
        <div class="pr"><span class="amt"><b>${money(p.precio)}</b><small>${esc(store.moneda)}</small></span><span class="go" aria-hidden="true"><em>Ver detalles</em><span>›</span></span></div>
      </a>`;
  }

  function render() {
    let list = all.filter(matches);
    if (state.sort) list = list.slice().sort((a, b) => (state.sort === "asc" ? a.precio - b.precio : b.precio - a.precio));
    // vendidas siempre al final
    list = list.filter((p) => p.disponible !== false).concat(list.filter((p) => p.disponible === false));
    $("#count").innerHTML = list.length
      ? list.length + (list.length === 1 ? " laptop" : " laptops") + (state.cat || state.q ? '<button type="button" data-clear>Ver todas</button>' : "")
      : "";
    $("#grid").innerHTML = list.length
      ? list.map(cardHTML).join("")
      : `<div class="empty">No hay laptops que coincidan con la búsqueda.<button type="button" data-clear>Ver todas las laptops</button></div>`;
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
          ${p.nota ? `<div class="note">${esc(p.nota)}</div>` : ""}
          ${p.descripcion ? `<p class="d-desc">${esc(p.descripcion)}</p>` : ""}
          <dl class="specs">${rows.map((r) => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>
          <div class="d-cta">
            ${sold ? '<span class="btn btn-wa off">Vendida</span>' : `<a class="btn btn-wa" href="${esc(waLink(msg))}" target="_blank" rel="noopener">${WA_ICON}Pedir por WhatsApp</a>`}
            <button class="btn-sh" id="shareBtn" aria-label="Compartir"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg></button>
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
    if (on) $("#page").setAttribute("inert", ""); else $("#page").removeAttribute("inert");
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

  /* ---------- Landing: portada, marcas y tipos ---------- */
  function setCat(cat) { state.cat = cat; renderChips(); render(); }
  function clearFilters() { state.q = ""; $("#q").value = ""; setCat(""); }

  function buildLanding() {
    const live = all.filter((p) => avail(p) && firstImg(p));
    const byCat = (c) => live.filter((p) => p.categoria === c);
    const cheapest = (l) => l.slice().sort((a, b) => a.precio - b.precio)[0];
    const priciest = (l) => l.slice().sort((a, b) => b.precio - a.precio)[0];

    // Dato de la portada
    if (live.length) {
      $("#heroFact").innerHTML = `<b>${live.length}</b> ${live.length === 1 ? "laptop disponible" : "laptops disponibles"} hoy, desde <b>${money(cheapest(live).precio)}</b>`;
    }

    // Abanico: la primera de uso, la gaming más cara al centro y la primera nueva (según el orden del panel)
    const picks = [byCat("uso")[0], priciest(byCat("gaming")), byCat("nueva")[0]].filter(Boolean);
    live.forEach((p) => { if (picks.length < 3 && !picks.includes(p)) picks.push(p); });
    const fan = $("#fan");
    if (picks.length) {
      if (picks.length === 3 && picks[1].categoria !== "gaming") picks.splice(1, 0, picks.pop());
      fan.innerHTML = picks.map((p) => `<div class="fan-item">${cardHTML(p, 0)}</div>`).join("");
      requestAnimationFrame(() => requestAnimationFrame(() => fan.classList.add("ready")));
      setTimeout(() => fan.classList.add("settled"), 1600);
    } else fan.hidden = true;

    // Franja de marcas (se repite para que el movimiento no tenga corte)
    const brands = Array.from(new Set(all.map((p) => String(p.marca || "").trim()).filter(Boolean)));
    if (brands.length > 2) {
      const one = brands.map((b) => `<span>${esc(b)}</span>`).join("");
      const reps = Math.max(2, Math.ceil(16 / brands.length)) ;
      const half = one.repeat(reps);
      $("#brands").innerHTML = half + half;
      $("#brands").style.setProperty("--dur", brands.length * reps * 3.2 + "s");
      $("#brands").classList.add("run");
    } else $(".brands").hidden = true;

    // Bloques por tipo
    ["uso", "nueva", "gaming"].forEach((c) => {
      const l = byCat(c), tile = $(`.type[data-cat="${c}"]`);
      if (!l.length) { tile.hidden = true; return; }
      $(`[data-meta="${c}"]`).textContent = `${l.length} ${l.length === 1 ? "disponible" : "disponibles"}, desde ${money(cheapest(l).precio)}`;
      const pic = c === "gaming" ? priciest(l) : l[Math.min(1, l.length - 1)];
      $(`[data-photo="${c}"]`).src = firstImg(pic);
    });
  }

  // Aparición al hacer scroll
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px", threshold: 0.1 })
    : null;
  $$(".rv").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  function onScroll() {
    const y = window.scrollY;
    $("#nav").classList.toggle("solid", y > 20);
    $("#fab").classList.toggle("show", y > window.innerHeight * 0.8);
    $("#tools").classList.toggle("stuck", $("#tools").getBoundingClientRect().top <= $("#nav").offsetHeight + 1);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // El abanico sigue un poco al ratón
  if (!reduceMotion && window.matchMedia("(hover:hover)").matches) {
    const hero = $(".hero"), fan = $("#fan");
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      fan.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      fan.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    hero.addEventListener("pointerleave", () => { fan.style.setProperty("--px", 0); fan.style.setProperty("--py", 0); });
  }

  function openFromCard(e, c) {
    if (!c || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abrir en pestaña nueva sigue funcionando
    e.preventDefault();
    lastFocus = c;
    openDetail(c.dataset.id, true);
  }
  $("#fan").addEventListener("click", (e) => openFromCard(e, e.target.closest(".card")));
  $$(".type").forEach((t) => t.addEventListener("click", () => {
    setCat(t.dataset.cat);
    $("#catalogo").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }));
  document.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) clearFilters(); });

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
      // La frase de la tienda sale bajo el titular, salvo la frase de fábrica, que repetiría el titular.
      if (store.mensaje && !/^laptops de uso, nuevas y gaming/i.test(store.mensaje.trim())) $("#brandSub").textContent = store.mensaje;
      if (store.nombre) $("#brandFoot").textContent = store.nombre;
      const wa = waLink("Hola, vi el catálogo y quisiera más información.");
      ["#waNav", "#waHero", "#fab"].forEach((q) => ($(q).href = wa));
      $("#waClose").href = waLink("Hola, quiero una laptop y no sé cuál elegir. ¿Me ayudan?");
      $("#foot").textContent = ["Precios en " + store.moneda, store.whatsapp && "WhatsApp +" + store.whatsapp].filter(Boolean).join(" · ");
      renderChips(); render(); buildLanding(); routeFromHash();
      document.documentElement.classList.add("loaded");
    })
    .catch(() => { document.documentElement.classList.add("loaded"); $("#fan").hidden = true; $(".brands").hidden = true; $("#count").textContent = ""; $("#grid").innerHTML = '<div class="empty">No se pudo cargar el catálogo. Revisa tu conexión y recarga la página.</div>'; });
})();
