import { GHOST_CUTLINE } from './ghost-cutout.js?v=boss-20261028-1';

export const BOSS_TAUNTS = [
  'It’s on order, it’ll be here in 4-6 months',
  'No packing slip',
  'Shipping was delayed',
  'There are no more LTM-1U',
  'The carts are gone'
];
export function bossTaunt(state) {
  if (state.boss?.status !== 'active') return null;
  const elapsed = Math.max(0, (state.serverNow || 0) - (state.startedAt || 0) - 240000);
  return BOSS_TAUNTS[Math.floor(elapsed / 6000) % BOSS_TAUNTS.length];
}

// Quiet scenery uses the existing patch artwork and a single code-native silhouette.
export function patchScene() {
  return `<div class="patch-scene" aria-hidden="true"><svg class="patch-silhouette" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"><g fill="#10111c"><path d="M0 826Q240 785 505 827T1000 820T1600 811V900H0Z"/><g transform="translate(1230 417) rotate(8)"><path d="M-7 105h14v320H-7Z"/><path d="m-122 93 236 20-2 13-237-20Z"/><path d="m-42 74 34-15 43 7 32 131-50-9-22 27-46-22Z"/><path d="m-30 181-9 74 22-6 22-52 15 56 24 10-4-76Z"/><ellipse cy="38" rx="33" ry="36"/><path d="m-63 19 128 7-2 12-128-6Zm27 5 18-70 30 17 24 57Z"/><path d="m-113 98-28-23 7 25-22 7 37 6Zm222 17 32-19-10 25 23 12-39-6Z"/></g></g></svg><div class="patch-fog"></div><div class="patch-vignette"></div></div>`;
}
export function bossGhost() {
  return `<div id="boss-float" class="boss-float" hidden><div id="boss-ghost" class="boss-ghost" data-damage="0"><svg viewBox="0 0 760 990" role="img" aria-label="Boss ghost. Scan the code to deal damage."><path d="${GHOST_CUTLINE}" fill="#f0ebde" stroke="#b8b0c6" stroke-width="5"/><g fill="#292332"><path d="M265 178q37-27 71 12l-9 65q-65 7-62-77Zm159 12q34-39 71-12 3 84-62 77Z"/><path class="boss-mouth" d="M335 284q45-38 90 0l-13 40-19-18-13 24-14-24-19 18Z"/></g><g class="boss-crack crack-one" fill="none" stroke="#6c6076" stroke-width="9" stroke-linejoin="round"><path d="m212 100 22 60-25 30 27 40-18 54M85 492l26 74-25 39 18 56"/></g><g class="boss-crack crack-two" fill="none" stroke="#6c6076" stroke-width="12" stroke-linejoin="round"><path d="m542 110-25 62 22 31-18 65 25 35M667 492l-22 66 25 33-17 86"/></g><text x="380" y="371" text-anchor="middle" font-family="Creepster,Impact,fantasy" font-size="46" textLength="430" lengthAdjust="spacingAndGlyphs" fill="#292332">THE PATCH PHANTOM</text><image id="boss-code" href="/qr/boss.svg" x="125" y="395" width="510" height="510"/><text x="380" y="937" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#292332">SCAN TO BLAST · 100 POINTS PER HIT</text></svg></div></div><aside id="boss-taunt" class="boss-taunt" aria-label="The Patch Phantom says" aria-live="polite" hidden></aside>`;
}

// Keep the existing ghost and QR nodes stable so each hit can animate without restarting its drift.
export function updateBoss(document, state) {
  const boss = state.boss || { status: 'waiting', health: 3, maxHealth: 3, hits: [] };
  const float = document.getElementById('boss-float'), ghost = document.getElementById('boss-ghost');
  const hud = document.getElementById('boss-hud'), status = document.getElementById('boss-status');
  const active = boss.status === 'active', defeated = boss.status === 'defeated';
  const bubble = document.getElementById('boss-taunt');
  if (bubble) {
    const line = bossTaunt(state); bubble.hidden = line === null;
    if (line !== null && bubble.textContent !== line) {
      bubble.textContent = line; bubble.classList.remove('taunt-enter');
      void bubble.offsetWidth; bubble.classList.add('taunt-enter');
    }
  }
  const previous = Number(ghost.dataset.damage), damage = boss.maxHealth - boss.health;
  const sameRound = ghost.dataset.round === state.roundId;
  ghost.dataset.round = state.roundId;
  ghost.dataset.damage = String(damage);
  ghost.classList.toggle('is-defeated', defeated);
  if (sameRound && damage > previous) {
    ghost.classList.remove('boss-hit'); void ghost.offsetWidth; ghost.classList.add('boss-hit');
  } else if (!sameRound) ghost.classList.remove('boss-hit');
  float.hidden = !active && !defeated;
  document.getElementById('boss-code').style.visibility = active ? 'visible' : 'hidden';
  hud.hidden = !active && !defeated;
  document.getElementById('boss-heading').textContent = defeated ? 'BOSS VANQUISHED!' : 'THE PATCH PHANTOM';
  document.getElementById('boss-health').setAttribute('aria-label', `${boss.health} of ${boss.maxHealth} health remaining`);
  document.querySelectorAll('.boss-heart').forEach((heart, i) => heart.classList.toggle('is-spent', i >= boss.health));
  const last = boss.hits.at(-1);
  status.textContent = last ? `${last.name} · ${damage} of ${boss.maxHealth} hits${defeated ? ' · The patch is safe!' : ` · ${boss.health} to go`}` : 'Three hits to vanquish. Every hunter can help!';
}
