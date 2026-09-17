/* ============================================================
 * PanZoom —— 整页拖动 + 缩放（零依赖）
 * ------------------------------------------------------------
 * PanZoom.attach(stageEl, { max, onChange }) → { scale, reset }
 *   滚轮：以光标为锚缩放
 *   拖动：放大后平移（1× 时无内容可移，自动忽略）
 *   双指：捏合缩放 + 双指拖移
 *   双击 / 双轻点：在锚点放大 ↔ 复位
 * 约束：缩放 1~max；平移钳制保证内容不脱手；1× 自动归位。
 * ============================================================ */
(function () {
  "use strict";

  function attach(stage, opts) {
    opts = opts || {};
    var min = 1, max = opts.max || 4;
    var s = 1, tx = 0, ty = 0;
    var pts = new Map();
    var pinch = null;          // { d0, s0, mid0, t0, c }
    var lastTap = 0, tapXY = [0, 0];

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function apply() {
      tx = clamp(tx, -(s - 1) * window.innerWidth, 0);
      ty = clamp(ty, -(s - 1) * window.innerHeight, 0);
      if (s <= 1.001) { tx = 0; ty = 0; s = 1; }
      stage.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
      if (opts.onChange) opts.onChange(s, tx, ty);
    }

    function zoomAt(cx, cy, ns) {
      ns = clamp(ns, min, max);
      var k = ns / s;
      tx = cx - (cx - tx) * k;
      ty = cy - (cy - ty) * k;
      s = ns;
      apply();
    }

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var step = e.deltaMode === 1 ? 0.05 : 0.0016;
      zoomAt(e.clientX, e.clientY, s * Math.exp(-e.deltaY * step));
    }, { passive: false });

    stage.addEventListener("pointerdown", function (e) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        var a = [];
        pts.forEach(function (p) { a.push(p); });
        var d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        var mid0 = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        pinch = { d0: d0, s0: s, mid0: mid0, t0: { x: tx, y: ty },
                  c: { x: (mid0.x - tx) / s, y: (mid0.y - ty) / s } };
      }
      if (e.pointerId !== undefined && stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    });

    window.addEventListener("pointermove", function (e) {
      if (!pts.has(e.pointerId)) return;
      var p = pts.get(e.pointerId);
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1 && s > 1) {
        tx += dx; ty += dy; apply();
      } else if (pts.size === 2 && pinch) {
        var a = [];
        pts.forEach(function (p2) { a.push(p2); });
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        var mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        s = clamp(pinch.s0 * d / pinch.d0, min, max);
        tx = mid.x - pinch.c.x * s;
        ty = mid.y - pinch.c.y * s;
        apply();
      }
    });

    function end(e) {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && e.type === "pointerup") {
        var now = Date.now();
        var near = Math.hypot(e.clientX - tapXY[0], e.clientY - tapXY[1]) < 30;
        if (now - lastTap < 320 && near) {
          if (s > 1.02) zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1);
          else zoomAt(e.clientX, e.clientY, 2.2);
          lastTap = 0;
        } else {
          lastTap = now; tapXY = [e.clientX, e.clientY];
        }
      }
    }
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);

    stage.addEventListener("dblclick", function (e) {
      if (s > 1.02) zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1);
      else zoomAt(e.clientX, e.clientY, 2.2);
    });

    // 挡掉 iOS Safari 的页面捏合
    ["gesturestart", "gesturechange"].forEach(function (t) {
      document.addEventListener(t, function (e) { e.preventDefault(); });
    });

    window.addEventListener("resize", apply);
    apply();

    return {
      get scale() { return s; },
      reset: function () { zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1); },
    };
  }

  window.PanZoom = { attach: attach };
})();
