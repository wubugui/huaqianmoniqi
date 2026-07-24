#!/usr/bin/env python3
"""
从视频抽帧 → 粉/洋红背景抠图 → 统一脚底锚点 → 输出游戏帧动画。
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_GAME = ROOT / "assets" / "game"
SCRATCH = Path(
    "/var/folders/96/l70q12vj1yg7ct4x6p96ry9c0000gn/T/grok-goal-e57942fad429/implementer/frames"
)


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.check_call(cmd)


def extract_frames(video: Path, out_dir: Path, fps: float = 10.0) -> list[Path]:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(out_dir / "raw_%04d.png")
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-vf",
            f"fps={fps}",
            pattern,
        ]
    )
    frames = sorted(out_dir.glob("raw_*.png"))
    print(f"  extracted {len(frames)} frames from {video.name}")
    return frames


def chroma_key_rgba(img: Image.Image) -> Image.Image:
    """强力抠除粉红/洋红/亮紫背景，保留角色主体。"""
    rgb = img.convert("RGB")
    arr = np.asarray(rgb).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # 多种粉/洋红判定（视频压缩后背景会偏色）
    # 1) 近 #FF00FF
    d_mag = np.sqrt((r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2)
    # 2) 高 R+B、低 G
    mag_score = (r + b) * 0.5 - g
    # 3) 粉红：R 高、B 中高、G 偏低
    pink = (r > 170) & (b > 120) & (g < 170) & ((r - g) > 35)
    # 4) 亮紫/品红
    purple = (r > 160) & (b > 160) & (g < 140)
    # 5) 过饱和亮粉（HSV 近似：高饱和高明度偏紫红）
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 1e-3, (mx - mn) / mx, 0)
    hot_pink = (mx > 180) & (sat > 0.25) & (g < r * 0.85) & (g < b * 0.95) & ((r + b) > 280)

    bg = (d_mag < 95) | (mag_score > 55) | pink | purple | hot_pink

    # 从四边 flood 连通的背景更稳（避免衣服里误杀）
    h, w = bg.shape
    seed = np.zeros_like(bg, dtype=bool)
    seed[0, :] = True
    seed[-1, :] = True
    seed[:, 0] = True
    seed[:, -1] = True
    # 只有被判定为 bg 的边才扩张
    from collections import deque

    visited = np.zeros_like(bg, dtype=bool)
    q: deque[tuple[int, int]] = deque()
    ys, xs = np.where(seed & bg)
    for y, x in zip(ys.tolist(), xs.tolist()):
        visited[y, x] = True
        q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for ny in (cy - 1, cy, cy + 1):
            for nx in (cx - 1, cx, cx + 1):
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and bg[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    # 主体 = 非连通背景
    alpha = np.where(visited, 0.0, 255.0).astype(np.float32)

    # 边缘软化：接近背景色的像素降 alpha
    edge = (~visited) & ((d_mag < 130) | (mag_score > 40))
    fade = np.clip((d_mag - 70) / 60.0, 0, 1)
    alpha = np.where(edge, alpha * fade, alpha)

    # 去小噪点：只保留最大连通前景
    hard = alpha > 40
    labels = np.zeros((h, w), dtype=np.int32)
    cur = 0
    best_label, best_count = 0, 0
    for y in range(h):
        for x in range(w):
            if not hard[y, x] or labels[y, x]:
                continue
            cur += 1
            stack = [(y, x)]
            labels[y, x] = cur
            cnt = 0
            while stack:
                cy, cx = stack.pop()
                cnt += 1
                for ny in (cy - 1, cy, cy + 1):
                    for nx in (cx - 1, cx, cx + 1):
                        if 0 <= ny < h and 0 <= nx < w and hard[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = cur
                            stack.append((ny, nx))
            if cnt > best_count:
                best_count = cnt
                best_label = cur
    if best_label:
        alpha = np.where(labels == best_label, alpha, 0.0)

    # 去背景 spill：把高品红边像素往邻近前景色靠一点
    rgba = np.dstack([r, g, b, alpha]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def foot_y(alpha: np.ndarray, thr: float = 0.25) -> int:
    h, w = alpha.shape
    x0, x1 = int(w * 0.25), int(w * 0.75)
    band = alpha[:, x0:x1]
    for y in range(h - 1, -1, -1):
        if np.mean(band[y] > thr * 255) > 0.03:
            return y
    ys = np.where(alpha > thr * 255)[0]
    return int(ys.max()) if len(ys) else h - 1


def normalize_unit(rgba: Image.Image, size: int = 256, foot_margin: float = 0.06) -> Image.Image:
    arr = np.asarray(rgba).astype(np.float32)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    pad = int(0.04 * max(x1 - x0 + 1, y1 - y0 + 1))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgba.width - 1, x1 + pad), min(rgba.height - 1, y1 + pad)
    crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))
    c_alpha = np.asarray(crop)[:, :, 3]
    fy = foot_y(c_alpha)

    target_body = size * (1.0 - foot_margin - 0.04)
    scale = min((size * 0.88) / max(1, crop.width), target_body / max(1, fy + 1))
    nw = max(1, int(crop.width * scale))
    nh = max(1, int(crop.height * scale))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    foot_scaled = fy * scale

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - nw) // 2
    foot_px = size * (1.0 - foot_margin)
    oy = int(round(foot_px - foot_scaled))
    canvas.paste(scaled, (ox, oy), scaled)
    return canvas


def pick_cycle_frames(paths: list[Path], target: int = 8) -> list[Path]:
    """从密采样帧中均匀挑 target 帧（保留完整周期感）。"""
    if not paths:
        return []
    if len(paths) <= target:
        return paths
    # 丢掉首尾各 ~10%（常有静止/切镜），再均匀采样
    n = len(paths)
    a = max(0, int(n * 0.08))
    b = min(n, int(n * 0.92))
    mid = paths[a:b] if b - a >= target else paths
    idxs = [int(round(i * (len(mid) - 1) / (target - 1))) for i in range(target)]
    return [mid[i] for i in idxs]


def process_video(
    video: Path,
    class_id: str,
    action: str,
    fps: float = 10.0,
    target_frames: int = 8,
    size: int = 256,
) -> list[Path]:
    raw_dir = SCRATCH / f"{class_id}_{action}_raw"
    frames = extract_frames(video, raw_dir, fps=fps)
    picked = pick_cycle_frames(frames, target=target_frames)

    out_dir = OUT_GAME / "anim" / class_id / action
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    out_paths: list[Path] = []
    sheet_frames: list[Image.Image] = []
    for i, src in enumerate(picked):
        img = Image.open(src)
        rgba = chroma_key_rgba(img)
        unit = normalize_unit(rgba, size=size)
        dst = out_dir / f"{i:02d}.png"
        unit.save(dst)
        out_paths.append(dst)
        sheet_frames.append(unit)
        print(f"  OK {class_id}/{action}/{dst.name}")

    if sheet_frames:
        w, h = sheet_frames[0].size
        sheet = Image.new("RGBA", (w * len(sheet_frames), h), (0, 0, 0, 0))
        for i, fr in enumerate(sheet_frames):
            sheet.paste(fr, (i * w, 0), fr)
        sheet_path = OUT_GAME / "anim" / class_id / f"{action}_sheet.png"
        sheet.save(sheet_path)
        print(f"  sheet -> {sheet_path.relative_to(ROOT)}")

    # QA contact: checkerboard
    if sheet_frames:
        qa = SCRATCH / f"qa_{class_id}_{action}.png"
        cell = 160
        cols = min(4, len(sheet_frames))
        rows = (len(sheet_frames) + cols - 1) // cols
        qa_img = Image.new("RGB", (cols * cell, rows * cell), (40, 40, 40))
        for i, fr in enumerate(sheet_frames):
            r, c = divmod(i, cols)
            tile = Image.new("RGB", (cell - 8, cell - 8), (180, 180, 180))
            td = tile.load()
            for yy in range(0, cell - 8, 12):
                for xx in range(0, cell - 8, 12):
                    if ((xx // 12) + (yy // 12)) % 2 == 0:
                        for dy in range(12):
                            for dx in range(12):
                                if xx + dx < cell - 8 and yy + dy < cell - 8:
                                    td[xx + dx, yy + dy] = (90, 90, 90)
            p = fr.resize((cell - 28, cell - 28), Image.Resampling.LANCZOS)
            tile.paste(p, (10, 10), p)
            qa_img.paste(tile, (c * cell + 4, r * cell + 4))
        qa_img.save(qa)
        print(f"  QA {qa}")

    return out_paths


ACTIONS = ("idle", "walk", "run", "jump", "attack")

# class_action.mp4 → (class, action, target_frame_count)
VIDEO_MAP = [
    (f"{cls}_{act}.mp4", cls, act, nfr)
    for cls in ("warrior", "wizard", "taoist")
    for act, nfr in (
        ("idle", 6),
        ("walk", 10),
        ("run", 10),
        ("jump", 6),
        ("attack", 6),
    )
]


def refresh_static_units() -> None:
    """Re-export unit stills from bases (not used as idle pack when idle video exists)."""
    unit_dir = OUT_GAME / "unit"
    unit_dir.mkdir(parents=True, exist_ok=True)
    for cls in ("warrior", "wizard", "taoist"):
        base = ROOT / "assets" / "generated" / "unit" / f"{cls}_base.jpg"
        if not base.exists():
            continue
        rgba = chroma_key_rgba(Image.open(base))
        unit = normalize_unit(rgba, 256)
        unit.save(unit_dir / f"{cls}.png")
        print(f"  unit still {cls}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", type=Path, help="single video")
    ap.add_argument("--class-id", type=str)
    ap.add_argument("--action", type=str, choices=list(ACTIONS))
    ap.add_argument("--all", action="store_true", help="process all known videos in assets/generated/videos")
    ap.add_argument("--fps", type=float, default=10.0)
    ap.add_argument("--frames", type=int, default=8)
    args = ap.parse_args()

    SCRATCH.mkdir(parents=True, exist_ok=True)
    OUT_GAME.mkdir(parents=True, exist_ok=True)

    if args.all:
        vdir = ROOT / "assets" / "generated" / "videos"
        for name, cls, act, nfr in VIDEO_MAP:
            p = vdir / name
            if not p.exists():
                print(f"SKIP missing {name}")
                continue
            process_video(p, cls, act, fps=args.fps, target_frames=nfr)
        refresh_static_units()
    elif args.video and args.class_id and args.action:
        process_video(args.video, args.class_id, args.action, fps=args.fps, target_frames=args.frames)
    else:
        ap.error("use --all or --video/--class-id/--action")

    # manifest snippet
    man_path = OUT_GAME / "manifest.json"
    man = json.loads(man_path.read_text()) if man_path.exists() else {}
    man.setdefault("anim", {})
    man["videos"] = {}
    vdir = ROOT / "assets" / "generated" / "videos"
    for name, cls, act, _nfr in VIDEO_MAP:
        p = vdir / name
        if p.exists():
            man["videos"][f"{cls}/{act}"] = str(p.relative_to(ROOT)).replace("\\", "/")
    for cls in ("warrior", "wizard", "taoist"):
        man["anim"][cls] = {}
        for act in ACTIONS:
            d = OUT_GAME / "anim" / cls / act
            if d.exists():
                man["anim"][cls][act] = [
                    str(p.relative_to(ROOT)).replace("\\", "/")
                    for p in sorted(d.glob("*.png"))
                ]
    man_path.write_text(json.dumps(man, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Wrote", man_path)


if __name__ == "__main__":
    main()
