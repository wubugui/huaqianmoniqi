#!/usr/bin/env python3
"""Ingest a black-background Grok strip into a directional pack.

Near-black key is intentionally conservative (armor/robes are dark).
Do NOT run keep_largest_subject — it drops limbs when dark joints key away.
Default to equal-width slicing; optional gap slicing when margins are clean.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

from equalize_bbox_packs import CELL, TARGET_H, crop_subject, metrics, place_bbox_foot, write_pack

ROOT = Path(__file__).resolve().parents[1]
QA_PROC = ROOT / "assets/game/anim/qa/commercial_regen/processed"
FRAME_COUNT = 6


def black_key(image: Image.Image) -> Image.Image:
    """Key only near-pure black / near-white paper. Do not touch dark armor."""
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    rgb = rgba[..., :3]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    chroma = mx - mn
    near_black = (mx < 10) & (chroma < 8)
    near_white = (mn > 245) & (chroma < 10)
    bg = near_black | near_white
    out = rgba.astype(np.uint8).copy()
    out[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def remove_debris(image: Image.Image, min_keep: int = 80, far_px: int = 14) -> Image.Image:
    """Drop tiny blobs far from the largest subject; keep attached limbs/weapons."""
    arr = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    mask = arr[..., 3] > 18
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    comps: list[np.ndarray] = []
    ys, xs = np.where(mask)
    for y0, x0 in zip(ys, xs):
        if visited[y0, x0]:
            continue
        q = deque([(int(y0), int(x0))])
        visited[y0, x0] = True
        coords: list[tuple[int, int]] = []
        while q:
            y, x = q.popleft()
            coords.append((y, x))
            for yy in range(max(0, y - 1), min(h, y + 2)):
                for xx in range(max(0, x - 1), min(w, x + 2)):
                    if mask[yy, xx] and not visited[yy, xx]:
                        visited[yy, xx] = True
                        q.append((yy, xx))
        comps.append(np.asarray(coords, dtype=np.int32))
    if not comps:
        return image
    comps.sort(key=len, reverse=True)
    main = comps[0]
    my0, mx0 = int(main[:, 0].min()), int(main[:, 1].min())
    my1, mx1 = int(main[:, 0].max()), int(main[:, 1].max())
    keep = np.zeros(mask.shape, dtype=bool)
    keep[main[:, 0], main[:, 1]] = True
    for comp in comps[1:]:
        cy0, cx0 = int(comp[:, 0].min()), int(comp[:, 1].min())
        cy1, cx1 = int(comp[:, 0].max()), int(comp[:, 1].max())
        dx = max(0, mx0 - cx1, cx0 - mx1)
        dy = max(0, my0 - cy1, cy0 - my1)
        near = dx <= far_px * 3 and dy <= far_px * 3
        if len(comp) >= min_keep and (near or len(comp) >= 400):
            keep[comp[:, 0], comp[:, 1]] = True
    arr[..., 3] = np.where(keep, arr[..., 3], 0)
    return Image.fromarray(arr, "RGBA")


def crop_label_bar(sheet: Image.Image) -> Image.Image:
    arr = np.asarray(sheet.convert("RGB"))
    h, w, _ = arr.shape
    white_rows = (arr.min(axis=2) > 230).mean(axis=1) > 0.55
    y0 = 0
    while y0 < h and white_rows[y0]:
        y0 += 1
    y1 = h
    while y1 > y0 and white_rows[y1 - 1]:
        y1 -= 1
    if y1 - y0 < h * 0.5:
        return sheet
    return sheet.crop((0, y0, w, y1))


def slice_equal(sheet: Image.Image, count: int = FRAME_COUNT) -> list[Image.Image]:
    w, h = sheet.size
    cell_w = w // count
    return [sheet.crop((i * cell_w, 0, (i + 1) * cell_w if i < count - 1 else w, h)) for i in range(count)]


def ingest(path: Path, class_id: str, direction: str, action: str) -> dict:
    sheet = crop_label_bar(Image.open(path))
    # Prefer equal-width: Grok strips are usually regular; gap-slice often clips.
    raw = slice_equal(sheet, FRAME_COUNT)
    keyed = [remove_debris(black_key(frame)) for frame in raw]
    locked = [place_bbox_foot(crop_subject(frame, pad=2), target_h=TARGET_H) for frame in keyed]
    write_pack(class_id, direction, action, locked)
    QA_PROC.mkdir(parents=True, exist_ok=True)
    qa = Image.new("RGBA", (CELL * FRAME_COUNT, CELL), (40, 40, 40, 255))
    for i, frame in enumerate(locked):
        bg = Image.new("RGBA", (CELL, CELL), (70, 70, 70, 255) if i % 2 == 0 else (35, 35, 35, 255))
        bg.alpha_composite(frame)
        qa.alpha_composite(bg, (i * CELL, 0))
    qa.save(QA_PROC / f"{class_id}_{direction}_{action}_qa.png")
    return metrics(locked)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("class_id")
    parser.add_argument("direction")
    parser.add_argument("action")
    args = parser.parse_args()
    print(ingest(Path(args.path), args.class_id, args.direction, args.action))
