import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { GameError } from './game.mjs';
export function equalSecret(a, b) {
  const hash = v => createHash('sha256').update(String(v ?? '')).digest();
  return timingSafeEqual(hash(a), hash(b));
}
export function signToken(payload, secret, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: now + 86400000 })).toString('base64url');
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}
export function verifyToken(token, secret, now = Date.now()) {
  try {
    const [data, mac, extra] = String(token).split('.');
    if (extra || !equalSecret(mac, createHmac('sha256', secret).update(data).digest('base64url'))) throw Error();
    const value = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (value.exp <= now || !['player', 'referee'].includes(value.role)) throw Error();
    return value;
  } catch { throw new GameError('Session expired. Reconnecting; try again in a moment.', 401); }
}

