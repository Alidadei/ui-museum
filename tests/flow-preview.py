# -*- coding: utf-8 -*-
"""FlowGL 片元着色器的 numpy 仿真：逐像素复算 flowmap 交叉平流，
验证 ①底部流线确实在动 ②河心行人基本驻足 ③位移不撕裂。
用法：python tests/flow-preview.py  →  tests/flow-check.png
"""
import numpy as np
from PIL import Image

SRC = "uis/cosmic-river/cosmos.jpg"
VW, VH = 1280, 800
AMP_PX = 3.5   # 轻烟沿河漂移
CYCLE = 16.0  # 烟带回卷周期
WAVER_PX = 1.2
DISS = 0.22
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
mask = np.zeros_like(sm)
b12 = (sm >= 0.06) & (sm < 0.12); mask[b12] = (sm[b12] - 0.06) / 0.06
b22 = (sm >= 0.12) & (sm < 0.22); mask[b22] = 1.0
b34 = (sm >= 0.22) & (sm < 0.34); mask[b34] = 1 - (sm[b34] - 0.22) / 0.12
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

# ---- 局部动画场（与 buildLocalTexture 同式）：衣袂 RG + 影子 BA ----
BOX = dict(x=0.505, y=0.455, w=0.16, h=0.13)
LTW, LTH = 160, 208
fullres = np.asarray(img).astype(np.float64)
Lf = (0.2126 * fullres[..., 0] + 0.7152 * fullres[..., 1] + 0.0722 * fullres[..., 2]) / 255.0
lx = BOX["x"] + (np.arange(LTW) + 0.5) / LTW * BOX["w"]
ly = BOX["y"] + (np.arange(LTH) + 0.5) / LTH * BOX["h"]
Lu = lx[None, :].repeat(LTH, 0)
Lv = ly[:, None].repeat(LTW, 1)
Lx = np.clip((Lu * iw).astype(int), 0, iw - 1)
Ly = np.clip((Lv * ih).astype(int), 0, ih - 1)
lumL = Lf[Ly, Lx]
dark = np.clip((0.45 - lumL) / 0.15, 0, 1)
darkS = np.clip((0.5 - lumL) / 0.2, 0, 1)
robeRamp = np.clip((Lv - 0.4885) / 0.0125, 0, 1)
robeBand = ((Lu > 0.565) & (Lu < 0.612) & (Lv > 0.482) & (Lv < 0.506)).astype(float)
dirR = np.array([0.94, 0.34]); dirR /= np.linalg.norm(dirR)
robeV = np.stack([dirR[0] * robeRamp * dark * robeBand,
                  dirR[1] * robeRamp * dark * robeBand], axis=-1)
feet = np.array([0.587, 0.500])
du = Lu - feet[0]; dv = Lv - feet[1]
dirS = np.array([-0.84, 0.55]); dirS /= np.linalg.norm(dirS)
along = du * dirS[0] + dv * dirS[1]
lat = np.abs(du * dirS[1] - dv * dirS[0])
swRamp = np.clip(along / 0.022, 0, 1) * np.clip(1 - lat / 0.016, 0, 1)
swWindow = ((along > -0.004) & (along < 0.03) & (lat < 0.016)).astype(float)
shadV = np.stack([dirS[0] * swRamp * darkS * swWindow,
                  dirS[1] * swRamp * darkS * swWindow], axis=-1)
# 箱缘渐隐
ex = np.minimum(np.minimum((np.arange(LTW) + 1) / 8, (LTW - np.arange(LTW)) / 8), 1)
ey = np.minimum(np.minimum((np.arange(LTH) + 1) / 8, (LTH - np.arange(LTH)) / 8), 1)
fadeL = np.minimum(ex[None, :].repeat(LTH, 0), ey[:, None].repeat(LTW, 1))
robeV *= fadeL[..., None]; shadV *= fadeL[..., None]

def loc_at(u, v):
    x = np.clip((u - BOX["x"]) / BOX["w"], 0, 1) * (LTW - 1)
    y = np.clip((v - BOX["y"]) / BOX["h"], 0, 1) * (LTH - 1)
    x0 = np.clip(x.astype(int), 0, LTW - 2); y0 = np.clip(y.astype(int), 0, LTH - 2)
    tx, ty = x - x0, y - y0
    def bl2(a):
        return (a[y0, x0] * (1 - tx[..., None]) + a[y0, x0 + 1] * tx[..., None]) * (1 - ty[..., None]) + \
               (a[y0 + 1, x0] * (1 - tx[..., None]) + a[y0 + 1, x0 + 1] * tx[..., None]) * ty[..., None]
    return bl2(robeV), bl2(shadV)

# ---- 着色器仿真 ----
FL_AMP = 2.3
SW_AMP = 3.4
u = np.linspace(0, 1, W)[None, :].repeat(H, 0)
v = np.linspace(0, 1, H)[:, None].repeat(W, 1)
robeU, shadU = loc_at(u, v)

def shade(t):
    fx, fy, m, ph = field_at(u, v)
    tt = t / CYCLE + ph
    f0 = tt % 1.0
    f1 = (tt + 0.5) % 1.0
    ax = fx * (f0 - 0.5) * 2 * AMP_PX * m / rect_w
    ay = fy * (f0 - 0.5) * 2 * AMP_PX * m / VH
    bx = fx * (f1 - 0.5) * 2 * AMP_PX * m / rect_w
    by = fy * (f1 - 0.5) * 2 * AMP_PX * m / VH
    fl = np.sin(t * 2.6 + 0.8) + 0.5 * np.sin(t * 4.3 + 2.1)
    sw = np.sin(t * 1.15 + 0.5) + 0.35 * np.sin(t * 2.9 + 1.2)
    ax = ax + robeU[..., 0] * fl * FL_AMP / rect_w + shadU[..., 0] * sw * SW_AMP / rect_w
    ay = ay + robeU[..., 1] * fl * FL_AMP / VH + shadU[..., 1] * sw * SW_AMP / VH
    bx = bx + robeU[..., 0] * fl * FL_AMP / rect_w + shadU[..., 0] * sw * SW_AMP / rect_w
    by = by + robeU[..., 1] * fl * FL_AMP / VH + shadU[..., 1] * sw * SW_AMP / VH
    perx = -fy; pery = fx
    wv = np.sin(t * 0.7 + ph * 6.2831) * WAVER_PX * m
    ax = ax + perx * wv / rect_w; ay = ay + pery * wv / VH
    bx = bx + perx * wv / rect_w; by = by + pery * wv / VH
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
    col = samp(ax * W, ay * H) * wA + samp(bx * W, by * H) * (1 - wA)
    diss = (0.5 + 0.5 * np.sin(t * 0.55 + ph * 6.2831)) * m * DISS
    return col * (1 - diss[..., None]) + np.array([2.0, 2.0, 5.0]) * diss[..., None]

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

# 衣袂/影子多相位对比（3 相位竖排，验证布料摆动与影子伸缩）
def crop_reg(t):
    fr = shade(t)
    ca, cb = int(rect_w * 0.50), int(rect_w * 0.65)
    robe = fr[int(VH * 0.482):int(VH * 0.508), ca:cb]
    shad = fr[int(VH * 0.496):int(VH * 0.528), ca:cb]
    return np.concatenate([robe, np.full((5, cb - ca, 3), 40.0), shad], axis=0)

ph1 = crop_reg(0.8)
ph2 = crop_reg(2.6)
ph3 = crop_reg(4.4)
gw = np.full((ph1.shape[0], 6, 3), 40.0)
tri = np.concatenate([ph1, gw, ph2, gw, ph3], axis=1)
Image.fromarray(np.clip(tri, 0, 255).astype(np.uint8)).resize(
    (tri.shape[1] * 3, tri.shape[0] * 3), Image.NEAREST).save("tests/flow-check-robe-shadow.png")

d_bot = np.abs(bot_a - bot_o).mean()
d_per = np.abs(per_a - per_o).mean()
robe_d = np.abs(shade(0.8) - shade(2.6))[int(VH * 0.482):int(VH * 0.508), int(rect_w * 0.55):int(rect_w * 0.65)].mean()
shad_d = np.abs(shade(0.8) - shade(2.6))[int(VH * 0.496):int(VH * 0.528), int(rect_w * 0.50):int(rect_w * 0.62)].mean()
head_d = np.abs(shade(0.8) - shade(2.6))[int(VH * 0.472):int(VH * 0.4865), int(rect_w * 0.575):int(rect_w * 0.6)].mean()
print(f"底部流线区平均变化: {d_bot:.2f}/255（应明显>0）")
print(f"行人区平均变化: {d_per:.2f}/255（应远小于底部）")
print(f"衣袂区相位间变化: {robe_d:.2f}/255（应>0）")
print(f"影子区相位间变化: {shad_d:.2f}/255（应>0）")
print(f"头部区相位间变化: {head_d:.2f}/255（应≈0，头要稳）")
print("saved tests/flow-check-bottom.png / tests/flow-check-person.png / tests/flow-check-robe-shadow.png")
# 紧凑人像六联（3 相位 x [全身/影子]）
def crop_fig(t):
    fr = shade(t)
    ca, cb = int(rect_w * 0.545), int(rect_w * 0.635)
    full = fr[int(VH * 0.462):int(VH * 0.535), ca:cb]
    return full
z6 = 6
f1, f2, f3 = crop_fig(0.8), crop_fig(2.6), crop_fig(4.4)
g6 = np.full((f1.shape[0], 4, 3), 40.0)
fig = np.concatenate([f1, g6, f2, g6, f3], axis=1)
Image.fromarray(np.clip(fig, 0, 255).astype(np.uint8)).resize(
    (fig.shape[1] * z6, fig.shape[0] * z6), Image.NEAREST).save("tests/flow-check-figure6.png")
print("saved tests/flow-check-figure6.png")
