#!/usr/bin/env python3
"""Cut a GPT Image 2x2 chroma atlas into transparent runtime scenery sprites."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


NAMES = ("tree_old", "tree_wind", "pine_blue", "grove_fern")
QA_BACKGROUNDS = ((29, 34, 40, 255), (215, 205, 181, 255), (55, 76, 43, 255))


def chroma_key(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    distance = np.sqrt(
        np.square(rgb[..., 0] - 255)
        + np.square(rgb[..., 1])
        + np.square(rgb[..., 2] - 255)
    )
    alpha = np.clip((distance - 8) / 62, 0, 1)
    alpha = np.power(alpha, 0.82)
    green = rgb[..., 1]
    magenta_excess = np.maximum(0, np.minimum(rgb[..., 0], rgb[..., 2]) - green)
    # Euclidean distance alone treats darker anti-aliased key pixels as opaque.
    # Suppress the distinctive magenta hue as well as the exact key colour.
    alpha = np.minimum(alpha, np.clip((52 - magenta_excess) / 24, 0, 1))

    # Remove reflected key colour from semi-transparent edge pixels.
    edge = (alpha > 0) & (alpha < 0.98)
    correction = magenta_excess * (1 - alpha) * 0.86
    rgb[..., 0] = np.where(edge, np.maximum(green, rgb[..., 0] - correction), rgb[..., 0])
    rgb[..., 2] = np.where(edge, np.maximum(green, rgb[..., 2] - correction), rgb[..., 2])

    rgba = np.dstack((np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)))
    return Image.fromarray(rgba, "RGBA")


def trimmed(image: Image.Image, padding: int = 18) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.where(alpha > 14)
    if not len(xs):
        raise ValueError("empty vegetation cell after chroma key")
    x0 = max(0, int(xs.min()) - padding)
    y0 = max(0, int(ys.min()) - padding)
    x1 = min(image.width, int(xs.max()) + padding + 1)
    y1 = min(image.height, int(ys.max()) + padding + 1)
    return image.crop((x0, y0, x1, y1))


def magenta_pixels(image: Image.Image) -> int:
    rgba = np.asarray(image).astype(np.int16)
    red, green, blue, alpha = (rgba[..., index] for index in range(4))
    return int(
        (
            (alpha > 20)
            & (red > 150)
            & (blue > 150)
            & (green + 52 < np.minimum(red, blue))
        ).sum()
    )


def fit_preview(image: Image.Image, size: int = 360) -> Image.Image:
    scale = min((size - 28) / image.width, (size - 28) / image.height)
    fitted = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, size - fitted.height - 12))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--qa-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.qa_dir.mkdir(parents=True, exist_ok=True)
    atlas = Image.open(args.input).convert("RGB")
    cell_w = atlas.width // 2
    cell_h = atlas.height // 2
    report = {"source": str(args.input), "sourceSize": [atlas.width, atlas.height], "sprites": []}
    sprites: list[tuple[str, Image.Image]] = []

    for index, name in enumerate(NAMES):
        col = index % 2
        row = index // 2
        cell = atlas.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        sprite = trimmed(chroma_key(cell))
        output = args.output_dir / f"{name}.png"
        sprite.save(output, optimize=True)
        alpha = np.asarray(sprite.getchannel("A"))
        entry = {
            "id": name,
            "path": str(output),
            "size": [sprite.width, sprite.height],
            "alphaPixels": int((alpha > 0).sum()),
            "partialAlphaPixels": int(((alpha > 0) & (alpha < 255)).sum()),
            "magentaPixels": magenta_pixels(sprite),
        }
        if entry["magentaPixels"]:
            raise ValueError(f"{name}: residual magenta pixels ({entry['magentaPixels']})")
        report["sprites"].append(entry)
        sprites.append((name, sprite))

    tile = 360
    qa = Image.new("RGBA", (tile * len(QA_BACKGROUNDS), tile * len(sprites)), (0, 0, 0, 255))
    draw = ImageDraw.Draw(qa)
    for row, (name, sprite) in enumerate(sprites):
        preview = fit_preview(sprite, tile)
        for col, background in enumerate(QA_BACKGROUNDS):
            x = col * tile
            y = row * tile
            panel = Image.new("RGBA", (tile, tile), background)
            panel.alpha_composite(preview)
            qa.alpha_composite(panel, (x, y))
            draw.text((x + 10, y + 8), name, fill=(255, 236, 190, 255))
    qa.save(args.qa_dir / "vegetation_multibg.png", optimize=True)
    (args.qa_dir / "vegetation_audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
