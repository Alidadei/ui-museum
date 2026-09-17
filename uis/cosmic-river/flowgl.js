/* ============================================================
 * FlowGL —— 零依赖 WebGL 流场平流层（浏览器内置能力，无库）
 * ------------------------------------------------------------
 * FlowGL.create(canvas, img, flow, opts) →
 *   { render(tSec), resize(x, y, w, h, dpr), destroy } 或 null。
 *
 * flow = { data: Uint8Array(RGBA, 行序=图像顶→底), w, h }
 *   R,G = 流向单位向量（0.5 基线编码）
 *   B   = 运动遮罩（亮处流动、暗处与行人驻足）
 *   A   = 空间相位种子（让各处滑动错峰，不整齐划一）
 *
 * 片元里做标准 flowmap 交叉平流：两份采样沿流向错相滑动、
 * 按三角波交叉加权——整幅图沿河道持续向下游漂移，且每周期
 * 无缝回卷，不撕裂、无接缝。位移幅度很小（几个显示像素），
 * 观感是「星河活着」而非「画面变形」。
 * ============================================================ */
(function () {
  "use strict";

  var VERT =
    "attribute vec2 p;" +
    "varying vec2 v_uv;" +
    "void main(){" +
    "  v_uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);" +
    "  gl_Position = vec4(p, 0.0, 1.0);" +
    "}";
  var FRAG =
    "precision mediump float;" +
    "varying vec2 v_uv;" +
    "uniform sampler2D u_img;" +
    "uniform sampler2D u_flow;" +
    "uniform sampler2D u_loc;" +
    "uniform float u_t;" +
    "uniform float u_cycle;" +
    "uniform vec2 u_amp;" +
    "uniform vec4 u_box;" +
    "uniform vec2 u_flAmp;" +
    "uniform vec2 u_swAmp;" +
    "void main(){" +
    "  vec4 f = texture2D(u_flow, v_uv);" +
    "  vec2 dir = (f.rg - 0.5) * 2.0;" +
    "  float m = f.b;" +
    "  float tt = u_t / u_cycle + f.a;" +
    "  float f0 = fract(tt);" +
    "  float f1 = fract(tt + 0.5);" +
    "  vec2 oA = dir * (f0 - 0.5) * 2.0 * u_amp * m;" +
    "  vec2 oB = dir * (f1 - 0.5) * 2.0 * u_amp * m;" +
    "  vec2 uvL = clamp((v_uv - u_box.xy) / u_box.zw, 0.0, 1.0);" +
    "  vec4 L = texture2D(u_loc, uvL);" +
    "  vec2 robe = (L.rg - 0.5) * 2.0;" +
    "  vec2 shad = (L.ba - 0.5) * 2.0;" +
    "  float fl = sin(u_t * 2.6 + 0.8) + 0.5 * sin(u_t * 4.3 + 2.1);" +
    "  float sw = sin(u_t * 1.15 + 0.5) + 0.35 * sin(u_t * 2.9 + 1.2);" +
    "  vec2 loc = robe * fl * u_flAmp + shad * sw * u_swAmp;" +
    "  oA += loc;" +
    "  oB += loc;" +
    "  vec3 cA = texture2D(u_img, v_uv + oA).rgb;" +
    "  vec3 cB = texture2D(u_img, v_uv + oB).rgb;" +
    "  float wA = abs(f0 * 2.0 - 1.0);" +
    "  gl_FragColor = vec4(mix(cB, cA, wA), 1.0);" +
    "}";

  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error("shader: " + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function makeTex(gl, unit) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  function create(canvas, img, flow, opts) {
    var gl = null;
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false }) ||
           canvas.getContext("experimental-webgl", { alpha: false });
    } catch (e) { gl = null; }
    if (!gl || !gl.createShader) return null;

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    } catch (e) { return null; }
    gl.useProgram(prog);

    // 全屏两三角
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var locP = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    // 原图纹理（不翻转：texel(0,0)=图像左上，配 v_uv 的手写翻转）
    var uImg = makeTex(gl, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    // 流场纹理（行序同样顶→底，与 v_uv 一致）
    var uFlow = makeTex(gl, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, flow.w, flow.h, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, flow.data);
    // 局部动画纹理（衣袂/影子矢量；缺省给 1×1 零纹理兜底）
    var uLoc = makeTex(gl, 2);
    if (opts.locTex) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, opts.locTex.w, opts.locTex.h, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, opts.locTex.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                    new Uint8Array([128, 128, 128, 128]));
    }

    var U = {};
    ["u_img", "u_flow", "u_loc", "u_t", "u_cycle", "u_amp", "u_box", "u_flAmp", "u_swAmp"].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(U.u_img, 0);
    gl.uniform1i(U.u_flow, 1);
    gl.uniform1i(U.u_loc, 2);
    gl.uniform1f(U.u_cycle, opts.cycle || 9);
    gl.uniform2f(U.u_amp, (opts.ampPx || 6) / 100, (opts.ampPx || 6) / 100);
    var b = opts.box || { x: 0, y: 0, w: 1, h: 1 };
    gl.uniform4f(U.u_box, b.x, b.y, b.w, b.h);
    gl.uniform2f(U.u_flAmp, (opts.flAmpPx || 0) / 100, (opts.flAmpPx || 0) / 100);
    gl.uniform2f(U.u_swAmp, (opts.swAmpPx || 0) / 100, (opts.swAmpPx || 0) / 100);

    var dead = false;
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      dead = true;
      if (opts.onLost) opts.onLost();
    });

    return {
      // 把画布钉到图像显示矩形上；w/h 为显示像素
      resize: function (x, y, w, h, dpr) {
        if (dead) return;
        dpr = Math.min(dpr || 1, 1.5);
        canvas.width = Math.max(2, Math.round(w * dpr));
        canvas.height = Math.max(2, Math.round(h * dpr));
        canvas.style.display = "block";
        canvas.style.left = x + "px";
        canvas.style.top = y + "px";
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(U.u_amp, (opts.ampPx || 6) / w, (opts.ampPx || 6) / h);
        gl.uniform2f(U.u_flAmp, (opts.flAmpPx || 0) / w, (opts.flAmpPx || 0) / h);
        gl.uniform2f(U.u_swAmp, (opts.swAmpPx || 0) / w, (opts.swAmpPx || 0) / h);
      },
      render: function (tSec) {
        if (dead) return;
        gl.uniform1f(U.u_t, tSec);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      destroy: function () {
        dead = true;
        canvas.style.display = "none";
        try {
          var ext = gl.getExtension("WEBGL_lose_context");
          if (ext) ext.loseContext();
        } catch (e) { /* 忽略 */ }
      },
    };
  }

  window.FlowGL = { create: create };
})();
