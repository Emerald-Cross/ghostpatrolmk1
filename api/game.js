import { performance } from 'node:perf_hooks';
import { apply, publicState, GameError } from '../lib/game.mjs';
import { equalSecret, signToken, verifyToken } from '../lib/auth.mjs';
import { memoryStore, supabaseStore, transact } from '../lib/store.mjs';

export function createHandler({ store, refereeSecret, sessionSecret, clock = () => performance.timeOrigin + performance.now(), onState = () => {} }) {
  return async function handler(req, res) {
    const now = clock();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (code, value) => { res.statusCode = code; res.end(JSON.stringify(value)); };
    try {
      if (!refereeSecret || refereeSecret.length < 16 || !sessionSecret || sessionSecret.length < 32) throw new GameError('Set private REFEREE_SECRET and SESSION_SECRET environment variables.', 503);
      if (!['GET', 'POST'].includes(req.method)) throw new GameError('Method not allowed.', 405);
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new GameError('Cross-site request blocked.', 403);
      let data = {};
      if (req.method === 'POST') {
        if (!String(req.headers['content-type']).startsWith('application/json')) throw new GameError('JSON required.', 415);
        if (req.body !== undefined) data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        else {
          let raw = '';
          for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) throw new GameError('Request too large.', 413); }
          data = JSON.parse(raw || '{}');
        }
        if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 8192) throw new GameError('Invalid request.', 400);
      }
      const action = req.method === 'GET' ? 'poll' : data.action;
      let auth = { role: 'public' };
      const bearer = req.headers.authorization;
      if (bearer) auth = verifyToken(bearer.replace(/^Bearer /, ''), sessionSecret, now);
      if (action === 'login') {
        if (!equalSecret(data.secret, refereeSecret)) throw new GameError('Incorrect staff passphrase.', 403);
        return send(200, { token: signToken({ role: 'referee' }, sessionSecret, now) });
      }
      const { state, output } = await transact(store, s => apply(s, action, data, auth, now));
      const response = { state: publicState(state, now, auth.role === 'referee'), result: output.result, storage: store.mode };
      // Realtime messages are invalidations only. Never broadcast the referee-only state.
      try { onState(publicState(state, now, false)); } catch { /* A failed broadcast must not fail a game action. */ }
      if (output.token) response.token = signToken(output.token, sessionSecret, now);
      send(200, response);
    } catch (err) {
      send(err.status ?? (err instanceof SyntaxError ? 400 : 503), { error: err.status ? err.message : 'Unable to reach the game. Check configuration or reconnect.' });
    }
  };
}
export function createConfiguredHandler({ env = process.env, onState } = {}) {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, LOCAL_DEMO, VERCEL, RENDER } = env;
  let store;
  if (url && key) store = supabaseStore(url, key);
  else if (!VERCEL && !RENDER && LOCAL_DEMO === '1') store = memoryStore();
  else {
    return async (_req, res) => {
      res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'Configure Supabase shared storage. Local memory mode is only available for local development.' }));
    };
  }
  return createHandler({ store, refereeSecret: env.REFEREE_SECRET, sessionSecret: env.SESSION_SECRET, onState });
}

let cached;
export default async function handler(req, res) {
  cached ??= createConfiguredHandler();
  return cached(req, res);
}
