#!/usr/bin/env python3
"""Chroma-key magenta sprites, resize, build animation frame packs + sheets."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "assets" / "generated"
OUT = ROOT / "assets" / "game"
SCRATCH = Path("/var/folders/96/l70q12vj1yg7ct4x6p96ry9c0000gn/T/grok-goal-de3725103c94/implementer")


def chroma_key(img: Image.Image, thr: float = 55.0) -> Image.Image:
    """Remove near-magenta / hot-pink background to RGBA."""
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    # magenta key: high R+B, low G
    mag = (r + b) / 2.0 - g
    pink = (r > 180) & (b > 140) & (g < 160)
    dist_mag = np.sqrt((r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2)
    mask = (dist_mag < thr * 3.2) | pink | (mag > 70)
    # also pure-ish purple-pink
    mask = mask | ((r > 200) & (b > 180) & (g < 120))
    alpha = np.where(mask, 0.0, a)
    # soft edge
    edge = (dist_mag >= thr * 2.0) & (dist_mag < thr * 3.2)
    alpha = np.where(edge, np.clip((dist_mag - thr * 2.0) / (thr * 1.2) * a, 0, 255), alpha)
    out = arr.copy()
    out[:, :, 3] = alpha
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def trim_and_fit(rgba: Image.Image, size: int, foot_y: float = 0.92) -> Image.Image:
    arr = np.asarray(rgba)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    pad = int(0.04 * max(x1 - x0 + 1, y1 - y0 + 1))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgba.width - 1, x1 + pad), min(rgba.height - 1, y1 + pad)
    crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))
    scale = min((size * 0.9) / crop.width, (size * 0.88) / crop.height)
    nw, nh = max(1, int(crop.width * scale)), max(1, int(crop.height * scale))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - nw) // 2
    oy = int(size * foot_y - nh)
    oy = max(0, min(size - nh, oy))
    canvas.paste(scaled, (ox, oy), scaled)
    return canvas


def process_one(src: Path, dst: Path, size: int) -> None:
    img = Image.open(src)
    rgba = chroma_key(img)
    out = trim_and_fit(rgba, size)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    print(f"OK {src.name} -> {dst.relative_to(ROOT)}")


def sheet(frames: list[Image.Image], path: Path) -> None:
    if not frames:
        return
    w, h = frames[0].size
    sheet_img = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet_img.paste(fr, (i * w, 0), fr)
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet_img.save(path)


def main() -> None:
    # static units
    unit_map = {
        "warrior": GEN / "unit" / "warrior_base.jpg",
        "wizard": GEN / "unit" / "wizard_base.jpg",
        "taoist": GEN / "unit" / "taoist_base.jpg",
    }
    for k, p in unit_map.items():
        if p.exists():
            process_one(p, OUT / "unit" / f"{k}.png", 256)
            # portrait crop-ish: reuse full processed at 128
            process_one(p, OUT / "portrait" / f"{k}.png", 256)
            img = Image.open(OUT / "portrait" / f"{k}.png").resize((128, 128), Image.Resampling.LANCZOS)
            img.save(OUT / "portrait" / f"{k}_128.png")

    for name in ("deer", "zombie", "skeleton", "orc", "bat", "guardian"):
        p = GEN / "mob" / f"{name}.jpg"
        if p.exists():
            process_one(p, OUT / "mob" / f"{name}.png", 256)

    for name in ("healer", "merchant", "warehouse"):
        p = GEN / "npc" / f"{name}.jpg"
        if p.exists():
            process_one(p, OUT / "npc" / f"{name}.png", 256)

    for name in ("town", "field", "temple"):
        p = GEN / "map" / f"{name}.jpg"
        if p.exists():
            img = Image.open(p).convert("RGB")
            img = img.resize((1920, 1080), Image.Resampling.LANCZOS)
            dst = OUT / "map" / f"{name}.jpg"
            dst.parent.mkdir(parents=True, exist_ok=True)
            img.save(dst, quality=88)
            print(f"OK map {name}")

    # portraits from dedicated gens if present
    for name, file in (
        ("warrior", "warrior_port.jpg"),
        ("wizard", "wizard_port.jpg"),
        ("taoist", "taoist_port.jpg"),
    ):
        p = GEN / "portrait" / file
        if p.exists():
            process_one(p, OUT / "portrait" / f"{name}_face.png", 256)
            Image.open(OUT / "portrait" / f"{name}_face.png").resize((128, 128), Image.Resampling.LANCZOS).save(
                OUT / "portrait" / f"{name}_128.png"
            )

    # UI
    for name in ("panel.jpg", "items_sheet.jpg"):
        p = GEN / "ui" / name
        if p.exists():
            dst = OUT / "ui" / name.replace(".jpg", ".png")
            dst.parent.mkdir(parents=True, exist_ok=True)
            Image.open(p).convert("RGBA").save(dst)
            print(f"OK ui {name}")

    # Animation frames: base + keyframes from anim_raw
    # Manual mapping after inspection defaults: include base as idle
    anim_sources = {
        "warrior": {
            "idle": [GEN / "unit" / "warrior_base.jpg"],
            "walk": [GEN / "unit" / "warrior_base.jpg"],
            "attack": [GEN / "unit" / "warrior_base.jpg"],
        },
        "wizard": {
            "idle": [GEN / "unit" / "wizard_base.jpg"],
            "walk": [GEN / "unit" / "wizard_base.jpg"],
            "attack": [GEN / "unit" / "wizard_base.jpg"],
        },
        "taoist": {
            "idle": [GEN / "unit" / "taoist_base.jpg"],
            "walk": [GEN / "unit" / "taoist_base.jpg"],
            "attack": [GEN / "unit" / "taoist_base.jpg"],
        },
    }

    # attach anim_raw frames if manifest exists
    manifest_path = GEN / "anim_manifest.json"
    if manifest_path.exists():
        anim_sources = json.loads(manifest_path.read_text())
        # resolve relative paths
        for cls, acts in anim_sources.items():
            for act, paths in acts.items():
                anim_sources[cls][act] = [ROOT / p if not Path(p).is_absolute() else Path(p) for p in paths]

    for cls, acts in anim_sources.items():
        for act, paths in acts.items():
            frames = []
            out_dir = OUT / "anim" / cls / act
            if out_dir.exists():
                shutil.rmtree(out_dir)
            out_dir.mkdir(parents=True, exist_ok=True)
            for i, p in enumerate(paths):
                p = Path(p)
                if not p.exists():
                    continue
                rgba = trim_and_fit(chroma_key(Image.open(p)), 256)
                dst = out_dir / f"{i:02d}.png"
                rgba.save(dst)
                frames.append(rgba)
            if frames:
                # ensure loop: if only 1 frame for walk, duplicate with mirror
                if act == "walk" and len(frames) == 1:
                    mir = frames[0].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                    # don't mirror facing - instead slight vertical shift clones
                    frames = [frames[0], frames[0]]
                sheet(frames, OUT / "anim" / cls / f"{act}_sheet.png")
                print(f"OK anim {cls}/{act} x{len(frames)}")

    # write runtime manifest
    runtime = {"units": {}, "mobs": {}, "npc": {}, "maps": {}, "anim": {}}
    for cls in ("warrior", "wizard", "taoist"):
        runtime["units"][cls] = f"assets/game/unit/{cls}.png"
        runtime["anim"][cls] = {}
        for act in ("idle", "walk", "attack"):
            d = OUT / "anim" / cls / act
            if d.exists():
                runtime["anim"][cls][act] = sorted(
                    str(p.relative_to(ROOT)).replace("\\", "/") for p in d.glob("*.png")
                )
    for m in ("deer", "zombie", "skeleton", "orc", "bat", "guardian"):
        if (OUT / "mob" / f"{m}.png").exists():
            runtime["mobs"][m] = f"assets/game/mob/{m}.png"
    for n in ("healer", "merchant", "warehouse"):
        if (OUT / "npc" / f"{n}.png").exists():
            runtime["npc"][n] = f"assets/game/npc/{n}.png"
    for m in ("town", "field", "temple"):
        if (OUT / "map" / f"{m}.jpg").exists():
            runtime["maps"][m] = f"assets/game/map/{m}.jpg"

    man = OUT / "manifest.json"
    man.write_text(json.dumps(runtime, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Wrote", man)


if __name__ == "__main__":
    main()
