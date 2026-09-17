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
 * 桌面全景（两翼星域）：竖图手机看刚好；桌面宽幅时两侧若留黑幕
 * 太浪费——从原图边缘取「镜像延展条」保证接缝处纹路零断裂地延续
 * 出去并渐渐隐没，再从原图里提取孤立星点（亮核+暗边才算）播进
 * 两翼、逐颗呼吸明灭。底色取原图边缘的暗部色调，接缝天衣无缝。
 * 侧宽不足（手机竖屏）自动退化为纯竖图。
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
  var wxCv = document.getElementById("wx");   // 两翼星域（桌面全景，垫在图后）
  var wxCtx = wxCv.getContext("2d");
  var glCv = document.getElementById("gl");   // WebGL 平流层（整幅图沿河道流动）
  var stage = document.getElementById("stage"); // 可拖动/缩放的舞台容器
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

  /* ---------------- WebGL 平流纹理 ----------------
   * 把流场编码成 RGBA 小纹理交给 FlowGL：
   * RG=流向（0.5 基线）、B=运动遮罩（亮处流、暗处与行人驻足）、
   * A=空间相位（各处滑动错峰）。行序顶→底，与着色器 v_uv 一致。 */
  var FLOW_AMP = 0;     // 整图平流幅度——用户定版：流线纹理要静止，置 0
  var FLOW_CYCLE = 9;   //（保留着色器通用性；幅度为 0 时无位移）
  var flowTex = null, flowCtl = null;
  function buildFlowTexture() {
    var n = fw * fh;
    var d = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) {
      var m = fL[i];
      m = m < 0.22 ? 0 : m > 0.5 ? 1 : (m - 0.22) / 0.28;
      // 行人保护区：剪影与投影周围运动衰减到零——流动的是河，人驻足原地
      var du = ((i % fw) + 0.5) / fw - 0.593;
      var dv = (((i / fw) | 0) + 0.5) / fh - 0.502;
      var pd = Math.sqrt((du / 0.05) * (du / 0.05) + (dv / 0.062) * (dv / 0.062));
      if (pd < 1.5) m *= pd < 1 ? 0 : (pd - 1) / 0.5;
      var x = (i % fw) + 0.5, y = ((i / fw) | 0) + 0.5;
      var h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      var j = i * 4;
      d[j] = Math.round((fU[i] * 0.5 + 0.5) * 255);
      d[j + 1] = Math.round((fV[i] * 0.5 + 0.5) * 255);
      d[j + 2] = Math.round(m * 255);
      d[j + 3] = Math.round(h * 255);
    }
    flowTex = { data: d, w: fw, h: fh };
  }

  /* ---------------- 衣袂 & 影子 局部动画纹理 ----------------
   * 箱体罩住人影与投影。RG = 衣袂摆动矢量（肩→摆缘渐强，只染剪影
   * 暗像素，头肩几乎不动）；BA = 影子摇曳矢量（脚跟→梢沿主轴渐强，
   * 远端摆幅大＝影子在伸长收缩）。有符号分量按 0.5 基线编码，
   * 箱缘渐隐防边缘渗色。 */
  var LOC_BOX = { x: 0.505, y: 0.455, w: 0.16, h: 0.13 };
  var LOC_TW = 160, LOC_TH = 208;
  var locTex = null;
  function buildLocalTexture() {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var off = document.createElement("canvas");
    off.width = LOC_TW; off.height = LOC_TH;
    var c = off.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, LOC_BOX.x * iw, LOC_BOX.y * ih, LOC_BOX.w * iw, LOC_BOX.h * ih,
                0, 0, LOC_TW, LOC_TH);
    var d = null;
    try { d = c.getImageData(0, 0, LOC_TW, LOC_TH).data; } catch (e) { d = null; }
    locTex = null;
    if (!d) return;
    var data = new Uint8Array(LOC_TW * LOC_TH * 4);
    var dirR = { x: 0.94, y: 0.34 }, rl = Math.sqrt(dirR.x * dirR.x + dirR.y * dirR.y);
    dirR.x /= rl; dirR.y /= rl;
    var dirS = { x: -0.84, y: 0.55 }, sl2 = Math.sqrt(dirS.x * dirS.x + dirS.y * dirS.y);
    dirS.x /= sl2; dirS.y /= sl2;
    var feet = { x: 0.587, y: 0.500 };
    for (var ty = 0; ty < LOC_TH; ty++) {
      for (var tx = 0; tx < LOC_TW; tx++) {
        var u = LOC_BOX.x + (tx + 0.5) / LOC_TW * LOC_BOX.w;
        var v = LOC_BOX.y + (ty + 0.5) / LOC_TH * LOC_BOX.h;
        var i4 = (ty * LOC_TW + tx) * 4;
        var lum = (0.2126 * d[i4] + 0.7152 * d[i4 + 1] + 0.0722 * d[i4 + 2]) / 255;
        var dark = Math.max(0, Math.min(1, (0.45 - lum) / 0.15));
        var darkS = Math.max(0, Math.min(1, (0.5 - lum) / 0.2));
        // 衣袂：肩线 0.4885 → 摆缘 0.5010 渐强，人形窄带以内
        var rf = 0;
        if (u > 0.565 && u < 0.612 && v > 0.482 && v < 0.506) {
          rf = Math.max(0, Math.min(1, (v - 0.4885) / 0.0125)) * dark;
        }
        // 影子：脚跟→梢 沿主轴渐强，横向收窄
        var du = u - feet.x, dv = v - feet.y;
        var along = du * dirS.x + dv * dirS.y;
        var lat = Math.abs(du * dirS.y - dv * dirS.x);
        var rs = 0;
        if (along > -0.004 && along < 0.03 && lat < 0.016) {
          rs = Math.max(0, Math.min(1, along / 0.022)) * darkS * (1 - lat / 0.016);
        }
        var ex = Math.min((tx + 1) / 8, (LOC_TW - tx) / 8, 1);
        var ey = Math.min((ty + 1) / 8, (LOC_TH - ty) / 8, 1);
        var fade = Math.min(ex, ey);
        var j = i4;
        data[j] = Math.round((dirR.x * rf * fade * 0.5 + 0.5) * 255);
        data[j + 1] = Math.round((dirR.y * rf * fade * 0.5 + 0.5) * 255);
        data[j + 2] = Math.round((dirS.x * rs * fade * 0.5 + 0.5) * 255);
        data[j + 3] = Math.round((dirS.y * rs * fade * 0.5 + 0.5) * 255);
      }
    }
    locTex = { data: data, w: LOC_TW, h: LOC_TH };
  }
  function startFlow() {
    if (quiet || !window.FlowGL || !flowTex) return;
    flowCtl = FlowGL.create(glCv, img, flowTex, {
      ampPx: FLOW_AMP,
      cycle: FLOW_CYCLE,
      locTex: locTex,
      flAmpPx: 2.3,
      swAmpPx: 3.4,
      onLost: function () {
        flowCtl = null;
        state.flow = "lost";
      },
    });
    state.flow = flowCtl ? "webgl" : "2d";
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

  /* ---------------- 桌面全景：两翼星域 ----------------
   * 全部素材取自原图自身：接缝处用「镜像延展条」（反射保证边界
   * 像素一一连续，再渐隐归黑），星点只收「亮核 + 暗边」的孤立星，
   * 底色取原图左右边缘的暗部均值。手机侧宽不够时整体退场。 */
  var WING_MIN_SIDE = 220;  // 侧宽小于此不开全景（手机竖屏）
  var sprites = [], toneL = [1, 1, 3], toneR = [1, 1, 3];
  var wingStars = [], wingsOn = false;

  function lumAt(d, i) { return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; }

  function edgeTone(d, iw, ih, x0) {
    var r = 0, g = 0, b = 0, n = 0;
    for (var y = 0; y < ih; y += 3) {
      for (var x = x0; x < x0 + 4 && x < iw; x++) {
        var i = (y * iw + x) * 4;
        if (lumAt(d, i) < 0.12) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      }
    }
    if (!n) return [1, 1, 3];
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }

  function extractSprites() {
    sprites.length = 0;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var off = document.createElement("canvas");
    off.width = iw; off.height = ih;
    var octx = off.getContext("2d", { willReadFrequently: true });
    var d = null;
    try {
      octx.drawImage(img, 0, 0);
      d = octx.getImageData(0, 0, iw, ih).data;
    } catch (e) { d = null; }
    if (!d) return;
    toneL = edgeTone(d, iw, ih, 0);
    toneR = edgeTone(d, iw, ih, Math.max(0, iw - 4));
    var R = 7, found = 0;
    for (var y = R; y < ih - R && found < 160; y += 7) {
      for (var x = R; x < iw - R && found < 160; x += 7) {
        var i = (y * iw + x) * 4;
        var L = lumAt(d, i);
        if (L < 0.5) continue;
        var border = 0, cnt = 0;
        for (var dy = -R; dy <= R; dy += 2) {
          for (var dx = -R; dx <= R; dx += 2) {
            if (!dx && !dy) continue;
            border += lumAt(d, ((y + dy) * iw + (x + dx)) * 4);
            cnt++;
          }
        }
        if (border / cnt > 0.16) continue; // 周围太亮＝星团内部/河道，不孤立
        var s = document.createElement("canvas");
        s.width = 15; s.height = 15;
        var sc2 = s.getContext("2d");
        sc2.drawImage(off, x - 7, y - 7, 15, 15, 0, 0, 15, 15);
        // 径向羽化：补丁背景不是纯黑，不羽化会贴出方块边
        sc2.globalCompositeOperation = "destination-in";
        var feather = sc2.createRadialGradient(7.5, 7.5, 0, 7.5, 7.5, 7.5);
        feather.addColorStop(0, "rgba(0,0,0,1)");
        feather.addColorStop(0.55, "rgba(0,0,0,0.85)");
        feather.addColorStop(1, "rgba(0,0,0,0)");
        sc2.fillStyle = feather;
        sc2.fillRect(0, 0, 15, 15);
        sprites.push({ c: s, peak: L });
        found++;
        x += 10; // 同一颗星只取一次
      }
    }
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildWings() {
    wingStars.length = 0;
    wingsOn = rect.x >= WING_MIN_SIDE && sprites.length > 0;
    wxCtx.clearRect(0, 0, vw, vh);
    if (!wingsOn) return;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = rect.h / ih;
    var sideW = rect.x;
    var rng = mulberry32(20260917); // 固定种子：resize 后星图稳定不跳
    for (var dir = -1; dir <= 1; dir += 2) {
      var seamX = dir < 0 ? rect.x : rect.x + rect.w;
      var tone = dir < 0 ? toneL : toneR;
      // 左缘离人影远（人影在图内 x≈0.6），延展条可以长些、渐隐慢些；
      // 右缘必须短——深了会把人影镜像出去穿帮。条深上限按源像素的
      // 安全距离折算（右 408 / 左 700），随视口等比生长、巨屏不缩成窄领。
      var strip = dir < 0 ? Math.min(700 * scale, sideW * 0.55)
                          : Math.min(408 * scale, sideW * 0.5);
      if (strip < 120) strip = Math.min(120, sideW * 0.5);

      // 底色：与原图边缘同调的暗
      wxCtx.fillStyle = "rgb(" + tone[0] + "," + tone[1] + "," + tone[2] + ")";
      wxCtx.fillRect(dir < 0 ? 0 : seamX, 0, sideW, vh);

      // 镜像延展条：反射对接缝，渐隐进黑（在临时画布上做完淡出再贴）
      var tmp = document.createElement("canvas");
      tmp.width = strip; tmp.height = Math.ceil(vh);
      var tc = tmp.getContext("2d");
      var srcS = Math.min(iw, strip / scale);
      tc.translate(strip, 0);
      tc.scale(-1, 1);
      tc.drawImage(img, dir < 0 ? 0 : iw - srcS, 0, srcS, ih, 0, 0, strip, vh);
      tc.setTransform(1, 0, 0, 1, 0, 0);
      // 横向涂抹：缩到 1/8 再拉回。镜像条若保留原结构，「黑洞」这类
      // 可辨认的形状会沿接缝对称出去一眼穿帮；抹成光痕就只是余晖。
      var bw = Math.max(2, Math.round(strip / 8));
      var bh = Math.max(2, Math.round(tmp.height / 8));
      var tiny = document.createElement("canvas");
      tiny.width = bw; tiny.height = bh;
      tiny.getContext("2d").drawImage(tmp, 0, 0, bw, bh);
      tc.clearRect(0, 0, strip, tmp.height);
      tc.imageSmoothingEnabled = true;
      tc.drawImage(tiny, 0, 0, strip, tmp.height);
      tc.globalCompositeOperation = "destination-in";
      var fade = tc.createLinearGradient(0, 0, strip, 0);
      if (dir < 0) { // 接缝在 temp 右缘（左侧条长，渐隐更缓）
        fade.addColorStop(0, "rgba(0,0,0,0)");
        fade.addColorStop(0.6, "rgba(0,0,0,0.3)");
        fade.addColorStop(1, "rgba(0,0,0,1)");
      } else {       // 接缝在 temp 左缘
        fade.addColorStop(0, "rgba(0,0,0,1)");
        fade.addColorStop(0.45, "rgba(0,0,0,0.25)");
        fade.addColorStop(1, "rgba(0,0,0,0)");
      }
      tc.fillStyle = fade;
      tc.fillRect(0, 0, strip, tmp.height);
      wxCtx.drawImage(tmp, dir < 0 ? seamX - strip - 1 : seamX - 1, 0);

      // 极淡的雾气，暗示星河在画外还有余脉（巨屏三片，免得外侧太空）
      var hazeN = sideW > 700 ? 3 : 2;
      for (var h2 = 0; h2 < hazeN; h2++) {
        var hr = 160 + rng() * 260;
        var hx = seamX + dir * (strip * 0.7 + rng() * Math.max(0, sideW - strip * 0.7 - hr * 0.5));
        var hy = rng() * vh;
        var g2 = wxCtx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        g2.addColorStop(0, "rgba(150,165,205,0.065)");
        g2.addColorStop(1, "rgba(150,165,205,0)");
        wxCtx.fillStyle = g2;
        wxCtx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
      }

      // 播种：原图里摘来的孤立星，逐颗会呼吸
      var zoneW = Math.max(40, sideW - strip);
      var count = Math.round((sideW * vh) / 3800);
      for (var k = 0; k < count; k++) {
        var spr = sprites[Math.floor(rng() * sprites.length)];
        var dx = strip * 0.35 + rng() * zoneW;
        wingStars.push({
          x: seamX + dir * dx,
          y: rng() * vh,
          s: spr,
          sc: 0.5 + rng() * 0.9,
          a: 0.3 + rng() * 0.6,
          period: 2 + rng() * 6,
          phase: rng() * Math.PI * 2,
        });
      }
    }
    state.wings.on = wingsOn;
    state.wings.side = Math.round(rect.x);
    state.wings.stars = wingStars.length;
    state.sprites = sprites.length;
  }


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
    [fxCv, gxCv, wxCv].forEach(function (c) {
      c.width = Math.round(vw * dpr);
      c.height = Math.round(vh * dpr);
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    buildWings();
    if (flowCtl) flowCtl.resize(rect.x, rect.y, rect.w, rect.h, dpr);
  }

  /* ---------------- 主循环 ---------------- */
  var running = false, rafId = 0, lastT = 0, fps = 60;

  function frame(t) {
    rafId = requestAnimationFrame(frame);
    var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
    lastT = t;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;

    // 整幅图沿河道平流（WebGL 层）
    if (flowCtl) flowCtl.render(t / 1000);

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
    // 两翼星域（桌面全景：原图摘来的星，逐颗呼吸）
    for (i = 0; i < wingStars.length; i++) {
      p = wingStars[i];
      var w4 = 0.55 + 0.45 * Math.sin(tw * Math.PI * 2 / p.period + p.phase);
      var ws = 15 * p.sc;
      gxCtx.globalAlpha = p.a * (0.3 + 0.7 * w4);
      gxCtx.drawImage(p.s.c, p.x - ws / 2, p.y - ws / 2, ws, ws);
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
    for (i = 0; i < wingStars.length; i++) {
      p = wingStars[i];
      var ws = 15 * p.sc;
      gxCtx.globalAlpha = p.a * 0.55;
      gxCtx.drawImage(p.s.c, p.x - ws / 2, p.y - ws / 2, ws, ws);
    }
    gxCtx.globalAlpha = 1;
  }

  /* ---------------- 自检 ?t=1 ---------------- */
  var state = {
    imgOK: false, iw: 0, ih: 0, field: [0, 0],
    drops: 0, twinkles: 0, ambient: 0, sprites: 0,
    wings: { on: false, side: 0, stars: 0 },
    flow: "2d", zoom: 1,
    line: null, lineTotal: lines.length, mode: mode, fps: 60,
  };
  window.__cosmos = state; // 自动化/测试随时可读（面板只在 ?t=1 显示）
  if (DEBUG) {
    testEl.hidden = false;
    setInterval(function () {
      state.drops = drops.length; state.twinkles = twinkles.length; state.ambient = ambient.length;
      state.sprites = sprites.length;
      state.wings.on = wingsOn; state.wings.side = Math.round(rect.x); state.wings.stars = wingStars.length;
      state.field = [fw, fh]; state.mode = mode; state.fps = Math.round(fps);
      var cur = currentLine();
      state.line = cur;
      var imgTag = state.imgOK ? "✓ " + state.iw + "×" + state.ih : "✗ 加载失败";
      var wingTag = wingsOn ? "翼星 " + wingStars.length + "/侧" + state.wings.side : "翼 –（侧宽不足）";
      testEl.textContent =
        "自检 · 图像 " + imgTag +
        " · 流场 " + state.field[0] + "×" + state.field[1] +
        " · GL " + state.flow + (FLOW_AMP > 0 ? " · 流线平流" : " · 流线静止") +
        " · 河 " + state.drops + " · 星 " + state.twinkles + "+" + state.ambient +
        " · " + wingTag +
        " · 句#" + (cur ? cur.i : "-") + "/" + state.lineTotal + "「" + (cur ? cur.text : "…") + "」" +
        " · " + (quiet ? "静态" : state.fps + "fps");
    }, 500);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    state.imgOK = true;
    state.iw = img.naturalWidth; state.ih = img.naturalHeight;
    fitRect();
    computeField();
    buildFlowTexture();
    buildLocalTexture();
    startFlow();
    extractSprites();
    resize();
    buildPopulations();
    if (window.PanZoom && stage) {
      PanZoom.attach(stage, { max: 4, onChange: function (sv) { state.zoom = sv; } });
    }
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
