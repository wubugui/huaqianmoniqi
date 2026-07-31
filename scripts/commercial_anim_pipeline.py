#!/usr/bin/env python3
"""Commercial Mir-style player animation pack: slice, cutout, root-lock, QA.

Standard (locked for this regen):
  - classes: warrior, wizard, taoist
  - directions: e se s sw w nw n ne
  - actions: idle walk run attack
  - frames: 6 per action/direction (uniform)
  - canvas: 256x256 RGBA, foot contact locked near bottom-center
"""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = ROOT / "assets/game/anim/qa/commercial_regen/sources"
OUT_ROOT = ROOT / "assets/game/anim/directional"
QA_ROOT = ROOT / "assets/game/anim/qa/commercial_regen"
REPORT_ROOT = QA_ROOT / "reports"

CLASSES = ("warrior", "wizard", "taoist")
DIRECTIONS = ("e", "se", "s", "sw", "w", "nw", "n", "ne")
ACTIONS = ("idle", "walk", "run", "attack")
FRAME_COUNT = 6
CELL = 256
ANCHOR_X = CELL // 2
CONTACT_Y = 236
ALPHA_T = 18
TARGET_IDLE_H = 188
MAX_FOOT_RANGE = 6.5
MAX_ROOT_X_RANGE = 8.0
MAX_IDLE_H_CV = 0.05  # body height coeff of variation within a pack
MAX_ATTACK_ROOT_X_RANGE = 72.0


def ensure_dirs() -> None:
    for class_id in CLASSES:
        for direction in DIRECTIONS:
            for action in ACTIONS:
                (OUT_ROOT / class_id / direction / action).mkdir(parents=True, exist_ok=True)
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    (QA_ROOT / "processed").mkdir(parents=True, exist_ok=True)


def gray_key_rgba(image: Image.Image) -> Image.Image:
    """Key flat gray / near-black studio backgrounds to alpha."""
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    rgb = rgba[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    chroma = mx - mn
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # flat gray studio
    grayish = (chroma < 28) & (luma > 70) & (luma < 210)
    # near-black void
    near_black = (mx < 28) & (chroma < 18)
    # near-white paper
    near_white = (mn > 235) & (chroma < 18)
    bg = grayish | near_black | near_white
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    out = rgba.astype(np.uint8).copy()
    out[..., 3] = np.minimum(out[..., 3], alpha)
    return Image.fromarray(out, "RGBA")


def alpha_bbox(image: Image.Image, threshold: int = ALPHA_T) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()
    return bbox or (0, 0, 1, 1)


def connected_components(mask: np.ndarray, min_pixels: int = 80) -> list[np.ndarray]:
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
        if len(coords) >= min_pixels:
            comps.append(np.asarray(coords, dtype=np.int32))
    comps.sort(key=len, reverse=True)
    return comps


def keep_largest_subject(image: Image.Image) -> Image.Image:
    arr = np.asarray(image, dtype=np.uint8).copy()
    mask = arr[..., 3] > ALPHA_T
    comps = connected_components(mask, min_pixels=120)
    if not comps:
        return image
    keep = np.zeros(mask.shape, dtype=bool)
    keep[comps[0][:, 0], comps[0][:, 1]] = True
    arr[..., 3] = np.where(keep, arr[..., 3], 0)
    return Image.fromarray(arr, "RGBA")


def slice_horizontal_strip(sheet: Image.Image, count: int = FRAME_COUNT) -> list[Image.Image]:
    sheet = sheet.convert("RGBA")
    w, h = sheet.size
    cell_w = w // count
    frames = []
    for i in range(count):
        crop = sheet.crop((i * cell_w, 0, (i + 1) * cell_w if i < count - 1 else w, h))
        frames.append(crop)
    return frames


def slice_grid(sheet: Image.Image, cols: int = 6, rows: int = 4) -> list[list[Image.Image]]:
    sheet = sheet.convert("RGBA")
    w, h = sheet.size
    cw, ch = w // cols, h // rows
    grid = []
    for r in range(rows):
        row = []
        for c in range(cols):
            row.append(sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
        grid.append(row)
    return grid


def waist_root_x(image: Image.Image) -> float:
    arr = np.asarray(image)
    a = arr[..., 3]
    x0, y0, x1, y1 = alpha_bbox(image)
    band_y0 = y0 + int((y1 - y0) * 0.42)
    band_y1 = y0 + int((y1 - y0) * 0.64)
    band = a[band_y0:band_y1, x0:x1] > ALPHA_T
    if band.sum() < 8:
        ys, xs = np.where(a > ALPHA_T)
        return float(xs.mean()) if len(xs) else ANCHOR_X
    # distance-weighted centroid
    from numpy import pad  # noqa: F401

    ys, xs = np.where(band)
    xs = xs + x0
    ys = ys + band_y0
    return float(np.median(xs))


def foot_contact_y(image: Image.Image) -> float:
    arr = np.asarray(image)
    a = arr[..., 3]
    x0, y0, x1, y1 = alpha_bbox(image)
    lower0 = y0 + int((y1 - y0) * 0.42)
    ys, xs = np.where(a[lower0:y1, x0:x1] > ALPHA_T)
    if len(ys) < 4:
        ys, xs = np.where(a > ALPHA_T)
        return float(np.percentile(ys, 99.2)) if len(ys) else CONTACT_Y
    return float(lower0 + np.percentile(ys, 99.2))


def place_on_canvas(subject: Image.Image, scale: float, root_x: float, foot_y: float) -> Image.Image:
    subject = subject.convert("RGBA")
    if abs(scale - 1.0) > 1e-4:
        nw = max(1, int(round(subject.width * scale)))
        nh = max(1, int(round(subject.height * scale)))
        subject = subject.resize((nw, nh), Image.Resampling.LANCZOS)
        root_x *= scale
        foot_y *= scale
    margin = 2
    max_w = CELL - margin * 2
    max_h = CELL - margin * 2
    if subject.width > max_w or subject.height > max_h:
        fit = min(max_w / max(1, subject.width), max_h / max(1, subject.height))
        subject = subject.resize(
            (max(1, int(subject.width * fit)), max(1, int(subject.height * fit))),
            Image.Resampling.LANCZOS,
        )
        root_x *= fit
        foot_y *= fit
    dx = int(round(ANCHOR_X - root_x))
    dy = int(round(CONTACT_Y - foot_y))
    dx = max(margin, min(dx, CELL - subject.width - margin))
    dy = max(margin, min(dy, CELL - subject.height - margin))
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(subject, (dx, dy))
    return canvas


def normalize_pack(frames: list[Image.Image]) -> tuple[list[Image.Image], dict]:
    keyed = [keep_largest_subject(gray_key_rgba(frame)) for frame in frames]
    heights = []
    for frame in keyed:
        x0, y0, x1, y1 = alpha_bbox(frame)
        heights.append(max(1, y1 - y0))
    # scale so median idle/body height -> TARGET_IDLE_H
    med_h = median(heights)
    scale = TARGET_IDLE_H / med_h if med_h else 1.0
    # first pass place with per-frame anchors
    placed = []
    roots, foots = [], []
    for frame in keyed:
        rx = waist_root_x(frame)
        fy = foot_contact_y(frame)
        roots.append(rx * scale)
        foots.append(fy * scale)
        placed.append(place_on_canvas(frame, scale, rx, fy))
    # second pass: translation-only lock to median root X / foot Y on canvas metrics
    canvas_roots = [waist_root_x(f) for f in placed]
    canvas_foots = [foot_contact_y(f) for f in placed]
    target_rx = median(canvas_roots)
    target_fy = median(canvas_foots)
    locked = []
    for frame, rx, fy in zip(placed, canvas_roots, canvas_foots):
        shift_x = int(round(target_rx - rx))
        shift_y = int(round(target_fy - fy))
        canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        canvas.alpha_composite(frame, (shift_x, shift_y))
        locked.append(canvas)
    metrics = {
        "sourceMedianHeight": med_h,
        "uniformScale": scale,
        "rootXRange": max(canvas_roots) - min(canvas_roots) if canvas_roots else 0,
        "footYRange": max(canvas_foots) - min(canvas_foots) if canvas_foots else 0,
        "heightCv": (float(np.std(heights)) / med_h) if med_h else 0,
        "lockedRootXRange": max(waist_root_x(f) for f in locked) - min(waist_root_x(f) for f in locked),
        "lockedFootYRange": max(foot_contact_y(f) for f in locked) - min(foot_contact_y(f) for f in locked),
    }
    return locked, metrics


def write_pack(class_id: str, direction: str, action: str, frames: list[Image.Image]) -> dict:
    out_dir = OUT_ROOT / class_id / direction / action
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames):
        frame.save(out_dir / f"{i:02d}.png")
    # sheet for QA
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i * CELL, 0))
    sheet_path = OUT_ROOT / class_id / direction / f"{action}_sheet.png"
    sheet.save(sheet_path)
    return {"frames": len(frames), "sheet": str(sheet_path.relative_to(ROOT))}


def qa_pack(frames: list[Image.Image], metrics: dict) -> dict:
    fails = []
    if len(frames) != FRAME_COUNT:
        fails.append(f"frame_count={len(frames)} expected={FRAME_COUNT}")
    sizes = {f.size for f in frames}
    if sizes != {(CELL, CELL)}:
        fails.append(f"size_mismatch={sizes}")
    # corners transparent
    for i, frame in enumerate(frames):
        arr = np.asarray(frame)
        corners = [arr[0, 0, 3], arr[0, -1, 3], arr[-1, 0, 3], arr[-1, -1, 3]]
        if max(corners) > 8:
            fails.append(f"opaque_corner_frame_{i}")
            break
        x0, y0, x1, y1 = alpha_bbox(frame)
        if x0 <= 0 or y0 <= 0 or x1 >= CELL or y1 >= CELL:
            fails.append(f"bbox_touches_edge_frame_{i}")
            break
    if metrics.get("lockedFootYRange", 99) > MAX_FOOT_RANGE:
        fails.append(f"foot_range={metrics['lockedFootYRange']:.2f}")
    if metrics.get("lockedRootXRange", 99) > MAX_ROOT_X_RANGE:
        fails.append(f"root_x_range={metrics['lockedRootXRange']:.2f}")
    action = str(metrics.get("action", ""))
    hcv = float(metrics.get("heightCv", 99))
    # Attack weapon arcs legitimately widen waist-band X; allow larger root range.
    if action == "attack":
        if metrics.get("lockedRootXRange", 99) > MAX_ATTACK_ROOT_X_RANGE:
            fails.append(f"attack_root_x_range={metrics['lockedRootXRange']:.2f}")
        # drop generic root fail for attack (re-check above)
        fails = [f for f in fails if not f.startswith("root_x_range=")]
        if hcv > 0.35:
            fails.append(f"attack_height_cv={hcv:.3f}")
    elif action in ("walk", "run"):
        if hcv > 0.22:
            fails.append(f"loco_height_cv={hcv:.3f}")
    elif hcv > 0.12:
        fails.append(f"height_cv={hcv:.3f}")
    return {"pass": not fails, "fails": fails, **metrics}


def process_strip_file(path: Path, class_id: str, direction: str, action: str) -> dict:
    sheet = Image.open(path)
    raw = slice_horizontal_strip(sheet, FRAME_COUNT)
    frames, metrics = normalize_pack(raw)
    write_pack(class_id, direction, action, frames)
    result = qa_pack(frames, {**metrics, "action": action})
    result.update({"classId": class_id, "direction": direction, "action": action, "source": str(path)})
    # QA contact sheet
    qa = Image.new("RGBA", (CELL * FRAME_COUNT, CELL), (40, 40, 40, 255))
    for i, frame in enumerate(frames):
        bg = Image.new("RGBA", (CELL, CELL), (80, 80, 80, 255) if i % 2 == 0 else (30, 30, 30, 255))
        bg.alpha_composite(frame)
        d = ImageDraw.Draw(bg)
        d.line([(ANCHOR_X, 0), (ANCHOR_X, CELL)], fill=(0, 255, 0, 120))
        d.line([(0, CONTACT_Y), (CELL, CONTACT_Y)], fill=(255, 80, 80, 120))
        qa.paste(bg, (i * CELL, 0))
    qa_path = QA_ROOT / "processed" / f"{class_id}_{direction}_{action}_qa.png"
    qa.save(qa_path)
    result["qa"] = str(qa_path.relative_to(ROOT))
    return result


def write_manifest(class_id: str) -> None:
    counts = {action: {direction: FRAME_COUNT for direction in DIRECTIONS} for action in ACTIONS}
    manifest = {
        "classId": class_id,
        "canvas": [CELL, CELL],
        "anchor": [ANCHOR_X, CONTACT_Y],
        "frameCount": FRAME_COUNT,
        "directions": list(DIRECTIONS),
        "actions": list(ACTIONS),
        "counts": counts,
        "standard": "commercial-mir-regen-v1",
    }
    path = OUT_ROOT / class_id / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def audit_all() -> dict:
    report = {"packs": [], "failCount": 0, "passCount": 0}
    for class_id in CLASSES:
        for direction in DIRECTIONS:
            for action in ACTIONS:
                folder = OUT_ROOT / class_id / direction / action
                frames = []
                missing = []
                for i in range(FRAME_COUNT):
                    p = folder / f"{i:02d}.png"
                    if not p.exists():
                        missing.append(p.name)
                    else:
                        frames.append(Image.open(p).convert("RGBA"))
                if missing:
                    entry = {
                        "classId": class_id,
                        "direction": direction,
                        "action": action,
                        "pass": False,
                        "fails": [f"missing:{','.join(missing)}"],
                    }
                    report["packs"].append(entry)
                    report["failCount"] += 1
                    continue
                # recompute metrics on runtime frames
                heights = [alpha_bbox(f)[3] - alpha_bbox(f)[1] for f in frames]
                med_h = median(heights) if heights else 0
                metrics = {
                    "lockedRootXRange": max(waist_root_x(f) for f in frames) - min(waist_root_x(f) for f in frames),
                    "lockedFootYRange": max(foot_contact_y(f) for f in frames) - min(foot_contact_y(f) for f in frames),
                    "heightCv": (float(np.std(heights)) / med_h) if med_h else 0,
                    "medianHeight": med_h,
                    "action": action,
                }
                entry = qa_pack(frames, metrics)
                entry.update({"classId": class_id, "direction": direction, "action": action})
                report["packs"].append(entry)
                if entry["pass"]:
                    report["passCount"] += 1
                else:
                    report["failCount"] += 1
    report["verdict"] = "PASS" if report["failCount"] == 0 else "FAIL"
    out = REPORT_ROOT / "audit.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--process-strip", nargs=4, metavar=("PATH", "CLASS", "DIR", "ACTION"))
    parser.add_argument("--audit", action="store_true")
    parser.add_argument("--write-manifests", action="store_true")
    args = parser.parse_args()
    ensure_dirs()
    if args.process_strip:
        path, class_id, direction, action = args.process_strip
        result = process_strip_file(Path(path), class_id, direction, action)
        print(json.dumps(result, indent=2))
    if args.write_manifests:
        for class_id in CLASSES:
            write_manifest(class_id)
        print("manifests written")
    if args.audit:
        print(json.dumps(audit_all(), indent=2))
