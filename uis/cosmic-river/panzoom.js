/* ============================================================
 * PanZoom —— 整页拖动 + 缩放（零依赖）
 * ------------------------------------------------------------
 * PanZoom.attach(stageEl, { max, onChange }) → { scale, reset }
 *   滚轮：以光标为锚缩放（1~max）
 *   拖动：放大后整幅平移（画面始终盖满视口，绝不露出底色；
 *         1× 时内容与视口重合，无处可移即不动）
 *   双指：捏合缩放 + 双指拖移
 *   双击 / 双轻点：锚点放大 ↔ 复位归中
 * ============================================================ */
(function () {
  "use strict";

  function attach(stage, opts) {
    opts = opts || {};
    var min = 1, max = opts.max || 4;
    var s = 1, tx = 0, ty = 0;
    var pts = new Map();
    var pinch = null;                      // { d0, s0, mid0, t0, c }
    var mouseDrag = false, lastM = [0, 0]; // 无 PointerEvent 环境的鼠标兜底
    var lastTap = 0, tapXY = [0, 0];
    var zoomTapAt = 0; // pointerup 双击放大时刻——原生 dblclick 紧随其后，须挡掉防二次触发

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function apply() {
      // 铁律：画面任何时刻都盖满视口——tx≤0 且 tx+s·W≥W（右侧同），
      // 因此只有放大后才有可拖余量；1× 内容与视口重合，拖动自然不动
      var rx = (s - 1) * window.innerWidth;
      var ry = (s - 1) * window.innerHeight;
      tx = clamp(tx, -rx, 0);
      ty = clamp(ty, -ry, 0);
      if (s <= 1.001) { tx = 0; ty = 0; s = 1; }
      stage.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
      stage.classList.toggle("dragging", pts.size > 0 || mouseDrag);
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

    function reset() { s = 1; tx = 0; ty = 0; apply(); }

    function down(e) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        var a = [];
        pts.forEach(function (p) { a.push(p); });
        var d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        var mid0 = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        pinch = { d0: d0, s0: s, mid0: mid0, t0: { x: tx, y: ty },
                  c: { x: (mid0.x - tx) / s, y: (mid0.y - ty) / s } };
      }
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
      apply();
    }

    function move(e) {
      if (!pts.has(e.pointerId)) return;
      var p = pts.get(e.pointerId);
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
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
    }

    function up(e) {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && e.type === "pointerup") {
        var now = Date.now();
        var near = Math.hypot(e.clientX - tapXY[0], e.clientY - tapXY[1]) < 30;
        if (now - lastTap < 320 && near) {
          zoomTapAt = now;
          if (s > 1.02) reset(); else zoomAt(e.clientX, e.clientY, 2.2);
          lastTap = 0;
        } else {
          lastTap = now; tapXY = [e.clientX, e.clientY];
        }
      }
      apply();
    }

    if (window.PointerEvent) {
      stage.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    } else {
      // 无 PointerEvent 的老环境：纯鼠标事件兜底
      stage.addEventListener("mousedown", function (e) {
        mouseDrag = true; lastM = [e.clientX, e.clientY]; apply();
      });
      window.addEventListener("mousemove", function (e) {
        if (!mouseDrag) return;
        tx += e.clientX - lastM[0];
        ty += e.clientY - lastM[1];
        lastM = [e.clientX, e.clientY]; apply();
      });
      window.addEventListener("mouseup", function () {
        mouseDrag = false; apply();
      });
    }

    // 滚轮：以光标为锚缩放（capture 挡掉浏览器的页面缩放手势）
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var step = e.deltaMode === 1 ? 0.05 : 0.0016;
      zoomAt(e.clientX, e.clientY, s * Math.exp(-e.deltaY * step));
    }, { passive: false });

    stage.addEventListener("dblclick", function (e) {
      if (Date.now() - zoomTapAt < 600) return; // 这次双击已由 pointerup 处理
      if (s > 1.02) reset();
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
      reset: reset,
    };
  }

  window.PanZoom = { attach: attach };
})();
