#!/usr/bin/env python3
"""Build anchored, transparent 8-way warrior runtime frames and visual QA.

Seven GPT Image turnaround sheets are segmented by connected subject rather
than by hard grid crops.  That matters for thrusts and sword tips which cross
the nominal 256px cell boundary.  The existing authored east-facing frames
are padded and anchored into the same runtime canvas.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ANIM_ROOT = ROOT / "assets/game/anim"
INPUT_ROOT = ANIM_ROOT / "directional/warrior/alpha"
OUTPUT_ROOT = ANIM_ROOT / "directional/warrior"
QA_ROOT = ANIM_ROOT / "qa"

DIRECTIONS = ("e", "se", "s", "sw", "w", "nw", "n", "ne")
GENERATED_DIRECTIONS = tuple(direction for direction in DIRECTIONS if direction != "e")
ACTIONS = ("idle", "walk", "run", "attack")
ACTION_ROWS = {action: index for index, action in enumerate(ACTIONS)}
LEGACY_COUNTS = {"idle": 6, "walk": 10, "run": 10, "attack": 6}
GENERATED_COUNT = 6

SOURCE_CELL = 256
FRAME_WIDTH = 384
FRAME_HEIGHT = 256
ANCHOR_X = FRAME_WIDTH // 2
CONTACT_Y = 240
ALPHA_THRESHOLD = 18
TARGET_IDLE_HEIGHT = 224


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()
    return bbox or (0, 0, 1, 1)


def connected_components(mask: np.ndarray) -> list[np.ndarray]:
    """Return 8-connected alpha components with at least six pixels."""
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[np.ndarray] = []
    for start_y, start_x in np.argwhere(mask):
        if visited[start_y, start_x]:
            continue
        queue = deque([(int(start_y), int(start_x))])
        visited[start_y, start_x] = True
        coords: list[tuple[int, int]] = []
        while queue:
            y, x = queue.popleft()
            coords.append((y, x))
            for yy in range(max(0, y - 1), min(height, y + 2)):
                for xx in range(max(0, x - 1), min(width, x + 2)):
                    if mask[yy, xx] and not visited[yy, xx]:
                        visited[yy, xx] = True
                        queue.append((yy, xx))
        if len(coords) >= 6:
            components.append(np.asarray(coords, dtype=np.int32))
    return components


def subject_from_component(sheet: Image.Image, component: np.ndarray) -> Image.Image:
    y0, x0 = component.min(axis=0)
    y1, x1 = component.max(axis=0) + 1
    pad = 3
    left = max(0, int(x0) - pad)
    top = max(0, int(y0) - pad)
    right = min(sheet.width, int(x1) + pad)
    bottom = min(sheet.height, int(y1) + pad)
    rgba = np.asarray(sheet.crop((left, top, right, bottom)), dtype=np.uint8).copy()
    keep = np.zeros((bottom - top, right - left), dtype=bool)
    keep[component[:, 0] - top, component[:, 1] - left] = True
    rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
    return Image.fromarray(rgba, "RGBA")


def segment_sheet(path: Path) -> tuple[list[list[Image.Image]], dict]:
    sheet = Image.open(path).convert("RGBA")
    alpha = np.asarray(sheet.getchannel("A"), dtype=np.uint8)
    components = [
        component
        for component in connected_components(alpha > ALPHA_THRESHOLD)
        if len(component) >= 2_000
    ]
    if len(components) != len(ACTIONS) * GENERATED_COUNT:
        raise RuntimeError(
            f"{path.name}: expected 24 connected subjects, found {len(components)}"
        )

    owned: dict[tuple[int, int], np.ndarray] = {}
    component_report: list[dict] = []
    for component in components:
        median_y = float(np.median(component[:, 0]))
        median_x = float(np.median(component[:, 1]))
        row = max(0, min(3, round((median_y - SOURCE_CELL / 2) / SOURCE_CELL)))
        col = max(0, min(5, round((median_x - SOURCE_CELL / 2) / SOURCE_CELL)))
        key = (row, col)
        if key in owned:
            raise RuntimeError(f"{path.name}: duplicate component assignment {key}")
        owned[key] = component
        y0, x0 = component.min(axis=0)
        y1, x1 = component.max(axis=0) + 1
        component_report.append(
            {
                "row": row,
                "column": col,
                "pixels": int(len(component)),
                "sourceBbox": [int(x0), int(y0), int(x1), int(y1)],
                "crossesNominalCell": bool(
                    x0 < col * SOURCE_CELL
                    or x1 > (col + 1) * SOURCE_CELL
                    or y0 < row * SOURCE_CELL
                    or y1 > (row + 1) * SOURCE_CELL
                ),
                "touchesSourceEdge": bool(
                    x0 == 0 or y0 == 0 or x1 == sheet.width or y1 == sheet.height
                ),
            }
        )

    expected = {(row, col) for row in range(4) for col in range(6)}
    if set(owned) != expected:
        missing = sorted(expected - set(owned))
        raise RuntimeError(f"{path.name}: missing subject cells {missing}")
    rows = [
        [subject_from_component(sheet, owned[(row, col)]) for col in range(6)]
        for row in range(4)
    ]
    return rows, {"components": sorted(component_report, key=lambda item: (item["row"], item["column"]))}


def resize_uniform(rows: list[list[Image.Image]]) -> tuple[list[list[Image.Image]], float]:
    idle_heights = [
        alpha_bbox(frame)[3] - alpha_bbox(frame)[1]
        for frame in rows[ACTION_ROWS["idle"]]
    ]
    scale = TARGET_IDLE_HEIGHT / max(1.0, float(median(idle_heights)))
    max_width = max(alpha_bbox(frame)[2] - alpha_bbox(frame)[0] for row in rows for frame in row)
    max_height = max(alpha_bbox(frame)[3] - alpha_bbox(frame)[1] for row in rows for frame in row)
    scale = min(
        scale,
        (FRAME_WIDTH - 10) / max(1, max_width),
        (FRAME_HEIGHT - 10) / max(1, max_height),
    )
    resized_rows: list[list[Image.Image]] = []
    for row in rows:
        resized_row = []
        for frame in row:
            width = max(1, round(frame.width * scale))
            height = max(1, round(frame.height * scale))
            resized_row.append(frame.resize((width, height), Image.Resampling.LANCZOS))
        resized_rows.append(resized_row)
    return resized_rows, scale


def pose_metrics(frame: Image.Image, reference_height: float) -> dict[str, float | list[int]]:
    alpha = np.asarray(frame.getchannel("A"), dtype=np.uint8)
    ys, xs = np.nonzero(alpha > ALPHA_THRESHOLD)
    if not len(xs):
        return {
            "bbox": [0, 0, 1, 1],
            "rootX": float(ANCHOR_X),
            "contactY": float(CONTACT_Y),
        }
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    contact_y = float(np.percentile(ys, 99.35))
    pelvis_top = contact_y - reference_height * 0.58
    pelvis_bottom = contact_y - reference_height * 0.34
    pelvis = (ys >= pelvis_top) & (ys <= pelvis_bottom)
    root_x = float(np.median(xs[pelvis])) if np.any(pelvis) else float(np.median(xs))
    return {
        "bbox": [x0, y0, x1, y1],
        "rootX": root_x,
        "contactY": contact_y,
    }


def place_at_anchor(frame: Image.Image, reference_height: float) -> tuple[Image.Image, dict]:
    before = pose_metrics(frame, reference_height)
    dx = round(ANCHOR_X - float(before["rootX"]))
    dy = round(CONTACT_Y - float(before["contactY"]))
    x0, y0, x1, y1 = before["bbox"]
    dx = max(3 - x0, min(FRAME_WIDTH - 3 - x1, dx))
    dy = max(3 - y0, min(FRAME_HEIGHT - 3 - y1, dy))
    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT))
    canvas.alpha_composite(frame, (dx, dy))
    after = pose_metrics(canvas, reference_height)
    bbox = list(alpha_bbox(canvas))
    clipped = bbox[0] <= 1 or bbox[1] <= 1 or bbox[2] >= FRAME_WIDTH - 1 or bbox[3] >= FRAME_HEIGHT - 1
    return canvas, {
        "before": before,
        "after": after,
        "shift": [dx, dy],
        "bbox": bbox,
        "clipped": clipped,
    }


def normalize_generated(rows: list[list[Image.Image]]) -> tuple[dict[str, list[Image.Image]], dict]:
    rows, scale = resize_uniform(rows)
    idle_heights = [
        alpha_bbox(frame)[3] - alpha_bbox(frame)[1]
        for frame in rows[ACTION_ROWS["idle"]]
    ]
    reference_height = float(median(idle_heights))
    output: dict[str, list[Image.Image]] = {}
    report: dict[str, list[dict] | float] = {"scale": round(scale, 6)}
    for action, row_index in ACTION_ROWS.items():
        frames: list[Image.Image] = []
        metrics: list[dict] = []
        for frame in rows[row_index]:
            normalized, frame_metrics = place_at_anchor(frame, reference_height)
            frames.append(normalized)
            metrics.append(frame_metrics)
        output[action] = frames
        report[action] = metrics
    return output, report


def normalize_legacy() -> tuple[dict[str, list[Image.Image]], dict]:
    output: dict[str, list[Image.Image]] = {}
    report: dict[str, list[dict]] = {}
    reference_height = 224.0
    for action in ACTIONS:
        source_dir = ANIM_ROOT / "warrior" / action
        source_frames = [
            Image.open(source_dir / f"{index:02d}.png").convert("RGBA")
            for index in range(LEGACY_COUNTS[action])
        ]
        frames: list[Image.Image] = []
        metrics: list[dict] = []
        for source in source_frames:
            wide = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT))
            wide.alpha_composite(source, ((FRAME_WIDTH - source.width) // 2, 0))
            normalized, frame_metrics = place_at_anchor(wide, reference_height)
            frames.append(normalized)
            metrics.append(frame_metrics)
        output[action] = frames
        report[action] = metrics
    return output, report


def pack_horizontal(frames: list[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME_WIDTH * len(frames), FRAME_HEIGHT))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    return sheet


def save_direction(direction: str, states: dict[str, list[Image.Image]]) -> None:
    direction_root = OUTPUT_ROOT / direction
    for action, frames in states.items():
        action_root = direction_root / action
        action_root.mkdir(parents=True, exist_ok=True)
        for old in action_root.glob("*.png"):
            old.unlink()
        for index, frame in enumerate(frames):
            frame.save(action_root / f"{index:02d}.png", optimize=True)
        pack_horizontal(frames).save(direction_root / f"{action}_sheet.png", optimize=True)


def render_bbox_qa(all_states: dict[str, dict[str, list[Image.Image]]]) -> Path:
    thumb_width = FRAME_WIDTH // 2
    thumb_height = FRAME_HEIGHT // 2
    state_width = thumb_width * GENERATED_COUNT
    canvas = Image.new(
        "RGB",
        (state_width * len(ACTIONS), thumb_height * len(DIRECTIONS)),
        (43, 55, 45),
    )
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for row, direction in enumerate(DIRECTIONS):
        for state_index, action in enumerate(ACTIONS):
            frames = all_states[direction][action]
            sample_indices = [
                round(index * (len(frames) - 1) / (GENERATED_COUNT - 1))
                for index in range(GENERATED_COUNT)
            ]
            for column, frame_index in enumerate(sample_indices):
                frame = frames[frame_index]
                preview = Image.new("RGBA", frame.size, (43, 55, 45, 255))
                preview.alpha_composite(frame)
                pdraw = ImageDraw.Draw(preview)
                pdraw.rectangle(alpha_bbox(frame), outline=(255, 74, 74, 255), width=2)
                pdraw.line((ANCHOR_X - 7, CONTACT_Y, ANCHOR_X + 7, CONTACT_Y), fill=(80, 235, 255, 255), width=2)
                pdraw.line((ANCHOR_X, CONTACT_Y - 7, ANCHOR_X, CONTACT_Y + 7), fill=(80, 235, 255, 255), width=2)
                preview = preview.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS).convert("RGB")
                x = state_index * state_width + column * thumb_width
                y = row * thumb_height
                canvas.paste(preview, (x, y))
                draw.text(
                    (x + 4, y + 4),
                    f"{direction.upper()} {action} {frame_index:02d}",
                    font=font,
                    fill=(255, 235, 173),
                    stroke_width=2,
                    stroke_fill=(0, 0, 0),
                )
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    path = QA_ROOT / "warrior_directional_8x4_bbox.png"
    canvas.save(path, optimize=True)
    return path


def render_multibg_qa(all_states: dict[str, dict[str, list[Image.Image]]]) -> Path:
    backgrounds = ((28, 30, 34), (224, 218, 198), (66, 96, 64))
    cell_width = FRAME_WIDTH
    cell_height = FRAME_HEIGHT
    canvas = Image.new(
        "RGB",
        (cell_width * len(DIRECTIONS), cell_height * len(backgrounds)),
    )
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for row, color in enumerate(backgrounds):
        for col, direction in enumerate(DIRECTIONS):
            frame = all_states[direction]["run"][2]
            preview = Image.new("RGBA", frame.size, (*color, 255))
            preview.alpha_composite(frame)
            x, y = col * cell_width, row * cell_height
            canvas.paste(preview.convert("RGB"), (x, y))
            draw.text(
                (x + 6, y + 6),
                direction.upper(),
                font=font,
                fill=(255, 230, 165),
                stroke_width=2,
                stroke_fill=(0, 0, 0),
            )
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    path = QA_ROOT / "warrior_directional_multibg.png"
    canvas.save(path, optimize=True)
    return path


def build_manifest(all_states: dict[str, dict[str, list[Image.Image]]]) -> dict:
    states = {}
    for action in ACTIONS:
        directions = {}
        for direction in DIRECTIONS:
            frames = all_states[direction][action]
            directions[direction] = {
                "base": f"assets/game/anim/directional/warrior/{direction}/{action}",
                "frames": len(frames),
                "canvas": [FRAME_WIDTH, FRAME_HEIGHT],
                "contactFrames": (
                    [0, len(frames) // 2] if action in ("walk", "run") else []
                ),
                "authored": True,
            }
        states[action] = {"directions": directions}
    return {
        "version": 1,
        "class": "warrior",
        "directions": list(DIRECTIONS),
        "actions": list(ACTIONS),
        "anchor": [ANCHOR_X, CONTACT_Y],
        "states": states,
    }


def main() -> None:
    all_states: dict[str, dict[str, list[Image.Image]]] = {}
    audit: dict[str, dict] = {}

    east_states, east_report = normalize_legacy()
    east_rows, east_segmentation = segment_sheet(INPUT_ROOT / "e.png")
    east_generated, east_generated_report = normalize_generated(east_rows)
    # Keep the proven ten-frame east locomotion cadence, but replace its lone
    # baked-slash attack row with the same clean authored art contract used by
    # the other seven directions. Runtime combat VFX is then direction-neutral.
    east_states["attack"] = east_generated["attack"]
    all_states["e"] = east_states
    audit["e"] = {
        "source": {
            "idleWalkRun": "existing authored east frames",
            "attack": str((INPUT_ROOT / "e.png").relative_to(ROOT)),
        },
        "segmentation": east_segmentation,
        "normalization": {
            "legacy": east_report,
            "generatedAttack": east_generated_report["attack"],
            "generatedScale": east_generated_report["scale"],
        },
        "bakedAttackVfx": False,
    }
    save_direction("e", east_states)
    print("processed e (legacy locomotion + clean authored attack)", flush=True)

    for direction in GENERATED_DIRECTIONS:
        path = INPUT_ROOT / f"{direction}.png"
        rows, segmentation = segment_sheet(path)
        states, normalization = normalize_generated(rows)
        all_states[direction] = states
        audit[direction] = {
            "source": str(path.relative_to(ROOT)),
            "segmentation": segmentation,
            "normalization": normalization,
        }
        save_direction(direction, states)
        print(f"processed {direction}", flush=True)

    manifest = build_manifest(all_states)
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    qa_path = render_bbox_qa(all_states)
    multibg_path = render_multibg_qa(all_states)
    audit_summary = {
        "canvas": [FRAME_WIDTH, FRAME_HEIGHT],
        "anchor": [ANCHOR_X, CONTACT_Y],
        "directions": audit,
        "qa": [
            str(qa_path.relative_to(ROOT)),
            str(multibg_path.relative_to(ROOT)),
        ],
    }
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    (QA_ROOT / "warrior_directional_audit.json").write_text(
        json.dumps(audit_summary, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {qa_path.relative_to(ROOT)}", flush=True)
    print(f"wrote {multibg_path.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
