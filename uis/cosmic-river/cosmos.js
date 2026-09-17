/* ============================================================
 * 宇宙玄学 · 仰观星河 —— 星河流动引擎（零依赖，Canvas 2D）
 * ------------------------------------------------------------
 * 铁律：原图一分不改。页面上唯一的 <img> 只做等比缩放（contain），
 * 没有滤镜、位移、变形；所有动效都发生在其上的两块透明画布里，
 * 且只用「加法光」（composite = lighter）往亮处添光——画面构图
 * 与内容因此保持原样，动的只有光。
 *
 * 三层光：
 *   1) 河流粒子：启动时把图降采样成亮度场，梯度旋转 90° 即「沿河
 *      方向」（等亮线走向 = 河道走向），粒子按亮度²加权撒进河里，
 *      顺 S 形河势漂向下游；出生色取自出生地像素（左上星团暖、
 *      河心冰蓝）。头在 gx 层，尾以极小剂量存在 fx 层慢慢衰减。
 *   2) 微光：从亮部采样的定点星，各自以 2~7 秒周期呼吸明灭。
 *   3) 环境星：视口黑幕上的稀疏小星，画框外也是宇宙。
 *
 * 每日一句：右上竖排行楷，句子存于同目录 quotes.json（可自行增删），
 *   每天零点（UTC+8）按顺序轮换；首展日 2026-09-17 显示第一句。
 *
 * 自检：?t=1 → 左下角仪表 + window.__cosmos 供自动化检查。
 * ============================================================ */
(function () {
  "use strict";

  var img = document.getElementById("cosmos");
  var fxCv = document.getElementById("fx");   // 拖尾层（慢衰减）
  var gxCv = document.getElementById("gx");   // 亮点层（每帧清屏）
  var fxCtx = fxCv.getContext("2d");
  var gxCtx = gxCv.getContext("2d");
  var quoteEl = document.getElementById("quote");
  var testEl = document.getElementById("selftest");

  var quiet = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DEBUG = /[?&]t=1/.test(location.search);

  /* ---------------- 每日一句 ---------------- */
  var FALLBACK = [
    "仰观宇宙之大", "俯察品类之盛", "寄蜉蝣于天地", "渺沧海之一粟",
    "哀吾生之须臾", "羡长江之无穷", "挟飞仙以遨游", "抱明月而长终",
  ];
  var lines = FALLBACK.slice();
  var mode = "daily"; // daily | fixed
  var DAY0 = Math.floor(Date.UTC(2026, 8, 17) / 86400e3); // 首展日（dayNo 已含 +8h 偏移，这里用 UTC 零点即可）
  function dayNo() { return Math.floor((Date.now() + 8 * 3600e3) / 86400e3); }
  function currentLine() {
    if (!lines.length) return null;
    if (mode === "fixed") return { text: lines[0], i: 0 };
    var n = ((dayNo() - DAY0) % lines.length + lines.length) % lines.length;
    return { text: lines[n], i: n };
  }

  var shownText = "";
  function showQuote(now) {
    var cur = currentLine();
    if (!cur || cur.text === shownText) return;
    var paint = function () {
      shownText = cur.text;
      quoteEl.textContent = cur.text;
      quoteEl.dataset.i = String(cur.i);
      quoteEl.classList.add("on");
    };
    if (now || quiet) { quoteEl.classList.remove("on"); paint(); return; }
    quoteEl.classList.remove("on");
    setTimeout(function () {
      var c2 = currentLine();
      if (c2 && c2.text === cur.text) paint();
    }, 1600);
  }

  fetch("quotes.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (j && Array.isArray(j.lines) && j.lines.length) {
        lines = j.lines.map(String).filter(Boolean);
        mode = j.mode === "fixed" ? "fixed" : "daily";
      }
    })
    .catch(function () {})
    .then(function () { setTimeout(function () { showQuote(true); }, 900); });

  // 跨零点自动换句（页面开过午夜）
  var today = dayNo();
  setInterval(function () {
    if (dayNo() !== today) {
      today = dayNo();
      shownText = "";
      showQuote(false);
    }
  }, 60e3);

  /* ---------------- 显示矩形（与 CSS contain 完全同式） ---------------- */
  var rect = { x: 0, y: 0, w: 0, h: 0 };
  var vw = 1, vh = 1;
  function fitRect() {
    vw = Math.max(1, window.innerWidth);
    vh = Math.max(1, window.innerHeight);
    var iw = img.naturalWidth || 848, ih = img.naturalHeight || 1500;
    var s = Math.min(vw / iw, vh / ih);
    rect.w = iw * s; rect.h = ih * s;
    rect.x = (vw - rect.w) / 2; rect.y = (vh - rect.h) / 2;
  }

  /* ---------------- 亮度场 → 流场 ---------------- */
  var SW = 96, fw = 0, fh = 0;
  var fU, fV, fL, fWarm;
  function computeField() {
    fw = SW;
    fh = Math.max(8, Math.round(SW * (img.naturalHeight || 1500) / (img.naturalWidth || 848)));
    var n = fw * fh;
    fU = new Float32Array(n); fV = new Float32Array(n);
    fL = new Float32Array(n); fWarm = new Float32Array(n);

    var off = document.createElement("canvas");
    off.width = fw; off.height = fh;
    var octx = off.getContext("2d", { willReadFrequently: true });
    var d = null;
    try {
      octx.drawImage(img, 0, 0, fw, fh);
      d = octx.getImageData(0, 0, fw, fh).data;
    } catch (e) { d = null; }

    if (!d) { // 拿不到像素的极端环境：退化为均匀缓降
      for (var k = 0; k < n; k++) { fU[k] = 0; fV[k] = 0.6; fL[k] = 0; fWarm[k] = 0; }
      return;
    }

    var rawL = new Float32Array(n), i, x, y, dx, dy;
    for (i = 0; i < n; i++) {
      var r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
      rawL[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      fWarm[i] = (r - b) / (r + b + 0.08); // >0 偏暖
    }

    // 3×3 盒滤波 ×2：去单星噪，留河道大势
    var a = rawL, b2 = new Float32Array(n);
    for (var pass = 0; pass < 2; pass++) {
      for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
        var s = 0, cnt = 0;
        for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
          var yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= fh || xx < 0 || xx >= fw) continue;
          s += a[yy * fw + xx]; cnt++;
        }
        b2[y * fw + x] = s / cnt;
      }
      var t = a; a = b2; b2 = t;
    }
    var sm = a;

    // 梯度旋转 90° = 沿河（等亮线方向）；统一取朝「下游」的方向
    for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
      i = y * fw + x;
      var xA = Math.max(0, x - 1), xB = Math.min(fw - 1, x + 1);
      var yA = Math.max(0, y - 1), yB = Math.min(fh - 1, y + 1);
      var gx = sm[y * fw + xB] - sm[y * fw + xA];
      var gy = sm[yB * fw + x] - sm[yA * fw + x];
      var px = -gy, py = gx;
      if (py < 0) { px = -px; py = -py; }
      var m = Math.sqrt(px * px + py * py);
      if (m < 1e-3) { px = 0; py = 0.55; } else { px /= m; py /= m; }
      fU[i] = px; fV[i] = py;
      fL[i] = sm[i];
    }
  }

  var F = { x: 0, y: 0, l: 0 };
  function field(u, v) { // u,v ∈ [0,1]，双线性
    var x = Math.min(Math.max(u, 0), 1) * (fw - 1);
    var y = Math.min(Math.max(v, 0), 1) * (fh - 1);
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var x1 = Math.min(x0 + 1, fw - 1), y1 = Math.min(y0 + 1, fh - 1);
    var tx = x - x0, ty = y - y0;
    var i00 = y0 * fw + x0, i10 = y0 * fw + x1, i01 = y1 * fw + x0, i11 = y1 * fw + x1;
    F.x = (fU[i00] * (1 - tx) + fU[i10] * tx) * (1 - ty) + (fU[i01] * (1 - tx) + fU[i11] * tx) * ty;
    F.y = (fV[i00] * (1 - tx) + fV[i10] * tx) * (1 - ty) + (fV[i01] * (1 - tx) + fV[i11] * tx) * ty;
    F.l = (fL[i00] * (1 - tx) + fL[i10] * tx) * (1 - ty) + (fL[i01] * (1 - tx) + fL[i11] * tx) * ty;
    return F;
  }

  /* ---------------- 光点精灵 ---------------- */
  function makeSprite(r, g, b) {
    var s = document.createElement("canvas");
    s.width = s.height = 32;
    var c = s.getContext("2d");
    var gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(" + r + "," + g + "," + b + ",0.85)");
    gr.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
    c.fillStyle = gr;
    c.fillRect(0, 0, 32, 32);
    return s;
  }
  var spCool = makeSprite(168, 196, 255);
  var spWarm = makeSprite(255, 206, 150);

  /* ---------------- 粒子 / 星 ---------------- */
  var drops = [], twinkles = [], ambient = [];
  var N_DROPS = 240, N_TWINKLE = 120, N_AMBIENT = 90;

  function spawnDrop(p) {
    for (var t = 0; t < 28; t++) {
      var i = (Math.random() * fw * fh) | 0;
      var L = fL[i];
      if (L * L > Math.random() * 0.5) { // 亮度²加权 → 亮处多生
        p.u = ((i % fw) + Math.random()) / fw;
        p.v = (((i / fw) | 0) + Math.random()) / fh;
        p.warm = fWarm[i] > 0.08;
        p.size = 1.1 + Math.random() * 2.3;
        p.speed = 7 + 22 * L + Math.random() * 6; // 显示像素/秒
        p.life = 5 + Math.random() * 8;
        p.age = Math.random() * 2; // 起始错峰
        return true;
      }
    }
    p.u = Math.random(); p.v = Math.random() * 0.3;
    p.warm = false; p.size = 1.2; p.speed = 10; p.life = 6; p.age = 0;
    return true;
  }

  function buildPopulations() {
    drops.length = 0; twinkles.length = 0; ambient.length = 0;
    var area = Math.round(rect.w * rect.h / 1500);
    N_DROPS = Math.max(110, Math.min(340, area));
    var i;
    for (i = 0; i < N_DROPS; i++) { var p = {}; spawnDrop(p); drops.push(p); }

    var guard = 0;
    while (twinkles.length < N_TWINKLE && guard++ < N_TWINKLE * 80) {
      i = (Math.random() * fw * fh) | 0;
      if (fL[i] < 0.4) continue;
      twinkles.push({
        u: ((i % fw) + Math.random()) / fw,
        v: (((i / fw) | 0) + Math.random()) / fh,
        size: 0.7 + Math.random() * 1.3,
        warm: fWarm[i] > 0.12,
        period: 2 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        base: 0.14 + Math.random() * 0.3,
      });
    }
    for (i = 0; i < N_AMBIENT; i++) {
      ambient.push({
        u: Math.random(), v: Math.random(),
        size: 0.5 + Math.random() * 0.9,
        warm: Math.random() < 0.18,
        period: 3 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
        base: 0.07 + Math.random() * 0.2,
      });
    }
  }

  /* ---------------- 画布尺寸 ---------------- */
  function resize() {
    fitRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    [fxCv, gxCv].forEach(function (c) {
      c.width = Math.round(vw * dpr);
      c.height = Math.round(vh * dpr);
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  /* ---------------- 主循环 ---------------- */
  var running = false, rafId = 0, lastT = 0, fps = 60;

  function frame(t) {
    rafId = requestAnimationFrame(frame);
    var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
    lastT = t;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;

    // 拖尾层：慢慢擦除自己（不做减法于画面，只擦画布自身）
    fxCtx.globalCompositeOperation = "destination-out";
    fxCtx.globalAlpha = 1;
    fxCtx.fillStyle = "rgba(0,0,0,0.05)";
    fxCtx.fillRect(0, 0, vw, vh);

    // 亮点层：整帧重画
    gxCtx.clearRect(0, 0, vw, vh);
    gxCtx.globalCompositeOperation = "lighter";

    var i, p, f;
    // 河流粒子
    for (i = 0; i < drops.length; i++) {
      p = drops[i];
      f = field(p.u, p.v);
      var sp = p.speed * dt;
      p.u += (f.x * sp + (Math.random() - 0.5) * 0.06 * dt) / rect.w;
      p.v += (f.y * sp + (Math.random() - 0.5) * 0.08 * dt) / rect.h;
      p.age += dt;
      if (p.age >= p.life || p.u < -0.02 || p.u > 1.02 || p.v > 1.02 || p.v < -0.02) {
        spawnDrop(p);
        continue;
      }
      var k = p.age / p.life;
      var env = Math.sin(Math.PI * Math.min(Math.max(k, 0), 1)); // 淡入淡出
      var a = env * (0.12 + 0.34 * f.l);
      var x = rect.x + p.u * rect.w;
      var y = rect.y + p.v * rect.h;
      var spr = p.warm ? spWarm : spCool;
      // 头
      var hs = p.size * 2.1;
      gxCtx.globalAlpha = Math.min(a, 0.5);
      gxCtx.drawImage(spr, x - hs, y - hs, hs * 2, hs * 2);
      // 尾：极小剂量存进拖尾层，慢慢衰减成光痕
      fxCtx.globalCompositeOperation = "lighter";
      fxCtx.globalAlpha = Math.min(a * 0.09, 0.06);
      fxCtx.drawImage(spr, x - 1.6, y - 1.6, 3.2, 3.2);
    }

    // 微光（图内亮星）
    var tw = t / 1000;
    for (i = 0; i < twinkles.length; i++) {
      p = twinkles[i];
      var w = 0.5 + 0.5 * Math.sin(tw * Math.PI * 2 / p.period + p.phase);
      var ta = p.base * (0.3 + 0.7 * w);
      var tx2 = rect.x + p.u * rect.w, ty2 = rect.y + p.v * rect.h;
      var ts = p.size * 2;
      gxCtx.globalAlpha = ta;
      gxCtx.drawImage(p.warm ? spWarm : spCool, tx2 - ts, ty2 - ts, ts * 2, ts * 2);
    }
    // 环境星（黑幕）
    for (i = 0; i < ambient.length; i++) {
      p = ambient[i];
      var w2 = 0.5 + 0.5 * Math.sin(tw * Math.PI * 2 / p.period + p.phase);
      var aa = p.base * (0.3 + 0.7 * w2);
      var ax = p.u * vw, ay = p.v * vh;
      var as = p.size * 2;
      gxCtx.globalAlpha = aa;
      gxCtx.drawImage(p.warm ? spWarm : spCool, ax - as, ay - as, as * 2, as * 2);
    }

    fxCtx.globalCompositeOperation = "lighter";
    gxCtx.globalAlpha = 1;
  }

  function start() {
    if (running || quiet) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // 静态偏好：只铺一帧安静的微光，不做任何运动
  function stillFrame() {
    gxCtx.clearRect(0, 0, vw, vh);
    gxCtx.globalCompositeOperation = "lighter";
    var i, p;
    for (i = 0; i < twinkles.length; i++) {
      p = twinkles[i];
      var ts = p.size * 2;
      gxCtx.globalAlpha = p.base * 0.5;
      gxCtx.drawImage(p.warm ? spWarm : spCool, rect.x + p.u * rect.w - ts, rect.y + p.v * rect.h - ts, ts * 2, ts * 2);
    }
    for (i = 0; i < ambient.length; i++) {
      p = ambient[i];
      var as = p.size * 2;
      gxCtx.globalAlpha = p.base * 0.5;
      gxCtx.drawImage(p.warm ? spWarm : spCool, p.u * vw - as, p.v * vh - as, as * 2, as * 2);
    }
    gxCtx.globalAlpha = 1;
  }

  /* ---------------- 自检 ?t=1 ---------------- */
  var state = {
    imgOK: false, iw: 0, ih: 0, field: [0, 0],
    drops: 0, twinkles: 0, ambient: 0,
    line: null, lineTotal: lines.length, mode: mode, fps: 60,
  };
  if (DEBUG) {
    testEl.hidden = false;
    setInterval(function () {
      state.drops = drops.length; state.twinkles = twinkles.length; state.ambient = ambient.length;
      state.field = [fw, fh]; state.mode = mode; state.fps = Math.round(fps);
      var cur = currentLine();
      state.line = cur;
      var imgTag = state.imgOK ? "✓ " + state.iw + "×" + state.ih : "✗ 加载失败";
      testEl.textContent =
        "自检 · 图像 " + imgTag +
        " · 流场 " + state.field[0] + "×" + state.field[1] +
        " · 河 " + state.drops + " · 星 " + state.twinkles + "+" + state.ambient +
        " · 句#" + (cur ? cur.i : "-") + "/" + state.lineTotal + "「" + (cur ? cur.text : "…") + "」" +
        " · " + (quiet ? "静态" : state.fps + "fps");
    }, 500);
    window.__cosmos = state;
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    state.imgOK = true;
    state.iw = img.naturalWidth; state.ih = img.naturalHeight;
    fitRect();
    computeField();
    resize();
    buildPopulations();
    if (quiet) { stillFrame(); } else { start(); }
    window.addEventListener("resize", function () {
      resize();
      if (quiet) stillFrame();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }
  if (img.complete && img.naturalWidth) {
    boot();
  } else {
    img.addEventListener("load", boot);
    img.addEventListener("error", function () {
      if (DEBUG) testEl.textContent = "自检 · 图像 ✗ 加载失败（cosmos.jpg）";
    });
  }
})();
