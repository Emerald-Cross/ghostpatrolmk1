import { randomUUID } from 'node:crypto';

export const STATION_COLORS = {
  joshdesk: 'Black',
  barbdesk: 'White',
  center: 'Blue',
  studentprimary: 'Red',
  north: 'Yellow',
  east: 'Green'
};
export const COLORS = Object.values(STATION_COLORS);
export const STATIONS = Object.keys(STATION_COLORS);
export const HOLD_MS = 200;
export const TIE_MS = 20;
export const BOSS_APPEARS_MS = 240000;
export const BOSS_HEALTH = 3;
export const BOSS_REARM_MS = 1200;
const freshBoss = () => ({ hits: [], defeatedAt: null });
export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function initialState() {
  return { epoch: randomUUID(), roundId: randomUUID(), phase: 'lobby', pvpEnabled: true,
    startedAt: null, endsAt: null, boss: freshBoss(), players: {}, events: [], pending: [], log: [] };
}
export function parseScan(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const text = value.trim();
  if (text === 'TEST WAND') return { kind: 'test' };
  if (text === 'Boss Ghost') return { kind: 'boss' };
  const ghost = /^Ghost ([1-9]|1[0-8])$/.exec(text);
  if (ghost) return { kind: 'ghost', id: Number(ghost[1]) };
  if (text.startsWith('Player ') && COLORS.includes(text.slice(7))) return { kind: 'player', color: text.slice(7) };
  return null;
}
function note(s, message, now) { s.log.push({ message, at: now }); s.log = s.log.slice(-30); }
function previousRound(s, now) {
  if (s.startedAt == null || s.phase === 'lobby') return s.previousRound || null;
  // Archive public score fields only, never assignment tokens or raw scans.
  return { roundId: s.roundId, players: publicState(s, now).players, message: s.log.at(-1)?.message || 'Round complete' };
}
function scoreHistory(s, now) {
  const history = [...(s.scoreHistory || (s.previousRound ? [s.previousRound] : []))];
  const round = previousRound(s, now);
  if (round && !history.some(entry => entry.roundId === round.roundId)) history.push(round);
  // Bound shared state while retaining far more entries than a display can show.
  return history.slice(-100);
}
function alive(s) { return Object.values(s.players).filter(p => p.name && !p.vanquished); }
function eliminate(p, now, reason) { p.vanquished = true; p.eliminatedAt = now; p.frozenScore = p.score; p.reason = reason; }
export function tick(s, now) {
  // Existing persisted rounds from before this feature need no database migration.
  s.boss ??= freshBoss();
  if (s.phase === 'pve' && now >= s.startedAt + 300000 && s.pvpEnabled) {
    s.phase = 'pvp'; note(s, 'Ghosts have possessed your fellow hunters! BLAST THEM!', s.startedAt + 300000);
  }
  // Server receipt order is authoritative in this prototype. Device timestamps are diagnostic only.
  s.pending.sort((a, b) => a.receivedAt - b.receivedAt || a.id.localeCompare(b.id));
  while (s.pending.length && now >= s.pending[0].receivedAt + HOLD_MS) {
    const hit = s.pending.shift();
    const a = s.players[hit.attacker], b = s.players[hit.target];
    if (!a || !b || a.vanquished || b.vanquished) continue;
    const reciprocal = s.pending.findIndex(other => other.attacker === hit.target && other.target === hit.attacker
      && Math.abs(other.receivedAt - hit.receivedAt) < TIE_MS);
    if (reciprocal >= 0) {
      s.pending.splice(reciprocal, 1);
      eliminate(a, now, 'tie'); eliminate(b, now, 'tie');
      note(s, `${a.name} and ${b.name}: tied. Both Vanquished.`, now);
    } else {
      const loot = b.score;
      eliminate(b, now, 'captured'); b.score = 0; a.score += loot;
      note(s, `${a.name} vanquished ${b.name} and stole ${loot} points.`, now);
    }
  }
  if (s.phase === 'pvp' && alive(s).length < 2 && s.pending.length === 0) {
    s.phase = 'results'; note(s, 'The final showdown is over.', now);
  }
  // Allow accepted hits before the buzzer to settle; no scans after endsAt are admitted.
  if (['pve', 'pvp'].includes(s.phase) && now >= s.endsAt && s.pending.length === 0) {
    s.phase = 'results'; note(s, 'The pumpkin patch is saved!', now);
  }
}
export function apply(s, action, data, auth, now) {
  tick(s, now);
  const fail = message => { throw new GameError(message); };
  const admin = () => { if (auth.role !== 'referee') throw new GameError('Referee access required.', 403); };
  const lobby = () => { if (s.phase !== 'lobby') fail('Return to the lobby first.'); };
  if (action === 'poll') return {};
  if (action === 'reset') { admin(); const n = initialState(); n.scoreHistory = scoreHistory(s, now); n.previousRound = n.scoreHistory.at(-1) || null; return { replacement: n }; }
  if (action === 'newRound') {
    admin(); const n = initialState(); n.scoreHistory = scoreHistory(s, now); n.previousRound = n.scoreHistory.at(-1) || null; n.epoch = s.epoch; n.pvpEnabled = s.pvpEnabled;
    for (const [color, p] of Object.entries(s.players)) n.players[color] = { ...p, name: '', score: 0, captured: [], ready: false, vanquished: false, frozenScore: null, reason: null, eliminatedAt: null };
    return { replacement: n };
  }
  if (action === 'settings') { admin(); lobby(); if (typeof data.pvpEnabled !== 'boolean') fail('Choose a round setting.'); s.pvpEnabled = data.pvpEnabled; return {}; }
  if (action === 'claim') {
    admin(); lobby();
    if (!STATIONS.includes(data.station) || STATION_COLORS[data.station] !== data.color) fail('Choose the assigned color for this computer.');
    if (s.players[data.color]) fail('Color is already assigned. Release it first.');
    if (Object.values(s.players).some(p => p.station === data.station)) fail('Station is already assigned.');
    const tokenId = randomUUID();
    s.players[data.color] = { color: data.color, station: data.station, tokenId, name: '', score: 0, captured: [], ready: false,
      vanquished: false, frozenScore: null, lastSeen: now, lastScan: null };
    return { token: { role: 'player', color: data.color, epoch: s.epoch, tokenId } };
  }
  if (action === 'name') {
    admin(); lobby(); const p = s.players[data.color]; if (!p) fail('Station has not joined.');
    if (typeof data.name !== 'string') fail('Enter a display name.');
    const name = data.name.trim(); if (!name || name.length > 24 || /[\p{C}]/u.test(name)) fail('Use a name of 1–24 visible characters.');
    p.name = name; return {};
  }
  if (action === 'release') { admin(); lobby(); delete s.players[data.color]; return {}; }
  if (action === 'start') {
    admin(); lobby(); const players = Object.values(s.players);
    if (!players.length || players.some(p => !p.name || !p.ready || now - p.lastSeen > 15000)) fail('Every joined station needs a name, a test scan, and a current connection. Release unused colors.');
    if (s.pvpEnabled && players.length < 2) fail('Enable ghost hunting only for a one player trial.');
    s.phase = 'pve'; s.startedAt = now; s.endsAt = now + 360000;
    s.boss = freshBoss();
    note(s, 'Ghost hunt started. Save the pumpkin patch!', now); return {};
  }
  if (action === 'finish') { admin(); s.phase = 'results'; s.pending = []; note(s, 'Round ended by the referee.', now); return {}; }
  if (!['scan', 'heartbeat', 'leave'].includes(action)) fail('Unknown action.');
  if (auth.role !== 'player') throw new GameError('Player session required.', 403);
  const p = s.players[auth.color];
  if (auth.epoch !== s.epoch || !p || p.tokenId !== auth.tokenId) throw new GameError('Station assignment released. Staff must reconnect.', 401);
  p.lastSeen = now;
  if (action === 'heartbeat') return {};
  if (action === 'leave') { lobby(); delete s.players[auth.color]; return {}; }
  if (data.roundId !== s.roundId) return { result: 'Old round ignored.' };
  const scan = parseScan(data.payload);
  if (!scan) return { result: 'Unknown code ignored.' };
  if (typeof data.eventId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(data.eventId)) fail('Invalid scan event.');
  if (s.events.includes(data.eventId)) return { result: 'Duplicate delivery ignored.' };
  if (s.events.length >= 5000) fail('Round event limit reached.');
  s.events.push(data.eventId);
  p.lastScan = { receivedAt: now, clientAt: Number.isFinite(data.clientAt) ? data.clientAt : null,
    clientMono: Number.isFinite(data.clientMono) ? data.clientMono : null, payload: data.payload };
  if (scan.kind === 'test') { if (s.phase === 'lobby') p.ready = true; return { result: 'Wand tested!' }; }
  if (p.vanquished || !['pve', 'pvp'].includes(s.phase) || now >= s.endsAt) return { result: 'Scan ignored outside active play.' };
  if (scan.kind === 'boss') {
    if (s.phase !== 'pve' || now < s.startedAt + BOSS_APPEARS_MS) return { result: 'Boss is not available.' };
    if (s.boss.hits.length >= BOSS_HEALTH) return { result: 'Boss already vanquished!' };
    const previous = s.boss.hits.findLast(hit => hit.color === p.color);
    if (previous && now - previous.at < BOSS_REARM_MS) return { result: 'Blaster recharging. Fire again in a moment.' };
    s.boss.hits.push({ color: p.color, name: p.name, at: now }); p.score += 100;
    if (s.boss.hits.length === BOSS_HEALTH) {
      s.boss.defeatedAt = now; note(s, `${p.name} vanquished the boss ghost! +100`, now);
      return { result: 'Boss vanquished! +100' };
    }
    note(s, `${p.name} hit the boss ghost. ${BOSS_HEALTH - s.boss.hits.length} hits left. +100`, now);
    return { result: 'Boss hit! +100' };
  }
  if (scan.kind === 'ghost' && s.phase === 'pve') {
    if (p.captured.includes(scan.id)) return { result: 'You already captured this ghost.' };
    p.captured.push(scan.id); p.score += 100; note(s, `${p.name} captured Ghost ${scan.id}. +100`, now);
    return { result: 'Ghost captured! +100' };
  }
  if (scan.kind === 'player' && s.phase === 'pvp' && scan.color !== p.color) {
    const target = s.players[scan.color]; if (!target?.name || target.vanquished) return { result: 'Target unavailable.' };
    if (!s.pending.some(h => h.attacker === p.color && h.target === scan.color)) s.pending.push({ id: data.eventId, attacker: p.color, target: scan.color, receivedAt: now });
    return { result: 'Blast registered.' };
  }
  return { result: 'Code ignored in this phase.' };
}
export function publicState(s, now, referee = false) {
  const boss = s.boss || freshBoss();
  const view = { scoreHistory: s.scoreHistory || (s.previousRound ? [s.previousRound] : []), previousRound: s.previousRound || null, roundId: s.roundId, phase: s.phase, startedAt: s.startedAt, endsAt: s.endsAt, serverNow: now,
    boss: { status: boss.hits.length >= BOSS_HEALTH ? 'defeated' : s.phase === 'pve' && now >= s.startedAt + BOSS_APPEARS_MS && now < s.endsAt ? 'active' : 'waiting',
      health: BOSS_HEALTH - boss.hits.length, maxHealth: BOSS_HEALTH,
      hits: boss.hits.map(({ color, name, at }) => ({ color, name, at })), defeatedAt: boss.defeatedAt },
    players: Object.values(s.players).map(({ color, station, name, score, captured, ready, vanquished, frozenScore, lastSeen, reason }) => ({
      color, station, name, score, captures: captured.length, ready, vanquished, frozenScore, reason, connected: now - lastSeen < 15000
    })), log: s.log };
  if (referee) { view.pvpEnabled = s.pvpEnabled; view.timing = 'server-receipt'; }
  // No hidden setting, internal phase boundary, tokens, raw scans, or pending hits in the public projection.
  return view;
}
