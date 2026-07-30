import { SAVE_KEY, SAVE_VERSION, WORLD } from './config.js';

const LEGACY_KEYS = ['ember_legend_save_v4', 'ember_legend_save_v3', 'mini_legend_save_v2'];
const BACKUP_KEY = `${SAVE_KEY}_backup`;

function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseAndValidate(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.player) return null;
    if (parsed.checksum) {
      const copy = { ...parsed };
      delete copy.checksum;
      if (checksum(JSON.stringify(copy)) !== parsed.checksum) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function migrateWorldLayout(record) {
  const fromVersion = Math.max(1, Math.floor(Number(record?.worldLayoutVersion) || 1));
  if (fromVersion >= WORLD.layoutVersion) return record;
  const authoredScale = fromVersion >= 2 ? WORLD.previousLayoutScale : 1;
  const coordinateScale = WORLD.layoutScale / authoredScale;
  const migrated = {
    ...record,
    worldLayoutVersion: WORLD.layoutVersion,
  };
  if (Number.isFinite(Number(record.px))) migrated.px = Number(record.px) * coordinateScale;
  if (Number.isFinite(Number(record.py))) migrated.py = Number(record.py) * coordinateScale;
  return migrated;
}

export function saveGame(payload) {
  try {
    const current = localStorage.getItem(SAVE_KEY);
    if (parseAndValidate(current)) localStorage.setItem(BACKUP_KEY, current);
    const record = {
      ...payload,
      version: SAVE_VERSION,
      worldLayoutVersion: WORLD.layoutVersion,
      ts: Date.now(),
    };
    // RHS runs before assignment, so checksum covers the payload without itself.
    record.checksum = checksum(JSON.stringify(record));
    localStorage.setItem(SAVE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  const candidates = [
    localStorage.getItem(SAVE_KEY),
    localStorage.getItem(BACKUP_KEY),
    ...LEGACY_KEYS.map((key) => localStorage.getItem(key)),
  ];
  for (const raw of candidates) {
    const parsed = parseAndValidate(raw);
    if (parsed) return migrateWorldLayout(parsed);
  }
  return null;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(BACKUP_KEY);
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}

export function hasSave() {
  return [SAVE_KEY, BACKUP_KEY, ...LEGACY_KEYS].some((key) => !!localStorage.getItem(key));
}
