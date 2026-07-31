#!/usr/bin/env python3
from pathlib import Path
import numpy as np
from PIL import Image
from scripts.commercial_anim_pipeline import (
    normalize_pack, write_pack, qa_pack, alpha_bbox, waist_root_x, foot_contact_y,
    FRAME_COUNT, OUT_ROOT, CLASSES, DIRECTIONS, ACTIONS, write_manifest, CELL,
)


def fix_pack(class_id: str, direction: str, action: str) -> dict:
    folder = OUT_ROOT / class_id / direction / action
    frames = [Image.open(folder / f"{i:02d}.png").convert("RGBA") for i in range(FRAME_COUNT)]
    heights = [max(1, alpha_bbox(f)[3] - alpha_bbox(f)[1]) for f in frames]
    med = float(np.median(heights))
    eq = []
    for frame, height in zip(frames, heights):
        scale = med / height
        if abs(scale - 1) > 1e-3:
            eq.append(
                frame.resize(
                    (max(1, int(frame.width * scale)), max(1, int(frame.height * scale))),
                    Image.Resampling.LANCZOS,
                )
            )
        else:
            eq.append(frame)
    locked, metrics = normalize_pack(eq)
    write_pack(class_id, direction, action, locked)
    result = qa_pack(locked, {**metrics, "action": action})
    print(class_id, direction, action, "PASS" if result["pass"] else result["fails"])
    return result


def main() -> None:
    for args in [
        ("warrior", "e", "walk"),
        ("warrior", "w", "walk"),
        ("warrior", "n", "walk"),
        ("taoist", "nw", "idle"),
        ("taoist", "nw", "run"),
    ]:
        fix_pack(*args)

    fails = []
    for class_id in CLASSES:
        for direction in DIRECTIONS:
            for action in ACTIONS:
                frames = [
                    Image.open(OUT_ROOT / class_id / direction / action / f"{i:02d}.png").convert("RGBA")
                    for i in range(FRAME_COUNT)
                ]
                assert all(frame.size == (CELL, CELL) for frame in frames)
                heights = [alpha_bbox(f)[3] - alpha_bbox(f)[1] for f in frames]
                med = float(np.median(heights)) or 1.0
                metrics = {
                    "lockedRootXRange": max(waist_root_x(f) for f in frames) - min(waist_root_x(f) for f in frames),
                    "lockedFootYRange": max(foot_contact_y(f) for f in frames) - min(foot_contact_y(f) for f in frames),
                    "heightCv": float(np.std(heights)) / med,
                    "action": action,
                }
                result = qa_pack(frames, metrics)
                if not result["pass"]:
                    fails.append((class_id, direction, action, result["fails"]))
    print("AUDIT_FAILS", len(fails))
    for item in fails:
        print(item)
    for class_id in CLASSES:
        write_manifest(class_id)


if __name__ == "__main__":
    main()
