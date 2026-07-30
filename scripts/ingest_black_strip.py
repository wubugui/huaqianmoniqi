#!/usr/bin/env python3
"""Ingest a black-background Grok strip into a directional pack.

Near-black key is intentionally conservative (armor/robes are dark).
Do NOT run keep_largest_subject — it drops limbs when dark joints key away.
Prefer gap-based horizontal slicing when cell boundaries cut subjects.
"""
from __future__ import annotations

import argparse
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
    # very conservative: only void black / paper white
    near_black = (mx < 10) & (chroma < 8)
    near_white = (mn > 245) & (chroma < 10)
    bg = near_black | near_white
    out = rgba.astype(np.uint8).copy()
    out[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


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


def slice_by_gaps(sheet: Image.Image, count: int = FRAME_COUNT) -> list[Image.Image] | None:
    """Split on columns that are mostly empty after a soft black mask."""
    arr = np.asarray(sheet.convert("RGB"), dtype=np.uint16)
    # content if not near-black
    content = arr.max(axis=2) >= 14
    col_density = content.mean(axis=0)
    # gap = low density
    is_gap = col_density < 0.01
    # find content runs
    runs: list[tuple[int, int]] = []
    i, w = 0, content.shape[1]
    while i < w:
        while i < w and is_gap[i]:
            i += 1
        if i >= w:
            break
        start = i
        while i < w and not is_gap[i]:
            i += 1
        runs.append((start, i))
    if len(runs) != count:
        return None
    # pad each run a bit into gaps
    frames = []
    h = sheet.height
    for idx, (a, b) in enumerate(runs):
        pad_l = 4 if idx == 0 else 8
        pad_r = 4 if idx == count - 1 else 8
        left = max(0, a - pad_l)
        right = min(w, b + pad_r)
        frames.append(sheet.crop((left, 0, right, h)))
    return frames


def ingest(path: Path, class_id: str, direction: str, action: str) -> dict:
    sheet = crop_label_bar(Image.open(path))
    raw = slice_by_gaps(sheet, FRAME_COUNT) or slice_equal(sheet, FRAME_COUNT)
    keyed = [black_key(frame) for frame in raw]
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
