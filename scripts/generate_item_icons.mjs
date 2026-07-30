#!/usr/bin/env node
/**
 * Item icon pipeline helpers (Grok GenerateImage → slice → atlas).
 *
 * Generation is done in-agent via Cursor GenerateImage with the six legacy
 * icons as style references (NOT arkcli). This script only:
 *   --slice-only   re-slice raw/batch_*.png using manifest.json
 *   --atlas-only   rebuild items_atlas.png from icons/*.png
 *
 * Manifest: assets/game/ui/items/raw/manifest.json
 * Batches JSON for ids: regenerate with the VISUALS table in git history if needed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_SHEETS = join(ROOT, 'assets/game/ui/items/raw');
const OUT_ICONS = join(ROOT, 'assets/game/ui/items/icons');
const PY = join(ROOT, '.venv/bin/python');
const INSET = 0.08;

function rebuildAtlas() {
  const py = `
from PIL import Image
from pathlib import Path
import json
ROOT = Path(${JSON.stringify(ROOT)})
icons = ROOT / 'assets/game/ui/items/icons'
# Prefer ITEMS order from icon_index if present, else sorted filenames
index_path = ROOT / 'assets/game/ui/items/raw/icon_index.json'
if index_path.exists():
    data = json.loads(index_path.read_text())
    ordered = sorted(data['index'].items(), key=lambda kv: kv[1]['i'])
    ids = [k for k,_ in ordered]
    cols = data['cols']
else:
    ids = sorted(p.stem for p in icons.glob('*.png'))
    cols = 12
rows = (len(ids) + cols - 1) // cols
atlas = Image.new('RGB', (cols * 128, rows * 128), (8, 6, 4))
index = {}
for i, item_id in enumerate(ids):
    r, c = divmod(i, cols)
    atlas.paste(Image.open(icons / f'{item_id}.png'), (c * 128, r * 128))
    index[item_id] = {'col': c, 'row': r, 'i': i}
atlas.save(ROOT / 'assets/game/ui/items_atlas.png', optimize=True)
index_path.write_text(json.dumps({'cell': 128, 'cols': cols, 'rows': rows, 'count': len(ids), 'index': index}, indent=2))
print(f'atlas {atlas.size} icons={len(ids)}')
`;
  const res = spawnSync(PY, ['-c', py], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || res.stdout);
  console.log(res.stdout.trim());
}

function sliceAll() {
  const manifest = JSON.parse(readFileSync(join(OUT_SHEETS, 'manifest.json'), 'utf8'));
  mkdirSync(OUT_ICONS, { recursive: true });
  for (const entry of manifest) {
    const sheet = join(OUT_SHEETS, `${entry.id}.png`);
    if (!existsSync(sheet)) {
      console.warn('missing sheet', entry.id);
      continue;
    }
    const ids = entry.ids;
    const mapPath = join(OUT_SHEETS, `${entry.id}.cells.json`);
    writeFileSync(mapPath, JSON.stringify(ids));
    const py = `
from PIL import Image
from pathlib import Path
import json
sheet = Image.open(${JSON.stringify(sheet)}).convert('RGB')
w, h = sheet.size
cw, ch = w / 3, h / 3
ids = json.loads(Path(${JSON.stringify(mapPath)}).read_text())
out = Path(${JSON.stringify(OUT_ICONS)})
INSET = ${INSET}
for i, item_id in enumerate(ids):
    r, c = divmod(i, 3)
    x0 = c * cw + cw * INSET
    y0 = r * ch + ch * INSET
    x1 = (c + 1) * cw - cw * INSET
    y1 = (r + 1) * ch - ch * INSET
    cell = sheet.crop((int(x0), int(y0), int(x1), int(y1))).resize((128, 128), Image.Resampling.LANCZOS)
    cell.save(out / f'{item_id}.png', optimize=True)
    print(item_id)
`;
    const res = spawnSync(PY, ['-c', py], { encoding: 'utf8' });
    if (res.status !== 0) throw new Error(res.stderr || res.stdout);
    console.log(`[slice] ${entry.id}: ${res.stdout.trim().split('\n').join(', ')}`);
  }
}

const args = process.argv.slice(2);
if (args.includes('--slice-only')) sliceAll();
rebuildAtlas();
