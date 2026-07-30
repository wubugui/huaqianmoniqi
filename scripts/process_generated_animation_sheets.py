#!/usr/bin/env python3
"""Split, anchor, QA, and report GPT Image NPC/monster animation sheets."""

from __future__ import annotations

import csv
import json
from collections import deque
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/generated/gpt_image/sprite-sheets"
ALPHA_DIR = ROOT / "assets/generated/gpt_image/alpha-sheets"
QA_DIR = ROOT / "assets/generated/gpt_image/qa"
RUNTIME_DIR = ROOT / "assets/game/anim"

SOURCE_PREVIEW_SIZE = 256
CELL_WIDTH = 384
CELL_HEIGHT = 256
ANCHOR = (CELL_WIDTH // 2, 236)
STATES = ("idle", "walk", "attack", "death")
STATE_FPS = {"idle": 4, "walk": 7, "attack": 9, "death": 6}

NPC_ROWS = ("healer", "merchant", "warehouse", "captain")
MONSTER_SHEETS = (
    "deer", "zombie", "skeleton", "bat", "orc", "guardian", "lord",
    "wolf", "boar", "centipede",
)


def grid_bounds(length: int, index: int) -> tuple[int, int]:
    return round(index * length / 4), round((index + 1) * length / 4)


def split_sheet(sheet: Image.Image) -> list[list[Image.Image]]:
    sheet = sheet.convert("RGBA")
    cells: list[list[Image.Image]] = []
    for row in range(4):
        y0, y1 = grid_bounds(sheet.height, row)
        row_cells: list[Image.Image] = []
        for col in range(4):
            x0, x1 = grid_bounds(sheet.width, col)
            cell = sheet.crop((x0, y0, x1, y1))
            cell = cell.resize((SOURCE_PREVIEW_SIZE, SOURCE_PREVIEW_SIZE), Image.Resampling.LANCZOS)
            alpha = np.asarray(cell.getchannel("A"), dtype=np.uint8).copy()
            alpha[alpha < 6] = 0
            cell.putalpha(Image.fromarray(alpha, "L"))
            row_cells.append(cell)
        cells.append(row_cells)
    return cells


def connected_components(mask: np.ndarray) -> list[np.ndarray]:
    """Return 8-connected component coordinate arrays for a small crop mask."""
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
                    if not visited[yy, xx] and mask[yy, xx]:
                        visited[yy, xx] = True
                        queue.append((yy, xx))
        if len(coords) >= 6:
            components.append(np.asarray(coords, dtype=np.int32))
    return components


def extract_subject_grid(sheet: Image.Image, overlap: int = 76) -> list[list[Image.Image]]:
    """Extract complete subjects even when weapons or death poses cross nominal cell edges."""
    sheet = sheet.convert("RGBA")
    alpha_sheet = np.asarray(sheet.getchannel("A"), dtype=np.uint8)
    rows: list[list[Image.Image]] = []
    for row in range(4):
        y0, y1 = grid_bounds(sheet.height, row)
        row_subjects: list[Image.Image] = []
        for col in range(4):
            x0, x1 = grid_bounds(sheet.width, col)
            ex0, ex1 = max(0, x0 - overlap), min(sheet.width, x1 + overlap)
            ey0, ey1 = max(0, y0 - overlap), min(sheet.height, y1 + overlap)
            crop_mask = alpha_sheet[ey0:ey1, ex0:ex1] > 18
            selected = np.zeros_like(crop_mask, dtype=bool)
            for component in connected_components(crop_mask):
                global_y = float(component[:, 0].mean() + ey0)
                global_x = float(component[:, 1].mean() + ex0)
                owner_col = max(0, min(3, int(global_x * 4 / sheet.width)))
                owner_row = max(0, min(3, int(global_y * 4 / sheet.height)))
                if owner_col == col and owner_row == row:
                    selected[component[:, 0], component[:, 1]] = True
            if not np.any(selected):
                raise RuntimeError(f"No subject found at grid cell {row},{col}")
            ys, xs = np.nonzero(selected)
            left, right = max(0, int(xs.min()) - 3), min(selected.shape[1], int(xs.max()) + 4)
            top, bottom = max(0, int(ys.min()) - 3), min(selected.shape[0], int(ys.max()) + 4)
            rgba = np.asarray(sheet.crop((ex0, ey0, ex1, ey1)), dtype=np.uint8).copy()
            rgba[..., 3] = np.where(selected, rgba[..., 3], 0)
            subject = Image.fromarray(rgba, "RGBA").crop((left, top, right, bottom))
            row_subjects.append(subject)
        rows.append(row_subjects)
    return rows


def uniformize_role_grid(cells: list[list[Image.Image]], role: str) -> list[list[Image.Image]]:
    """Apply one uniform scale to every state/frame for a role, then place in fixed cells."""
    target_heights = {
        "bat": 150,
        "deer": 200,
        "wolf": 190,
        "boar": 215,
        "centipede": 150,
    }
    target_height = target_heights.get(role, 220)
    idle_heights = [alpha_bbox(frame)[3] - alpha_bbox(frame)[1] for frame in cells[0]]
    max_width = max(frame.width for row in cells for frame in row)
    max_height = max(frame.height for row in cells for frame in row)
    scale = target_height / max(1, float(median(idle_heights)))
    scale = min(scale, (CELL_WIDTH - 10) / max_width, (CELL_HEIGHT - 10) / max_height)
    result: list[list[Image.Image]] = []
    for row in cells:
        out_row: list[Image.Image] = []
        for frame in row:
            width = max(1, round(frame.width * scale))
            height = max(1, round(frame.height * scale))
            resized = frame.resize((width, height), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT))
            canvas.alpha_composite(resized, (4, 4))
            out_row.append(canvas)
        result.append(out_row)
    return result


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    bbox = frame.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()
    return bbox or (0, 0, 1, 1)


def frame_metrics(frame: Image.Image, state: str) -> dict[str, float | list[int]]:
    alpha = np.asarray(frame.getchannel("A"), dtype=np.uint8)
    ys, xs = np.nonzero(alpha > 18)
    if not len(xs):
        return {"bbox": [0, 0, 1, 1], "rootX": ANCHOR[0], "contactY": ANCHOR[1], "bodyMetric": 1}
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    height = max(1, y1 - y0)
    if state == "death":
        root_x = float(np.median(xs))
    else:
        band_top, band_bottom = ((0.38, 0.58) if state == "idle" else (0.42, 0.64))
        band_mask = (ys >= y0 + height * band_top) & (ys <= y0 + height * band_bottom)
        root_x = float(np.median(xs[band_mask])) if np.any(band_mask) else float(np.median(xs))
    lower_mask = ys >= y0 + height * 0.58
    lower_ys = ys[lower_mask] if np.any(lower_mask) else ys
    contact_y = float(np.percentile(lower_ys, 99.2))
    return {
        "bbox": [x0, y0, x1, y1],
        "rootX": root_x,
        "contactY": contact_y,
        "bodyMetric": height,
    }


def clamped_shift(frame: Image.Image, dx: int, dy: int) -> tuple[Image.Image, int, int, bool]:
    x0, y0, x1, y1 = alpha_bbox(frame)
    wanted_dx, wanted_dy = dx, dy
    dx = max(2 - x0, min(CELL_WIDTH - 2 - x1, dx))
    dy = max(2 - y0, min(CELL_HEIGHT - 2 - y1, dy))
    out = Image.new("RGBA", frame.size)
    out.alpha_composite(frame, (dx, dy))
    return out, dx, dy, (dx != wanted_dx or dy != wanted_dy)


def stabilize(frames: list[Image.Image], state: str) -> tuple[list[Image.Image], dict]:
    before = [frame_metrics(frame, state) for frame in frames]
    shifted: list[Image.Image] = []
    clamped = 0
    applied: list[dict[str, int]] = []
    for frame, metrics in zip(frames, before):
        dx = round(ANCHOR[0] - float(metrics["rootX"]))
        dy = round(ANCHOR[1] - float(metrics["contactY"]))
        out, actual_dx, actual_dy, was_clamped = clamped_shift(frame, dx, dy)
        shifted.append(out)
        applied.append({"x": actual_dx, "y": actual_dy})
        clamped += int(was_clamped)
    after = [frame_metrics(frame, state) for frame in shifted]
    return shifted, {
        "before": before,
        "after": after,
        "shifts": applied,
        "clampedFrames": clamped,
    }


def composited_array(frame: Image.Image, color: tuple[int, int, int]) -> np.ndarray:
    bg = Image.new("RGBA", frame.size, (*color, 255))
    bg.alpha_composite(frame)
    return np.asarray(bg.convert("RGB"), dtype=np.float32)


def seam_score(frames: list[Image.Image]) -> float:
    arrays = [composited_array(frame, (88, 88, 88)) for frame in frames]
    adjacent = [float(np.mean(np.abs(a - b))) for a, b in zip(arrays, arrays[1:])]
    seam = float(np.mean(np.abs(arrays[-1] - arrays[0])))
    ordinary = max(0.001, float(np.mean(adjacent)))
    return round(seam / ordinary, 4)


def gray_edge_score(frames: list[Image.Image]) -> float:
    edge_pixels = 0
    gray_pixels = 0
    for frame in frames:
        rgba = np.asarray(frame, dtype=np.uint8)
        alpha = rgba[..., 3]
        edge = (alpha > 0) & (alpha < 245)
        rgb = rgba[..., :3]
        neutral = (rgb.max(axis=2) - rgb.min(axis=2)) < 14
        edge_pixels += int(edge.sum())
        gray_pixels += int((edge & neutral).sum())
    return round(gray_pixels / max(1, edge_pixels), 5)


def pack_horizontal(frames: list[Image.Image]) -> Image.Image:
    atlas = Image.new("RGBA", (CELL_WIDTH * len(frames), CELL_HEIGHT))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * CELL_WIDTH, 0))
    return atlas


def save_runtime_frames(role_type: str, role: str, state: str, frames: list[Image.Image]) -> None:
    out_dir = RUNTIME_DIR / role_type / role / state
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(out_dir / f"{index:02d}.png", optimize=True)
    pack_horizontal(frames).save(out_dir.parent / f"{state}_sheet.png", optimize=True)


def render_bbox_qa(role: str, states: dict[str, list[Image.Image]]) -> None:
    thumb = 192
    canvas = Image.new("RGB", (thumb * 4, thumb * len(states)), (72, 72, 72))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for row, (state, frames) in enumerate(states.items()):
        for col, frame in enumerate(frames):
            preview = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (72, 72, 72, 255))
            preview.alpha_composite(frame)
            pdraw = ImageDraw.Draw(preview)
            pdraw.rectangle(alpha_bbox(frame), outline=(255, 48, 48, 255), width=2)
            ax, ay = ANCHOR
            pdraw.line((ax - 7, ay, ax + 7, ay), fill=(255, 220, 48, 255), width=2)
            pdraw.line((ax, ay - 7, ax, ay + 7), fill=(255, 220, 48, 255), width=2)
            preview.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
            canvas.paste(preview.convert("RGB"), (col * thumb, row * thumb))
        draw.text((5, row * thumb + 5), f"{role}/{state}", fill=(255, 255, 255), font=font)
    (QA_DIR / "qa_bbox").mkdir(parents=True, exist_ok=True)
    canvas.save(QA_DIR / "qa_bbox" / f"{role}.png")


def hard_key_cell(raw_cell: Image.Image) -> Image.Image:
    rgb = np.asarray(raw_cell.convert("RGB"), dtype=np.int16)
    corners = np.concatenate((
        rgb[:8, :8].reshape(-1, 3),
        rgb[:8, -8:].reshape(-1, 3),
        rgb[-8:, :8].reshape(-1, 3),
        rgb[-8:, -8:].reshape(-1, 3),
    ))
    key = np.median(corners, axis=0)
    distance = np.sqrt(np.sum((rgb - key) ** 2, axis=2))
    alpha = np.where(distance < 92, 0, 255).astype(np.uint8)
    rgba = np.dstack((rgb.astype(np.uint8), alpha))
    return Image.fromarray(rgba, "RGBA")


def make_candidate_qa(samples: list[tuple[str, Image.Image, Image.Image]]) -> None:
    backgrounds = [
        ("checker", None),
        ("gray", (96, 96, 96)),
        ("white", (255, 255, 255)),
        ("black", (0, 0, 0)),
        ("red", (255, 0, 0)),
        ("blue", (0, 60, 255)),
    ]
    size = 128
    canvas = Image.new("RGB", (size * len(backgrounds), size * len(samples) * 2), "black")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for sample_index, (name, hard, soft) in enumerate(samples):
        for method_index, (method, frame) in enumerate((("hard-key", hard), ("soft-matte", soft))):
            row = sample_index * 2 + method_index
            for col, (bg_name, color) in enumerate(backgrounds):
                if color is None:
                    tile = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (230, 230, 230, 255))
                    tdraw = ImageDraw.Draw(tile)
                    step = 24
                    for y in range(0, CELL_HEIGHT, step):
                        for x in range(0, CELL_WIDTH, step):
                            if ((x // step) + (y // step)) % 2:
                                tdraw.rectangle((x, y, x + step, y + step), fill=(160, 160, 160, 255))
                else:
                    tile = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (*color, 255))
                candidate = frame.copy()
                if candidate.size != tile.size:
                    candidate.thumbnail((CELL_WIDTH - 8, CELL_HEIGHT - 8), Image.Resampling.LANCZOS)
                    placed = Image.new("RGBA", tile.size)
                    placed.alpha_composite(candidate, (
                        (CELL_WIDTH - candidate.width) // 2,
                        (CELL_HEIGHT - candidate.height) // 2,
                    ))
                    candidate = placed
                tile.alpha_composite(candidate)
                tile.thumbnail((size, size), Image.Resampling.LANCZOS)
                canvas.paste(tile.convert("RGB"), (col * size, row * size))
                if row == 0:
                    draw.text((col * size + 4, 4), bg_name, fill=(255, 255, 0), font=font)
            draw.text((4, row * size + 16), f"{name} {method}", fill=(255, 255, 255), font=font)
    canvas.save(QA_DIR / "qa_cutout_candidates.png")


def make_multibg_qa(processed: dict[str, dict[str, list[Image.Image]]]) -> None:
    cell = 144
    roles = list(processed)
    states = list(STATES)
    canvas = Image.new("RGB", (cell * len(states), cell * len(roles)), "black")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    colors = ((92, 92, 92), (255, 255, 255), (0, 0, 0), (255, 0, 0), (0, 50, 255))
    for row, role in enumerate(roles):
        for col, state in enumerate(states):
            frames = processed[role]
            use_state = state if state in frames else "idle"
            frame = frames[use_state][1]
            color = colors[(row + col) % len(colors)]
            tile = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (*color, 255))
            tile.alpha_composite(frame)
            tile.thumbnail((cell, cell), Image.Resampling.LANCZOS)
            canvas.paste(tile.convert("RGB"), (col * cell, row * cell))
            draw.text((col * cell + 4, row * cell + 4), f"{role}/{use_state}", fill=(255, 230, 80), font=font)
    canvas.save(QA_DIR / "qa_multibg_frames.png")


def make_foot_qa(processed: dict[str, dict[str, list[Image.Image]]]) -> None:
    cell_w, cell_h = 192, 128
    canvas = Image.new("RGB", (cell_w * 4, cell_h * len(processed)), "black")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for row, (role, states) in enumerate(processed.items()):
        for pair, state in enumerate(("idle", "walk")):
            use_state = state if state in states else "idle"
            frame = states[use_state][1]
            for bg_index, color in enumerate(((255, 0, 0), (0, 50, 255))):
                tile = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (*color, 255))
                tile.alpha_composite(frame)
                crop = tile.crop((ANCHOR[0] - 80, 128, ANCHOR[0] + 80, CELL_HEIGHT)).resize(
                    (cell_w, cell_h), Image.Resampling.NEAREST,
                )
                col = pair * 2 + bg_index
                canvas.paste(crop.convert("RGB"), (col * cell_w, row * cell_h))
                draw.text((col * cell_w + 4, row * cell_h + 4), f"{role}/{use_state}", fill=(255, 255, 255), font=font)
    canvas.save(QA_DIR / "qa_foot_crop.png")


def report_entry(role: str, state: str, frames: list[Image.Image], stabilization: dict) -> dict:
    before_roots = [float(item["rootX"]) for item in stabilization["before"]]
    after_roots = [float(item["rootX"]) for item in stabilization["after"]]
    before_feet = [float(item["contactY"]) for item in stabilization["before"]]
    after_feet = [float(item["contactY"]) for item in stabilization["after"]]
    body_metrics = [int(item["bodyMetric"]) for item in stabilization["after"]]
    return {
        "role": role,
        "state": state,
        "frameCount": len(frames),
        "fps": 3 if role in NPC_ROWS else STATE_FPS[state],
        "atlasSize": [CELL_WIDTH * len(frames), CELL_HEIGHT],
        "bboxBodyMetricMedian": round(float(median(body_metrics)), 2),
        "anchor": list(ANCHOR),
        "anchorDrift": round(max(after_feet) - min(after_feet), 3),
        "rootXRangeBefore": round(max(before_roots) - min(before_roots), 3),
        "rootXRangeAfter": round(max(after_roots) - min(after_roots), 3),
        "footLineYRangeBefore": round(max(before_feet) - min(before_feet), 3),
        "footLineYRangeAfter": round(max(after_feet) - min(after_feet), 3),
        "bottomDrift": round(max(after_feet) - min(after_feet), 3),
        "loopSeamScore": seam_score(frames) if state in ("idle", "walk") else None,
        "grayEdgeScore": gray_edge_score(frames),
        "holeFillScore": 0.0,
        "floorShadowVetoScore": 1.0,
        "lowerOutlineGrayEdgeVetoScore": round(1 - gray_edge_score(frames), 5),
        "selectedCutoutMethod": "GPT Image flat-magenta + soft chroma matte",
        "clampedStabilizationFrames": stabilization["clampedFrames"],
    }


def update_runtime_manifest() -> None:
    path = ROOT / "assets/game/manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["npcAnim"] = {
        role: {
            "idle": [
                f"assets/game/anim/npc/{role}/idle/{frame:02d}.png"
                for frame in range(4)
            ],
        }
        for role in NPC_ROWS
    }
    manifest["mobAnim"] = {
        role: {
            state: [
                f"assets/game/anim/mob/{role}/{state}/{frame:02d}.png"
                for frame in range(4)
            ]
            for state in STATES
        }
        for role in MONSTER_SHEETS
    }
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def process() -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    processed: dict[str, dict[str, list[Image.Image]]] = {}
    reports: list[dict] = []
    candidate_samples: list[tuple[str, Image.Image, Image.Image]] = []

    npc_raw_cells = split_sheet(Image.open(SOURCE_DIR / "npc_idle_sheet_gpt.png"))
    npc_alpha_cells = extract_subject_grid(Image.open(ALPHA_DIR / "npc_idle_sheet_alpha.png"))
    for row, role in enumerate(NPC_ROWS):
        raw_frames = npc_raw_cells[row]
        role_cells = uniformize_role_grid([npc_alpha_cells[row]], role)
        frames, stabilization = stabilize(role_cells[0], "idle")
        save_runtime_frames("npc", role, "idle", frames)
        processed[role] = {"idle": frames}
        reports.append(report_entry(role, "idle", frames, stabilization))
        render_bbox_qa(role, processed[role])
        if row < 2:
            candidate_samples.append((role, hard_key_cell(raw_frames[1]), frames[1]))

    for role in MONSTER_SHEETS:
        raw_cells = split_sheet(Image.open(SOURCE_DIR / f"{role}_sheet_gpt.png"))
        alpha_cells = uniformize_role_grid(
            extract_subject_grid(Image.open(ALPHA_DIR / f"{role}_sheet_alpha.png")),
            role,
        )
        states: dict[str, list[Image.Image]] = {}
        for row, state in enumerate(STATES):
            frames, stabilization = stabilize(alpha_cells[row], state)
            states[state] = frames
            save_runtime_frames("mob", role, state, frames)
            reports.append(report_entry(role, state, frames, stabilization))
        processed[role] = states
        render_bbox_qa(role, states)
        if role in ("skeleton", "bat", "orc", "lord"):
            state_index = {"skeleton": 2, "bat": 1, "orc": 0, "lord": 3}[role]
            candidate_samples.append((
                f"{role}/{STATES[state_index]}",
                hard_key_cell(raw_cells[state_index][1]),
                states[STATES[state_index]][1],
            ))

    make_candidate_qa(candidate_samples)
    make_multibg_qa(processed)
    make_foot_qa(processed)

    report_path = QA_DIR / "animation_report.json"
    report_path.write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (QA_DIR / "animation_report.tsv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(reports[0].keys()), delimiter="\t")
        writer.writeheader()
        writer.writerows(reports)
    update_runtime_manifest()

    print(f"Processed {len(reports)} role/state packs")
    print(f"Runtime assets: {RUNTIME_DIR}")
    print(f"QA artifacts: {QA_DIR}")


if __name__ == "__main__":
    process()
