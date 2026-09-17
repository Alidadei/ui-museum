/* PanZoom 行为仿真：stub DOM 里真实派发 wheel/pointer/dblclick 事件，
 * 断言缩放锚点、拖动钳制、双击不互掐（pointerup 放大后 dblclick 不复位）。
 * 运行：node tests/panzoom.stub.test.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let ok = true;
function check(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "  " + (extra || "")));
  if (!cond) ok = false;
}

/* ---- 最小 DOM stub ---- */
function makeStage() {
  const listeners = {};
  return {
    style: {},
    classList: { _s: new Set(), toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); } },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    setPointerCapture() { throw new Error("no capture in stub"); },
    _listeners: listeners,
    _fire(t, ev) { (listeners[t] || []).forEach(fn => fn(ev)); },
  };
}
function winListeners() {
  const L = {};
  return {
    innerWidth: 1920, innerHeight: 1080, PointerEvent: function P() {},
    addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); },
    _fire(t, ev) { (L[t] || []).forEach(fn => fn(ev)); },
    _L: L,
  };
}
function pev(type, x, y, id) {
  return { type, pointerId: id, clientX: x, clientY: y, pointerType: "mouse" };
}

const code = fs.readFileSync(path.join(__dirname, "..", "uis", "cosmic-river", "panzoom.js"), "utf8");

function boot() {
  const win = winListeners();
  const stage = makeStage();
  const sandbox = { window: win, document: { addEventListener() {} }, Date, Math };
  sandbox.window = win;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const api = win.PanZoom.attach(stage, { max: 4 });
  return { win, stage, api };
}

function txOf(stage) {
  const m = /translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([\d.]+)\)/.exec(stage.style.transform || "");
  return m ? { tx: +m[1], ty: +m[2], s: +m[3] } : null;
}

/* 1) 滚轮：以光标为锚放大 */
{
  const { win, stage } = boot();
  stage._fire("wheel", { preventDefault() {}, deltaY: -240, deltaX: 0, deltaMode: 0, clientX: 960, clientY: 540 });
  const t = txOf(stage);
  const k = Math.exp(240 * 0.0016); // exp(0.384) ≈ 1.4681
  check("滚轮放大：scale ≈ " + k.toFixed(4), t && Math.abs(t.s - k) < 1e-9, JSON.stringify(t));
  check("滚轮放大：光标锚点不动（图像上指的点留在原地）",
        t && Math.abs(t.tx - (960 - 960 * k)) < 1 && Math.abs(t.ty - (540 - 540 * k)) < 1, JSON.stringify(t));
}

/* 2) 滚轮向下：缩回；最小 1 不再小 */
{
  const { win, stage } = boot();
  stage._fire("wheel", { preventDefault() {}, deltaY: 99999, deltaMode: 0, clientX: 100, clientY: 100 });
  const t = txOf(stage);
  check("滚轮缩小钳制到 1×", t && t.s === 1 && t.tx === 0 && t.ty === 0, JSON.stringify(t));
}

/* 3) 拖动：1× 留 22% 余量，且不越界 */
{
  const { win, stage } = boot();
  stage._fire("pointerdown", pev("pointerdown", 960, 540, 1));
  win._fire("pointermove", pev("pointermove", 1460, 840, 1)); // +500,+300
  win._fire("pointerup", pev("pointerup", 1460, 840, 1));
  const t = txOf(stage);
  const cap = 0.22 * 1920;
  check("1× 拖动生效", t && t.tx === 422.4 && t.ty === 237.6, JSON.stringify(t));
  check("1× 拖动钳制在 22% 余量内", t && t.tx <= cap && t.ty <= 0.22 * 1080, JSON.stringify(t));
}

/* 4) 放大后拖动：可见范围钳制，内容不脱手 */
{
  const { win, stage } = boot();
  stage._fire("wheel", { preventDefault() {}, deltaY: -880, deltaMode: 0, clientX: 960, clientY: 540 });
  let t = txOf(stage);
  stage._fire("pointerdown", pev("pointerdown", 960, 540, 1));
  win._fire("pointermove", pev("pointermove", 3000, 3000, 1)); // 拖很远
  win._fire("pointerup", pev("pointerup", 3000, 3000, 1));
  t = txOf(stage);
  const rx = (t.s - 1) * 1920;
  check("放大后拖动钳制：-rx ≤ tx ≤ 0", t && t.tx >= -rx - 1e-6 && t.tx <= 0, JSON.stringify(t));
}

/* 5) 双击放大：pointerup 双击检测放大后，原生 dblclick 不得复位（护栏） */
{
  const { win, stage } = boot();
  const now = Date.now();
  stage._fire("pointerdown", pev("pointerdown", 800, 400, 1));
  win._fire("pointerup", pev("pointerup", 800, 400, 1));
  stage._fire("pointerdown", pev("pointerdown", 802, 402, 1));
  win._fire("pointerup", pev("pointerup", 802, 402, 1)); // 第二次抬起 → zoomAt(2.2)
  const afterTap = txOf(stage);
  stage._fire("dblclick", { clientX: 802, clientY: 402 }); // 原生 dblclick 紧随
  const afterDbl = txOf(stage);
  check("双击放大到 2.2×", afterTap && Math.abs(afterTap.s - 2.2) < 1e-9, JSON.stringify(afterTap));
  check("dblclick 不与 pointerup 互掐（仍是 2.2×）",
        afterDbl && Math.abs(afterDbl.s - 2.2) < 1e-9, JSON.stringify(afterDbl));
}

/* 6) 已放大时 dblclick 复位归中 */
{
  const { win, stage } = boot();
  stage._fire("dblclick", { clientX: 500, clientY: 300 }); // 1× → 放大
  let t = txOf(stage);
  check("单击 dblclick：放大 2.2×", t && Math.abs(t.s - 2.2) < 1e-9, JSON.stringify(t));
  stage._fire("dblclick", { clientX: 500, clientY: 300 }); // 再 dblclick → 复位
  t = txOf(stage);
  check("再 dblclick：复位 1× 归中", t && t.s === 1 && t.tx === 0 && t.ty === 0, JSON.stringify(t));
}

/* 7) 捏合：双指缩放 + 内容点跟随 */
{
  const { win, stage } = boot();
  stage._fire("pointerdown", pev("pointerdown", 860, 540, 1));
  stage._fire("pointerdown", pev("pointerdown", 1060, 540, 2)); // d0=200
  win._fire("pointermove", pev("pointermove", 760, 540, 1));   // d=300 → s=1.5
  win._fire("pointermove", pev("pointermove", 1160, 540, 2));
  win._fire("pointerup", pev("pointerup", 760, 540, 1));
  win._fire("pointerup", pev("pointerup", 1160, 540, 2));
  const t = txOf(stage);
  check("双指捏合放大到 2×（400/200）", t && Math.abs(t.s - 2) < 1e-9, JSON.stringify(t));
  check("捏合中点固定（内容点不漂移）", t && Math.abs(t.tx - (960 - 960 * 2)) < 1, JSON.stringify(t));
}

console.log(ok ? "── 全部通过 ──" : "── 存在失败 ──");
process.exit(ok ? 0 : 1);
