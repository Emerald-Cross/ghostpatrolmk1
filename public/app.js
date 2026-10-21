import { createScanner } from '/scanner.js';
import { connectGameUpdates } from '/realtime.js';

const colors = ['Red', 'Green', 'Blue', 'Yellow', 'White', 'Black'];
const stations = ['North', 'Central', 'East', 'west', 'south', 'southwest', 'drewPC'];
const $ = id => document.getElementById(id);
const app = $('app');
const view = new URLSearchParams(location.search).get('view') || 'home';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const options = items => items.map(s => `<option>${esc(s)}</option>`).join('');
let state = null, lastGood = 0, offset = 0, staffOpen = false;
let staffToken = sessionStorage.getItem('gp-staff') || '';
let playerToken = localStorage.getItem('gp-player') || '';
let feedback = 'Ready for your next scan.', busy = false, pendingPoll = false;
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
    $('connection').textContent = result.storage === 'local-memory' ? 'Local trial · connected' : 'Connected';
    $('connection').className = 'online'; render();
  }
  return result;
}
async function staffAction(action, extra = {}) {
  try { return await api({ action, ...extra }, staffToken); } catch (e) { toast(e.message); return null; }
}
function hero(title, text, image = '/assets/jebediah.png') {
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">JEBEDIAH CROW NEEDS YOU</p><h1>${title}</h1><p class="lead">${text}</p></div><div class="portrait"><img src="${image}" alt="Jebediah Crow, a smiling scarecrow"></div></section>`;
}
const testCode = `<div class="test-code"><img src="/qr/test.svg" alt="Scanner test QR, payload TEST WAND"><div><p class="eyebrow">WAND CHECK</p><h2>Give it a test blast.</h2><p>Point your wand at the code. We’ll light up your color when it connects.</p></div></div>`;
function shell() {
  if (view === 'home') {
    app.innerHTML = hero('Ghostbusters in<br>the pumpkin patch.', 'Our patch is haunted. Our wands are charged. Let’s save Halloween.') +
      `<section class="launch-grid"><a class="tile" href="/?view=referee"><span>01 / CONTROL</span><h2>Referee desk ↗</h2><p>Names, wand checks, and round controls.</p></a><a class="tile" href="/?view=station"><span>02 / CONNECT</span><h2>Wand station ↗</h2><p>Staff setup for a paired scanner.</p></a><a class="tile" href="/?view=leaderboard"><span>03 / DISPLAY</span><h2>Live leaderboard ↗</h2><p>Put your ghost hunters on the big screen.</p></a><a class="tile" href="/?view=intro"><span>04 / WELCOME</span><h2>Meet Jebediah ↗</h2><p>Orientation and scanner testing.</p></a><a class="tile" href="/?view=targets"><span>05 / PROJECT</span><h2>Digital ghosts ↗</h2><p>Three stationary targets for a screen or projector.</p></a><a class="tile" href="/?view=atmosphere"><span>06 / HAUNT</span><h2>Atmosphere ↗</h2><p>A floating ghost for ceilings and corners.</p></a></section><p class="footnote"><a href="/print.html">Print ghost targets, chest badges, or a test target ↗</a></p>`;
  } else if (view === 'referee') {
    app.innerHTML = `<section class="referee-top"><div><p class="eyebrow">WELCOME TO THE PATCH</p><h1>Meet your ghost patrol.</h1><p>Tell Jebediah your name, then test your wand.</p></div><button id="staff-toggle" class="quiet">Staff controls</button></section>
      <section id="staff-panel" class="panel" hidden>
        <form id="login"><label>Staff passphrase<input id="staff-secret" type="password" autocomplete="current-password" required></label><button>Unlock controls</button></form>
        <div id="unlocked" hidden><div class="control-row"><label class="switch"><input id="pvp" type="checkbox"> Enable surprise PvP finale</label><span class="muted">Private round setting · editable in lobby</span></div><div class="control-row"><button id="start">Start round</button><button id="finish" class="quiet">End round</button><button id="new-round" class="quiet">Next group</button><button id="reset" class="danger">Reset lobby & release all</button><button id="lock" class="quiet">Sign out</button></div><p class="muted" id="timing-note"></p></div>
      </section><section class="referee-grid"><div class="panel"><div class="section-head"><h2>Your patrol</h2><span id="round-status" class="tag">Lobby</span></div><div id="roster"></div></div><div class="panel">${testCode}</div></section>`;
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
    app.innerHTML = `<section class="station"><p class="eyebrow">NEUTRON WAND LINK</p><h1 id="station-title">Connect your wand.</h1><section id="pair-panel" class="panel"><p>Staff: select this computer and its scanner color. Players will enter names at the referee desk.</p><form id="pair"><label>Computer<select id="station">${options(stations)}</select></label><label>Scanner color<select id="color">${options(colors)}</select></label><label>Staff passphrase<input id="pair-secret" type="password" required autocomplete="current-password"></label><button>Connect station</button></form></section><div id="linked" hidden><img class="wand" src="/assets/scanner.png" alt="Glowing neutron wand"><p id="station-name" class="lead"></p><p id="scanner-feedback" class="scan-feedback" aria-live="polite"></p><p id="focus-note" class="tag"></p><div class="station-actions"><button id="focus" class="quiet">Arm scanner capture</button><button id="leave" class="quiet">Leave station</button></div><p class="muted">Keep this browser window active. Unknown codes are ignored.</p></div></section>`;
    $('pair').onsubmit = async e => {
      e.preventDefault();
      try {
        const login = await api({ action: 'login', secret: $('pair-secret').value });
        const r = await api({ action: 'claim', color: $('color').value, station: $('station').value }, login.token);
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
      try { const r = await api(event, playerToken); feedback = r.result || 'Scan received.'; render(); }
      catch(e) { feedback = 'Scan not confirmed. Check connection, then scan again.'; toast(e.message); render(); }
    });
    document.addEventListener('keydown', e => {
      if (!playerToken || e.target.closest('input,select,textarea')) return;
      scanner(e);
    });
    window.addEventListener('focus', render); window.addEventListener('blur', render);
  } else if (view === 'intro') {
    app.innerHTML = hero('IT friends!<br>I need your help!', 'Spooky ghosts have taken over my pumpkin patch! Grab a neutron wand, tell us your name, and give it a test blast. Help me save Halloween!') + `<section class="intro-bottom"><div class="panel">${testCode}</div><div class="panel"><p class="eyebrow">YOUR GHOST PATROL</p><div id="intro-roster"></div></div></section><div id="intro-announcement" class="announcement" hidden></div>`;
  } else if (view === 'leaderboard') {
    app.innerHTML = `<section class="score-header"><div><p class="eyebrow">JEBEDIAH’S GHOST PATROL</p><h1 id="board-title">Save the pumpkin patch.</h1></div><div class="clock"><span id="phase-label">READY WHEN YOU ARE</span><strong id="clock">06:00</strong></div></section><section id="standings" class="standings"></section><section class="vanquished" id="vanquished"></section><div class="ticker"><span class="pulse"></span><span id="latest">Choose your wand and meet Jebediah.</span></div>`;
  } else if (view === 'targets') {
    app.innerHTML = `<section class="target-top"><p class="eyebrow">GHOSTS IN THE MACHINE</p><h1>Give these ghosts a blast.</h1><p id="target-phase">Each ghost is worth 100 points. Capture each one once.</p></section><section class="digital-targets">${[16,17,18].map(id=>`<article><div class="ghost-shape">● ●<span>﹏</span></div><img src="/qr/ghost-${id}.svg" alt="Ghost ${id} QR code"><h2>Ghost ${id}</h2></article>`).join('')}</section>`;
  } else if (view === 'atmosphere') {
    document.body.classList.add('atmosphere');
    app.innerHTML = `<div class="haunt"><img src="/assets/ghost.png" alt="A floating gauze ghost with green streamers and an orange pumpkin"></div><div class="mist"></div>`;
  } else { app.innerHTML = '<h1>Session not found.</h1><a href="/">Choose a session</a>'; }
}
function playerColor() {
  try { return JSON.parse(atob(playerToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).color; } catch { return null; }
}
function render() {
  if (!state) return;
  const lobby = state.phase === 'lobby';
  if (view === 'referee') {
    $('login').hidden = !!staffToken; $('unlocked').hidden = !staffToken;
    $('pvp').disabled = !lobby;
    if (state.pvpEnabled !== undefined) $('pvp').checked = state.pvpEnabled;
    $('timing-note').textContent = '5 min hunt + 1 min finale when enabled; 6 min hunt otherwise. Tie timing uses server receipts; office accuracy is unverified.';
    $('round-status').textContent = ({ lobby: 'Wand check', pve: 'Hunting ghosts', pvp: 'Final showdown', results: 'Round complete' })[state.phase];
    // Stable controls: do not replace a focused name field while polling.
    for (const color of colors) {
      const p = state.players.find(p => p.color === color);
      let row = $(`row-${color}`);
      if (!p) { row?.remove(); continue; }
      if (!row) {
        row = document.createElement('div'); row.id = `row-${color}`; row.className = 'roster-row';
        row.innerHTML = `<span class="swatch ${color.toLowerCase()}"></span><div class="roster-info"><strong>${color}</strong><small class="player-meta"></small></div><form class="name-form"><input aria-label="${color} player name" maxlength="24" placeholder="Display name" required><button>Save</button></form><span class="readiness"></span><button class="release quiet" aria-label="Release ${color}">×</button>`;
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
      row.querySelector('.readiness').textContent = p.vanquished ? 'Vanquished' : p.ready ? '✓ Wand tested' : 'Test wand';
    }
    if (!state.players.length && !$('empty-roster')) $('roster').innerHTML = '<p id="empty-roster" class="muted">Staff: connect a wand station to begin.</p>';
    if (state.players.length) $('empty-roster')?.remove();
  }
  if (view === 'station') {
    const p = state.players.find(p => p.color === playerColor());
    $('pair-panel').hidden = !!playerToken; $('linked').hidden = !playerToken;
    $('station-title').textContent = playerToken ? `${p?.color || 'Your'} wand connected.` : 'Connect your wand.';
    if (playerToken) {
      $('station-name').textContent = `${p?.name || 'Name entry at the referee desk'} · ${p?.station || 'Reconnecting'}`;
      $('scanner-feedback').textContent = p?.vanquished ? 'Vanquished · your patrol thanks you.' : feedback;
      $('focus-note').textContent = document.hasFocus() ? '● Scanner capture armed' : '⚠ Window inactive · staff must restore focus';
    }
  }
  if (view === 'intro') {
    $('intro-roster').innerHTML = state.players.length ? state.players.map(p=>`<div class="intro-player"><span class="swatch ${p.color.toLowerCase()}"></span><strong>${esc(p.name || p.color)}</strong><span>${p.ready ? '✓ Ready' : 'Test your wand'}</span></div>`).join('') : '<p>Your patrol is assembling…</p>';
    $('intro-announcement').hidden = lobby;
    $('intro-announcement').textContent = state.phase === 'pvp' ? 'The ghosts have possessed your fellow hunters! Scan their chest badges!' : state.phase === 'results' ? 'The round is complete! Check your patrol’s results.' : 'The hunt is on! Find and blast the ghosts around the patch.';
  }
  if (view === 'leaderboard') {
    const players = state.players.filter(p=>p.name);
    $('standings').innerHTML = players.filter(p=>!p.vanquished).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name)).map((p,i)=>`<article class="score-card ${p.color.toLowerCase()}"><span class="rank">${String(i+1).padStart(2,'0')}</span><span class="swatch ${p.color.toLowerCase()}"></span><h2>${esc(p.name)}</h2><small>${p.color} wand · ${p.captures} ghosts</small><strong>${p.score.toLocaleString()}</strong><span class="points">POINTS</span></article>`).join('') || '<div class="empty-patch"><img src="/assets/pumpkin.png" alt="Orange pumpkin lantern"><h2>Your patrol is assembling…</h2></div>';
    $('vanquished').innerHTML = players.filter(p=>p.vanquished).map(p=>`<span><i class="swatch ${p.color.toLowerCase()}"></i>${esc(p.name)} · Vanquished${p.reason === 'tie' ? ` · ${p.frozenScore} frozen` : ''}</span>`).join('');
    $('board-title').textContent = state.phase === 'pvp' ? 'Who’s haunting whom?' : state.phase === 'results' ? 'The patch is saved!' : 'Save the pumpkin patch.';
    $('phase-label').textContent = ({ lobby: 'READY WHEN YOU ARE', pve: 'GHOST HUNT', pvp: 'FINAL SHOWDOWN', results: 'ROUND COMPLETE' })[state.phase];
    $('latest').textContent = state.log.at(-1)?.message || 'Choose your wand and meet Jebediah.';
  }
  if (view === 'targets') {
    $('target-phase').textContent = state.phase === 'pvp' ? 'The ghosts have moved! Scan your opponents’ chest badges.' : state.phase === 'results' ? 'Round complete. Thank you, ghost patrol!' : 'Each ghost is worth 100 points. Capture each one once.';
    document.querySelector('.digital-targets').classList.toggle('inactive', state.phase === 'pvp' || state.phase === 'results');
  }
}
async function poll() {
  if (view === 'atmosphere') return;
  if (busy) { pendingPoll = true; return; }
  busy = true;
  try {
    if (view === 'station' && playerToken) await api({ action: 'heartbeat' }, playerToken);
    else await api(null, view === 'referee' && staffOpen ? staffToken : '');
  } catch(e) {
    $('connection').textContent = e.message; $('connection').className = 'offline';
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
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('On iPhone: Share → Add to Home Screen for an app-like display.'); } catch { toast('Full screen unavailable here. Try Add to Home Screen on iPhone.'); } };
shell();
connectGameUpdates(globalThis.io, poll);
poll();
setInterval(poll, view === 'station' ? 2000 : 15000);
setInterval(() => {
  if ($('clock') && state) {
    const ms = state.phase === 'lobby' ? 360000 : state.phase === 'results' ? 0 : Math.max(0, state.endsAt - (Date.now() + offset));
    const sec = Math.ceil(ms/1000); $('clock').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  }
  if (lastGood && Date.now() - lastGood > 6000) { $('connection').textContent = 'Connection interrupted · scores may be delayed'; $('connection').className = 'offline'; }
}, 250);
