import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the app's real shell and render functions with a small DOM stand-in.
// Startup networking and timers are covered by the optional browser trial.
const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/gm, '').split("$('fullscreen').innerHTML")[0];
function display(view) {
  const classes = new Set();
  const classList = {
    add: value => classes.add(value),
    toggle(value, on) { if (on) classes.add(value); else classes.delete(value); },
    contains: value => classes.has(value)
  };
  const elements = new Map();
  class Element {
    hidden = false; dataset = {}; textContent = ''; rows = []; html = '';
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
        const element = new Element(); element.hidden = /\bhidden\b/.test(match[0]);
        elements.set(match[1], element);
      }
      this.rows = [...html.matchAll(/<li class="score-row /g)].map(() => new Element());
    }
    get innerHTML() { return this.html; }
    querySelectorAll() { return this.rows; }
    getBoundingClientRect() { return { top: 200, height: 90 }; }
    closest() { return { getBoundingClientRect: () => ({ height: 50 }) }; }
  }
  elements.set('app', new Element());
  const context = vm.createContext({
    URLSearchParams, location: { search: `?view=${view}` },
    sessionStorage: { getItem: () => '' }, localStorage: { getItem: () => '' },
    document: { getElementById: id => elements.get(id), body: { classList, dataset: {} } },
    patchScene: () => '', bossGhost: () => '', bossThanks: () => '', bossPvpAnnouncement: () => '',
    updateBoss: () => {},
    window: { innerHeight: 900 }, icon: () => '', createGameAudio: () => ({})
  });
  vm.runInContext(source + '\nshell(); bossAnnouncement = { update() {} };', context);
  return {
    get: id => elements.get(id), classes, context,
    render(state) { context.snapshot = state; vm.runInContext('state = snapshot; render();', context); }
  };
}
const player = { name: 'Hunter', color: 'Red', score: 100, captures: 1, ready: true };
const snapshot = (phase, extra = {}) => ({
  phase, roundId: 'current', startedAt: 1000, endsAt: 121000, players: [player], log: [],
  scoreHistory: [{ roundId: 'previous', players: [{ ...player, name: 'Previous hunter', score: 400 }] }], ...extra
});
test('referee instructions describe boss-driven rounds and the display-only countdown', () => {
  const d = display('referee');
  d.render(snapshot('pve', { players: [] }));
  const instructions = d.get('timing-note').textContent;
  assert.match(instructions, /boss appears after 80 seconds and takes 9 hits/i);
  assert.match(instructions, /if the finale is enabled, PvP continues until one hunter remains/i);
  assert.match(instructions, /reaching zero does not end the round/i);
  assert.match(instructions, /staff may end the round manually/i);
  assert.doesNotMatch(instructions, /5 min hunt|6 min hunt|automatic/i);

  const board = display('leaderboard').get('app').innerHTML;
  assert.match(board, /aria-label="Decorative round countdown"/);
  assert.match(board, /Decorative display · round continues at 0/);
  assert.doesNotMatch(board, /Round countdown/);
});

for (const view of ['leaderboard', 'intro']) {
  test(`${view} shows orientation for setup, scores throughout play and results, then orientation for the next group`, () => {
    const d = display(view), orientation = d.get('orientation-screen'), board = d.get('leaderboard-screen');
    assert.equal(orientation.hidden,false);assert.equal(board.hidden,true,'orientation is the initial shell');
    d.render(snapshot('lobby',{startedAt:null}));
    assert.equal(board.hidden,true);assert.equal(orientation.hidden,false);
    assert.match(d.get('intro-roster').innerHTML,/Hunter/);
    assert.equal(d.get('intro-announcement').hidden,true);
    assert.ok(d.classes.has('intro-view'));assert.ok(!d.classes.has('leaderboard-view'));
    for(const phase of ['pve','pve','pvp']){
      d.render(snapshot(phase));
      assert.equal(board.hidden,false);assert.equal(orientation.hidden,true);
      assert.ok(d.classes.has('leaderboard-view'));assert.ok(!d.classes.has('intro-view'));
      assert.match(d.get('standings').innerHTML,/>100</);
      assert.doesNotMatch(d.get('standings').innerHTML,/Previous hunter/);
    }
    d.render(snapshot('pvp',{players:[{...player,score:700}]}));
    assert.match(d.get('standings').innerHTML,/>700</,'leaderboard stays live during the finale');
    const results=snapshot('results',{players:[{...player,score:700},{...player,color:'Blue',name:'Vanquished hunter',score:0,vanquished:true}]});
    d.render(results);d.render(results);
    assert.equal(board.hidden,false);assert.equal(orientation.hidden,true);
    assert.match(d.get('standings').innerHTML,/>700</);
    assert.match(d.get('standings').innerHTML,/Vanquished hunter/);
    assert.doesNotMatch(d.get('standings').innerHTML,/Previous hunter/,'results retain this group, not historical scores');
    assert.equal(d.get('phase-label').textContent,'ROUND COMPLETE');
    d.render(snapshot('lobby',{roundId:'next',players:[],startedAt:null}));
    assert.equal(board.hidden,true);assert.equal(orientation.hidden,false);
    assert.match(d.get('intro-roster').innerHTML,/assembling/);
    assert.equal(d.get('orientation-screen'),orientation);assert.equal(d.get('leaderboard-screen'),board);
  });
  test(`${view} selects the correct screen on reload in every phase, including retained results`, () => {
    for(const phase of ['lobby','pve','pvp','results']){
      const d=display(view);
      d.render(snapshot(phase,{startedAt:phase==='lobby'?null:1000}));
      assert.equal(d.get('orientation-screen').hidden,phase!=='lobby');
      assert.equal(d.get('leaderboard-screen').hidden,phase==='lobby');
    }
  });
}


test('iPhone switches from setup to boss for play and results, then back for the next group', () => {
  const d = display('referee');
  for (const phase of ['lobby', 'pve', 'pvp', 'results', 'lobby']) {
    d.render(snapshot(phase, {players: []}));
    assert.equal(d.get('setup-screen').hidden, phase !== 'lobby');
    assert.equal(d.get('iphone-boss').hidden, phase === 'lobby');
    assert.equal(d.classes.has('cinematic'), phase !== 'lobby');
  }
});
test('control hub stays available throughout play and results without password fields', () => {
  const d = display('hub');
  assert.doesNotMatch(d.get('app').innerHTML, /type="password"|Unlock controls|Sign out/);
  for (const phase of ['lobby', 'pve', 'pvp', 'results']) {
    d.render(snapshot(phase, {players: []}));
    assert.equal(d.get('staff-panel').hidden, false);
    assert.equal(d.get('setup-screen').hidden, false);
  }
});

test('computer selection shows screen buttons without opening windows or navigating', () => {
  const d = display('hub'), opened = [], selected = [];
  d.context.window.open = (...args) => opened.push(args);
  d.context.location.assign = url => opened.push(url);
  d.context.document.querySelectorAll = () => ['east','central','student','iphone'].map(id => ({
    dataset: {device:id}, setAttribute(name,value) { selected.push({id,name,value}); }
  }));
  d.context.document.getElementById = id => id === 'device-links' ? (d.links ||= {}) : d.get(id);
  for (const [id, urls] of Object.entries({
    east: ['/?view=leaderboard', '/?view=atmosphere&scene=1', '/?view=station&station=east'],
    central: ['/?view=atmosphere&scene=2', '/?view=station&station=center'],
    student: ['/?view=hub', '/?view=station&station=studentprimary'],
    iphone: ['/?view=referee']
  })) {
    vm.runInContext(`launchDevice('${id}')`, d.context);
    assert.equal(opened.length, 0, 'selection must never open a window or navigate');
    assert.equal([...d.links.innerHTML.matchAll(/class="screen-button"/g)].length, urls.length);
    for (const url of urls) assert.ok(d.links.innerHTML.includes(`href="${url}"`));
    assert.equal(d.links.innerHTML.includes('target='), id !== 'iphone');
    assert.ok(selected.some(button => button.id === id && button.name === 'aria-pressed' && button.value === 'true'));
    assert.doesNotMatch(d.links.innerHTML, /pop-ups/);
  }
});
