export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
export const moveToward = (from, to, speed, dt) => {
  const d = dist(from, to);
  if (d <= speed * dt || d < 1) return { x: to.x, y: to.y, arrived: true };
  const k = (speed * dt) / d;
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, arrived: false };
};
export const uid = (() => {
  let i = 1;
  return () => i++;
})();
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load fail: ${src}`));
    img.src = src;
  });
}
export function randInt(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}
export function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
