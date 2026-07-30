import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'server'), { recursive: true });
await mkdir(resolve(dist, 'js'), { recursive: true });
await mkdir(client, { recursive: true });

for (const entry of ['index.html', 'css', 'js']) {
  await cp(resolve(root, entry), resolve(client, entry), { recursive: true });
}
await mkdir(resolve(client, 'assets/game'), { recursive: true });
for (const entry of ['anim', 'map', 'mob', 'npc', 'portrait', 'scenery', 'tiles', 'ui', 'unit', 'manifest.json']) {
  const filter = (source) => {
    const normalized = source.replaceAll('\\', '/');
    const developmentOnly = [
      '/qa/',
      '/source/',
      '/staging/',
      '/alpha/',
      '/anchors/',
      '/rejected/',
      '/__pycache__/',
    ];
    return !normalized.endsWith('/scenery/raw')
      && !normalized.endsWith('_sheet.png')
      && !normalized.endsWith('.py')
      && !normalized.endsWith('.pyc')
      && !developmentOnly.some((segment) => (
        normalized.includes(segment) || normalized.endsWith(segment.slice(0, -1))
      ));
  };
  await cp(resolve(root, 'assets/game', entry), resolve(client, 'assets/game', entry), { recursive: true, filter });
}
await cp(resolve(root, 'worker/index.js'), resolve(dist, 'server/index.js'));
await cp(resolve(root, 'server/local-server.mjs'), resolve(dist, 'server/local-server.mjs'));
await cp(resolve(root, 'js/config.js'), resolve(dist, 'js/config.js'));

console.log('Built static game for Sites');
