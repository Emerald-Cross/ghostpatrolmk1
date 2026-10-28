import { createScanner } from '/scanner.js?v=display-fix-20261028-1';
import { connectGameUpdates } from '/realtime.js';
import { icon } from '/icons.js?v=display-fix-20261028-1';
import { createGameAudio } from '/audio.js?v=display-fix-20261028-1';
import { patchScene, bossGhost, bossThanks, updateBoss, createBossPvpAnnouncement, bossPvpAnnouncement } from '/patch-scene.js?v=device-setup-20261028-1';
import { mountAtmosphere } from '/atmosphere.js?v=display-fix-20261028-1';

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
const params = new URLSearchParams(location.search);
const view = params.get('view') === 'targets' ? 'home' : params.get('view') || 'home';
const setupView = ['referee', 'hub'].includes(view);
const bossView = view === 'boss' || view === 'referee';
const gameTitle = "Save Jebediah Crow's pumpkin patch";
const sharedDisplay = ['leaderboard', 'intro'].includes(view);
const requestedScene = Number(new URLSearchParams(location.search).get('scene'));
const scene = [1,2,3].includes(requestedScene) ? requestedScene : 1;
document.body.classList.add(`${sharedDisplay ? 'intro' : view}-view`);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const options = items => items.map((s,i) => `<option value="${esc(s)}"${i === 0 ? ' selected' : ''}>${esc(s)}</option>`).join('');
let state = null, lastGood = 0, offset = 0, staffOpen = false, connectionHealthy = false, stationRound;
let staffToken = sessionStorage.getItem('gp-staff') || '';
const playerStorageKey = `gp-player-${params.get('station') || 'manual'}`;
let playerToken = localStorage.getItem(playerStorageKey) || '';
// Reuse an existing assignment when upgrading a computer already in service.
if (!playerToken) {
  const legacy = localStorage.getItem('gp-player') || '';
  try {
    const color = JSON.parse(atob(legacy.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).color;
    if (!params.get('station') || stationColors[params.get('station')] === color) {
      playerToken = legacy; localStorage.setItem(playerStorageKey, legacy); localStorage.removeItem('gp-player');
    }
  } catch { /* No previous assignment on this computer. */ }
}
let feedback = 'Ready for your next scan.', busy = false, pendingPoll = false;
let autoPairAttempted = false;
let projection, projectionPhase, announcementTimer, controlsTimer, bossAnnouncement;
const audio = createGameAudio({ music: ['atmosphere','boss','referee','leaderboard','intro'].includes(view), onChange(active) {
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
  lastGood = Date.now(); connectionHealthy = true;
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
const deviceProfiles = {
  east: { name: 'East computer', screens: [
    { name: 'Leaderboard & orientation', url: '/?view=leaderboard' },
    { name: 'Ambience', url: '/?view=atmosphere&scene=1' },
    { name: 'Green scan capture', url: '/?view=station&station=east' }
  ] },
  central: { name: 'Central computer', screens: [
    { name: 'Ambience', url: '/?view=atmosphere&scene=2' },
    { name: 'Blue scan capture', url: '/?view=station&station=center' }
  ] },
  student: { name: 'Student main computer', screens: [
    { name: 'Control hub', url: '/?view=hub' },
    { name: 'Red scan capture', url: '/?view=station&station=studentprimary' }
  ] },
  iphone: { name: 'iPhone', screens: [
    { name: 'Setup Station & boss screen', url: '/?view=referee' }
  ] }
};
function launchDevice(id) {
  const profile = deviceProfiles[id];
  document.querySelectorAll('[data-device]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.device === id));
  });
  $('device-links').innerHTML = `<h2>${profile.name} screens</h2><p>${id === 'iphone' ? 'Open setup here, then mirror this page to the boss TV with AirPlay.' : 'Open each screen using the buttons below. Keep scan capture active on the computer; move display tabs onto their screens.'}</p><div class="screen-buttons">${profile.screens.map(screen => `<a class="screen-button" href="${screen.url}"${id === 'iphone' ? '' : ` target="ghost-patrol-${id}-${screen.name}"`}>Open ${screen.name}</a>`).join('')}</div>`;
}

function bossMarkup() {
  return `${patchScene()}${bossGhost()}${bossThanks()}${bossPvpAnnouncement()}<section id="boss-hud" class="boss-hud" role="status" aria-live="polite" hidden><h1 id="boss-heading">BOSS BATTLE</h1><div id="boss-health" class="boss-health" role="img" aria-label="9 of 9 health remaining">${Array.from({length:9},()=>'<span class="boss-heart" aria-hidden="true"></span>').join('')}</div><p id="boss-status"></p></section>`;
}
function shell() {
  if (view === 'home') {
    app.innerHTML = `<section id="device-setup" class="panel"><p class="eyebrow">QUICK SETUP</p><h1>Which computer are you setting up?</h1><p>Choose a device, then use its screen buttons below.</p><div class="device-grid">${Object.entries(deviceProfiles).map(([id, profile]) => `<button class="device-choice" data-device="${id}" aria-pressed="false" aria-controls="device-links"><strong>${profile.name}</strong><span>${profile.screens.map(screen => screen.name).join(' · ')}</span></button>`).join('')}</div><div id="device-links" aria-live="polite"></div><button id="skip-setup" class="quiet">Skip · choose a screen</button></section><section id="manual-screens" hidden>` + hero(gameTitle.replace(" Crow's", "<br>Crow's").replace(" patch", "<br>patch"), 'Grab a blaster! Let’s save Halloween.') +
      `<section class="launch-grid" aria-label="Game screens">${[
        launchTile('referee', 'setup', 'Setup Station & boss', 'Enter names on the iPhone, then keep it on the boss screen.'),
        launchTile('hub', 'setup', 'Control hub', 'Start rounds, change settings, and prepare the next group.'),
        launchTile('station', 'blaster', 'Scan capture', 'Connect a blaster and capture scans.'),
        launchTile('leaderboard', 'trophy', 'Leaderboard & orientation', 'Welcome your team, then show live scores.'),
        launchTile('atmosphere', 'moon', 'Ambience', 'Looping pumpkin patch scenes.'),
        launchTile('boss', 'ghost', 'Boss screen', 'Nine hits to vanquish.')
      ].join('')}</section><p class="footnote"><a href="/print.html">${icon('printer')}Print ghost targets, chest badges, or a test target</a></p></section>`;
    $('skip-setup').onclick = () => { $('device-setup').hidden = true; $('manual-screens').hidden = false; };
    document.querySelectorAll('[data-device]').forEach(button => { button.onclick = () => launchDevice(button.dataset.device); });
  } else if (setupView) {
    app.innerHTML = `<div id="setup-screen"><section class="referee-top"><div><p class="eyebrow">WELCOME TO THE OIT MATERIALS MANAGEMENT HALLOWEEN PUMPKIN PATCH</p><h1>You are professional ghost busters!</h1><p>Enter your name and test your blaster</p></div><button id="staff-toggle" class="quiet">Round controls</button></section>
      <section id="staff-panel" class="panel" hidden>
        <div id="unlocked"><div class="control-row"><label class="switch"><input id="pvp" type="checkbox"> Enable finale</label><span class="muted">Private round setting · editable in lobby</span></div><div class="control-row"><button id="start">Start round</button><button id="finish" class="quiet">End round</button><button id="new-round" class="quiet">Next group</button><button id="reset" class="danger">Reset lobby & release all</button></div><p class="muted" id="timing-note"></p></div>
      </section><section class="referee-grid"><div class="panel"><div class="section-head"><h2>Your team</h2><span id="round-status" class="tag">Blaster checking...</span></div><div id="roster"><p id="empty-roster" class="muted">Connect blasters to begin</p></div></div><div class="panel">${testCode}</div></section></div>${view === 'referee' ? `<div id="iphone-boss" hidden>${bossMarkup()}</div>` : ''}`;
    $('staff-toggle').onclick = () => { staffOpen = !staffOpen; $('staff-panel').hidden = !staffOpen; $('staff-toggle').textContent = staffOpen ? 'Return to welcome screen' : 'Round controls'; render(); };
    if (view === 'hub') { staffOpen = true; $('staff-panel').hidden = false; $('staff-toggle').hidden = true; }
    $('pvp').onchange = () => staffAction('settings', { pvpEnabled: $('pvp').checked });
    $('start').onclick = () => staffAction('start');
    $('finish').onclick = () => { if (confirm('End the current round?')) staffAction('finish'); };
    $('new-round').onclick = () => { if (confirm('Clear names and scores for the next group? Station connections will stay assigned.')) staffAction('newRound'); };
    $('reset').onclick = () => { if (confirm('Release every color and disconnect all wand stations?')) staffAction('reset'); };
  } else if (view === 'station') {
    app.innerHTML = `<div id="station-scenery" hidden>${patchScene()}</div><section class="station"><div class="station-head"><p class="eyebrow">NEUTRON BLASTER LINK</p><h1 id="station-title">Connect your blaster</h1></div><div class="station-stage"><div class="station-art"><img src="/assets/scanner.webp" alt="Glowing neutron blaster" width="650" height="650"></div><section id="pair-panel" class="panel"><p>Select this computer. Its assigned scanner color is shown automatically. Players will enter names at hub device.</p><form id="pair"><label>Computer<select id="station">${options(stations)}</select></label><label>Scanner color<input id="color" readonly></label><button>${icon('link', 'icon-small')}Connect station</button></form></section><div id="linked" class="panel" hidden><p id="station-name" class="station-name"></p><p id="scanner-feedback" class="scan-feedback" aria-live="polite"></p><p id="focus-note" class="tag"></p><div class="station-actions"><button id="focus" class="quiet">${icon('target', 'icon-small')}Arm your scanner</button><button id="leave" class="quiet">Leave station</button></div><p class="muted">Keep this browser window active.</p></div></div></section>`;
    $('station').onchange = () => { $('color').value = stationColors[$('station').value]; };
    if (stations.includes(params.get('station'))) $('station').value = params.get('station');
    $('color').value = stationColors[$('station').value];
    $('pair').onsubmit = async e => {
      e.preventDefault();
      try {
        const selectedStation = $('station').value;
        const selectedColor = stationColors[selectedStation];
        const login = await api({ action: 'login' });
        const r = await api({ action: 'claim', color: selectedColor, station: selectedStation }, login.token);
        playerToken = r.token; localStorage.setItem(playerStorageKey, playerToken); document.activeElement?.blur(); render();
      } catch (e) { toast(e.message); }
    };
    $('leave').onclick = async () => {
      try { await api({ action: 'leave' }, playerToken); playerToken = ''; localStorage.removeItem(playerStorageKey); render(); } catch(e) { toast(e.message); }
    };
    $('focus').onclick = () => { document.activeElement?.blur(); window.focus(); render(); };
    const scanner = createScanner(async (payload, clientMono) => {
      if (!playerToken || !state) return;
      const event = { action: 'scan', payload, roundId: state.roundId, eventId: crypto.randomUUID(), clientMono, clientAt: performance.timeOrigin + clientMono };
      try { const r = await api(event, playerToken); feedback = r.result || 'Scan received.'; if (r.result === 'Wand tested!') audio.effect('ready'); else if (['Ghost captured! +100','Boss hit! +100'].includes(r.result)) audio.effect('capture'); else if (r.result === 'Boss vanquished! +100') audio.effect('finish'); else if (r.result === 'Blast registered.') audio.effect('vanquished'); render(); }
      catch(e) { connectionHealthy = false; feedback = 'Scan not confirmed. Check connection, then scan again.'; toast(e.message); render(); }
    });
    document.addEventListener('keydown', e => {
      if (!playerToken || e.target.closest('input,select,textarea')) return;
      scanner(e);
    });
    window.addEventListener('focus', render); window.addEventListener('blur', render);
  } else if (sharedDisplay) {
    app.innerHTML = `<section id="leaderboard-screen" aria-label="Leaderboard" hidden><section class="score-header"><div><p class="eyebrow">SAVE HALLOWEEN</p><h1 id="board-title">Save the pumpkin patch.</h1></div><div class="clock" role="timer" aria-label="Decorative round countdown"><span id="phase-label">READY WHEN YOU ARE</span><strong id="clock">02:00</strong><small class="clock-note">Decorative display · round continues at 0</small></div></section><ol id="standings" class="standings" aria-label="Player rankings"></ol><section class="vanquished" id="vanquished"></section><div class="ticker">${icon('ghost')}<span id="latest">Choose your blaster and get instructions</span></div></section><section id="orientation-screen" aria-label="Orientation">` + hero('IT friends!<br>I need your help!', 'Spooky ghosts have taken over my pumpkin patch! Grab a neutron blaster and vanquish some ghosts! Help me save Halloween!') + `<section class="intro-bottom"><div class="panel">${testCode}</div><div class="panel"><p class="eyebrow">YOUR TEAM</p><div id="intro-roster"></div></div></section><div id="intro-announcement" class="announcement" hidden></div></section>`;
  } else if (view === 'atmosphere') {
    document.body.classList.add('atmosphere');
    app.innerHTML = `<canvas id="projection" role="img" aria-label="Looping ghosts in the pumpkin patch"></canvas><div id="projection-announcement" class="projection-announcement" role="status" hidden><strong>FINAL SHOWDOWN</strong><span>Ghosts have possessed your fellow hunters! BLAST THEM!</span></div><nav class="projection-controls" aria-label="Projection scenes"><div class="projection-scenes">${['Drift','Current','Whirl'].map((name,i)=>`<a href="/?view=atmosphere&scene=${i+1}"${scene===i+1?' aria-current="page"':''}>${i+1} · ${name}</a>`).join('')}</div><span id="projection-status">Connecting…</span><small>Move the pointer or tap to show controls. Enable sound on one device.</small></nav>`;
    projection = mountAtmosphere($('projection'), scene);
  } else if (view === 'boss') {
    document.body.classList.add('cinematic');
    app.innerHTML = bossMarkup();
  } else { app.innerHTML = '<h1>Session not found.</h1><a href="/">Choose a session</a>'; }
}
function playerColor() {
  try { return JSON.parse(atob(playerToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).color; } catch { return null; }
}
function render() {
  if (!state) return;
  document.body.dataset.phase = state.phase;
  const lobby = state.phase === 'lobby';
  const orienting = sharedDisplay && lobby;
  if (sharedDisplay) {
    $('leaderboard-screen').hidden = orienting;
    $('orientation-screen').hidden = !orienting;
    document.body.classList.toggle('intro-view', orienting);
    document.body.classList.toggle('leaderboard-view', !orienting);
  }
  if (view === 'atmosphere') {
    projection?.update(state);
    $('projection-status').textContent = ({lobby:'Standby',pve:'Ghost hunt',pvp:'Final showdown',results:'Round complete'})[state.phase];
    if (projectionPhase !== state.phase) {
      clearTimeout(announcementTimer); $('projection-announcement').hidden = state.phase !== 'pvp';
      if (state.phase === 'pvp') announcementTimer = setTimeout(() => { $('projection-announcement').hidden = true; },6500);
      projectionPhase = state.phase;
    }
  }
  if (bossView) {
    if (view === 'referee') {
      const showingBoss = !lobby;
      $('setup-screen').hidden = showingBoss;
      $('iphone-boss').hidden = !showingBoss;
      document.body.classList.toggle('cinematic', showingBoss);
      document.body.classList.toggle('boss-view', showingBoss);
    }
    bossAnnouncement.update(state);
    updateBoss(document, state);
  }
  if (setupView) {
    $('pvp').disabled = !lobby;
    if (state.pvpEnabled !== undefined) $('pvp').checked = state.pvpEnabled;
    $('timing-note').textContent = 'The boss appears after 80 seconds and takes 9 hits. Defeating it ends ghost hunting. If the finale is enabled, PvP continues until one hunter remains; otherwise, the round completes. The 2:00 countdown is decorative and reaching zero does not end the round. Staff may end the round manually.';
    $('round-status').textContent = ({ lobby: 'Blaster checking...', pve: 'Hunting ghosts', pvp: 'Final showdown', results: 'Round complete' })[state.phase];
    // Stable controls: do not replace a focused name field while polling.
    for (const color of colors) {
      const p = state.players.find(p => p.color === color);
      let row = $(`row-${color}`);
      if (!p) { row?.remove(); continue; }
      if (!row) {
        row = document.createElement('div'); row.id = `row-${color}`; row.className = 'roster-row';
        row.innerHTML = `<span class="swatch ${color.toLowerCase()}"></span><div class="roster-info"><strong>${color}</strong><small class="player-meta"></small></div><form class="name-form"><input aria-label="${color} player name" maxlength="24" placeholder="Player Name" required><button>Save</button></form><span class="readiness"></span><button class="release quiet" aria-label="Release ${color}">×</button>`;
        row.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await api({ action: 'name', color, name: row.querySelector('input').value }); toast('Name saved.'); } catch(e) { toast(e.message); } };
        row.querySelector('.release').onclick = () => { if (confirm(`Release the ${color} station?`)) staffAction('release', { color }); };
        $('roster').append(row);
      }
      const field = row.querySelector('input');
      if (document.activeElement !== field) field.value = p.name;
      field.disabled = !lobby;
      row.querySelector('button').disabled = !lobby;
      row.querySelector('.release').hidden = !staffOpen || !staffToken || !lobby;
      row.querySelector('.player-meta').textContent = `${p.station}${p.connected ? '' : ' · disconnected'}`;
      row.querySelector('.readiness').textContent = p.vanquished ? 'Ghost vanquished!' : p.ready ? '✓ Blaster tested' : 'Test blaster';
    }
    if (!state.players.length && !$('empty-roster')) $('roster').innerHTML = '<p id="empty-roster" class="muted">Connect blasters to begin</p>';
    if (state.players.length) $('empty-roster')?.remove();
  }
  if (view === 'station') {
    if (!playerToken && !autoPairAttempted && stations.includes(params.get('station'))) {
      autoPairAttempted = true;
      $('pair').dispatchEvent(new Event('submit', { cancelable: true }));
    }
    const p = state.players.find(p => p.color === playerColor());
    if (stationRound !== state.roundId) { stationRound = state.roundId; feedback = 'Ready for your next scan.'; }
    const playing = !!p && ['pve','pvp'].includes(state.phase);
    document.body.classList.toggle('station-playing', playing);
    document.body.classList.toggle('cinematic', playing);
    document.body.classList.toggle('scanner-unfocused', !document.hasFocus());
    document.body.classList.toggle('station-connection-issue', !connectionHealthy);
    $('station-scenery').hidden = !playing;
    $('pair-panel').hidden = !!playerToken; $('linked').hidden = !playerToken;
    $('station-title').textContent = playerToken ? `${p?.color || 'Your'} blaster connected.` : 'Connect your blaster';
    if (playerToken) {
      $('linked').dataset.ready = String(!!p?.ready);
      $('station-name').textContent = `${p?.name || 'Name entry at hub'} · ${p?.station || 'Reconnecting'}`;
      $('scanner-feedback').textContent = p?.vanquished ? 'Vanquished! Good Job!' : feedback;
      $('focus-note').textContent = !connectionHealthy ? 'Connection issue · scans unconfirmed' : document.hasFocus() ? '● Scanner capture armed' : '⚠ Window inactive · restore focus';
    }
  }
  if (orienting) {
    const character = $('hero-character');
    const art = 'welcome';
    if (character.dataset.art !== art) { character.src = `/assets/jebediah-${art}.webp`; character.dataset.art = art; }
    $('intro-roster').innerHTML = state.players.length ? state.players.map(p=>`<div class="intro-player"><span class="swatch ${p.color.toLowerCase()}"></span><strong>${esc(p.name || p.color)}</strong><span>${p.ready ? '✓ Ready' : 'Test your blaster'}</span></div>`).join('') : '<p>Your team is assembling…</p>';
    $('intro-announcement').hidden = true;
    $('intro-announcement').innerHTML = '';
  }
  if (sharedDisplay && !orienting) {
    const completed = state.phase === 'results';
    const players = state.players.filter(p=>p.name);
    $('clock').dataset.previous = 'false';
    $('standings').innerHTML = players.filter(p=>completed || !p.vanquished).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name)).map((p,i)=>`<li class="score-row ${p.color.toLowerCase()}"><span class="row-rank">${String(i+1).padStart(2,'0')}</span><span class="swatch ${p.color.toLowerCase()}"></span><div class="row-player"><h2>${esc(p.name)}</h2><small>${p.color} scanner · ${p.captures} ghosts${completed && p.vanquished ? ' · Vanquished' : ''}</small></div><div class="row-score"><strong class="score-value">${p.score.toLocaleString()}</strong><span>POINTS</span></div></li>`).join('') || '<li class="empty-patch"><img src="/assets/pumpkin.webp" alt="Orange pumpkin lantern" width="130" height="130"><h2>Your team is assembling…</h2></li>';
    $('vanquished').innerHTML = (completed ? [] : players).filter(p=>p.vanquished).map(p=>`<span><i class="swatch ${p.color.toLowerCase()}"></i>${esc(p.name)} · Vanquished${p.reason === 'tie' ? ` · ${p.frozenScore} frozen` : ''}</span>`).join('');
    $('board-title').textContent = state.phase === 'pvp' ? 'Who’s haunting whom?' : state.phase === 'results' ? 'The pumpkin patch is saved!' : 'Save the pumpkin patch.';
    $('phase-label').textContent = ({ lobby: 'READY WHEN YOU ARE', pve: 'GHOST HUNT', pvp: 'FINAL SHOWDOWN', results: 'ROUND COMPLETE' })[state.phase];
    $('latest').textContent = state.log.at(-1)?.message || 'Choose your blaster and get instructions';
  }

}
async function poll() {
  if (busy) { pendingPoll = true; return; }
  busy = true;
  try {
    if (setupView && !staffToken) { const login = await api({ action: 'login' }); staffToken = login.token; sessionStorage.setItem('gp-staff', staffToken); }
    if (view === 'station' && playerToken) await api({ action: 'heartbeat' }, playerToken);
    else await api(null, setupView ? staffToken : '');
  } catch(e) {
    connectionHealthy = false;
    $('connection').textContent = 'Connection issue'; $('connection').className = 'offline';
    if (e.status === 401) {
      if (view === 'station') { playerToken = ''; localStorage.removeItem(playerStorageKey); }
      else { staffToken = ''; sessionStorage.removeItem('gp-staff'); }
    }
    render();
  } finally {
    busy = false;
    if (pendingPoll) { pendingPoll = false; queueMicrotask(poll); }
  }
}
$('fullscreen').innerHTML = icon('fullscreen') + 'Full screen';
$('fullscreen').onclick = async e => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('On iPhone: Share → Add to Home Screen for an app-like display.'); } catch { toast('Full screen unavailable here. Try Add to Home Screen on iPhone.'); } finally { if(['atmosphere','boss','station','referee'].includes(view) && e?.detail > 0) $('fullscreen').blur(); } };
shell();
if (bossView) bossAnnouncement = createBossPvpAnnouncement($('boss-pvp-announcement'));
if (sharedDisplay) window.addEventListener('resize',render);
if (['atmosphere','boss','station','referee'].includes(view)) {
  const showControls = () => { document.body.classList.add('projection-ui-visible'); clearTimeout(controlsTimer); controlsTimer = setTimeout(()=>document.body.classList.remove('projection-ui-visible'),6500); };
  document.addEventListener('pointermove',showControls); document.addEventListener('pointerdown',showControls); document.addEventListener('keydown',e=>{ if (e.key === 'Tab' || e.key === 'Escape') showControls(); }); showControls();
}
const soundControls = $('sound-controls');
if (soundControls && ['station','intro','leaderboard','atmosphere','boss','referee'].includes(view)) {
  soundControls.hidden = false;
  $('sound-toggle').onclick = async event => { $('sound-toggle').disabled = true; try { if (audio.enabled) audio.disable(); else await audio.enable(); } catch(e) { toast(e.message || 'Tap Enable sound to try again.'); } finally { $('sound-toggle').disabled = false; if(['atmosphere','boss','station','referee'].includes(view) && event?.detail > 0) $('sound-toggle').blur(); } };
  $('sound-volume').oninput = () => audio.setVolume(Number($('sound-volume').value));
  $('sound-volume').onpointerup = () => { if(['atmosphere','boss','station','referee'].includes(view)) $('sound-volume').blur(); };
}
window.addEventListener('pagehide', event => { if(event.persisted) audio.disable(); else { projection?.destroy(); bossAnnouncement?.destroy(); audio.destroy(); } });
connectGameUpdates(globalThis.io, poll);
poll();
setInterval(poll, ['station','atmosphere','boss','referee','hub'].includes(view) ? 2000 : 15000);
setInterval(() => {
  if ($('clock') && state) {
    const ms = $('clock').dataset.previous === 'true' ? 0 : state.phase === 'lobby' ? 120000 : state.phase === 'results' ? 0 : Math.max(0, state.endsAt - (Date.now() + offset));
    const sec = Math.ceil(ms/1000); $('clock').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    $('clock').closest('.clock').classList.toggle('is-urgent', ms > 0 && ms <= 30000 && state.phase !== 'lobby');
  }
  // Referee and display views intentionally poll every 15 seconds when no
  // Socket.IO event arrives. Allow two poll intervals plus some jitter before
  // declaring the connection stale; stations heartbeat every 2 seconds.
  const staleAfter = ['station','atmosphere','boss','referee','hub'].includes(view) ? 10000 : 35000;
  if (lastGood && Date.now() - lastGood > staleAfter) { $('connection').textContent = 'Connection issue'; $('connection').className = 'offline'; if (connectionHealthy) { connectionHealthy = false; render(); } }
}, 250);


