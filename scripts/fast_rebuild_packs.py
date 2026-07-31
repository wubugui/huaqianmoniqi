#!/usr/bin/env python3
"""Fast 256 canvas pack builder without expensive connected-component passes."""
from __future__ import annotations

import json
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


def bbox(img: Image.Image):
    box = img.getchannel("A").point(lambda v: 255 if v > ALPHA else 0).getbbox()
    return box or (0, 0, 1, 1)


def foot_y(img: Image.Image) -> float:
    arr = np.asarray(img)
    a = arr[..., 3]
    x0, y0, x1, y1 = bbox(img)
    lower = y0 + int((y1 - y0) * 0.42)
    ys = np.where(a[lower:y1, x0:x1] > ALPHA)[0]
    if len(ys) < 4:
        ys = np.where(a > ALPHA)[0]
        return float(np.percentile(ys, 99.2)) if len(ys) else CONTACT_Y
    return float(lower + np.percentile(ys, 99.2))


def root_x(img: Image.Image) -> float:
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


def place(img: Image.Image, scale: float, rx: float, fy: float) -> Image.Image:
    if abs(scale - 1) > 1e-4:
        img = img.resize(
            (max(1, int(img.width * scale)), max(1, int(img.height * scale))),
            Image.Resampling.LANCZOS,
        )
        rx *= scale
        fy *= scale
    margin = 2
    max_w, max_h = CELL - margin * 2, CELL - margin * 2
    if img.width > max_w or img.height > max_h:
        fit = min(max_w / img.width, max_h / img.height)
        img = img.resize((max(1, int(img.width * fit)), max(1, int(img.height * fit))), Image.Resampling.LANCZOS)
        rx *= fit
        fy *= fit
    dx = int(round(ANCHOR_X - rx))
    dy = int(round(CONTACT_Y - fy))
    dx = max(margin, min(dx, CELL - img.width - margin))
    dy = max(margin, min(dy, CELL - img.height - margin))
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(img, (dx, dy))
    return canvas


def build_pack(frames: list[Image.Image]) -> list[Image.Image]:
    # Tight-crop each frame first so wide 384 canvases don't force fit-shrink.
    cropped = []
    for frame in frames:
        x0, y0, x1, y1 = bbox(frame)
        pad = 8
        cropped.append(frame.crop((
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(frame.width, x1 + pad),
            min(frame.height, y1 + pad),
        )))
    frames = cropped
    heights = [max(1, bbox(f)[3] - bbox(f)[1]) for f in frames]
    med = float(np.median(heights))
    scale = TARGET_H / med
    placed = []
    for frame in frames:
        placed.append(place(frame, scale, root_x(frame), foot_y(frame)))
    # translation lock
    rxs = [root_x(f) for f in placed]
    fys = [foot_y(f) for f in placed]
    trx, tfy = float(np.median(rxs)), float(np.median(fys))
    locked = []
    for frame, rx, fy in zip(placed, rxs, fys):
        canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        sx = int(round(trx - rx))
        sy = int(round(tfy - fy))
        # keep content on canvas
        x0, y0, x1, y1 = bbox(frame)
        if x0 + sx < 2 or y0 + sy < 2 or x1 + sx > CELL - 2 or y1 + sy > CELL - 2:
            locked.append(frame)
        else:
            canvas.alpha_composite(frame, (sx, sy))
            locked.append(canvas)
    return locked


def write_pack(class_id: str, direction: str, action: str, frames: list[Image.Image]) -> None:
    out = OUT / class_id / direction / action
    out.mkdir(parents=True, exist_ok=True)
    # remove stale extra frames
    for old in out.glob("*.png"):
        old.unlink()
    for i, frame in enumerate(frames):
        frame.save(out / f"{i:02d}.png")
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i * CELL, 0))
    sheet.save(OUT / class_id / direction / f"{action}_sheet.png")


def subsample(frames: list[Image.Image], n: int = 6) -> list[Image.Image]:
    if len(frames) == n:
        return frames
    if len(frames) < n:
        while len(frames) < n:
            frames.append(frames[-1].copy())
        return frames[:n]
    idxs = [round(i * (len(frames) - 1) / (n - 1)) for i in range(n)]
    return [frames[i] for i in idxs]


def rebuild_from_dir(src_dir: Path, class_id: str, direction: str, action: str) -> None:
    frames = []
    for i in range(16):
        p = src_dir / f"{i:02d}.png"
        if p.exists() and p.stat().st_size > 1000:
            frames.append(Image.open(p).convert("RGBA"))
    if not frames:
        raise SystemExit(f"no frames in {src_dir}")
    frames = subsample(frames, 6)
    locked = build_pack(frames)
    write_pack(class_id, direction, action, locked)
    hs = [bbox(f)[3] - bbox(f)[1] for f in locked]
    print(class_id, direction, action, "ok", "heights", hs, "sizes", {f.size for f in locked})


if __name__ == "__main__":
    # restore warrior e walk from extracted originals
    rebuild_from_dir(Path("/tmp/warrior_e_walk_restore"), "warrior", "e", "walk")
    # also clean any other packs that still have >6 numbered frames
    classes = ("warrior", "wizard", "taoist")
    dirs = ("e", "se", "s", "sw", "w", "nw", "n", "ne")
    acts = ("idle", "walk", "run", "attack")
    for class_id in classes:
        for direction in dirs:
            for action in acts:
                folder = OUT / class_id / direction / action
                if not folder.exists():
                    continue
                files = sorted(folder.glob("[0-9][0-9].png"))
                big = [p for p in files if p.stat().st_size > 1000]
                tiny = [p for p in files if p.stat().st_size <= 1000]
                if tiny or len(files) != 6 or any(Image.open(p).size != (CELL, CELL) for p in big[:1]):
                    if not big:
                        print("SKIP empty", class_id, direction, action)
                        continue
                    # rebuild in place from non-tiny sources (may include 06-09 leftovers)
                    src_frames = [Image.open(p).convert("RGBA") for p in big]
                    # Prefer first 6 good if already 256, else subsample all
                    locked = build_pack(subsample(src_frames, 6))
                    write_pack(class_id, direction, action, locked)
                    print("rebuilt", class_id, direction, action, "from", len(big), "sources")
    # write manifests
    for class_id in classes:
        manifest = {
            "classId": class_id,
            "canvas": [CELL, CELL],
            "anchor": [ANCHOR_X, CONTACT_Y],
            "frameCount": 6,
            "directions": list(dirs),
            "actions": list(acts),
            "counts": {a: {d: 6 for d in dirs} for a in acts},
            "standard": "commercial-mir-regen-v1",
        }
        (OUT / class_id / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("done")
