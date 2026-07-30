#!/usr/bin/env python3
"""Stage, audit, and promote true eight-direction monster animation packs.

New artwork is intentionally processed into ``staging/runtime_candidate`` first.
Promotion is a separate explicit operation and is refused unless every strict
structural/pixel/anchor check passes.  The script performs only deterministic
post-processing: fixed-cell extraction, chroma-spill cleanup, uniform scaling,
translation-only root/contact locking, atlas/QA rendering, and file copying.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import shutil
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont


FRAME_W = 384
FRAME_H = 256
CELL_W = 384
CELL_H = 256
TARGET_ROOT_X = 192
TARGET_CONTACT_Y = 236
EDGE_MARGIN = 7
ALPHA_THRESHOLD = 12
DIRECTIONS = ("e", "se", "s", "sw", "w", "nw", "n", "ne")
ACTIONS = ("idle", "walk", "attack", "death")
LOOP_ACTIONS = {"idle", "walk"}

HERE = Path(__file__).resolve().parent
ANIM_ROOT = HERE.parents[1]
QA_ROOT = ANIM_ROOT / "qa" / "monster_directional_wave1"

ROLE_CONFIG = {
    "wolf": {
        "target_idle_height": 190,
        "source_ids": {
            "e": "call_PDJ3o4Wv86Fwfors6WbrlauN",
            "se": "call_gZn82nQERpbsmhnJuCxg6QAy",
            "s": "call_goCQZ4kKsFXagcfgEa2U3i8D",
            "sw": "call_dnwinjVJScdgsZjGuHXypmWn",
            "w": "call_S5toupG3lCuXNvYDQWy6Jz2j",
            "nw": "call_YkDhX4ldwizZ7KDFld25uNfQ",
            "n": "call_I0dTSKLD5Hlvttjky4hVoSzj",
            "ne": "call_TGoB0TvkRU61h8vJM9mDn1Rt",
            "n_attack_retry": "call_yJG4ech4JcGYtz9J0MHT909z",
        },
        # The generated north attack row was rejected for sitting/bipedal
        # silhouettes.  The replacement source contains four grounded attack
        # candidates per row; row zero is the selected chronology.
        "overrides": {
            ("n", "attack"): ("n_attack_retry.png", 0),
        },
        "rejected": {
            "n/attack": "Original row rejected: sitting frame and bipedal/raised-forepaw silhouette.",
        },
        "selected_override_notes": {
            "n/attack": "n_attack_retry.png row 0: all-four-paws grounded replacement chronology.",
        },
    },
    "deer": {
        "target_idle_height": 190,
        "source_ids": {
            "e": "call_Uw5VGIdd9CDXtTBzMKAb48fw",
            "se": "call_KDfKyGW2EgSCME8dpA8N5IZQ",
            "s": "call_2EQYuhcTXMQ3zeslcL0n4XNv",
            "sw": "call_a55bpcwdKg2utMN2M4tszE9F",
            "w": "call_sv1mj70yILw1o1xz5kExLroH",
            "nw": "call_nKybQbCkntmgyCCy9rmgc4qR",
            "n": "call_gByyXVaw35T1aKVSkok9UPMR",
            "ne": "call_xRkXUrGGMM1uKTUS9pA4LFcr",
            "e_attack_retry": "call_foPHygi2RAFgn3Q9UlGgYcdk",
        },
        "overrides": {
            ("e", "attack"): ("e_attack_retry.png", 0),
        },
        "rejected": {
            "e/attack": "Original contact frame rejected: airborne dive plus baked magenta impact streaks.",
            "se/v1": "Entire first sheet rejected: generated flower/vine artifacts attached to the hooves.",
        },
        "selected_override_notes": {
            "e/attack": "e_attack_retry.png row 0: planted antler drive with no baked VFX.",
            "se": "Second independent source accepted after the artifact-bearing first source was discarded.",
        },
        # Cyclic rotations preserve authored chronology while choosing a clean
        # wrap boundary for the runtime loop.
        "loop_rotations": {
            ("e", "idle"): 2,
            ("s", "walk"): 1,
        },
    },
}


@dataclass
class FrameAudit:
    role: str
    direction: str
    action: str
    frame: int
    source_file: str
    source_row: int
    source_col: int
    source_bbox: tuple[int, int, int, int]
    source_edge_margin: int
    source_cross_cell_pixels: int
    scale: float
    output_bbox: tuple[int, int, int, int]
    root_x: float
    contact_y: float
    alpha_pixels: int
    partial_alpha_pixels: int
    magenta_pixels: int
    spill_pixels_neutralized: int
    source_sha256: str
    output_sha256: str


def _font(size: int = 16) -> ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                pass
    return ImageFont.load_default()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def alpha_bbox(image: Image.Image, threshold: int = ALPHA_THRESHOLD) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.where(alpha > threshold)
    if not len(xs):
        raise ValueError("empty alpha subject")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def edge_margin(bbox: tuple[int, int, int, int], width: int, height: int) -> int:
    x0, y0, x1, y1 = bbox
    return int(min(x0, y0, width - x1, height - y1))


def largest_component_bbox(
    image: Image.Image,
    threshold: int = 24,
) -> tuple[int, int, int, int]:
    """Return the main connected silhouette, ignoring isolated matte noise."""

    mask = np.asarray(image.getchannel("A")) > threshold
    visited = np.zeros(mask.shape, dtype=np.bool_)
    best_count = 0
    best_bbox: tuple[int, int, int, int] | None = None
    height, width = mask.shape
    for y, x in np.argwhere(mask):
        y = int(y)
        x = int(x)
        if visited[y, x]:
            continue
        queue = deque([(y, x)])
        visited[y, x] = True
        count = 0
        min_x = max_x = x
        min_y = max_y = y
        while queue:
            current_y, current_x = queue.popleft()
            count += 1
            min_x = min(min_x, current_x)
            max_x = max(max_x, current_x)
            min_y = min(min_y, current_y)
            max_y = max(max_y, current_y)
            for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                    if mask[next_y, next_x] and not visited[next_y, next_x]:
                        visited[next_y, next_x] = True
                        queue.append((next_y, next_x))
        if count > best_count:
            best_count = count
            best_bbox = (min_x, min_y, max_x + 1, max_y + 1)
    if best_bbox is None or best_count < 100:
        raise ValueError("no plausible connected silhouette")
    return best_bbox


def label_sheet_components(image: Image.Image, threshold: int = 24) -> tuple[np.ndarray, list[dict]]:
    """Label opaque subjects once so poses crossing nominal grid lines survive."""

    mask = np.asarray(image.getchannel("A")) > threshold
    labels = np.zeros(mask.shape, dtype=np.int32)
    components: list[dict] = []
    height, width = mask.shape
    next_label = 1
    for y, x in np.argwhere(mask):
        y = int(y)
        x = int(x)
        if labels[y, x]:
            continue
        queue = deque([(y, x)])
        labels[y, x] = next_label
        count = 0
        min_x = max_x = x
        min_y = max_y = y
        while queue:
            current_y, current_x = queue.popleft()
            count += 1
            min_x = min(min_x, current_x)
            max_x = max(max_x, current_x)
            min_y = min(min_y, current_y)
            max_y = max(max_y, current_y)
            for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                    if mask[next_y, next_x] and not labels[next_y, next_x]:
                        labels[next_y, next_x] = next_label
                        queue.append((next_y, next_x))
        if count >= 100:
            components.append(
                {
                    "label": next_label,
                    "count": count,
                    "bbox": (min_x, min_y, max_x + 1, max_y + 1),
                }
            )
        next_label += 1
    return labels, components


def estimate_contact(image: Image.Image, direction: str, action: str) -> float:
    alpha = np.asarray(image.getchannel("A")) > 48
    x0, y0, x1, y1 = alpha_bbox(image, 48)
    if action == "death":
        return float(y1 - 1)
    if action in LOOP_ACTIONS:
        lower_ys, _ = np.where(alpha & (np.indices(alpha.shape)[0] >= y0 + (y1 - y0) * 0.58))
        if len(lower_ys):
            return float(np.percentile(lower_ys, 99.2))
    columns: list[int] = []
    width = max(1, x1 - x0)
    for x in range(x0, x1):
        ys = np.flatnonzero(alpha[:, x])
        if not len(ys):
            continue
        relative = (x - x0) / width
        # Rear views have a central tail that can hang lower than the paws.
        if direction == "n" and 0.34 <= relative <= 0.66:
            continue
        columns.append(int(ys[-1]))
    if len(columns) < 8:
        columns = [int(np.flatnonzero(alpha[:, x])[-1]) for x in range(x0, x1) if alpha[:, x].any()]
    # Contact is the planted extremity, not the median underside of the torso.
    # The connected-subject filter already removed isolated matte specks, so a
    # high percentile is stable; north excludes its lower central tail above.
    return float(np.percentile(columns, 98))


def estimate_root_x(image: Image.Image, action: str) -> float:
    alpha = np.asarray(image.getchannel("A")) > 48
    x0, y0, x1, y1 = alpha_bbox(image, 48)
    if action == "death":
        ys, xs = np.where(alpha)
        return float(np.median(xs))
    height = y1 - y0
    band_range = (0.38, 0.58) if action == "idle" else (0.42, 0.64) if action == "walk" else (0.28, 0.62)
    band_top = y0 + int(height * band_range[0])
    band_bottom = y0 + max(1, int(height * band_range[1]))
    ys, xs = np.where(alpha[band_top:band_bottom])
    if not len(xs):
        ys, xs = np.where(alpha)
    return float(np.median(xs))


def neutralize_lower_magenta(image: Image.Image) -> tuple[Image.Image, int]:
    """Remove residual key reflection from paws/underside without repainting art."""

    array = np.array(image, dtype=np.uint8)
    x0, y0, x1, y1 = alpha_bbox(image)
    y_cut = y0 + int((y1 - y0) * 0.48)
    rgb = array[..., :3].astype(np.int16)
    alpha = array[..., 3]
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = (
        (alpha > 8)
        & (np.indices(alpha.shape)[0] >= y_cut)
        & (red - green > 8)
        & (blue - green > 8)
        & (red + blue - 2 * green > 34)
        & (red + blue > 44)
    )
    count = int(spill.sum())
    if count:
        luminance = np.clip(
            np.rint(red * 0.299 + green * 0.587 + blue * 0.114),
            0,
            255,
        ).astype(np.uint8)
        for channel in range(3):
            array[..., channel][spill] = luminance[spill]
    return Image.fromarray(array, "RGBA"), count


def magenta_pixel_count(image: Image.Image) -> int:
    array = np.asarray(image, dtype=np.int16)
    red, green, blue, alpha = (
        array[..., 0],
        array[..., 1],
        array[..., 2],
        array[..., 3],
    )
    x0, y0, x1, y1 = alpha_bbox(image)
    y_cut = y0 + int((y1 - y0) * 0.48)
    rows = np.indices(alpha.shape)[0]
    return int(
        (
            (alpha > 20)
            & (rows >= y_cut)
            & (red - green > 8)
            & (blue - green > 8)
            & (red + blue - 2 * green > 34)
            & (red + blue > 44)
        ).sum()
    )


def crop_source_cell(
    source: Image.Image,
    labels: np.ndarray,
    components: list[dict],
    row: int,
    col: int,
) -> tuple[Image.Image, tuple[int, int, int, int], int, int]:
    nominal = (
        col * CELL_W,
        row * CELL_H,
        (col + 1) * CELL_W,
        (row + 1) * CELL_H,
    )
    best_component: dict | None = None
    best_overlap = 0
    for component in components:
        label = component["label"]
        overlap = int(
            (
                labels[
                    nominal[1] : nominal[3],
                    nominal[0] : nominal[2],
                ]
                == label
            ).sum()
        )
        if overlap > best_overlap:
            best_overlap = overlap
            best_component = component
    if best_component is None or best_overlap < 100:
        raise ValueError(f"no component assigned to source cell row={row} col={col}")

    global_bbox = best_component["bbox"]
    margin = edge_margin(global_bbox, source.width, source.height)
    cross_cell_pixels = best_component["count"] - best_overlap
    padded = (
        max(0, global_bbox[0] - 4),
        max(0, global_bbox[1] - 4),
        min(source.width, global_bbox[2] + 4),
        min(source.height, global_bbox[3] + 4),
    )
    cropped = source.crop(padded)
    cropped_array = np.array(cropped)
    core = (
        labels[
            padded[1] : padded[3],
            padded[0] : padded[2],
        ]
        == best_component["label"]
    )
    # Include the helper's soft antialias fringe around the selected opaque
    # component while excluding every neighboring pose and isolated speck.
    keep = core.copy()
    for _ in range(3):
        expanded = keep.copy()
        expanded[1:, :] |= keep[:-1, :]
        expanded[:-1, :] |= keep[1:, :]
        expanded[:, 1:] |= keep[:, :-1]
        expanded[:, :-1] |= keep[:, 1:]
        expanded[1:, 1:] |= keep[:-1, :-1]
        expanded[:-1, :-1] |= keep[1:, 1:]
        expanded[1:, :-1] |= keep[:-1, 1:]
        expanded[:-1, 1:] |= keep[1:, :-1]
        keep = expanded
    cropped_array[~keep] = 0
    relative_bbox = (
        global_bbox[0] - nominal[0],
        global_bbox[1] - nominal[1],
        global_bbox[2] - nominal[0],
        global_bbox[3] - nominal[1],
    )
    return (
        Image.fromarray(cropped_array, "RGBA"),
        relative_bbox,
        margin,
        cross_cell_pixels,
    )


def role_sources(role: str) -> dict[str, Image.Image]:
    alpha_dir = HERE / role / "staging" / "alpha_v2"
    required = [f"{direction}.png" for direction in DIRECTIONS]
    required.extend(
        source_name
        for source_name, _ in ROLE_CONFIG[role].get("overrides", {}).values()
    )
    missing = sorted({name for name in required if not (alpha_dir / name).exists()})
    if missing:
        raise FileNotFoundError(f"{role}: missing chroma outputs: {', '.join(missing)}")
    return {
        name: Image.open(alpha_dir / name).convert("RGBA")
        for name in sorted(set(required))
    }


def source_selection(role: str, direction: str, action: str) -> tuple[str, int]:
    override = ROLE_CONFIG[role].get("overrides", {}).get((direction, action))
    if override:
        return override
    return f"{direction}.png", ACTIONS.index(action)


def build_role(role: str) -> tuple[list[FrameAudit], dict]:
    config = ROLE_CONFIG[role]
    sources = role_sources(role)
    source_components = {
        name: label_sheet_components(source)
        for name, source in sources.items()
    }
    source_dir = HERE / role / "staging" / "alpha_v2"
    stage_root = HERE / role / "staging" / "runtime_candidate"
    if stage_root.exists():
        shutil.rmtree(stage_root)
    stage_root.mkdir(parents=True, exist_ok=True)

    source_hashes = {name: sha256(source_dir / name) for name in sources}
    extracted: dict[tuple[str, str, int], dict] = {}

    for direction in DIRECTIONS:
        for action in ACTIONS:
            source_name, source_row = source_selection(role, direction, action)
            source = sources[source_name]
            labels, components = source_components[source_name]
            for frame in range(4):
                rotation = config.get("loop_rotations", {}).get((direction, action), 0)
                source_frame = (frame + rotation) % 4
                crop, bbox, margin, cross_cell_pixels = crop_source_cell(
                    source,
                    labels,
                    components,
                    source_row,
                    source_frame,
                )
                cleaned, spill_count = neutralize_lower_magenta(crop)
                extracted[(direction, action, frame)] = {
                    "image": cleaned,
                    "source_name": source_name,
                    "source_row": source_row,
                    "source_col": source_frame,
                    "source_bbox": bbox,
                    "source_margin": margin,
                    "source_cross_cell_pixels": cross_cell_pixels,
                    "spill_count": spill_count,
                }

    direction_scales: dict[str, float] = {}
    for direction in DIRECTIONS:
        idle_heights = [
            alpha_bbox(extracted[(direction, "idle", frame)]["image"])[3]
            - alpha_bbox(extracted[(direction, "idle", frame)]["image"])[1]
            for frame in range(4)
        ]
        desired_scale = float(config["target_idle_height"]) / float(median(idle_heights))
        max_left = 1.0
        max_right = 1.0
        max_top = 1.0
        max_bottom = 1.0
        max_height = 1.0
        for action in ACTIONS:
            for frame in range(4):
                image = extracted[(direction, action, frame)]["image"]
                bbox = alpha_bbox(image)
                root_x = estimate_root_x(image, action)
                contact_y = estimate_contact(image, direction, action)
                max_left = max(max_left, root_x - bbox[0])
                max_right = max(max_right, bbox[2] - root_x)
                max_height = max(max_height, bbox[3] - bbox[1])
                if action in LOOP_ACTIONS:
                    max_top = max(max_top, contact_y - bbox[1])
                    max_bottom = max(max_bottom, bbox[3] - contact_y)
        fit_scale = min(
            (TARGET_ROOT_X - EDGE_MARGIN) / max_left,
            (FRAME_W - EDGE_MARGIN - TARGET_ROOT_X) / max_right,
            (TARGET_CONTACT_Y - EDGE_MARGIN) / max_top,
            (FRAME_H - EDGE_MARGIN - TARGET_CONTACT_Y) / max_bottom,
            (FRAME_H - 2 * EDGE_MARGIN) / max_height,
        )
        direction_scales[direction] = min(desired_scale, fit_scale)

    audits: list[FrameAudit] = []
    runtime_frames: dict[tuple[str, str, int], Image.Image] = {}
    for direction in DIRECTIONS:
        scale = direction_scales[direction]
        for action in ACTIONS:
            action_dir = stage_root / direction / action
            action_dir.mkdir(parents=True, exist_ok=True)
            for frame in range(4):
                item = extracted[(direction, action, frame)]
                subject = item["image"]
                bbox = alpha_bbox(subject)
                subject = subject.crop(bbox)
                scaled_size = (
                    max(1, int(round(subject.width * scale))),
                    max(1, int(round(subject.height * scale))),
                )
                subject = subject.resize(scaled_size, Image.Resampling.LANCZOS)
                root_x = estimate_root_x(subject, action)
                contact_y = estimate_contact(subject, direction, action)
                paste_x = int(round(TARGET_ROOT_X - root_x))
                paste_y = int(round(TARGET_CONTACT_Y - contact_y))

                subject_bbox = alpha_bbox(subject)
                left = paste_x + subject_bbox[0]
                top = paste_y + subject_bbox[1]
                right = paste_x + subject_bbox[2]
                bottom = paste_y + subject_bbox[3]
                if left < EDGE_MARGIN:
                    paste_x += EDGE_MARGIN - left
                if right > FRAME_W - EDGE_MARGIN:
                    paste_x -= right - (FRAME_W - EDGE_MARGIN)
                if top < EDGE_MARGIN:
                    paste_y += EDGE_MARGIN - top
                if bottom > FRAME_H - EDGE_MARGIN:
                    paste_y -= bottom - (FRAME_H - EDGE_MARGIN)

                canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
                canvas.alpha_composite(subject, (paste_x, paste_y))
                canvas, post_scale_spill = neutralize_lower_magenta(canvas)
                output_path = action_dir / f"{frame:02d}.png"
                canvas.save(output_path, optimize=True)
                runtime_frames[(direction, action, frame)] = canvas

                output_bbox = alpha_bbox(canvas)
                output_contact = estimate_contact(canvas, direction, action)
                output_root = estimate_root_x(canvas, action)
                array = np.asarray(canvas)
                alpha = array[..., 3]
                audits.append(
                    FrameAudit(
                        role=role,
                        direction=direction,
                        action=action,
                        frame=frame,
                        source_file=item["source_name"],
                        source_row=item["source_row"],
                        source_col=item["source_col"],
                        source_bbox=item["source_bbox"],
                        source_edge_margin=item["source_margin"],
                        source_cross_cell_pixels=item["source_cross_cell_pixels"],
                        scale=round(scale, 6),
                        output_bbox=output_bbox,
                        root_x=round(output_root, 3),
                        contact_y=round(output_contact, 3),
                        alpha_pixels=int((alpha > 0).sum()),
                        partial_alpha_pixels=int(((alpha > 0) & (alpha < 255)).sum()),
                        magenta_pixels=magenta_pixel_count(canvas),
                        spill_pixels_neutralized=item["spill_count"] + post_scale_spill,
                        source_sha256=source_hashes[item["source_name"]],
                        output_sha256=sha256(output_path),
                    )
                )

    for direction in DIRECTIONS:
        for action in ACTIONS:
            atlas = Image.new("RGBA", (FRAME_W * 4, FRAME_H), (0, 0, 0, 0))
            for frame in range(4):
                atlas.alpha_composite(runtime_frames[(direction, action, frame)], (frame * FRAME_W, 0))
            atlas.save(stage_root / direction / f"{action}_sheet.png", optimize=True)

    sheet_paths = render_qa(role, runtime_frames, audits)
    verdict = strict_verdict(role, runtime_frames, audits)
    manifest = {
        "schema": 1,
        "role": role,
        "authoredDirections": list(DIRECTIONS),
        "actions": {action: {direction: 4 for direction in DIRECTIONS} for action in ACTIONS},
        "frameSize": [FRAME_W, FRAME_H],
        "anchor": {"rootX": TARGET_ROOT_X, "contactY": TARGET_CONTACT_Y},
        "oneShots": ["attack", "death"],
        "loops": ["idle", "walk"],
        "sources": config["source_ids"],
        "sourceOverrides": {
            f"{direction}/{action}": {"file": value[0], "row": value[1]}
            for (direction, action), value in config.get("overrides", {}).items()
        },
        "loopRotations": {
            f"{direction}/{action}": rotation
            for (direction, action), rotation in config.get("loop_rotations", {}).items()
        },
        "directionScales": {key: round(value, 6) for key, value in direction_scales.items()},
        "qa": {**verdict, "sheets": sheet_paths},
    }
    (stage_root / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    write_audits(role, audits, manifest)
    return audits, manifest


def _composite_on_background(frame: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    background = Image.new("RGBA", frame.size, color)
    background.alpha_composite(frame)
    return background


def render_qa(
    role: str,
    frames: dict[tuple[str, str, int], Image.Image],
    audits: list[FrameAudit],
) -> dict[str, list[str] | str]:
    role_qa = QA_ROOT / role
    role_qa.mkdir(parents=True, exist_ok=True)
    font = _font(15)
    small_font = _font(12)

    # Full fixed-cell chronology sheet: every direction, action, and frame.
    sheet = Image.new("RGBA", (2048, 1024), (17, 20, 24, 255))
    draw = ImageDraw.Draw(sheet)
    for direction_index, direction in enumerate(DIRECTIONS):
        block_x = (direction_index % 4) * 512
        block_y = (direction_index // 4) * 512
        draw.text((block_x + 8, block_y + 4), f"{role.upper()} · {direction.upper()}", fill=(255, 224, 151), font=font)
        for action_index, action in enumerate(ACTIONS):
            row_y = block_y + 28 + action_index * 118
            draw.text((block_x + 8, row_y + 2), action, fill=(214, 220, 228), font=small_font)
            for frame_index in range(4):
                thumb = frames[(direction, action, frame_index)].resize((120, 80), Image.Resampling.LANCZOS)
                x = block_x + 8 + frame_index * 124
                y = row_y + 22
                sheet.alpha_composite(_composite_on_background(thumb, (29, 34, 40, 255)), (x, y))
                draw.line((x, y + round(TARGET_CONTACT_Y * 80 / FRAME_H), x + 119, y + round(TARGET_CONTACT_Y * 80 / FRAME_H)), fill=(255, 70, 70, 180), width=1)
                draw.text((x + 3, y + 3), str(frame_index), fill=(255, 255, 255), font=small_font)
    chronology_path = role_qa / f"{role}_all_directions_actions.png"
    sheet.convert("RGB").save(chronology_path, quality=95)

    # Bounding-box and contact-line audit at readable 50% scale.
    bbox_sheet = Image.new("RGBA", (1536, 1024), (13, 15, 18, 255))
    bbox_draw = ImageDraw.Draw(bbox_sheet)
    audit_map = {(a.direction, a.action, a.frame): a for a in audits}
    for direction_index, direction in enumerate(DIRECTIONS):
        column = direction_index % 4
        group_row = direction_index // 4
        base_x = column * 384
        base_y = group_row * 512
        bbox_draw.text((base_x + 5, base_y + 4), direction.upper(), fill=(255, 224, 151), font=font)
        for action_index, action in enumerate(ACTIONS):
            y = base_y + 28 + action_index * 116
            bbox_draw.text((base_x + 3, y + 2), action, fill=(220, 225, 232), font=small_font)
            for frame_index in range(4):
                frame = frames[(direction, action, frame_index)].resize((90, 60), Image.Resampling.LANCZOS)
                x = base_x + 4 + frame_index * 94
                bbox_sheet.alpha_composite(_composite_on_background(frame, (31, 35, 40, 255)), (x, y + 18))
                audit = audit_map[(direction, action, frame_index)]
                bx0, by0, bx1, by1 = audit.output_bbox
                bbox_draw.rectangle(
                    (
                        x + round(bx0 * 90 / FRAME_W),
                        y + 18 + round(by0 * 60 / FRAME_H),
                        x + round(bx1 * 90 / FRAME_W),
                        y + 18 + round(by1 * 60 / FRAME_H),
                    ),
                    outline=(70, 220, 128, 255),
                    width=1,
                )
                bbox_draw.line(
                    (
                        x,
                        y + 18 + round(TARGET_CONTACT_Y * 60 / FRAME_H),
                        x + 89,
                        y + 18 + round(TARGET_CONTACT_Y * 60 / FRAME_H),
                    ),
                    fill=(255, 62, 62, 230),
                    width=1,
                )
    bbox_path = role_qa / f"{role}_bbox_anchor.png"
    bbox_sheet.convert("RGB").save(bbox_path, quality=95)

    # Every action/direction on all four adversarial backgrounds.
    multibg_paths: list[str] = []
    backgrounds = (
        (15, 18, 22, 255),
        (245, 245, 240, 255),
        (255, 0, 0, 255),
        (0, 42, 255, 255),
    )
    for direction in DIRECTIONS:
        page = Image.new("RGBA", (768, 512), (0, 0, 0, 255))
        page_draw = ImageDraw.Draw(page)
        for action_index, action in enumerate(ACTIONS):
            frame = frames[(direction, action, 2)].resize((192, 128), Image.Resampling.LANCZOS)
            for background_index, background in enumerate(backgrounds):
                x = background_index * 192
                y = action_index * 128
                page.alpha_composite(_composite_on_background(frame, background), (x, y))
                page_draw.text((x + 4, y + 4), f"{action} · {background_index}", fill=(255, 223, 134) if background_index != 1 else (30, 30, 30), font=small_font)
        path = role_qa / f"{role}_{direction}_multibg.png"
        page.convert("RGB").save(path, quality=95)
        multibg_paths.append(str(path.relative_to(QA_ROOT)))

    # Saturated red and blue enlarged foot crops for all periodic frames.
    foot_paths: list[str] = []
    for name, background in (("red", (255, 0, 0, 255)), ("blue", (0, 35, 255, 255))):
        page = Image.new("RGBA", (1280, 1024), background)
        page_draw = ImageDraw.Draw(page)
        for direction_index, direction in enumerate(DIRECTIONS):
            page_draw.text((4, direction_index * 128 + 4), direction.upper(), fill=(255, 255, 255), font=small_font)
            periodic = [("idle", i) for i in range(4)] + [("walk", i) for i in range(4)]
            for sequence_index, (action, frame_index) in enumerate(periodic):
                frame = frames[(direction, action, frame_index)]
                crop = frame.crop((72, 154, 312, 256)).resize((150, 128), Image.Resampling.NEAREST)
                x = 72 + sequence_index * 150
                y = direction_index * 128
                page.alpha_composite(_composite_on_background(crop, background), (x, y))
                page_draw.line((x, y + round((TARGET_CONTACT_Y - 154) * 128 / 102), x + 149, y + round((TARGET_CONTACT_Y - 154) * 128 / 102)), fill=(255, 255, 255, 190), width=1)
                page_draw.text((x + 3, y + 3), f"{action[0]}{frame_index}", fill=(255, 255, 255), font=small_font)
        path = role_qa / f"{role}_foot_crops_{name}.png"
        page.convert("RGB").save(path, quality=95)
        foot_paths.append(str(path.relative_to(QA_ROOT)))

    return {
        "chronology": str(chronology_path.relative_to(QA_ROOT)),
        "bboxAnchor": str(bbox_path.relative_to(QA_ROOT)),
        "multibg": multibg_paths,
        "footCrops": foot_paths,
    }


def frame_motion(a: Image.Image, b: Image.Image) -> float:
    first = np.asarray(a.convert("RGBA"), dtype=np.int16)
    second = np.asarray(b.convert("RGBA"), dtype=np.int16)
    return float(np.mean(np.abs(first - second)) / 255.0)


def strict_verdict(
    role: str,
    frames: dict[tuple[str, str, int], Image.Image],
    audits: list[FrameAudit],
) -> dict:
    failures: list[str] = []
    warnings: list[str] = []

    if len(audits) != len(DIRECTIONS) * len(ACTIONS) * 4:
        failures.append(f"expected 128 frames, found {len(audits)}")

    for audit in audits:
        if audit.source_edge_margin < 3:
            failures.append(f"{audit.direction}/{audit.action}/{audit.frame}: source crosses cell edge")
        if audit.alpha_pixels < 1200:
            failures.append(f"{audit.direction}/{audit.action}/{audit.frame}: implausibly small silhouette")
        if audit.magenta_pixels > 8:
            failures.append(f"{audit.direction}/{audit.action}/{audit.frame}: {audit.magenta_pixels} magenta spill pixels")
        if edge_margin(audit.output_bbox, FRAME_W, FRAME_H) < EDGE_MARGIN:
            failures.append(f"{audit.direction}/{audit.action}/{audit.frame}: output clipping risk")

    for direction in DIRECTIONS:
        for action in LOOP_ACTIONS:
            group = [a for a in audits if a.direction == direction and a.action == action]
            contact_spread = max(a.contact_y for a in group) - min(a.contact_y for a in group)
            root_spread = max(a.root_x for a in group) - min(a.root_x for a in group)
            if contact_spread > 2.5:
                failures.append(f"{direction}/{action}: contact spread {contact_spread:.2f}px")
            if root_spread > 4.0:
                failures.append(f"{direction}/{action}: torso-root spread {root_spread:.2f}px")
            motions = [
                frame_motion(frames[(direction, action, index)], frames[(direction, action, (index + 1) % 4)])
                for index in range(4)
            ]
            if min(motions) < 0.0008:
                failures.append(f"{direction}/{action}: duplicate/near-duplicate transition {min(motions):.6f}")
            adjacent_motion = motions[:3]
            min_motion_ratio = min(adjacent_motion) / max(
                0.000001,
                float(median(adjacent_motion)),
            )
            if min_motion_ratio < 0.30:
                failures.append(
                    f"{direction}/{action}: duplicate-phase ratio {min_motion_ratio:.3f}<0.30"
                )
            seam_ratio = motions[-1] / max(0.000001, sum(motions[:3]) / 3)
            if seam_ratio > 1.5:
                failures.append(f"{direction}/{action}: loop seam ratio {seam_ratio:.3f}>1.5")

        attack_motions = [
            frame_motion(frames[(direction, "attack", index)], frames[(direction, "attack", index + 1)])
            for index in range(3)
        ]
        if min(attack_motions) < 0.0015:
            failures.append(f"{direction}/attack: weak chronology transition {min(attack_motions):.6f}")

        final_bbox = alpha_bbox(frames[(direction, "death", 3)])
        final_ratio = (final_bbox[3] - final_bbox[1]) / max(1, final_bbox[2] - final_bbox[0])
        if final_ratio > 0.78:
            failures.append(f"{direction}/death: final corpse is not convincingly prone ({final_ratio:.3f})")
        elif final_ratio > 0.66:
            warnings.append(f"{direction}/death: final corpse ratio is high ({final_ratio:.3f})")

    idle_heights = {}
    for direction in DIRECTIONS:
        values = []
        for frame_index in range(4):
            bbox = alpha_bbox(frames[(direction, "idle", frame_index)])
            values.append(bbox[3] - bbox[1])
        idle_heights[direction] = float(median(values))
        if idle_heights[direction] < 160:
            failures.append(
                f"{direction}/idle: authored silhouette too small ({idle_heights[direction]:.1f}px)"
            )
    smallest_idle = min(idle_heights.values())
    largest_idle = max(idle_heights.values())
    if largest_idle / max(1.0, smallest_idle) > 1.16:
        failures.append(
            "cross-direction idle scale mismatch "
            f"({smallest_idle:.1f}px–{largest_idle:.1f}px)"
        )

    status = "pass" if not failures else "fail"
    score = max(0, 100 - len(failures) * 8 - len(warnings) * 2)
    return {
        "status": status,
        "strictScore": score,
        "failures": failures,
        "warnings": warnings,
        "criteria": {
            "explicitFrames": 128,
            "sourceCellMarginMin": 3,
            "outputMarginMin": EDGE_MARGIN,
            "loopContactSpreadMax": 2.5,
            "loopRootSpreadMax": 4.0,
            "deathFinalProneRatioMax": 0.78,
            "magentaPixelsMax": 8,
            "idleHeightMin": 160,
            "crossDirectionIdleHeightRatioMax": 1.16,
            "loopSeamRatioMax": 1.5,
            "minMotionRatioMin": 0.30,
        },
    }


def write_audits(role: str, audits: list[FrameAudit], manifest: dict) -> None:
    role_qa = QA_ROOT / role
    role_qa.mkdir(parents=True, exist_ok=True)
    json_path = role_qa / f"{role}_audit.json"
    json_path.write_text(
        json.dumps(
            {
                "manifest": manifest,
                "frames": [asdict(audit) for audit in audits],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    tsv_path = role_qa / f"{role}_audit.tsv"
    rows = [asdict(audit) for audit in audits]
    with tsv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)

    prompt_log = role_qa / f"{role}_source_provenance.json"
    prompt_log.write_text(
        json.dumps(
            {
                "generator": "built-in GPT Image via image_gen",
                "postProcessing": [
                    "official remove_chroma_key.py helper",
                    "fixed 384x256 cell extraction",
                    "lower-body chroma-spill neutralization",
                    "uniform per-direction scaling",
                    "translation-only torso/contact locking",
                ],
                "videoUsed": False,
                "sources": ROLE_CONFIG[role]["source_ids"],
                "rejected": ROLE_CONFIG[role].get("rejected", {}),
                "selectedOverride": ROLE_CONFIG[role].get("selected_override_notes", {}),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def promote(role: str) -> None:
    stage_root = HERE / role / "staging" / "runtime_candidate"
    manifest_path = stage_root / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"{role}: no staged manifest; run --stage first")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("qa", {}).get("status") != "pass":
        failures = manifest.get("qa", {}).get("failures", [])
        raise RuntimeError(f"{role}: refusing promotion; strict QA failed: {failures}")
    for direction in DIRECTIONS:
        for action in ACTIONS:
            destination = HERE / role / direction / action
            destination.mkdir(parents=True, exist_ok=True)
            for frame in range(4):
                source = stage_root / direction / action / f"{frame:02d}.png"
                shutil.copy2(source, destination / source.name)
            sheet = stage_root / direction / f"{action}_sheet.png"
            shutil.copy2(sheet, (HERE / role / direction) / sheet.name)
    shutil.copy2(manifest_path, HERE / role / "manifest.json")
    print(f"promoted {role}: 128 authored runtime frames")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", choices=sorted(ROLE_CONFIG), default="wolf")
    parser.add_argument("--stage", action="store_true", help="Build staging candidates and QA")
    parser.add_argument("--promote", action="store_true", help="Promote only a passing staged pack")
    args = parser.parse_args()
    if not args.stage and not args.promote:
        parser.error("choose --stage and/or --promote")
    if args.stage:
        _, manifest = build_role(args.role)
        qa = manifest["qa"]
        print(f"staged {args.role}: {qa['status']} score={qa['strictScore']}")
        for failure in qa["failures"]:
            print(f"FAIL: {failure}")
        for warning in qa["warnings"]:
            print(f"WARN: {warning}")
    if args.promote:
        promote(args.role)


if __name__ == "__main__":
    main()
