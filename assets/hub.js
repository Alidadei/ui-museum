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
  const specialShows = typeof EXHIBITIONS !== "undefined" ? EXHIBITIONS : window.EXHIBITIONS || [];
  const state = {
    list,
    current: -1,
    mode: "hall",   // hall 总台 | stage 观展
    port: null,     // 当前展品的 iframe 外壳
    busy: false,    // 飞行动画进行中
    hotLayer: null, // 高光解剖图层（fixed，与相框同步落位）
    tour: null,     // 特展巡游态 { ex, phase, idx }
    altSrc: null,   // 正在观展的版本 url（非主源时记录，归馆后还原）
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
      const extraH = () => (versionsBox && !versionsBox.hidden ? versionsBox.offsetHeight : 0);
      let ph = placardEl.offsetHeight + extraH();
      let w = Math.max(260, Math.min(cw, (ch - ph - 26) * ex.aspect, 1120));
      frame.style.width = w + "px";
      body.style.setProperty("--frame-w", w + "px");
      ph = placardEl.offsetHeight + extraH();  // 相框宽度会影响展签换行，二轮收敛
      w = Math.max(260, Math.min(cw, (ch - ph - 26) * ex.aspect, 1120));
    }
    frame.style.width = w + "px";
    body.style.setProperty("--frame-w", w + "px");
    syncPort();
  }

  /* ── FLIP：同一元素在两个矩形间飞行 ─────────────── */
  /* 实现已入库为馆藏原子 原002 flip-step（shared/flip-step/flip.js），此处领用 */

  function flip(el, first, last, done) {
    flipFit(el, first, last, { duration: DUR, done });
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
    stampCurrent();
    const want = "#/exhibit/" + cur().id;
    if (!state.tour && location.hash !== want) location.hash = want;
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
    if (!state.tour && location.hash !== "#/") location.hash = "#/";
    if (state.altSrc && state.port) {
      const ex = cur();
      frame.dataset.loaded = "false";
      state.port.classList.remove("loaded");
      state.port.querySelector("iframe").src = ex.path || ex.url;
      state.altSrc = null;
    }
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
    renderVersions(ex);
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

  /* ── 巡礼印章：步入过哪件展品，就盖上哪枚章 ──────── */

  const STAMP_KEY = "ui-museum-stamps";
  const stampGrid = $("stampGrid"), stampProgress = $("stampProgress"), toastEl = $("toast");

  function getStamps() {
    try { return JSON.parse(localStorage.getItem(STAMP_KEY)) || []; }
    catch (_) { return state._stamps || []; }
  }

  function saveStamps(arr) {
    state._stamps = arr;
    try { localStorage.setItem(STAMP_KEY, JSON.stringify(arr)); } catch (_) { /* 隐私模式下仅内存记账 */ }
  }

  function renderPassport() {
    if (!stampGrid) return;
    const done = getStamps();
    stampGrid.innerHTML = "";
    state.list.forEach((ex) => {
      const s = document.createElement("span");
      s.className = "stamp " + (done.includes(ex.id) ? "done" : "todo");
      s.textContent = ex.cn || ex.no;
      s.title = `${ex.title} · ${done.includes(ex.id) ? "已盖章" : "待步入"}`;
      stampGrid.appendChild(s);
    });
    stampProgress.textContent = `已集 ${done.length} / ${state.list.length} 枚印章`;
  }

  function stampCurrent() {
    const ex = cur();
    if (!ex) return;
    const done = getStamps();
    if (done.includes(ex.id)) return;
    done.push(ex.id);
    saveStamps(done);
    renderPassport();
    if (done.length >= state.list.length) {
      toast("全馆巡礼达成 —— 荣誉访客 ◈");
      stampGrid.classList.add("glow");
      setTimeout(() => stampGrid.classList.remove("glow"), 3200);
    } else {
      toast(`已为 №${ex.no} 盖章`);
    }
  }

  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ── 版本史专柜：可步入的版本 + 修复中的凭证 ──────── */

  const versionsBox = $("versionsBox");

  function renderVersions(ex) {
    if (!versionsBox) return;
    const vs = ex.versions || [];
    if (vs.length < 2) {
      versionsBox.hidden = true;
      versionsBox.innerHTML = "";
      return;
    }
    versionsBox.hidden = false;
    versionsBox.innerHTML = "";
    const head = document.createElement("p");
    head.className = "versions-head";
    head.textContent = "版本 · EDITIONS";
    versionsBox.appendChild(head);
    const row = document.createElement("div");
    row.className = "versions-row";
    vs.forEach((v) => {
      const card = document.createElement(v.url ? "button" : "div");
      if (v.url) card.type = "button";
      card.className = "version-card" + (v.url ? "" : " restoring");
      const l = document.createElement("span");
      l.className = "v-label";
      l.textContent = v.label;
      const y = document.createElement("span");
      y.className = "v-year";
      y.textContent = v.year;
      const n = document.createElement("span");
      n.className = "v-note";
      n.textContent = v.note || (v.url ? "" : "修复中，暂不开放步入");
      card.append(l, y, n);
      if (v.url) {
        card.addEventListener("click", () => enterVersion(v));
      } else {
        card.addEventListener("click", () => toast(`「${v.label}」在修复室，暂不开放步入`));
      }
      row.appendChild(card);
    });
    versionsBox.appendChild(row);
  }

  function enterVersion(v) {
    if (state.mode !== "hall" || state.busy || !state.port) return;
    const ex = cur();
    const primary = ex.path || ex.url;
    if (v.url !== primary) {
      state.altSrc = v.url;
      frame.dataset.loaded = "false";
      state.port.classList.remove("loaded");
      state.port.querySelector("iframe").src = v.url;
    }
    enterStage();
  }

  /* ── 特展巡游：前言 → 沿展线逐件观展 → 闭幕 ──────── */

  const specialList = $("specialList"), tourEl = $("tour"),
        tourNo = $("tourNo"), tourTitle = $("tourTitle"),
        tourText = $("tourText"), tourActions = $("tourActions");

  function buildSpecial() {
    if (!specialList) return;
    specialList.innerHTML = "";
    if (!specialShows.length) {
      specialList.closest(".special").hidden = true;
      return;
    }
    specialShows.forEach((sp) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<span class="no">${sp.no}</span><span class="t"></span>`;
      b.querySelector(".t").textContent = sp.title;
      b.addEventListener("click", () => enterTour(sp.id));
      li.appendChild(b);
      specialList.appendChild(li);
    });
  }

  function findTourIdx(id) {
    return specialShows.findIndex((s) => s.id === id);
  }

  function enterTour(id) {
    if (findTourIdx(id) < 0 || state.busy) return;
    state.tour = { ex: specialShows[findTourIdx(id)], phase: "preface", idx: 0 };
    const want = "#/exhibition/" + id;
    if (location.hash !== want) location.hash = want;
    showTourPhase();
  }

  function addTourBtn(label, fn, primary) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = primary ? "btn-enter" : "tour-skip";
    b.textContent = label;
    b.addEventListener("click", fn);
    tourActions.appendChild(b);
  }

  function showTourPhase() {
    const t = state.tour;
    if (!t) return;
    body.classList.add("in-tour");
    tourNo.textContent = `特展 № ${t.ex.no}`;
    tourTitle.textContent = t.ex.title;
    tourActions.innerHTML = "";
    if (t.phase === "item") {
      tourEl.classList.remove("show");
      setTimeout(() => { if (!state.tour || state.tour.phase === "item") tourEl.hidden = true; }, 340);
      return;
    }
    tourEl.hidden = false;
    requestAnimationFrame(() => tourEl.classList.add("show"));
    tourText.textContent = t.phase === "preface" ? t.ex.preface : (t.ex.closing || "展览到此——感谢观展。");
    if (t.phase === "preface") {
      addTourBtn("开展 →", () => tourGotoItem(0), true);
      addTourBtn("先不看了", exitTour);
    } else {
      addTourBtn("回到总台", exitTour, true);
    }
  }

  function tourGotoItem(i) {
    const t = state.tour;
    if (!t || state.busy) return;
    t.phase = "item";
    const target = findIdx(t.ex.items[i]);
    if (target < 0) return;
    const needSelect = target !== state.current;
    const doEnter = () => {
      if (!state.tour) return;
      if (needSelect) swapTo(target);
      setTimeout(() => {
        if (!state.tour) return;
        if (state.mode !== "stage") enterStage();
        showTourPhase();  // item 相位：收起前言幕布
        toast(`特展 · ${t.idx + 1}/${t.ex.items.length}`);
      }, needSelect ? 320 : 30);
    };
    if (state.mode === "stage" && !state.busy) {
      leaveStage();
      setTimeout(doEnter, REDUCED ? 30 : DUR + 80);
    } else {
      doEnter();
    }
  }

  function tourStep(dir) {
    const t = state.tour;
    if (!t || state.busy) return;
    if (dir > 0) {
      if (t.phase === "preface") tourGotoItem(0);
      else if (t.idx < t.ex.items.length - 1) tourGotoItem(t.idx + 1);
      else tourClosing();
    } else {
      if (t.phase === "closing") tourGotoItem(t.ex.items.length - 1);
      else if (t.phase === "item" && t.idx === 0) { t.phase = "preface"; if (state.mode === "stage") leaveStage(); showTourPhase(); }
      else if (t.phase === "item") tourGotoItem(t.idx - 1);
    }
  }

  function tourClosing() {
    const t = state.tour;
    if (!t) return;
    t.phase = "closing";
    if (state.mode === "stage" && !state.busy) leaveStage();
    showTourPhase();
  }

  function exitTour() {
    if (!state.tour) return;
    state.tour = null;
    body.classList.remove("in-tour");
    tourEl.classList.remove("show");
    setTimeout(() => { tourEl.hidden = true; }, 340);
    if (location.hash.indexOf("#/exhibition/") === 0) location.hash = "#/";
    if (state.mode === "stage" && !state.busy) leaveStage();
  }

  function parseTourHash() {
    const m = location.hash.match(/^#\/exhibition\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  /* ── 路由 / 键盘 / 视口 ────────────────────────── */

  function parseHash() {
    const m = location.hash.match(/^#\/exhibit\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  window.addEventListener("hashchange", () => {
    const tourId = parseTourHash();
    if (tourId) {
      if (findTourIdx(tourId) < 0) { location.hash = "#/"; return; }
      if (!state.tour || state.tour.ex.id !== tourId) enterTour(tourId);
      return;
    }
    if (state.tour) { exitTour(); return; }
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
      if (state.tour) exitTour();
      else if (state.mode === "stage") leaveStage();
      return;
    }
    if (state.tour) {
      if (e.key === "ArrowRight" || (e.key === "Enter" && state.tour.phase !== "closing")) tourStep(1);
      else if (e.key === "ArrowLeft") tourStep(-1);
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
  buildSpecial();
  const want = parseHash();
  const start = Math.max(0, findIdx(want));
  selectExhibit(start);
  renderPassport();
  const tourWant = parseTourHash();
  if (tourWant && findTourIdx(tourWant) >= 0) enterTour(tourWant);
  else if (want && findIdx(want) >= 0) enterStage();
  window.addEventListener("load", layoutHall);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHall);
})();
