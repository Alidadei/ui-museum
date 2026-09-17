# -*- coding: utf-8 -*-
"""两翼星域合成预览器：与 uis/cosmic-river/cosmos.js 的 buildWings 逐位同构。
不依赖浏览器，直接在真实像素上渲染桌面全景效果，供肉眼审核接缝质量。
用法：python tests/wing-preview.py  →  输出 tests/preview-1280x800.png 及两张接缝特写
"""
import math, random, sys
import numpy as np
from PIL import Image

SRC = "uis/cosmic-river/cosmos.jpg"
VW = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
VH = int(sys.argv[2]) if len(sys.argv) > 2 else 800
TAGOUT = f"-{VW}x{VH}" if len(sys.argv) > 1 else ""
WING_MIN_SIDE = 220

img = Image.open(SRC).convert("RGB")
iw, ih = img.size            # 1206×2134
scale = VH / ih
rect_w = iw * scale          # 452
rect_x = (VW - rect_w) / 2   # 414
sideW = rect_x

disp = img.resize((round(rect_w), VH), Image.LANCZOS)
disp_np = np.asarray(disp).astype(np.float64)  # (H,W,3)


def lum(a):
    return (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]) / 255.0


# ---------- 边缘底色（与 edgeTone 同式：边缘 4px 里 L<0.12 的均值） ----------
def edge_tone(x0):
    cols = np.asarray(img).astype(np.float64)[:, x0:min(x0 + 4, iw), :]
    L = lum(cols)
    mask = L < 0.12
    if not mask.any():
        return np.array([1.0, 1.0, 3.0])
    return cols[mask].mean(axis=0)


toneL = edge_tone(0)
toneR = edge_tone(max(0, iw - 4))

# ---------- 孤立星提取（与 extractSprites 同式） ----------
full = np.asarray(img).astype(np.float64)
Lf = lum(full)
sprites = []  # (patch ndarray 15x15x3)
R = 7
y = R
found = 0
while y < ih - R and found < 160:
    x = R
    while x < iw - R and found < 160:
        if Lf[y, x] >= 0.5:
            ys, xs = slice(y - R, y + R + 1, 2), slice(x - R, x + R + 1, 2)
            border = Lf[ys, xs].mean()  # 步长2的8x8邻域，中心0不在格点上，全为邻居
            if border <= 0.16:
                patch = full[y - 7:y + 8, x - 7:x + 8, :].copy()
                # 径向羽化（与 cosmos.js 同式）：补丁背景非纯黑，不羽化会贴出方块
                yy2, xx2 = np.mgrid[0:15, 0:15]
                r2 = np.sqrt((xx2 - 7.5) ** 2 + (yy2 - 7.5) ** 2) / 7.5
                m = np.where(r2 <= 0.55, 1.0, np.where(r2 >= 1.0, 0.0, 0.85 * (1 - (r2 - 0.55) / 0.45)))
                sprites.append(patch * m[..., None])
                found += 1
                x += 10
                y_local = True
        x += 7
    y += 7
print("sprites:", len(sprites), "sideW:", round(sideW, 1), "scale:", round(scale, 4))

# ---------- mulberry32（与 JS 逐位一致） ----------
A = 20260917
def rnd():
    global A
    A = (A + 0x6D2B79F5) & 0xFFFFFFFF
    t = A
    t = ((t ^ (t >> 15)) * (1 | A)) & 0xFFFFFFFF
    t = ((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF
    t = (t ^ (t >> 14)) & 0xFFFFFFFF
    return t / 4294967296.0


# ---------- 组装 ----------
canvas = np.zeros((VH, VW, 3), dtype=np.float64)
wing_l = int(round(rect_x))
wing_r0 = int(round(rect_x + rect_w))
wing_r1 = VW - wing_r0

# 镜像延展条的渐隐 alpha（与 stops 同式；左翼条长渐隐缓，右翼短促防人影穿帮）
def fade_alpha(t, gentle):  # t∈[0,1] 外缘→接缝
    if t <= 0.0: return 0.0
    if t >= 1.0: return 1.0
    if gentle:   # 接缝在 t=1：0 →(0.6)0.3 → 1
        return t / 0.6 * 0.3 if t <= 0.6 else 0.3 + (t - 0.6) / 0.4 * 0.7
    #            接缝在 t=0：1 →(0.45)0.25 → 0
    return (1 - t / 0.45 * 0.75) if t <= 0.45 else 0.25 * (1 - (t - 0.45) / 0.55)

for dir_ in (-1, 1):
    seamX = rect_x if dir_ < 0 else rect_x + rect_w
    gentle = dir_ < 0
    # 条深上限按源像素安全距离折算（右 408 / 左 700，人影在图内 x≈0.6），
    # 随视口等比生长、巨屏不缩成窄领
    strip = min(700 * scale, sideW * 0.55) if gentle else min(408 * scale, sideW * 0.5)
    strip = max(strip, min(120, sideW * 0.5))
    strip = int(round(strip))
    # 底色
    tone = toneL if dir_ < 0 else toneR
    x0 = 0 if dir_ < 0 else int(seamX)
    canvas[:, x0:x0 + (wing_l if dir_ < 0 else wing_r1), :] = tone

    # 镜像延展条（display 域：直接镜像显示图的外缘 strip 列）
    # alpha 数组 t=0 是外缘(fade=0)、t=strip-1 是接缝(fade=1)；
    # 左翼区域 col0=外缘 → 直接用；右翼区域 col0=接缝 → 反转
    strip_img = disp_np[:, :strip, :] if dir_ < 0 else disp_np[:, -strip:, :]
    cols = strip_img[:, ::-1, :]
    # 横向涂抹（缩 1/8 再拉回）：抹掉可辨认结构，只留亮度余晖
    hh, ww = cols.shape[:2]
    small = Image.fromarray(np.clip(cols, 0, 255).astype(np.uint8)).resize((max(2, strip // 8), max(2, hh // 8)), Image.LANCZOS)
    cols = np.asarray(small.resize((strip, hh), Image.BILINEAR)).astype(np.float64)
    alphas = np.array([fade_alpha(t / (strip - 1), gentle) for t in range(strip)])
    if dir_ < 0:
        a = alphas[None, :, None]
        region = canvas[:, int(seamX - strip):int(seamX), :]
        canvas[:, int(seamX - strip):int(seamX), :] = region * (1 - a) + cols * a
    else:
        a = alphas[None, ::-1, None]              # col0=接缝侧=1
        region = canvas[:, int(seamX):int(seamX) + strip, :]
        canvas[:, int(seamX):int(seamX) + strip, :] = region * (1 - a) + cols * a

    # 雾气（巨屏三片，与 cosmos.js 同式）
    haze_n = 3 if sideW > 700 else 2
    for _ in range(haze_n):
        hr = 160 + rnd() * 260
        budget = max(0.0, sideW - strip * 0.7 - hr * 0.5)
        hx = seamX + dir_ * (strip * 0.7 + rnd() * budget)
        hy = rnd() * VH
        x_lo, x_hi = max(0, int(hx - hr)), min(VW, int(hx + hr))
        y_lo, y_hi = max(0, int(hy - hr)), min(VH, int(hy + hr))
        if x_lo >= x_hi or y_lo >= y_hi:
            continue
        yy, xx = np.mgrid[y_lo:y_hi, x_lo:x_hi]
        r2 = np.sqrt((xx - hx) ** 2 + (yy - hy) ** 2) / hr
        a = np.clip(1 - r2, 0, 1) * 0.065
        region = canvas[y_lo:y_hi, x_lo:x_hi, :]
        tint = np.array([150.0, 165.0, 205.0])
        canvas[y_lo:y_hi, x_lo:x_hi, :] = region * (1 - a[..., None]) + tint * a[..., None]

    # 播种
    zoneW = max(40, sideW - strip)
    count = round(sideW * VH / 3800)
    for _ in range(count):
        spr = sprites[int(rnd() * len(sprites))]
        dx = strip * 0.35 + rnd() * zoneW
        sy = rnd() * VH
        sc = 0.5 + rnd() * 0.9
        pa = 0.3 + rnd() * 0.6
        rnd(); rnd(); rnd()  # period / phase / 预览取固定相位，消耗掉保持序列一致
        sx = seamX + dir_ * dx
        w = max(1, int(round(15 * sc)))
        patch = np.asarray(Image.fromarray(spr.astype(np.uint8)).resize((w, w), Image.LANCZOS)).astype(np.float64)
        alpha = pa * (0.3 + 0.7 * 0.65)
        x_lo, x_hi = int(sx - w // 2), int(sx - w // 2) + w
        y_lo, y_hi = int(sy - w // 2), int(sy - w // 2) + w
        xl, xh = max(0, x_lo), min(VW, x_hi)
        yl, yh = max(0, y_lo), min(VH, y_hi)
        if xl >= xh or yl >= yh:
            continue
        p = patch[yl - y_lo:yh - y_lo, xl - x_lo:xh - x_lo, :]
        canvas[yl:yh, xl:xh, :] += p * alpha  # lighter 加法

# 贴上本体
canvas[:, wing_l:wing_r0, :] = disp_np
out = np.clip(canvas, 0, 255).astype(np.uint8)
Image.fromarray(out).save(f"tests/preview{TAGOUT}.png")
print(f"saved tests/preview{TAGOUT}.png")

# 接缝特写（左右各一张，2× 放大）
for name, cx in (("left", int(rect_x)), ("right", int(rect_x + rect_w))):
    lo, hi = max(0, cx - 90), min(VW, cx + 90)
    crop = out[:, lo:hi, :]
    big = Image.fromarray(crop).resize((crop.shape[1] * 2, crop.shape[0] * 2), Image.NEAREST)
    big.save(f"tests/preview-seam-{name}{TAGOUT}.png")
    print(f"saved tests/preview-seam-{name}{TAGOUT}.png (x{cx})")
