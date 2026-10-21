import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRenderServer } from '../lib/render-server.mjs';
import { createHandler } from '../api/game.js';
import { memoryStore } from '../lib/store.mjs';
import { createExpressStandin, SocketIOServerStandin } from './helpers/express-socket-standins.mjs';

test('Render server serves every session asset and QR without exposing source files', async () => {
  const handler = createHandler({ store: memoryStore(), refereeSecret: 'static-test-passphrase', sessionSecret: 'static-test-session-secret-at-least-32' });
  const runtime = createRenderServer({ express: createExpressStandin(), SocketServer: SocketIOServerStandin, handler, staticDir: resolve('public') });
  await new Promise(resolveListen => runtime.server.listen(0, '127.0.0.1', resolveListen));
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  try {
    for (const path of ['/', '/?view=station', '/?view=referee', '/?view=intro', '/?view=leaderboard', '/?view=targets', '/?view=atmosphere', '/style.css', '/app.js', '/scanner.js', '/realtime.js', '/print.html', '/assets/jebediah.png', '/assets/scanner.png', '/assets/pumpkin.png', '/assets/ghost.png']) assert.equal((await fetch(base + path)).status, 200, path);
    for (let i = 1; i <= 18; i++) {
      const response = await fetch(`${base}/qr/ghost-${i}.svg`); assert.equal(response.status, 200);
      assert.match(await response.text(), new RegExp(`<title>Ghost ${i}</title>`));
    }
    for (const color of ['red', 'green', 'blue', 'yellow', 'white', 'black']) assert.equal((await fetch(`${base}/qr/player-${color}.svg`)).status, 200);
    assert.equal((await fetch(`${base}/qr/test.svg`)).status, 200);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/lib/game.mjs`)).status, 404);
    const api = await fetch(`${base}/api/game`); assert.equal(api.status, 200); assert.equal((await api.json()).storage, 'local-memory');
  } finally { await new Promise(resolveClose => runtime.server.close(resolveClose)); }
});
