# -*- coding: utf-8 -*-
"""FlowGL 片元着色器的 numpy 仿真：逐像素复算 flowmap 交叉平流，
验证 ①底部流线确实在动 ②河心行人基本驻足 ③位移不撕裂。
用法：python tests/flow-preview.py  →  tests/flow-check.png
"""
import numpy as np
from PIL import Image

SRC = "uis/cosmic-river/cosmos.jpg"
VW, VH = 1280, 800
AMP_PX = 6.0
CYCLE = 9.0
SW = 96

img = Image.open(SRC).convert("RGB")
iw, ih = img.size
scale = VH / ih
rect_w, rect_x = iw * scale, (VW - iw * scale) / 2
disp = np.asarray(img.resize((round(rect_w), VH), Image.LANCZOS)).astype(np.float64)
H, W = disp.shape[:2]

# ---- 亮度场（与 computeField 同式：SW 宽降采样 + 2×盒滤波 + 梯度转 90°）----
small = np.asarray(img.resize((SW, round(SW * ih / iw)), Image.LANCZOS)).astype(np.float64)
fw, fh = SW, small.shape[0]
lum_s = (0.2126 * small[..., 0] + 0.7152 * small[..., 1] + 0.0722 * small[..., 2]) / 255.0

def box(a):
    p = np.pad(a, 1, mode="edge")
    s = np.zeros_like(a)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            s += p[dy:dy + fh, dx:dx + fw]
    return s / 9.0

sm = box(box(lum_s))
gx = np.gradient(sm, axis=1)
gy = np.gradient(sm, axis=0)
px, py = -gy, gx
flip = py < 0
px[flip], py[flip] = -px[flip], -py[flip]
mag = np.sqrt(px * px + py * py)
ok = mag > 1e-3
px = np.where(ok, px / np.maximum(mag, 1e-9), 0.0)
py = np.where(ok, py / np.maximum(mag, 1e-9), 0.55)
mask = np.clip((sm - 0.22) / 0.28, 0, 1)
yy, xx = np.mgrid[0:fh, 0:fw]
du = (xx + 0.5) / fw - 0.593
dv = (yy + 0.5) / fh - 0.502
pd = np.sqrt((du / 0.05) ** 2 + (dv / 0.062) ** 2)
mask = mask * np.where(pd < 1, 0.0, np.where(pd < 1.5, (pd - 1) / 0.5, 1.0))
phase = (np.sin((xx + 0.5) * 12.9898 + (yy + 0.5) * 78.233) * 43758.5453) % 1.0

def field_at(u, v):
    x = np.clip(u, 0, 1) * (fw - 1)
    y = np.clip(v, 0, 1) * (fh - 1)
    x0 = np.clip(x.astype(int), 0, fw - 2); y0 = np.clip(y.astype(int), 0, fh - 2)
    tx, ty = x - x0, y - y0
    def bl(a):
        return (a[y0, x0] * (1 - tx) + a[y0, x0 + 1] * tx) * (1 - ty) + \
               (a[y0 + 1, x0] * (1 - tx) + a[y0 + 1, x0 + 1] * tx) * ty
    return bl(px), bl(py), bl(mask), bl(phase)

# ---- 着色器仿真 ----
def shade(t):
    u = np.linspace(0, 1, W)[None, :].repeat(H, 0)
    v = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    fx, fy, m, ph = field_at(u, v)
    tt = t / CYCLE + ph
    f0 = tt % 1.0
    f1 = (tt + 0.5) % 1.0
    ax = fx * (f0 - 0.5) * 2 * AMP_PX * m / rect_w
    ay = fy * (f0 - 0.5) * 2 * AMP_PX * m / VH
    bx = fx * (f1 - 0.5) * 2 * AMP_PX * m / rect_w
    by = fy * (f1 - 0.5) * 2 * AMP_PX * m / VH
    xs = np.arange(W)[None, :].repeat(H, 0).astype(float)
    ys = np.arange(H)[:, None].repeat(W, 1).astype(float)

    def samp(ox, oy):
        sx = np.clip(xs + ox, 0, W - 1.001); sy = np.clip(ys + oy, 0, H - 1.001)
        x0 = sx.astype(int); y0 = sy.astype(int)
        tx, ty = sx - x0, sy - y0
        out = np.zeros((H, W, 3))
        for c in range(3):
            ch = disp[..., c]
            out[..., c] = (ch[y0, x0] * (1 - tx) + ch[y0, x0 + 1] * tx) * (1 - ty) + \
                          (ch[y0 + 1, x0] * (1 - tx) + ch[y0 + 1, x0 + 1] * tx) * ty
        return out

    wA = np.abs(f0 * 2 - 1)[..., None]
    return samp(ax * W, ay * H) * wA + samp(bx * W, by * H) * (1 - wA)

# 底部流线区：原图 y∈[0.55,1.0]（rect 内坐标，W=rect_w）
bot_o = disp[int(VH * 0.55):, :]
bot_a = shade(3.0)[int(VH * 0.55):, :]
bot_b = shade(3.0 + CYCLE / 4)[int(VH * 0.55):, :]
# 行人区：图像归一 (0.53-0.66, 0.44-0.545)，rect 内坐标
py0, py1 = int(VH * 0.44), int(VH * 0.545)
px0, px1 = int(rect_w * 0.53), int(rect_w * 0.66)
per_o = disp[py0:py1, px0:px1]
per_a = shade(3.0)[py0:py1, px0:px1]

gap = np.full((bot_o.shape[0], 6, 3), 40.0)
rows = np.concatenate([bot_o, gap, bot_a, gap, bot_b], axis=1)
Image.fromarray(np.clip(rows, 0, 255).astype(np.uint8)).save("tests/flow-check-bottom.png")

z = 3
prow = np.concatenate([per_o, np.full((per_o.shape[0], 5, 3), 40.0), per_a], axis=1)
Image.fromarray(np.clip(prow, 0, 255).astype(np.uint8)).resize(
    (prow.shape[1] * z, prow.shape[0] * z), Image.NEAREST).save("tests/flow-check-person.png")

d_bot = np.abs(bot_a - bot_o).mean()
d_per = np.abs(per_a - per_o).mean()
print(f"底部流线区平均变化: {d_bot:.2f}/255（应明显>0）")
print(f"行人区平均变化: {d_per:.2f}/255（应远小于底部）")
print("saved tests/flow-check-bottom.png / tests/flow-check-person.png")
