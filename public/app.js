import { createScanner } from '/scanner.js';
import { connectGameUpdates } from '/realtime.js';
import { icon } from '/icons.js?v=haunt-20261027-1';
import { createGameAudio } from '/audio.js?v=haunt-20261027-1';
import { mountAtmosphere } from '/atmosphere.js?v=haunt-20261027-1';

const stationColors = {
  joshdesk: 'Black',
  barbdesk: 'White',
  center: 'Blue',
  studentprimary: 'Red',
  north: 'Yellow',
  east: 'Green'
};
const colors = Object.values(stationColors);
const stations = Object.keys(stationColors);
const $ = id => document.getElementById(id);
const app = $('app');
const view = new URLSearchParams(location.search).get('view') || 'home';
const requestedScene = Number(new URLSearchParams(location.search).get('scene'));
const scene = [1,2,3].includes(requestedScene) ? requestedScene : 1;
document.body.classList.add(`${view}-view`);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const options = items => items.map((s,i) => `<option value="${esc(s)}"${i === 0 ? ' selected' : ''}>${esc(s)}</option>`).join('');
let state = null, lastGood = 0, offset = 0, staffOpen = false;
let staffToken = sessionStorage.getItem('gp-staff') || '';
let playerToken = localStorage.getItem('gp-player') || '';
let feedback = 'Ready for your next scan.', busy = false, pendingPoll = false;
let projection, projectionPhase, announcementTimer, controlsTimer;
const audio = createGameAudio({ music: ['atmosphere','leaderboard','intro'].includes(view), onChange(active) {
  const button = $('sound-toggle');
  if (button) { button.textContent = active ? 'Sound on' : 'Enable sound'; button.setAttribute('aria-pressed', String(active)); }
} });
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 4500); }
async function api(data, token = '') {
  const start = Date.now();
  const response = await fetch('/api/game', {
    method: data ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Request failed.'); error.status = response.status; throw error; }
  lastGood = Date.now();
  if (result.state) {
    state = result.state; offset = state.serverNow - (start + Date.now()) / 2;
    audio.update(state);
    $('connection').textContent = result.storage === 'local-memory' ? 'Local trial · connected' : 'Connected';
    $('connection').className = 'online'; render();
  }
  return result;
}
async function staffAction(action, extra = {}) {
  try { return await api({ action, ...extra }, staffToken); } catch (e) { toast(e.message); return null; }
}
function hero(title, text, image = '/assets/jebediah-welcome.webp') {
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">JEBEDIAH CROW NEEDS YOU</p><h1>${title}</h1><p class="lead">${text}</p></div><div class="hero-art"><span class="orbit" aria-hidden="true"></span><img id="hero-character" src="${image}" alt="Jebediah Crow, a smiling scarecrow" fetchpriority="high" width="1024" height="1536"></div></section>`;
}
const testCode = `<div class="test-code"><div class="qr-frame"><img src="/qr/test.svg" alt="Scanner test QR, payload TEST WAND" width="300" height="300"></div><div><p class="eyebrow">BLASTER CHECK</p><h2>Give it a test fire.</h2><p>Point your blaster at the code. Lights up when connected</p></div></div>`;
function launchTile(target, symbol, title, description) {
  return `<a class="tile" href="/?view=${target}"><span class="tile-icon">${icon(symbol)}</span><h2>${title}</h2><p>${description}</p>${icon('arrow', 'tile-arrow')}</a>`;
}
function shell() {
  if (view === 'home') {
    app.innerHTML = hero('Ghosts have<br>taken over our<br>pumpkin patch!', 'Grab a blaster! Let’s save Halloween.') +
      `<section class="launch-grid" aria-label="Game screens">${[
        launchTile('referee', 'setup', 'Setup Station', 'Names, wand checks, and round controls.'),
        launchTile('station', 'blaster', 'Wand station', 'Scanner pairing'),
        launchTile('leaderboard', 'trophy', 'Live leaderboard', 'Show Leaderboard'),
        launchTile('intro', 'pumpkin', 'Meet Jebediah', 'Orientation and testing'),
        launchTile('targets', 'target', 'Digital ghosts', 'Three stationary targets for a screen or projector.'),
        launchTile('atmosphere', 'moon', 'Atmosphere', 'Three looping projection scenes.')
      ].join('')}</section><p class="footnote"><a href="/print.html">${icon('printer')}Print ghost targets, chest badges, or a test target</a></p>`;
  } else if (view === 'referee') {
    app.innerHTML = `<section class="referee-top"><div><p class="eyebrow">WELCOME TO THE OIT MATERIALS MANAGEMENT HALLOWEEN PUMPKIN PATCH</p><h1>You are professional ghost busters!</h1><p>Enter your name and test your blaster</p></div><button id="staff-toggle" class="quiet">Staff controls</button></section>
      <section id="staff-panel" class="panel" hidden>
        <form id="login"><label>Staff passphrase<input id="staff-secret" type="password" autocomplete="current-password" required></label><button>Unlock controls</button></form>
        <div id="unlocked" hidden><div class="control-row"><label class="switch"><input id="pvp" type="checkbox"> Enable finale</label><span class="muted">Private round setting · editable in lobby</span></div><div class="control-row"><button id="start">Start round</button><button id="finish" class="quiet">End round</button><button id="new-round" class="quiet">Next group</button><button id="reset" class="danger">Reset lobby & release all</button><button id="lock" class="quiet">Sign out</button></div><p class="muted" id="timing-note"></p></div>
      </section><section class="referee-grid"><div class="panel"><div class="section-head"><h2>Your team</h2><span id="round-status" class="tag">Blaster checking...</span></div><div id="roster"><p id="empty-roster" class="muted">Connect blasters to begin</p></div></div><div class="panel">${testCode}</div></section>`;
    $('staff-toggle').onclick = () => { staffOpen = !staffOpen; $('staff-panel').hidden = !staffOpen; $('staff-toggle').textContent = staffOpen ? 'Return to welcome screen' : 'Staff controls'; render(); };
    $('login').onsubmit = async e => {
      e.preventDefault();
      try { const r = await api({ action: 'login', secret: $('staff-secret').value }); staffToken = r.token; sessionStorage.setItem('gp-staff', staffToken); $('staff-secret').value = ''; await poll(); } catch (e) { toast(e.message); }
    };
    $('lock').onclick = () => { staffToken = ''; sessionStorage.removeItem('gp-staff'); staffOpen = false; $('staff-panel').hidden = true; $('staff-toggle').textContent = 'Staff controls'; poll(); };
    $('pvp').onchange = () => staffAction('settings', { pvpEnabled: $('pvp').checked });
    $('start').onclick = () => staffAction('start');
    $('finish').onclick = () => { if (confirm('End the current round?')) staffAction('finish'); };
    $('new-round').onclick = () => { if (confirm('Clear names and scores for the next group? Station connections will stay assigned.')) staffAction('newRound'); };
    $('reset').onclick = () => { if (confirm('Release every color and disconnect all wand stations?')) staffAction('reset'); };
  } else if (view === 'station') {
    app.innerHTML = `<section class="station"><div class="station-head"><p class="eyebrow">NEUTRON BLASTER LINK</p><h1 id="station-title">Connect your blaster</h1></div><div class="station-stage"><div class="station-art"><img src="/assets/scanner.webp" alt="Glowing neutron blaster" width="650" height="650"></div><section id="pair-panel" class="panel"><p>Select this computer. Its assigned scanner color is shown automatically. Players will enter names at hub device.</p><form id="pair"><label>Computer<select id="station">${options(stations)}</select></label><label>Scanner color<input id="color" readonly></label><label>Staff password<input id="pair-secret" type="password" required autocomplete="current-password"></label><button>${icon('link', 'icon-small')}Connect station</button></form></section><div id="linked" class="panel" hidden><p id="station-name" class="station-name"></p><p id="scanner-feedback" class="scan-feedback" aria-live="polite"></p><p id="focus-note" class="tag"></p><div class="station-actions"><button id="focus" class="quiet">${icon('target', 'icon-small')}Arm your scanner</button><button id="leave" class="quiet">Leave station</button></div><p class="muted">Keep this browser window active.</p></div></div></section>`;
    $('station').onchange = () => { $('color').value = stationColors[$('station').value]; };
    $('color').value = stationColors[$('station').value];
    $('pair').onsubmit = async e => {
      e.preventDefault();
      try {
        const login = await api({ action: 'login', secret: $('pair-secret').value });
        const r = await api({ action: 'claim', color: stationColors[$('station').value], station: $('station').value }, login.token);
        playerToken = r.token; localStorage.setItem('gp-player', playerToken); $('pair-secret').value = ''; document.activeElement?.blur(); render();
      } catch (e) { toast(e.message); }
    };
    $('leave').onclick = async () => {
      try { await api({ action: 'leave' }, playerToken); playerToken = ''; localStorage.removeItem('gp-player'); render(); } catch(e) { toast(e.message); }
    };
    $('focus').onclick = () => { document.activeElement?.blur(); window.focus(); render(); };
    const scanner = createScanner(async (payload, clientMono) => {
      if (!playerToken || !state) return;
      const event = { action: 'scan', payload, roundId: state.roundId, eventId: crypto.randomUUID(), clientMono, clientAt: performance.timeOrigin + clientMono };
      try { const r = await api(event, playerToken); feedback = r.result || 'Scan received.'; if (r.result === 'Wand tested!') audio.effect('ready'); else if (r.result === 'Ghost captured! +100') audio.effect('capture'); else if (r.result === 'Blast registered.') audio.effect('vanquished'); render(); }
      catch(e) { feedback = 'Scan not confirmed. Check connection, then scan again.'; toast(e.message); render(); }
    });
    document.addEventListener('keydown', e => {
      if (!playerToken || e.target.closest('input,select,textarea')) return;
      scanner(e);
    });
    window.addEventListener('focus', render); window.addEventListener('blur', render);
  } else if (view === 'intro') {
    app.innerHTML = hero('IT friends!<br>I need your help!', 'Spooky ghosts have taken over my pumpkin patch! Grab a neutron blaster and vanquish some ghosts! Help me save Halloween!') + `<section class="intro-bottom"><div class="panel">${testCode}</div><div class="panel"><p class="eyebrow">YOUR TEAM</p><div id="intro-roster"></div></div></section><div id="intro-announcement" class="announcement" hidden></div>`;
  } else if (view === 'leaderboard') {
    app.innerHTML = `<section class="score-header"><div><p class="eyebrow">SAVE HALLOWEEN</p><h1 id="board-title">Save the pumpkin patch.</h1></div><div class="clock" role="timer" aria-label="Round countdown"><span id="phase-label">READY WHEN YOU ARE</span><strong id="clock">06:00</strong></div></section><ol id="standings" class="standings" aria-label="Player rankings"></ol><section class="vanquished" id="vanquished"></section><div class="ticker">${icon('ghost')}<span id="latest">Choose your blaster and get instructions</span></div>`;
  } else if (view === 'targets') {
    app.innerHTML = `<section class="target-top"><p class="eyebrow">GHOSTS IN THE MACHINE</p><h1>Give these ghosts a blast.</h1><p id="target-phase">Each ghost is worth 100 points. Capture each one once.</p></section><section class="digital-targets">${[16,17,18].map((id,i)=>`<article><span class="ghost-sprite ghost-${i}" aria-hidden="true"></span><div class="qr-frame"><img src="/qr/ghost-${id}.svg" alt="Ghost ${id} QR code" width="330" height="330"></div><h2>Ghost ${id}</h2></article>`).join('')}</section><img id="target-reaction" class="target-reaction" src="/assets/jebediah-alert.webp" alt="Jebediah reacting to the ghosts" hidden>`;
  } else if (view === 'atmosphere') {
    document.body.classList.add('atmosphere');
    app.innerHTML = `<canvas id="projection" role="img" aria-label="Looping ghosts in the pumpkin patch"></canvas><div id="projection-announcement" class="projection-announcement" role="status" hidden><strong>FINAL SHOWDOWN</strong><span>Ghosts have possessed your fellow hunters! BLAST THEM!</span></div><nav class="projection-controls" aria-label="Projection scenes"><div class="projection-scenes">${['Drift','Current','Whirl'].map((name,i)=>`<a href="/?view=atmosphere&scene=${i+1}"${scene===i+1?' aria-current="page"':''}>${i+1} · ${name}</a>`).join('')}</div><span id="projection-status">Connecting…</span><small>Move the pointer or tap to show controls. Enable sound on one device.</small></nav>`;
    projection = mountAtmosphere($('projection'), scene);
    const showControls = () => { document.body.classList.add('projection-ui-visible'); clearTimeout(controlsTimer); controlsTimer = setTimeout(()=>document.body.classList.remove('projection-ui-visible'),6500); };
    document.addEventListener('pointermove',showControls); document.addEventListener('pointerdown',showControls); document.addEventListener('keydown',showControls); showControls();
  } else { app.innerHTML = '<h1>Session not found.</h1><a href="/">Choose a session</a>'; }
}
function playerColor() {
  try { return JSON.parse(atob(playerToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).color; } catch { return null; }
}
function render() {
  if (!state) return;
  document.body.dataset.phase = state.phase;
  const lobby = state.phase === 'lobby';
  if (view === 'atmosphere') {
    projection?.update(state);
    $('projection-status').textContent = ({lobby:'Standby',pve:'Ghost hunt',pvp:'Final showdown',results:'Round complete'})[state.phase];
    if (projectionPhase !== state.phase) {
      clearTimeout(announcementTimer); $('projection-announcement').hidden = state.phase !== 'pvp';
      if (state.phase === 'pvp') announcementTimer = setTimeout(() => { $('projection-announcement').hidden = true; },6500);
      projectionPhase = state.phase;
    }
  }
  if (view === 'referee') {
    $('login').hidden = !!staffToken; $('unlocked').hidden = !staffToken;
    $('pvp').disabled = !lobby;
    if (state.pvpEnabled !== undefined) $('pvp').checked = state.pvpEnabled;
    $('timing-note').textContent = '5 min hunt + 1 min finale when enabled; 6 min hunt otherwise. Tie timing uses server receipts; office accuracy is unverified.';
    $('round-status').textContent = ({ lobby: 'Blaster checking...', pve: 'Hunting ghosts', pvp: 'Final showdown', results: 'Round complete' })[state.phase];
    // Stable controls: do not replace a focused name field while polling.
    for (const color of colors) {
      const p = state.players.find(p => p.color === color);
      let row = $(`row-${color}`);
      if (!p) { row?.remove(); continue; }
      if (!row) {
        row = document.createElement('div'); row.id = `row-${color}`; row.className = 'roster-row';
        row.innerHTML = `<span class="swatch ${color.toLowerCase()}"></span><div class="roster-info"><strong>${color}</strong><small class="player-meta"></small></div><form class="name-form"><input aria-label="${color} player name" maxlength="24" placeholder="Player Name" required><button>Save</button></form><span class="readiness"></span><button class="release quiet" aria-label="Release ${color}">×</button>`;
        row.querySelector('form').onsubmit = async e => { e.preventDefault(); const r = await staffAction('name', { color, name: row.querySelector('input').value }); if (r) toast('Name saved.'); };
        row.querySelector('.release').onclick = () => { if (confirm(`Release the ${color} station?`)) staffAction('release', { color }); };
        $('roster').append(row);
      }
      const field = row.querySelector('input');
      if (document.activeElement !== field) field.value = p.name;
      field.disabled = !staffToken || !lobby;
      row.querySelector('button').disabled = !staffToken || !lobby;
      row.querySelector('.release').hidden = !staffOpen || !staffToken || !lobby;
      row.querySelector('.player-meta').textContent = `${p.station}${p.connected ? '' : ' · disconnected'}`;
      row.querySelector('.readiness').textContent = p.vanquished ? 'Ghost vanquished!' : p.ready ? '✓ Blaster tested' : 'Test blaster';
    }
    if (!state.players.length && !$('empty-roster')) $('roster').innerHTML = '<p id="empty-roster" class="muted">Connect blasters to begin</p>';
    if (state.players.length) $('empty-roster')?.remove();
  }
  if (view === 'station') {
    const p = state.players.find(p => p.color === playerColor());
    $('pair-panel').hidden = !!playerToken; $('linked').hidden = !playerToken;
    $('station-title').textContent = playerToken ? `${p?.color || 'Your'} blaster connected.` : 'Connect your blaster';
    if (playerToken) {
      $('linked').dataset.ready = String(!!p?.ready);
      $('station-name').textContent = `${p?.name || 'Name entry at hub'} · ${p?.station || 'Reconnecting'}`;
      $('scanner-feedback').textContent = p?.vanquished ? 'Vanquished! Good Job!' : feedback;
      $('focus-note').textContent = document.hasFocus() ? '● Scanner capture armed' : '⚠ Window inactive · restore focus';
    }
  }
  if (view === 'intro') {
    const character = $('hero-character');
    const art = state.phase === 'pvp' ? 'alert' : state.phase === 'results' ? 'victory' : 'welcome';
    if (character.dataset.art !== art) { character.src = `/assets/jebediah-${art}.webp`; character.dataset.art = art; }
    $('intro-roster').innerHTML = state.players.length ? state.players.map(p=>`<div class="intro-player"><span class="swatch ${p.color.toLowerCase()}"></span><strong>${esc(p.name || p.color)}</strong><span>${p.ready ? '✓ Ready' : 'Test your blaster'}</span></div>`).join('') : '<p>Your team is assembling…</p>';
    $('intro-announcement').hidden = lobby;
    const announcement = state.phase === 'pvp' ? 'Ghosts have possessed your fellow hunters! BLAST THEM!' : state.phase === 'results' ? 'The round is complete! Check your results.' : 'The hunt is on! Find and blast the ghosts around the patch.';
    $('intro-announcement').innerHTML = icon(state.phase === 'results' ? 'trophy' : state.phase === 'pvp' ? 'alert' : 'ghost') + `<span>${announcement}</span>`;
  }
  if (view === 'leaderboard') {
    const players = state.players.filter(p=>p.name);
    $('standings').innerHTML = players.filter(p=>!p.vanquished).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name)).map((p,i)=>`<li class="score-row ${p.color.toLowerCase()}"><span class="row-rank">${String(i+1).padStart(2,'0')}</span><span class="swatch ${p.color.toLowerCase()}"></span><div class="row-player"><h2>${esc(p.name)}</h2><small>${p.color} scanner · ${p.captures} ghosts</small></div><div class="row-score"><strong class="score-value">${p.score.toLocaleString()}</strong><span>POINTS</span></div></li>`).join('') || '<li class="empty-patch"><img src="/assets/pumpkin.webp" alt="Orange pumpkin lantern" width="130" height="130"><h2>Your team is assembling…</h2></li>';
    $('vanquished').innerHTML = players.filter(p=>p.vanquished).map(p=>`<span><i class="swatch ${p.color.toLowerCase()}"></i>${esc(p.name)} · Vanquished${p.reason === 'tie' ? ` · ${p.frozenScore} frozen` : ''}</span>`).join('');
    $('board-title').textContent = state.phase === 'pvp' ? 'Who’s haunting whom?' : state.phase === 'results' ? 'The patch is saved!' : 'Save the pumpkin patch.';
    $('phase-label').textContent = ({ lobby: 'READY WHEN YOU ARE', pve: 'GHOST HUNT', pvp: 'FINAL SHOWDOWN', results: 'ROUND COMPLETE' })[state.phase];
    $('latest').textContent = state.log.at(-1)?.message || 'Choose your blaster and get instructions';
  }
  if (view === 'targets') {
    $('target-phase').textContent = state.phase === 'pvp' ? 'The ghosts have possessed your teammates! Scan their chest badges!' : state.phase === 'results' ? 'Round complete. Thank you, ghost patrol!' : 'Each ghost is worth 100 points. Capture each one once.';
    document.querySelector('.digital-targets').classList.toggle('inactive', state.phase === 'pvp' || state.phase === 'results');
    $('target-reaction').hidden = !['pvp', 'results'].includes(state.phase);
    const reactionArt = state.phase === 'results' ? 'victory' : 'alert';
    if ($('target-reaction').dataset.art !== reactionArt) { $('target-reaction').src = `/assets/jebediah-${reactionArt}.webp`; $('target-reaction').dataset.art = reactionArt; }
  }
}
async function poll() {
  if (busy) { pendingPoll = true; return; }
  busy = true;
  try {
    if (view === 'station' && playerToken) await api({ action: 'heartbeat' }, playerToken);
    else await api(null, view === 'referee' && staffOpen ? staffToken : '');
  } catch(e) {
    $('connection').textContent = 'Connection issue'; $('connection').className = 'offline';
    if (e.status === 401) {
      if (view === 'station') { playerToken = ''; localStorage.removeItem('gp-player'); }
      else { staffToken = ''; sessionStorage.removeItem('gp-staff'); }
      render();
    }
  } finally {
    busy = false;
    if (pendingPoll) { pendingPoll = false; queueMicrotask(poll); }
  }
}
$('fullscreen').innerHTML = icon('fullscreen') + 'Full screen';
$('fullscreen').onclick = async e => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('On iPhone: Share → Add to Home Screen for an app-like display.'); } catch { toast('Full screen unavailable here. Try Add to Home Screen on iPhone.'); } finally { if(view === 'atmosphere' && e?.detail > 0) $('fullscreen').blur(); } };
shell();
const soundControls = $('sound-controls');
if (soundControls && ['station','intro','leaderboard','atmosphere'].includes(view)) {
  soundControls.hidden = false;
  $('sound-toggle').onclick = async event => { $('sound-toggle').disabled = true; try { if (audio.enabled) audio.disable(); else await audio.enable(); } catch(e) { toast(e.message || 'Tap Enable sound to try again.'); } finally { $('sound-toggle').disabled = false; if(view === 'atmosphere' && event?.detail > 0) $('sound-toggle').blur(); } };
  $('sound-volume').oninput = () => audio.setVolume(Number($('sound-volume').value));
  $('sound-volume').onpointerup = () => { if(view === 'atmosphere') $('sound-volume').blur(); };
}
window.addEventListener('pagehide', event => { if(event.persisted) audio.disable(); else { projection?.destroy(); audio.destroy(); } });
connectGameUpdates(globalThis.io, poll);
poll();
setInterval(poll, ['station','atmosphere'].includes(view) ? 2000 : 15000);
setInterval(() => {
  if ($('clock') && state) {
    const ms = state.phase === 'lobby' ? 360000 : state.phase === 'results' ? 0 : Math.max(0, state.endsAt - (Date.now() + offset));
    const sec = Math.ceil(ms/1000); $('clock').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    $('clock').closest('.clock').classList.toggle('is-urgent', ms > 0 && ms <= 30000 && state.phase !== 'lobby');
  }
  // Referee and display views intentionally poll every 15 seconds when no
  // Socket.IO event arrives. Allow two poll intervals plus some jitter before
  // declaring the connection stale; stations heartbeat every 2 seconds.
  const staleAfter = ['station','atmosphere'].includes(view) ? 10000 : 35000;
  if (lastGood && Date.now() - lastGood > staleAfter) { $('connection').textContent = 'Connection issue'; $('connection').className = 'offline'; }
}, 250);
