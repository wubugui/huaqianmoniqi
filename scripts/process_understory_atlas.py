#!/usr/bin/env python3
"""Split the GPT Image 3x3 understory atlas into transparent game sprites."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


NAMES = (
    "shrub_dense",
    "fern_patch",
    "grass_dry",
    "grass_lush",
    "flower_wild",
    "fallen_log",
    "stone_cluster",
    "bramble",
    "sapling",
)
QA_BACKGROUNDS = ((24, 29, 35, 255), (220, 211, 190, 255), (58, 77, 43, 255))


def chroma_key(image: Image.Image) -> Image.Image:
    """Remove GPT Image's flat magenta key while despilling antialiased edges."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    distance = np.sqrt(
        np.square(rgb[..., 0] - 255)
        + np.square(rgb[..., 1])
        + np.square(rgb[..., 2] - 255)
    )
    alpha = np.clip((distance - 7) / 60, 0, 1)
    alpha = np.power(alpha, 0.84)
    green = rgb[..., 1]
    magenta_excess = np.maximum(0, np.minimum(rgb[..., 0], rgb[..., 2]) - green)
    alpha = np.minimum(alpha, np.clip((50 - magenta_excess) / 23, 0, 1))

    edge = (alpha > 0) & (alpha < 0.985)
    correction = magenta_excess * (1 - alpha) * 0.9
    rgb[..., 0] = np.where(edge, np.maximum(green, rgb[..., 0] - correction), rgb[..., 0])
    rgb[..., 2] = np.where(edge, np.maximum(green, rgb[..., 2] - correction), rgb[..., 2])
    rgba = np.dstack((np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)))
    return Image.fromarray(rgba, "RGBA")


def trim(image: Image.Image, padding: int = 14) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.where(alpha > 12)
    if not len(xs):
        raise ValueError("empty atlas cell after chroma removal")
    return image.crop((
        max(0, int(xs.min()) - padding),
        max(0, int(ys.min()) - padding),
        min(image.width, int(xs.max()) + padding + 1),
        min(image.height, int(ys.max()) + padding + 1),
    ))


def residual_magenta(image: Image.Image) -> int:
    rgba = np.asarray(image).astype(np.int16)
    red, green, blue, alpha = (rgba[..., index] for index in range(4))
    return int(
        (
            (alpha > 20)
            & (red > 145)
            & (blue > 145)
            & (green + 50 < np.minimum(red, blue))
        ).sum()
    )


def fitted_preview(image: Image.Image, size: int = 300) -> Image.Image:
    scale = min((size - 24) / image.width, (size - 24) / image.height)
    fitted = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, size - fitted.height - 10))
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
    report = {
        "generator": "built-in GPT Image",
        "source": str(args.input),
        "sourceSize": [atlas.width, atlas.height],
        "grid": [3, 3],
        "sprites": [],
    }
    sprites: list[tuple[str, Image.Image]] = []

    for index, name in enumerate(NAMES):
        col = index % 3
        row = index // 3
        x0 = round(col * atlas.width / 3)
        x1 = round((col + 1) * atlas.width / 3)
        y0 = round(row * atlas.height / 3)
        y1 = round((row + 1) * atlas.height / 3)
        sprite = trim(chroma_key(atlas.crop((x0, y0, x1, y1))))
        output = args.output_dir / f"{name}.png"
        sprite.save(output, optimize=True)
        alpha = np.asarray(sprite.getchannel("A"))
        entry = {
            "id": name,
            "path": str(output),
            "size": [sprite.width, sprite.height],
            "alphaPixels": int((alpha > 0).sum()),
            "partialAlphaPixels": int(((alpha > 0) & (alpha < 255)).sum()),
            "transparentCorners": [
                int(alpha[0, 0]),
                int(alpha[0, -1]),
                int(alpha[-1, 0]),
                int(alpha[-1, -1]),
            ],
            "magentaPixels": residual_magenta(sprite),
        }
        if any(entry["transparentCorners"]):
            raise ValueError(f"{name}: crop corners are not transparent")
        if entry["magentaPixels"]:
            raise ValueError(f"{name}: residual magenta pixels ({entry['magentaPixels']})")
        report["sprites"].append(entry)
        sprites.append((name, sprite))

    tile = 300
    qa = Image.new(
        "RGBA",
        (tile * len(QA_BACKGROUNDS), tile * len(sprites)),
        (0, 0, 0, 255),
    )
    draw = ImageDraw.Draw(qa)
    for row, (name, sprite) in enumerate(sprites):
        preview = fitted_preview(sprite, tile)
        for col, background in enumerate(QA_BACKGROUNDS):
            x = col * tile
            y = row * tile
            panel = Image.new("RGBA", (tile, tile), background)
            panel.alpha_composite(preview)
            qa.alpha_composite(panel, (x, y))
            draw.text((x + 9, y + 7), name, fill=(255, 237, 194, 255))
    qa_path = args.qa_dir / "understory_multibg.png"
    qa.save(qa_path, optimize=True)
    (args.qa_dir / "understory_audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
