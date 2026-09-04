/* ============================================================
 * 界面收藏馆 · 总台逻辑（零依赖 vanilla JS）
 *
 * - 展品 iframe 用固定虚拟视口宽（1280px）等比缩览，保证相框里
 *   呈现的是桌面版式；
 * - 「步入展厅」：同一枚 iframe 从相框 FLIP 放大到全屏，全程不重
 *   载，展品里的 3D 场景连续存活；Esc / 返回键缩回相框；
 * - hash 路由：#/ 为总台，#/exhibit/<id> 为观展态，浏览器前进后
 *   退、刷新、直链均可用。
 * ============================================================ */
(() => {
  "use strict";

  const VIRTUAL_W = 1280;  // 相框内 iframe 的虚拟视口宽度
  const DUR = 680;         // 步入/归馆 动画时长（ms）
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const frame = $("frame");
  const center = $("hallCenter");
  const ghostNo = $("ghostNo");
  const placardEl = $("placard");
  const elNo = $("pNo"), elTitle = $("pTitle"), elMeta = $("pMeta"),
        elNote = $("pNote"), elLinks = $("pLinks");
  const topbar = $("topbar"), tbTitle = $("topbarTitle"), tbLinks = $("topbarLinks");
  const indexList = $("indexList");

  // registry.js 里的顶层 const 不会挂到 window 上，按全局词法绑定读取
  const list = typeof EXHIBITS !== "undefined" ? EXHIBITS : window.EXHIBITS || [];
  const state = {
    list,
    current: -1,
    mode: "hall",   // hall 总台 | stage 观展
    port: null,     // 当前展品的 iframe 外壳
    busy: false,    // 飞行动画进行中
    hotLayer: null, // 高光解剖图层（fixed，与相框同步落位）
    tour: null,     // 特展巡游态 { ex, phase, idx }
  };

  const topbarH = () => (window.innerWidth < 640 ? 46 : 52);
  const cur = () => state.list[state.current];
  const findIdx = (id) => state.list.findIndex((e) => e.id === id);

  /* ── 展签/导览渲染 ─────────────────────────────── */

  function linksHTML(ex) {
    const parts = [];
    if (ex.live) parts.push(`<a href="${ex.live}" target="_blank" rel="noopener">源站 ↗</a>`);
    if (ex.source) parts.push(`<a href="${ex.source}" target="_blank" rel="noopener">源码 ↗</a>`);
    return parts.join('<span class="sep">·</span>');
  }

  function buildIndex() {
    indexList.innerHTML = "";
    state.list.forEach((ex, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.i = String(i);
      b.innerHTML = `<span class="no">№${ex.no}</span><span class="t"></span>`;
      b.querySelector(".t").textContent = ex.title;
      b.addEventListener("click", () => goTo(i));
      li.appendChild(b);
      indexList.appendChild(li);
    });
    const ghost = document.createElement("li");
    ghost.className = "ghost";
    ghost.textContent = "虚位以待 · RESERVED";
    indexList.appendChild(ghost);
  }

  function markIndex() {
    indexList.querySelectorAll("button[data-i]").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.i) === state.current);
    });
  }

  /* ── 展品 iframe 的生命周期 ────────────────────── */

  function destroyPort() {
    if (!state.port) return;
    state.port.querySelector("iframe").src = "about:blank";
    state.port.remove();
    state.port = null;
    if (state.hotLayer) {
      state.hotLayer.remove();
      state.hotLayer = null;
    }
  }

  /* 高光解剖：缩览上的「细看这里」热区（fixed 图层，与相框同步落位，
     必须浮在展品 iframe 之上才能点到） */
  function renderHighlights(ex) {
    if (state.hotLayer) {
      state.hotLayer.remove();
      state.hotLayer = null;
    }
    if (!ex.highlights || !ex.highlights.length) return;
    const layer = document.createElement("div");
    layer.className = "hotspots";
    layer.setAttribute("aria-label", "高光解剖");
    ex.highlights.forEach((h) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "hotspot";
      dot.style.left = h.x + "%";
      dot.style.top = h.y + "%";
      dot.setAttribute("aria-label", h.title);
      if (h.y < 18) dot.classList.add("below");
      if (h.x > 78) dot.classList.add("tip-right");
      if (h.x < 22) dot.classList.add("tip-left");
      const tip = document.createElement("span");
      tip.className = "hotspot-tip";
      const b = document.createElement("b");
      b.textContent = h.title;
      const i = document.createElement("i");
      i.textContent = h.text;
      tip.append(b, i);
      dot.appendChild(tip);
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = dot.classList.contains("open");
        layer.querySelectorAll(".hotspot.open").forEach((d) => d.classList.remove("open"));
        if (!wasOpen) dot.classList.add("open");
      });
      layer.appendChild(dot);
    });
    body.appendChild(layer);
    state.hotLayer = layer;
  }

  function createPort(ex) {
    const port = document.createElement("div");
    port.className = "port";
    port.addEventListener("click", () => { if (state.mode === "hall") enterStage(); });
    const ifr = document.createElement("iframe");
    ifr.className = "port-iframe";
    ifr.title = ex.title;
    ifr.addEventListener("load", () => {
      if (ifr.src === "about:blank") return;
      frame.dataset.loaded = "true";
      port.classList.add("loaded");
      hookIframeEscape(ifr);
    });
    port.appendChild(ifr);
    body.appendChild(port);
    state.port = port;
    ifr.src = ex.path || ex.url;
    syncPort();
  }

  /* 焦点进入展品内部后，Esc 不再冒泡到总台——同源展品在 iframe 文档里挂中继；
     跨域展品拿不到 document，由顶栏「返回总台」兜底 */
  function hookIframeEscape(ifr) {
    try {
      ifr.contentDocument.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && state.mode === "stage" && !state.busy) leaveStage();
      });
    } catch (_) { /* 跨域展品 */ }
  }

  /* hall 态：port 落位于相框，iframe 以虚拟视口等比缩小 */
  function syncPort() {
    if (!state.port || state.current < 0) return;
    const ex = cur();
    const r = frame.getBoundingClientRect();
    const p = state.port.style;
    p.transition = "none";
    p.left = r.left + "px";
    p.top = r.top + "px";
    p.width = r.width + "px";
    p.height = r.height + "px";
    p.transform = "none";
    const ifr = state.port.querySelector("iframe");
    ifr.style.width = VIRTUAL_W + "px";
    ifr.style.height = VIRTUAL_W / ex.aspect + "px";
    ifr.style.transform = `scale(${r.width / VIRTUAL_W})`;
    if (state.hotLayer) {
      const h = state.hotLayer.style;
      h.left = r.left + "px";
      h.top = r.top + "px";
      h.width = r.width + "px";
      h.height = r.height + "px";
    }
    void state.port.offsetWidth;
  }

  /* stage 态：port 铺满顶栏以下视口，iframe 原生尺寸 */
  function applyStageStyle() {
    const tb = topbarH();
    const p = state.port.style;
    p.transition = "none";
    p.left = "0px";
    p.top = tb + "px";
    p.width = window.innerWidth + "px";
    p.height = window.innerHeight - tb + "px";
    p.transform = "none";
    const ifr = state.port.querySelector("iframe");
    ifr.style.width = "100%";
    ifr.style.height = "100%";
    ifr.style.transform = "none";
    void state.port.offsetWidth;
  }

  /* 相框尺寸：优先塞满展厅高度，同时受宽度和上限约束 */
  function layoutHall() {
    if (state.mode !== "hall" || state.current < 0) return;
    const ex = cur();
    frame.style.aspectRatio = String(ex.aspect);
    const cw = center.clientWidth;
    let w;
    if (window.innerWidth < 880) {
      w = Math.max(260, Math.min(cw, 760));
    } else {
      const ch = center.clientHeight;
      let ph = placardEl.offsetHeight;
      w = Math.max(260, Math.min(cw, (ch - ph - 26) * ex.aspect, 1120));
      frame.style.width = w + "px";
      body.style.setProperty("--frame-w", w + "px");
      ph = placardEl.offsetHeight;  // 相框宽度会影响展签换行，二轮收敛
      w = Math.max(260, Math.min(cw, (ch - ph - 26) * ex.aspect, 1120));
    }
    frame.style.width = w + "px";
    body.style.setProperty("--frame-w", w + "px");
    syncPort();
  }

  /* ── FLIP：同一元素在两个矩形间飞行 ─────────────── */

  function flip(el, first, last, done) {
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width || 1;
    const sy = first.height / last.height || 1;
    let fired = false;
    const onEnd = (e) => {
      if (e.target === el && e.propertyName === "transform") finish();
    };
    const finish = () => {
      if (fired) return;
      fired = true;
      el.removeEventListener("transitionend", onEnd);
      el.style.transition = "none";
      el.style.transform = "none";
      done();
    };
    if (REDUCED) { finish(); return; }
    el.style.transition = "none";
    el.style.transformOrigin = "0 0";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void el.offsetWidth;
    el.style.transition = `transform ${DUR}ms cubic-bezier(0.32, 0.72, 0.18, 1)`;
    el.style.transform = "translate(0px, 0px) scale(1, 1)";
    el.addEventListener("transitionend", onEnd);
    setTimeout(finish, DUR + 150);
  }

  /* ── 步入 / 归馆 ───────────────────────────────── */

  function enterStage() {
    if (state.busy || state.mode !== "hall" || !state.port) return;
    state.busy = true;
    syncPort();
    const first = state.port.getBoundingClientRect();
    state.mode = "stage";
    applyStageStyle();
    body.classList.add("in-stage");
    topbar.hidden = false;
    requestAnimationFrame(() => topbar.classList.add("show"));
    const want = "#/exhibit/" + cur().id;
    if (location.hash !== want) location.hash = want;
    const last = state.port.getBoundingClientRect();
    flip(state.port, first, last, () => { state.busy = false; });
  }

  function leaveStage() {
    if (state.busy || state.mode !== "stage" || !state.port) return;
    state.busy = true;
    const first = state.port.getBoundingClientRect();
    state.mode = "hall";
    body.classList.remove("in-stage");
    topbar.classList.remove("show");
    setTimeout(() => { topbar.hidden = true; }, 400);
    if (location.hash !== "#/") location.hash = "#/";
    layoutHall();
    const last = state.port.getBoundingClientRect();
    flip(state.port, first, last, () => { state.busy = false; });
  }

  /* ── 换展（带淡出淡入） ────────────────────────── */

  function selectExhibit(i) {
    if (i < 0 || i >= state.list.length) return;
    if (i === state.current && state.port) return;
    state.current = i;
    const ex = state.list[i];
    destroyPort();
    frame.dataset.loaded = "false";
    elNo.textContent = `馆藏 № ${ex.no}`;
    elTitle.textContent = ex.title;
    elMeta.textContent = [ex.year, ex.origin, (ex.medium || []).join(" / ")]
      .filter(Boolean).join(" · ");
    elNote.textContent = ex.note || "";
    const lh = linksHTML(ex);
    elLinks.innerHTML = lh;
    tbLinks.innerHTML = lh;
    tbTitle.textContent = `№ ${ex.no} · ${ex.title}`;
    ghostNo.textContent = ex.cn || `№${ex.no}`;
    markIndex();
    renderHighlights(ex);
    layoutHall();
    createPort(ex);
  }

  function swapTo(i) {
    if (i === state.current) return;
    center.classList.add("swap-out");
    setTimeout(() => {
      selectExhibit(i);
      center.classList.remove("swap-out");
    }, REDUCED ? 20 : 280);
  }

  function goTo(i) {
    if (i === state.current) return;
    if (state.mode === "stage") {
      if (state.busy) return;
      leaveStage();
      setTimeout(() => swapTo(i), REDUCED ? 30 : DUR + 80);
    } else {
      swapTo(i);
    }
  }

  /* ── 路由 / 键盘 / 视口 ────────────────────────── */

  function parseHash() {
    const m = location.hash.match(/^#\/exhibit\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  window.addEventListener("hashchange", () => {
    const id = parseHash();
    if (id) {
      const i = findIdx(id);
      if (i < 0) { location.hash = "#/"; return; }
      if (state.mode === "hall" && !state.busy) {
        if (i !== state.current) selectExhibit(i);
        enterStage();
      }
    } else if (state.mode === "stage" && !state.busy) {
      leaveStage();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.mode === "stage") leaveStage();
      return;
    }
    if (state.mode !== "hall" || state.busy) return;
    const n = state.list.length;
    if (e.key === "ArrowRight") goTo((state.current + 1) % n);
    else if (e.key === "ArrowLeft") goTo((state.current - 1 + n) % n);
    else if (e.key === "Enter") enterStage();
  });

  let raf = 0;
  window.addEventListener("scroll", () => {
    if (state.mode !== "hall" || state.busy) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncPort);
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (state.busy) return;
    if (state.mode === "stage") applyStageStyle();
    else layoutHall();
  });

  $("btnEnter").addEventListener("click", enterStage);
  $("btnLeave").addEventListener("click", leaveStage);
  frame.addEventListener("click", enterStage);

  /* ── 开馆 ──────────────────────────────────────── */

  buildIndex();
  const want = parseHash();
  const start = Math.max(0, findIdx(want));
  selectExhibit(start);
  if (want && findIdx(want) >= 0) enterStage();
  window.addEventListener("load", layoutHall);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHall);
})();
