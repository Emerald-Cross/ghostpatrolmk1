import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { connectGameUpdates } from '../public/realtime.js';
import { createRenderServer } from '../lib/render-server.mjs';
import { createConfiguredHandler, createHandler } from '../api/game.js';
import { memoryStore } from '../lib/store.mjs';
import { createExpressStandin, SocketIOServerStandin } from './helpers/express-socket-standins.mjs';
import { resolve } from 'node:path';

test('Render server wiring serves health, static content, API, and private-safe realtime invalidations', async () => {
  let runtime;
  const handler = createHandler({
    store: memoryStore(), refereeSecret: 'test-referee-passphrase', sessionSecret: 'test-session-secret-32-characters-long',
    clock: () => 1234, onState: state => runtime?.notifyStateChange(state)
  });
  runtime = createRenderServer({ express: createExpressStandin(), SocketServer: SocketIOServerStandin, handler, staticDir: resolve('dist') });
  await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  try {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200); assert.equal(await health.text(), 'ok');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.match(await (await fetch(base)).text(), /Ghost Patrol/);
    const initial = await (await fetch(`${base}/api/game`)).json();
    assert.equal(initial.state.phase, 'lobby');
    assert.deepEqual(SocketIOServerStandin.instance.events.at(-1), { name: 'game:changed', args: [] });
    const eventCount = SocketIOServerStandin.instance.events.length;
    await fetch(`${base}/api/game`);
    assert.equal(SocketIOServerStandin.instance.events.length, eventCount, 'unchanged polling does not loop realtime notifications');
    const login = await fetch(`${base}/api/game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', secret: 'test-referee-passphrase' }) });
    const token = (await login.json()).token;
    await fetch(`${base}/api/game`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'claim', color: 'Red', station: 'North' }) });
    assert.equal(SocketIOServerStandin.instance.events.at(-1).name, 'game:changed');
    assert.deepEqual(SocketIOServerStandin.instance.events.at(-1).args, [], 'socket notifications carry no game or referee data');
  } finally { await new Promise(resolve => runtime.server.close(resolve)); }
});

test('browser realtime client refreshes after connection and shared-state notifications', () => {
  const handlers = {};
  const optionsSeen = [];
  const socket = { on(name, fn) { handlers[name] = fn; } };
  let refreshes = 0;
  const connected = connectGameUpdates(options => { optionsSeen.push(options); return socket; }, () => refreshes++);
  assert.equal(connected, socket);
  assert.deepEqual(optionsSeen, [{ reconnection: true }]);
  handlers.connect();
  handlers['game:changed']();
  assert.equal(refreshes, 2);
  assert.equal(connectGameUpdates(undefined, () => {}), null, 'static hosts without Socket.IO retain HTTP fallback behavior');
});

test('Render refuses local memory storage even if LOCAL_DEMO is accidentally enabled', async () => {
  const handler = createConfiguredHandler({ env: {
    RENDER: 'true', LOCAL_DEMO: '1', REFEREE_SECRET: 'test-referee-passphrase', SESSION_SECRET: 'test-session-secret-32-characters-long'
  } });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game`);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Configure Supabase/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
