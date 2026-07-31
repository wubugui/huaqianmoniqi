#!/usr/bin/env python3
"""Hard-lock bbox foot + equalize body height for directional packs.

Uses alpha bbox bottom (not percentile foot) so QA footΔ / loop_f go to ~0.
For walk/run: per-frame scale to TARGET_H then lock bbox bottom to CONTACT_Y.
For attack: soft-equalize toward median height (cap extreme weapon frames), then lock foot.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/game/anim/directional"
CELL = 256
ANCHOR_X = 128
CONTACT_Y = 236
ALPHA = 18
TARGET_H = 200
# attack: allow some pose stretch but clamp outliers toward median
ATTACK_MAX_H_DELTA = 24


def bbox(img: Image.Image):
    box = img.getchannel("A").point(lambda v: 255 if v > ALPHA else 0).getbbox()
    return box or (0, 0, 1, 1)


def crop_subject(img: Image.Image, pad: int = 4) -> Image.Image:
    x0, y0, x1, y1 = bbox(img)
    return img.crop((
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(img.width, x1 + pad),
        min(img.height, y1 + pad),
    ))


def waist_root_x(img: Image.Image) -> float:
    """Median X of mid-torso alpha band — keeps silhouette centered like commercial Mir."""
    arr = np.asarray(img)
    a = arr[..., 3]
    x0, y0, x1, y1 = bbox(img)
    band0 = y0 + int((y1 - y0) * 0.42)
    band1 = y0 + int((y1 - y0) * 0.64)
    xs = np.where(a[band0:band1, x0:x1] > ALPHA)[1]
    if len(xs) < 8:
        xs = np.where(a > ALPHA)[1]
        return float(xs.mean()) if len(xs) else ANCHOR_X
    return float(np.median(xs + x0))


def place_bbox_foot(subject: Image.Image, target_h: float | None = None) -> Image.Image:
    """Scale subject so bbox height ~= target_h; lock bbox bottom + waist root X."""
    sub = subject.convert("RGBA")
    x0, y0, x1, y1 = bbox(sub)
    sub = sub.crop((x0, y0, x1, y1))
    bh = max(1, sub.height)
    if target_h is not None and abs(bh - target_h) > 0.5:
        scale = target_h / bh
        nw = max(1, int(round(sub.width * scale)))
        nh = max(1, int(round(sub.height * scale)))
        sub = sub.resize((nw, nh), Image.Resampling.LANCZOS)
    # fit if still oversized
    margin = 2
    max_w, max_h = CELL - margin * 2, CELL - margin * 2
    if sub.width > max_w or sub.height > max_h:
        fit = min(max_w / sub.width, max_h / sub.height)
        sub = sub.resize(
            (max(1, int(sub.width * fit)), max(1, int(sub.height * fit))),
            Image.Resampling.LANCZOS,
        )
    rx = waist_root_x(sub)
    # after crop, bbox top-left is (0,0); foot is sub.height
    dx = int(round(ANCHOR_X - rx))
    dy = int(round(CONTACT_Y - sub.height))
    # prefer keeping foot lock; clamp X only if needed
    if dx < margin:
        dx = margin
    elif dx + sub.width > CELL - margin:
        dx = CELL - margin - sub.width
    if dy < margin:
        dy = margin
    elif dy + sub.height > CELL - margin:
        dy = CELL - margin - sub.height
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(sub, (dx, dy))
    return canvas


def equalize_pack(frames: list[Image.Image], action: str) -> list[Image.Image]:
    cropped = [crop_subject(f) for f in frames]
    heights = [max(1, bbox(f)[3] - bbox(f)[1]) for f in cropped]
    med = float(np.median(heights))
    out = []
    for sub, h in zip(cropped, heights):
        # Uniform body height across all actions; weapon extension still adds
        # some bbox variance after alpha crop, but stay under attack QA budget.
        out.append(place_bbox_foot(sub, target_h=TARGET_H))
    return out


def write_pack(class_id: str, direction: str, action: str, frames: list[Image.Image]) -> None:
    folder = OUT / class_id / direction / action
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.png"):
        old.unlink()
    for i, frame in enumerate(frames):
        frame.save(folder / f"{i:02d}.png")
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i * CELL, 0))
    sheet.save(OUT / class_id / direction / f"{action}_sheet.png")


def metrics(frames: list[Image.Image]) -> dict:
    bottoms, heights = [], []
    for f in frames:
        x0, y0, x1, y1 = bbox(f)
        bottoms.append(y1)
        heights.append(y1 - y0)
    return {
        "footΔ": max(bottoms) - min(bottoms),
        "hΔ": max(heights) - min(heights),
        "loop_h": abs(heights[0] - heights[-1]),
        "loop_f": abs(bottoms[0] - bottoms[-1]),
        "bottoms": bottoms,
        "hs": heights,
    }


def process_one(class_id: str, direction: str, action: str) -> dict:
    folder = OUT / class_id / direction / action
    frames = [Image.open(folder / f"{i:02d}.png").convert("RGBA") for i in range(6)]
    locked = equalize_pack(frames, action)
    write_pack(class_id, direction, action, locked)
    m = metrics(locked)
    print(f"{class_id}/{direction}/{action}", m)
    return m


FAILING = [
    ("warrior", "s", "run"),
    ("warrior", "w", "run"),
    ("warrior", "w", "attack"),
    ("warrior", "nw", "run"),
    ("warrior", "ne", "run"),
    ("wizard", "s", "attack"),
    ("wizard", "sw", "run"),
    ("wizard", "nw", "run"),
    ("wizard", "nw", "attack"),
    ("wizard", "n", "run"),
    ("wizard", "n", "attack"),
    ("wizard", "ne", "attack"),
    ("taoist", "e", "run"),
    ("taoist", "se", "walk"),
    ("taoist", "se", "run"),
    ("taoist", "sw", "run"),
    ("taoist", "w", "run"),
    ("taoist", "nw", "run"),
    ("taoist", "n", "run"),
    ("taoist", "n", "attack"),
]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all-failing", action="store_true")
    parser.add_argument("--pack", nargs=3, metavar=("CLASS", "DIR", "ACTION"))
    parser.add_argument("--all", action="store_true", help="equalize every pack")
    args = parser.parse_args()
    packs = []
    if args.all:
        for c in ("warrior", "wizard", "taoist"):
            for d in ("e", "se", "s", "sw", "w", "nw", "n", "ne"):
                for a in ("idle", "walk", "run", "attack"):
                    packs.append((c, d, a))
    elif args.all_failing:
        packs = FAILING
    elif args.pack:
        packs = [tuple(args.pack)]
    else:
        packs = FAILING
    for pack in packs:
        process_one(*pack)
