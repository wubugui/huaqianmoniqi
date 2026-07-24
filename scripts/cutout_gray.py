#!/usr/bin/env python3
"""生产级灰底抠图：统一画布、脚底锚点、头像构图、去灰雾。"""
from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def fit_local_bg(rgb: np.ndarray, border: int = 14) -> np.ndarray:
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    xn = xx / max(w - 1, 1)
    yn = yy / max(h - 1, 1)
    mask = np.zeros((h, w), dtype=bool)
    mask[:border, :] = True
    mask[-border:, :] = True
    mask[:, :border] = True
    mask[:, -border:] = True
    A = np.stack(
        [np.ones(h * w), xn.ravel(), yn.ravel(), xn.ravel() ** 2, yn.ravel() ** 2, xn.ravel() * yn.ravel()],
        axis=1,
    )
    bg = np.zeros_like(rgb, dtype=np.float64)
    for c in range(3):
        y = rgb[:, :, c].astype(np.float64).ravel()
        m = mask.ravel()
        coef, *_ = np.linalg.lstsq(A[m], y[m], rcond=None)
        bg[:, :, c] = (A @ coef).reshape(h, w)
    return bg


def flood_bg(seed_mask: np.ndarray) -> np.ndarray:
    h, w = seed_mask.shape
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if seed_mask[y, x] and not visited[y, x]:
                q.append((y, x))
                visited[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if seed_mask[y, x] and not visited[y, x]:
                q.append((y, x))
                visited[y, x] = True
    while q:
        cy, cx = q.popleft()
        for ny in range(cy - 1, cy + 2):
            for nx in range(cx - 1, cx + 2):
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and seed_mask[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))
    return visited


def alpha_bbox(alpha: np.ndarray, thr: float = 0.08):
    ys, xs = np.where(alpha > thr)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def cutout_rgba(path: Path, thr: float = 24.0, max_side: int = 900) -> Image.Image:
    img = Image.open(path).convert("RGB")
    if max(img.size) > max_side:
        s = max_side / max(img.size)
        img = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.Resampling.LANCZOS)

    rgb = np.asarray(img).astype(np.float64)
    bg = fit_local_bg(rgb)
    dist = np.linalg.norm(rgb - bg, axis=2)
    luma = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    bg_luma = 0.2126 * bg[:, :, 0] + 0.7152 * bg[:, :, 1] + 0.0722 * bg[:, :, 2]
    luma_diff = np.abs(luma - bg_luma)

    alpha = np.clip((dist - 5.0) / thr, 0.0, 1.0)
    alpha = np.maximum(alpha, np.clip((luma_diff - 14.0) / 34.0, 0.0, 1.0) * 0.92)

    seed = dist < thr * 0.9
    bg_conn = flood_bg(seed)
    alpha = np.where(bg_conn & (alpha < 0.58), 0.0, alpha)
    alpha = np.where(bg_conn & (dist < thr * 0.42), 0.0, alpha)

    # 去孤立噪点
    hard = alpha > 0.2
    labeled = _label_fast(hard)
    if labeled.max() > 0:
        counts = np.bincount(labeled.ravel())
        counts[0] = 0
        keep = int(counts.argmax())
        alpha = np.where(labeled == keep, alpha, 0.0)

    alpha_img = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), mode="L")
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.55))
    alpha = np.asarray(alpha_img).astype(np.float64) / 255.0

    a = alpha[:, :, None]
    fg = np.clip((rgb - bg * (1.0 - a)) / np.maximum(a, 1e-4), 0, 255)
    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, mode="RGBA")


def _label_fast(binary: np.ndarray) -> np.ndarray:
    h, w = binary.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    for y in range(h):
        for x in range(w):
            if not binary[y, x] or labels[y, x]:
                continue
            current += 1
            stack = [(y, x)]
            labels[y, x] = current
            while stack:
                cy, cx = stack.pop()
                for ny in (cy - 1, cy, cy + 1):
                    for nx in (cx - 1, cx, cx + 1):
                        if 0 <= ny < h and 0 <= nx < w and binary[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = current
                            stack.append((ny, nx))
    return labels


def normalize_portrait(rgba: Image.Image, size: int = 512, top_bias: float = 0.42) -> Image.Image:
    """头像：按 alpha bbox 裁切，脸偏上居中，统一正方形。"""
    arr = np.asarray(rgba).astype(np.float64)
    alpha = arr[:, :, 3] / 255.0
    box = alpha_bbox(alpha, 0.1)
    if not box:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    pad = int(0.08 * max(bw, bh))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgba.width - 1, x1 + pad), min(rgba.height - 1, y1 + pad)
    crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))

    side = int(max(crop.width, crop.height) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    # 垂直：主体中心略偏上（头像构图）
    ox = (side - crop.width) // 2
    cy = int(side * top_bias - crop.height * 0.45)
    oy = max(0, min(side - crop.height, cy))
    canvas.paste(crop, (ox, oy), crop)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def find_foot_y(alpha: np.ndarray, thr: float = 0.28) -> int:
    """中轴带找脚底：从下往上，连续实心行的上沿底部。"""
    h, w = alpha.shape
    x0, x1 = int(w * 0.28), int(w * 0.72)
    band = alpha[:, x0:x1]
    # 先找最底有像素的行
    bottom = None
    for y in range(h - 1, -1, -1):
        if np.mean(band[y] > thr) > 0.04:
            bottom = y
            break
    if bottom is None:
        box = alpha_bbox(alpha, 0.1)
        return box[3] if box else h - 1
    # 再往上扫一小段，取“脚掌厚度”中心偏下
    top = bottom
    for y in range(bottom, max(-1, bottom - int(h * 0.08)), -1):
        if np.mean(band[y] > thr) > 0.04:
            top = y
        else:
            break
    return int(bottom - (bottom - top) * 0.15)


def normalize_unit(rgba: Image.Image, size: int = 256, foot_margin: float = 0.06) -> tuple[Image.Image, dict]:
    """单位：脚底中心锚点。先保留完整 bbox，再把脚点映射到固定锚线。"""
    arr = np.asarray(rgba).astype(np.float64)
    alpha = arr[:, :, 3] / 255.0
    box = alpha_bbox(alpha, 0.08)
    if not box:
        empty = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        return empty, {"anchor": [0.5, 1.0 - foot_margin]}
    x0, y0, x1, y1 = box
    pad = int(0.05 * max(x1 - x0 + 1, y1 - y0 + 1))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgba.width - 1, x1 + pad), min(rgba.height - 1, y1 + pad)
    crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))
    crop_a = np.asarray(crop)[:, :, 3] / 255.0
    foot_local = find_foot_y(crop_a)

    # 以脚点为基准缩放：脚点到头顶的高度占画布主体
    headroom = foot_local + 1
    target_body = size * (1.0 - foot_margin - 0.03)
    scale = min((size * 0.90) / max(1, crop.width), target_body / max(1, headroom))
    nw = max(1, int(crop.width * scale))
    nh = max(1, int(crop.height * scale))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    foot_scaled = foot_local * scale

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - nw) // 2
    foot_px = size * (1.0 - foot_margin)
    oy = int(round(foot_px - foot_scaled))
    # 画布外裁剪粘贴，保证脚点落在锚线
    src_x0 = max(0, -ox)
    src_y0 = max(0, -oy)
    dst_x0 = max(0, ox)
    dst_y0 = max(0, oy)
    src_x1 = min(nw, size - ox)
    src_y1 = min(nh, size - oy)
    if src_x1 > src_x0 and src_y1 > src_y0:
        part = scaled.crop((src_x0, src_y0, src_x1, src_y1))
        canvas.paste(part, (dst_x0, dst_y0), part)
    meta = {
        "anchor": [0.5, 1.0 - foot_margin],
        "content": [dst_x0 / size, dst_y0 / size, (dst_x0 + part.width) / size, (dst_y0 + part.height) / size]
        if src_x1 > src_x0 and src_y1 > src_y0 else [0, 0, 1, 1],
        "foot_y": 1.0 - foot_margin,
    }
    return canvas, meta


def contact_sheet(processed: Image.Image, out_path: Path, title: str) -> None:
    cell = 200
    backgrounds = [
        ("checker", None),
        ("gray50", (128, 128, 128)),
        ("white", (255, 255, 255)),
        ("black", (0, 0, 0)),
        ("red", (220, 30, 30)),
        ("blue", (30, 80, 220)),
        ("green", (30, 160, 80)),
        ("map", (40, 70, 45)),
    ]
    cols, rows = 4, 2
    sheet = Image.new("RGB", (cols * cell, rows * cell + 30), (36, 38, 42))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), f"{title} {processed.size[0]}x{processed.size[1]}", fill=(235, 235, 235))
    for i, (name, color) in enumerate(backgrounds):
        r, c = divmod(i, cols)
        x, y = c * cell, 30 + r * cell
        if color is None:
            tile = Image.new("RGB", (cell - 8, cell - 8), (170, 170, 170))
            td = ImageDraw.Draw(tile)
            for yy in range(0, cell, 14):
                for xx in range(0, cell, 14):
                    if (xx // 14 + yy // 14) % 2 == 0:
                        td.rectangle([xx, yy, xx + 13, yy + 13], fill=(90, 90, 90))
        else:
            tile = Image.new("RGB", (cell - 8, cell - 8), color)
        p = processed.resize((cell - 28, cell - 28), Image.Resampling.LANCZOS)
        tile.paste(p, (10, 10), p)
        # 脚锚点十字
        if "unit" in title or "building" in title or "mob" in title:
            ax, ay = cell // 2 - 4, int((cell - 8) * 0.94)
            td = ImageDraw.Draw(tile)
            td.line([(ax - 8, ay), (ax + 8, ay)], fill=(255, 220, 80), width=2)
            td.line([(ax, ay - 8), (ax, ay + 8)], fill=(255, 220, 80), width=2)
        sheet.paste(tile, (x + 4, y + 4))
        draw.text((x + 8, y + cell - 18), name, fill=(220, 220, 220))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def process_one(src: Path, dst: Path, mode: str, size: int, qa: Path | None, meta_path: Path | None):
    rgba = cutout_rgba(src)
    meta = {}
    if mode == "portrait":
        out = normalize_portrait(rgba, size=size)
        meta = {"mode": "portrait", "anchor": [0.5, 0.55]}
    else:
        out, meta = normalize_unit(rgba, size=size)
        meta["mode"] = mode
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    if qa:
        contact_sheet(out, qa, title=dst.stem)
    if meta_path:
        meta_path.parent.mkdir(parents=True, exist_ok=True)
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"OK [{mode}] {src.name} -> {dst}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, required=True)
    ap.add_argument("--dst", type=Path, required=True)
    ap.add_argument("--mode", choices=["portrait", "unit", "building"], default="portrait")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--qa", type=Path, default=None)
    ap.add_argument("--meta", type=Path, default=None)
    ap.add_argument("--thr", type=float, default=24.0)
    args = ap.parse_args()
    # rebuild cutout with thr
    global_thr = args.thr

    def _cut(path: Path):
        return cutout_rgba(path, thr=global_thr)

    # monkey via re-call
    rgba = _cut(args.src)
    if args.mode == "portrait":
        out = normalize_portrait(rgba, size=args.size)
        meta = {"mode": "portrait", "anchor": [0.5, 0.55]}
    else:
        foot = 0.08 if args.mode == "building" else 0.06
        out, meta = normalize_unit(rgba, size=args.size, foot_margin=foot)
        meta["mode"] = args.mode
    args.dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(args.dst)
    if args.qa:
        contact_sheet(out, args.qa, title=f"{args.mode}:{args.dst.stem}")
    if args.meta:
        args.meta.parent.mkdir(parents=True, exist_ok=True)
        args.meta.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"OK [{args.mode}] {args.src.name} -> {args.dst} size={args.size}")


if __name__ == "__main__":
    main()
