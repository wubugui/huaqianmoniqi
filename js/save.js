import { SAVE_KEY, SAVE_VERSION } from './config.js';

const LEGACY_KEYS = ['mini_legend_save_v2'];

export function saveGame(payload) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...payload, version: SAVE_VERSION, ts: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY) || LEGACY_KEYS.some((key) => !!localStorage.getItem(key));
}
