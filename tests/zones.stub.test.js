/* 分区逻辑回归测试：用 Node DOM 桩驱动真实 hub.js + registry.js
 * 运行：node tests/zones.stub.test.js （改完 hub.js 建议先跑一遍） */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "assets/hub.js"), "utf8");
const regCode = fs.readFileSync(path.join(root, "registry.js"), "utf8");
const flipCode = fs.readFileSync(path.join(root, "shared/flip-step/flip.js"), "utf8");

function makeEl(id, tag) {
  const el = {
    id, tagName: (tag || "div").toUpperCase(),
    style: { setProperty(){}, removeProperty(){} }, dataset: {}, children: [], listeners: {},
    textContent: "", innerHTML: "", offsetWidth: 100, offsetHeight: 40,
    hidden: false, title: "",
    classList: { _s: new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,v){v?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)} },
    appendChild(c){ this.children.push(c); return c; },
    append(...cs){ cs.forEach(c=>this.children.push(c)); },
    addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); },
    removeEventListener(){},
    querySelector(){ return makeEl("q"); },
    querySelectorAll(sel){ if (sel === "button") return this.children.filter(c=>c.tagName==="BUTTON"); return []; },
    setAttribute(){}, getAttribute(){ return null; },
    remove(){}, closest(){ return makeEl("c"); },
    getBoundingClientRect(){ return {left:0,top:0,width:100,height:100}; },
  };
  Object.defineProperty(el, "clientWidth", { get(){ return 900; } });
  Object.defineProperty(el, "clientHeight", { get(){ return 500; } });
  Object.defineProperty(el, "innerHTML", { set(v){ this.children.length = 0; this._h = v; }, get(){ return this._h || ""; } });
  Object.defineProperty(el, "textContent", { set(v){ this.children.length = 0; this._t = v; }, get(){ return this._t || ""; } });
  return el;
}
const els = {};
const documentStub = {
  getElementById(id){ return els[id] || (els[id] = makeEl(id)); },
  createElement(tag){ return makeEl("created-"+tag, tag); },
  body: makeEl("body"),
  querySelector(){ return makeEl("qs"); },
  querySelectorAll(){ return []; },
  fonts: null,
};
els.zoneTabs = makeEl("zoneTabs");
for (const z of ["create", "collect"]) {
  const b = makeEl("tab-" + z, "button");
  b.dataset.zone = z;
  b.children.push(makeEl("cnt-" + z));
  els.zoneTabs.children.push(b);
}
const winListeners = {};
const locationStub = { hash: "#/" };
const store = {};
const windowStub = {
  matchMedia: () => ({ matches: false }),
  addEventListener(t, f) { (winListeners[t] = winListeners[t] || []).push(f); },
  innerWidth: 1280, innerHeight: 800,
  setTimeout, clearTimeout, open: () => {},
};
windowStub.window = windowStub;

const getFlip = new Function("window", flipCode + "; return window.flipFit;");
const flipFit = getFlip(windowStub);
new Function("window","document","localStorage","location","setTimeout","clearTimeout","requestAnimationFrame","flipFit",
  regCode + "\n" + code)(windowStub, documentStub, {
  getItem: (k) => store[k] ?? null, setItem: (k,v) => { store[k] = v; },
}, locationStub, setTimeout, clearTimeout, (fn) => fn(), flipFit);

const fireHash = (h) => { locationStub.hash = h; (winListeners["hashchange"]||[]).forEach(f=>f()); };
const idxButtons = () => els.indexList.children.filter(c=>c.children&&c.children.length&&c.children[0].dataset&&c.children[0].dataset.i!==undefined);
let ok = true;
const check = (n, c) => { console.log((c?"✓":"✗")+" "+n); if(!c) ok = false; };

check("默认区=创作", els.indexTitle.textContent.includes("创作"));
check("创作区导览 1 件", idxButtons().length === 1);
check("创作区特展=特001", els.specialList.children.length === 1);
const collectBtn = els.zoneTabs.children[1];
els.zoneTabs.listeners["click"][0]({ target: { closest: (sel) => sel === "button[data-zone]" ? collectBtn : null } });
check("切换后区=收录", els.indexTitle.textContent.includes("收录"));
check("收录区导览 5 件", idxButtons().length === 5);
check("收录区特展=特002", els.specialList.children.length === 1);
fireHash("#/exhibit/harry-homepage");
setTimeout(() => {
  check("直链№001自动落创作区", els.indexTitle.textContent.includes("创作"));
  check("集章 1/6", els.stampProgress.textContent.includes("1 / 6"));
  console.log(ok ? "── 全部通过 ──" : "── 存在失败 ──");
  process.exit(ok ? 0 : 1);
}, 1200);
