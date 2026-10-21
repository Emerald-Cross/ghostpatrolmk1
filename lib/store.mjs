import { initialState, GameError } from './game.mjs';

export function memoryStore() {
  let row = { version: 0, data: initialState() };
  return {
    mode: 'local-memory',
    async read() { return structuredClone(row); },
    async cas(version, data) { if (row.version !== version) return false; row = { version: version + 1, data: structuredClone(data) }; return true; }
  };
}
export function supabaseStore(url, key, request = fetch) {
  const base = `${url.replace(/\/$/, '')}/rest/v1`;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy service_role JWTs need Authorization; modern sb_secret keys use apikey only.
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  async function call(path, options = {}) {
    const response = await request(base + path, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new GameError('Shared database unavailable. Check server configuration and schema.', 503);
    return response.status === 204 ? null : response.json();
  }
  return {
    mode: 'supabase',
    async read() {
      let rows = await call('/gip_state?id=eq.main&select=version,data');
      if (!rows.length) {
        await call('/gip_state', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ id: 'main', version: 0, data: initialState() }) });
        rows = await call('/gip_state?id=eq.main&select=version,data');
      }
      if (!rows[0]) throw new GameError('Shared state has not initialized.', 503);
      return rows[0];
    },
    async cas(version, data) {
      return await call('/rpc/gip_cas', { method: 'POST', body: JSON.stringify({ expected_version: version, next_state: data }) });
    }
  };
}
export async function transact(store, reduce) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const row = await store.read();
    const state = structuredClone(row.data);
    const output = reduce(state);
    const next = output.replacement ?? state;
    if (JSON.stringify(next) === JSON.stringify(row.data)) return { state: next, output };
    if (await store.cas(row.version, next)) return { state: next, output };
    await new Promise(resolve => setTimeout(resolve, Math.min(80, attempt * 4) + Math.random() * 10));
  }
  throw new GameError('The round is busy. Please try again.', 503);
}
