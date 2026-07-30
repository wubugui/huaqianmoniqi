import { MAPS } from './config.js?v=0.9.9';

export const WORLD_MAP_LAYOUT = {
  bich: { x: 12, y: 46 },
  field: { x: 31, y: 44 },
  valley: { x: 43, y: 16 },
  stone_tomb: { x: 77, y: 15 },
  cave: { x: 52, y: 45 },
  centipede_cave: { x: 77, y: 47 },
  temple: { x: 61, y: 71 },
  sanctum: { x: 87, y: 78 },
  sabac: { x: 28, y: 78 },
};

export function findWorldRoute(from, to, maps = MAPS) {
  if (!maps[from] || !maps[to]) return [];
  if (from === to) return [from];

  const queue = [[from]];
  const visited = new Set([from]);
  while (queue.length) {
    const route = queue.shift();
    const current = route[route.length - 1];
    for (const portal of maps[current]?.portals || []) {
      if (visited.has(portal.to) || !maps[portal.to]) continue;
      const nextRoute = [...route, portal.to];
      if (portal.to === to) return nextRoute;
      visited.add(portal.to);
      queue.push(nextRoute);
    }
  }
  return [];
}

export function portalForLeg(from, to, maps = MAPS) {
  return maps[from]?.portals?.find((portal) => portal.to === to) || null;
}

export function directionLabel(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.hypot(dx, dy) < 0.001) return '脚下';
  const directions = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return directions[(index + 8) % 8];
}

export function distanceInTiles(fromX, fromY, toX, toY, tileSize = 48) {
  return Math.max(0, Math.round(Math.hypot(toX - fromX, toY - fromY) / Math.max(1, tileSize)));
}

export function findTilePath(grid, startX, startY, goalX, goalY, tileSize = 48) {
  if (!Array.isArray(grid) || !grid.length || !grid[0]?.length) return [];
  const rows = grid.length;
  const cols = grid[0].length;
  const cell = (value, max) => Math.max(0, Math.min(max - 1, Math.floor(value / tileSize)));
  const start = { x: cell(startX, cols), y: cell(startY, rows) };
  const goal = { x: cell(goalX, cols), y: cell(goalY, rows) };
  const key = (x, y) => `${x},${y}`;
  const open = [{ ...start, score: 0 }];
  const cameFrom = new Map();
  const cost = new Map([[key(start.x, start.y), 0]]);
  const closed = new Set();
  const walkable = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows
    && (grid[y][x] !== 1 || (x === goal.x && y === goal.y));
  const directions = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];

  while (open.length) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift();
    const currentKey = key(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    if (current.x === goal.x && current.y === goal.y) {
      const cells = [goal];
      let cursor = currentKey;
      while (cameFrom.has(cursor)) {
        const previous = cameFrom.get(cursor);
        cells.push(previous);
        cursor = key(previous.x, previous.y);
      }
      cells.reverse();
      return cells.slice(1).map((point, index, points) => (
        index === points.length - 1
          ? { x: goalX, y: goalY }
          : { x: (point.x + 0.5) * tileSize, y: (point.y + 0.5) * tileSize }
      ));
    }

    for (const [dx, dy, stepCost] of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(current.x + dx, current.y) || !walkable(current.x, current.y + dy))) continue;
      const nextKey = key(nx, ny);
      const nextCost = (cost.get(currentKey) || 0) + stepCost;
      if (nextCost >= (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      cost.set(nextKey, nextCost);
      cameFrom.set(nextKey, { x: current.x, y: current.y });
      const heuristic = Math.hypot(goal.x - nx, goal.y - ny);
      open.push({ x: nx, y: ny, score: nextCost + heuristic });
    }
  }
  return [];
}
