#!/usr/bin/env python3
"""Ingest a black-background Grok strip into a directional pack (near-black key only)."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from commercial_anim_pipeline import keep_largest_subject, slice_horizontal_strip
from equalize_bbox_packs import CELL, TARGET_H, crop_subject, metrics, place_bbox_foot, write_pack

ROOT = Path(__file__).resolve().parents[1]
QA_PROC = ROOT / "assets/game/anim/qa/commercial_regen/processed"


def black_key(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    rgb = rgba[..., :3]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    chroma = mx - mn
    bg = ((mx < 22) & (chroma < 14)) | ((mn > 240) & (chroma < 12))
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


def ingest(path: Path, class_id: str, direction: str, action: str) -> dict:
    sheet = crop_label_bar(Image.open(path))
    raw = slice_horizontal_strip(sheet, 6)
    keyed = [keep_largest_subject(black_key(frame)) for frame in raw]
    locked = [place_bbox_foot(crop_subject(frame, pad=2), target_h=TARGET_H) for frame in keyed]
    write_pack(class_id, direction, action, locked)
    QA_PROC.mkdir(parents=True, exist_ok=True)
    qa = Image.new("RGBA", (CELL * 6, CELL), (40, 40, 40, 255))
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
