import { GHOST_CUTLINE } from './ghost-cutout.js?v=display-fix-20261028-1';

export const BOSS_TAUNTS = [
  'It’s on order, it’ll be here in 4-6 months',
  'No packing slip',
  'Shipping was delayed',
  'There are no more LTM-1U',
  'The carts are gone'
];
export function bossTaunt(state) {
  if (state.boss?.status !== 'active') return null;
  const appearsAt = state.boss.appearsAt ?? (state.startedAt || 0) + 80000;
  const elapsed = Math.max(0, (state.serverNow || 0) - appearsAt);
  return BOSS_TAUNTS[Math.floor(elapsed / 6000) % BOSS_TAUNTS.length];
}

export function bossPvpTransition(previous, current) {
  return Boolean(previous && previous.roundId === current.roundId && previous.phase === 'pve' && current.phase === 'pvp' && current.boss?.status === 'defeated');
}

export function createBossPvpAnnouncement(element, { setTimer = setTimeout, clearTimer = clearTimeout, duration = 7000 } = {}) {
  let previous = null, timer = null;
  const clear = () => { clearTimer(timer); timer = null; };
  return {
    update(current) {
      if (bossPvpTransition(previous, current)) {
        clear();
        element.hidden = false;
        element.classList.remove('boss-pvp-enter');
        void element.offsetWidth;
        element.classList.add('boss-pvp-enter');
        timer = setTimer(() => { element.hidden = true; timer = null; }, duration);
      } else if (previous?.roundId !== current.roundId || current.phase !== 'pvp') {
        clear();
        element.hidden = true;
        element.classList.remove('boss-pvp-enter');
      }
      previous = { roundId: current.roundId, phase: current.phase };
    },
    destroy() { clear(); element.hidden = true; }
  };
}

export function bossPvpAnnouncement() {
  return `<div id="boss-pvp-announcement" class="boss-pvp-announcement" role="status" aria-live="assertive" hidden><strong>FINAL SHOWDOWN</strong><span>Scan your opponents’ chest badges!</span></div>`;
}

// Quiet scenery uses the existing patch artwork and a single code-native silhouette.
export function patchScene() {
  return `<div class="patch-scene" aria-hidden="true"><svg class="patch-silhouette" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"><g fill="#10111c"><path d="M0 826Q240 785 505 827T1000 820T1600 811V900H0Z"/><g transform="translate(1230 417) rotate(8)"><path d="M-7 105h14v320H-7Z"/><path d="m-122 93 236 20-2 13-237-20Z"/><path d="m-42 74 34-15 43 7 32 131-50-9-22 27-46-22Z"/><path d="m-30 181-9 74 22-6 22-52 15 56 24 10-4-76Z"/><ellipse cy="38" rx="33" ry="36"/><path d="m-63 19 128 7-2 12-128-6Zm27 5 18-70 30 17 24 57Z"/><path d="m-113 98-28-23 7 25-22 7 37 6Zm222 17 32-19-10 25 23 12-39-6Z"/></g></g></svg><div class="patch-fog"></div><div class="patch-vignette"></div></div>`;
}
export function bossGhost() {
  return `<div id="boss-float" class="boss-float" hidden><div id="boss-ghost" class="boss-ghost" data-damage="0"><svg viewBox="0 0 760 990" role="img" aria-label="Boss ghost. Scan the code to deal damage."><path d="${GHOST_CUTLINE}" fill="#f0ebde" stroke="#b8b0c6" stroke-width="5"/><g fill="#292332"><path d="M265 178q37-27 71 12l-9 65q-65 7-62-77Zm159 12q34-39 71-12 3 84-62 77Z"/><path class="boss-mouth" d="M335 284q45-38 90 0l-13 40-19-18-13 24-14-24-19 18Z"/></g><g class="boss-crack crack-one" fill="none" stroke="#6c6076" stroke-width="9" stroke-linejoin="round"><path d="m212 100 22 60-25 30 27 40-18 54M85 492l26 74-25 39 18 56"/></g><g class="boss-crack crack-two" fill="none" stroke="#6c6076" stroke-width="12" stroke-linejoin="round"><path d="m542 110-25 62 22 31-18 65 25 35M667 492l-22 66 25 33-17 86"/></g><image id="boss-code" href="/qr/boss.svg" x="125" y="395" width="510" height="510"/><text x="380" y="937" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#292332">SCAN TO BLAST · 100 POINTS PER HIT</text></svg></div><aside id="boss-taunt" class="boss-taunt" aria-label="The boss says" aria-live="polite" hidden></aside></div>`;
}

// Keep the existing ghost and QR nodes stable so each hit can animate without restarting its drift.
export function updateBoss(document, state) {
  const boss = state.boss || { status: 'waiting', health: 9, maxHealth: 9, hits: [] };
  const float = document.getElementById('boss-float'), ghost = document.getElementById('boss-ghost');
  const hud = document.getElementById('boss-hud'), status = document.getElementById('boss-status');
  const playing = ['pve', 'pvp'].includes(state.phase);
  const active = playing && boss.status === 'active', defeated = playing && boss.status === 'defeated';
  const battleOver = boss.status === 'defeated' || (playing && state.startedAt != null && state.phase === 'pvp');
  const thanks = document.getElementById('boss-thanks');
  if (thanks) {
    thanks.hidden = !battleOver;
    thanks.classList.toggle('after-defeat', defeated);
  }
  const bubble = document.getElementById('boss-taunt');
  if (bubble) {
    const line = active ? bossTaunt(state) : null; bubble.hidden = line === null;
    if (line === null) bubble.textContent = '';
    if (line !== null && bubble.textContent !== line) {
      bubble.textContent = line; bubble.classList.remove('taunt-enter');
      void bubble.offsetWidth; bubble.classList.add('taunt-enter');
    }
  }
  const previous = Number(ghost.dataset.damage), damage = playing ? boss.maxHealth - boss.health : 0;
  const sameRound = ghost.dataset.round === state.roundId;
  ghost.dataset.round = state.roundId;
  ghost.dataset.damage = String(damage);
  ghost.dataset.damageStage = String(damage === 0 ? 0 : Math.min(3, Math.ceil(damage / (boss.maxHealth / 3))));
  ghost.classList.toggle('is-defeated', defeated);
  if (sameRound && damage > previous) {
    ghost.classList.remove('boss-hit'); void ghost.offsetWidth; ghost.classList.add('boss-hit');
  } else if (!sameRound || !playing) ghost.classList.remove('boss-hit');
  float.hidden = !active && !defeated;
  document.getElementById('boss-code').style.visibility = active ? 'visible' : 'hidden';
  hud.hidden = !active;
  document.getElementById('boss-heading').textContent = defeated ? 'BOSS VANQUISHED!' : 'BOSS BATTLE';
  const remaining = playing ? boss.health : boss.maxHealth;
  document.getElementById('boss-health').setAttribute('aria-label', `${remaining} of ${boss.maxHealth} health remaining`);
  document.querySelectorAll('.boss-heart').forEach((heart, i) => heart.classList.toggle('is-spent', i >= remaining));
  const last = boss.hits.at(-1);
  status.textContent = !playing ? '' : last ? `${last.name} · ${damage} of ${boss.maxHealth} hits${defeated ? ' · The patch is safe!' : ` · ${boss.health} to go`}` : `${boss.maxHealth} hits to vanquish. Every hunter can help!`;
}


export function bossThanks() {
  return `<section id="boss-thanks" class="boss-thanks" role="status" aria-live="polite" hidden><div class="boss-thanks-copy"><p class="eyebrow">JEBEDIAH CROW</p><h1>Thank you, ghost busters!</h1><p>You helped save my pumpkin patch and Halloween! I couldn’t have done it without you!</p></div><img src="/assets/jebediah-victory.webp" alt="Jebediah Crow celebrating and thanking the players" width="1024" height="1536"></section>`;
}

