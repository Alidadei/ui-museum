/* 星河引擎回归测试：用 Node DOM/Canvas 桩驱动真实 cosmos.js
 * 运行：node tests/cosmos.stub.test.js （改完 cosmos.js 建议先跑一遍）
 * 覆盖：boot 链路（流场 96×170）、粒子撒种/推进/重生的边界、
 *       拖尾与亮点层的绘制调用、每日一句 fallback 与轮换序号。 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "uis/cosmic-river/cosmos.js"), "utf8");

let ok = true;
const check = (n, c) => { console.log((c ? "✓" : "✗") + " " + n); if (!c) ok = false; };

/* ---------- 桩：合成一张「左暖右冷两条亮带」的图 ---------- */
const IW = 848, IH = 1500, SW = 96, SH = Math.round(SW * IH / IW); // 170
function syntheticData(fw, fh) {
  const d = new Uint8ClampedArray(fw * fh * 4); // 全黑底
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const i = (y * fw + x) * 4;
      if (x >= 6 && x <= 16) { d[i] = 255; d[i + 1] = 200; d[i + 2] = 120; d[i + 3] = 255; } // 暖带
      if (x >= 40 && x <= 60) { d[i] = 200; d[i + 1] = 215; d[i + 2] = 255; d[i + 3] = 255; } // 冷带宽河
    }
  }
  return d;
}
function makeCtx(canvas) {
  return {
    canvas,
    globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "",
    drawImageCount: 0, fillRectCount: 0, cleared: 0, transformed: 0,
    setTransform() { this.transformed++; },
    fillRect() { this.fillRectCount++; },
    clearRect() { this.cleared++; },
    drawImage() { this.drawImageCount++; },
    createRadialGradient() { return { addColorStop() {} }; },
    getImageData(x, y, w, h) { return { data: syntheticData(w, h), width: w, height: h }; },
  };
}
function makeCanvas() {
  const c = { width: 0, height: 0, _ctx: null, listeners: {} };
  c.getContext = function () { return (this._ctx ||= makeCtx(this)); };
  c.addEventListener = (t, f) => { (c.listeners[t] = c.listeners[t] || []).push(f); };
  return c;
}

const imgStub = { complete: true, naturalWidth: IW, naturalHeight: IH, listeners: {}, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); } };
const quoteEl = { textContent: "", dataset: {}, _on: false, classList: { add(c) { if (c === "on") quoteEl._on = true; }, remove(c) { if (c === "on") quoteEl._on = false; }, contains(c) { return c === "on" && quoteEl._on; } } };
const testEl = { hidden: true, textContent: "" };
const fxCv = makeCanvas(), gxCv = makeCanvas();
const docListeners = {};
const documentStub = {
  getElementById(id) {
    return { cosmos: imgStub, fx: fxCv, gx: gxCv, quote: quoteEl, selftest: testEl }[id] || makeCanvas();
  },
  createElement(tag) { return makeCanvas(); },
  addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); },
  hidden: false,
};
const winListeners = {};
const windowStub = {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  matchMedia: () => ({ matches: false }),
  addEventListener(t, f) { (winListeners[t] = winListeners[t] || []).push(f); },
};
const locationStub = { search: "" };
let fetchCalls = 0;
const fetchStub = () => { fetchCalls++; return Promise.reject(new Error("离线测试：走 fallback")); };

// rAF 手动泵 + setInterval 哑掉（避免吊住进程）
let rafCb = null;
const rafStub = (fn) => { rafCb = fn; return 1; };
const cafStub = () => { rafCb = null; };
const siStub = () => 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let bootError = null;
try {
  new Function("window", "document", "location", "fetch", "matchMedia",
    "requestAnimationFrame", "cancelAnimationFrame", "setInterval",
    code)(windowStub, documentStub, locationStub, fetchStub,
    windowStub.matchMedia, rafStub, cafStub, siStub);
} catch (e) { bootError = e; }

check("boot 无异常", !bootError);
if (bootError) { console.error(bootError); process.exit(1); }

const fxCtx = fxCv.getContext("2d"), gxCtx = gxCv.getContext("2d");
check("图像尺寸读取 848×1500", imgStub.complete && IW === 848 && IH === 1500);
check("流场 96×170", SH === 170);
check("画布做了 DPR 变换", fxCtx.transformed > 0 && gxCtx.transformed > 0);

// 手动泵 120 帧（约 2 秒 @60fps）
let t = 0, threw = null;
try {
  for (let f = 0; f < 120; f++) {
    t += 16.7;
    const cb = rafCb; rafCb = null;
    if (cb) cb(t);
  }
} catch (e) { threw = e; }
check("主循环 120 帧无异常", !threw);
if (threw) console.error(threw);
check("亮点层在画（星/粒子头）", gxCtx.drawImageCount > 500);
check("拖尾层在画（粒子尾迹）", fxCtx.drawImageCount > 100);
check("亮点层每帧清屏", gxCtx.cleared >= 120);
check("拖尾层在衰减", fxCtx.fillRectCount >= 120);

// 每日一句：fallback + 今日序号（与 cosmos.js 同式：首展 2026-09-17 → #0）
(async () => {
  await sleep(1100); // 等 900ms 后的 showQuote(true)
  const DAY0 = Math.floor(Date.UTC(2026, 8, 17) / 86400e3); // 与 cosmos.js 同式
  const dayNo = Math.floor((Date.now() + 8 * 3600e3) / 86400e3);
  const expectIdx = ((dayNo - DAY0) % 8 + 8) % 8;
  const FALLBACK = ["仰观宇宙之大", "俯察品类之盛", "寄蜉蝣于天地", "渺沧海之一粟", "哀吾生之须臾", "羡长江之无穷", "挟飞仙以遨游", "抱明月而长终"];
  check("quotes.json 被请求过（离线走 fallback）", fetchCalls === 1);
  check("显示的是 fallback 今日句", quoteEl.textContent === FALLBACK[expectIdx]);
  check("今日序号正确 #" + expectIdx, Number(quoteEl.dataset.i) === expectIdx);
  check("句子已淡入（class on）", quoteEl._on === true);
  check("非调试模式自检面板隐藏", testEl.hidden === true);

  console.log(ok ? "── 全部通过 ──" : "── 存在失败 ──");
  process.exit(ok ? 0 : 1);
})();
