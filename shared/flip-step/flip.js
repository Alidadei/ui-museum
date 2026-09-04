/* ============================================================
 * 馆藏原子 原002 · 步入过渡 flip-step
 * ------------------------------------------------------------
 * 零依赖 FLIP 过渡：让同一元素在两个矩形之间连续飞行
 * （放大缩小不重载、不跳切）。界面收藏馆总台的
 * 「步入展厅 / 返回总台」用的就是它。
 *
 * 用法：
 *   1) 先把元素的布局（left/top/width/height 或 CSS 类）设为
 *      目标位置——flipFit 假定"落点即当前布局"；
 *   2) 调用 flipFit(el, firstRect, lastRect, { duration, done })
 *      firstRect 为移动前的 getBoundingClientRect()，
 *      lastRect 为目标矩形；元素会被反向放置并飞行归位。
 *
 * 依赖：无。尊重 prefers-reduced-motion（直接落位不做动画）。
 * ============================================================ */
(function (global) {
  "use strict";

  function flipFit(el, first, last, opts) {
    opts = opts || {};
    var dur = opts.duration || 680;
    var done = opts.done || function () {};
    var dx = first.left - last.left;
    var dy = first.top - last.top;
    var sx = first.width / last.width || 1;
    var sy = first.height / last.height || 1;
    var fired = false;

    var onEnd = function (e) {
      if (e.target === el && e.propertyName === "transform") finish();
    };
    var finish = function () {
      if (fired) return;
      fired = true;
      el.removeEventListener("transitionend", onEnd);
      el.style.transition = "none";
      el.style.transform = "none";
      done();
    };

    if (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    el.style.transition = "none";
    el.style.transformOrigin = opts.origin || "0 0";
    el.style.transform = "translate(" + dx + "px, " + dy + "px) scale(" + sx + ", " + sy + ")";
    void el.offsetWidth; // 强制回流，确保起始帧生效
    el.style.transition = "transform " + dur + "ms cubic-bezier(0.32, 0.72, 0.18, 1)";
    el.style.transform = "translate(0px, 0px) scale(1, 1)";
    el.addEventListener("transitionend", onEnd);
    setTimeout(finish, dur + 150); // 兜底：transitionend 可能不触发
  }

  global.flipFit = flipFit;
})(window);
