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
    window: { innerHeight: 900 }, icon: () => '', createGameAudio: () => ({})
  });
  vm.runInContext(source + '\nshell();', context);
  return {
    get: id => elements.get(id), classes, context,
    render(state) { context.snapshot = state; vm.runInContext('state = snapshot; render();', context); }
  };
}
const player = { name: 'Hunter', color: 'Red', score: 100, captures: 1, ready: true };
const snapshot = (phase, extra = {}) => ({
  phase, roundId: 'current', startedAt: 1000, endsAt: 361000, players: [player], log: [],
  scoreHistory: [{ roundId: 'previous', players: [{ ...player, name: 'Previous hunter', score: 400 }] }], ...extra
});
for (const view of ['leaderboard', 'intro']) {
  test(`${view} link switches from past scores to orientation and back without rebuilding the display`, () => {
    const d = display(view), orientation = d.get('orientation-screen'), board = d.get('leaderboard-screen');
    d.render(snapshot('lobby'));
    assert.equal(board.hidden, false); assert.equal(orientation.hidden, true);
    assert.match(d.get('standings').innerHTML, /Previous hunter/);
    assert.ok(d.classes.has('leaderboard-view')); assert.ok(!d.classes.has('intro-view'));
    for (const phase of ['pve', 'pve', 'pvp']) {
      d.render(snapshot(phase));
      assert.equal(board.hidden, true); assert.equal(orientation.hidden, false);
      assert.ok(d.classes.has('intro-view')); assert.ok(!d.classes.has('leaderboard-view'));
      assert.match(d.get('intro-roster').innerHTML, /Hunter/);
    }
    assert.match(d.get('intro-announcement').innerHTML, /possessed/);
    assert.equal(d.get('hero-character').src, '/assets/jebediah-alert.webp');
    d.render(snapshot('results'));
    assert.equal(board.hidden, false); assert.equal(orientation.hidden, true);
    assert.match(d.get('standings').innerHTML, /Previous hunter/);
    assert.match(d.get('standings').innerHTML, />100</);
    // Next group preserves history, including the just-completed round.
    d.render(snapshot('lobby', { players: [], startedAt: null, scoreHistory: [
      ...snapshot('results').scoreHistory, { roundId: 'current', players: [player] }
    ] }));
    assert.match(d.get('standings').innerHTML, /Hunter/);
    assert.equal(d.get('orientation-screen'), orientation);
    assert.equal(d.get('leaderboard-screen'), board);
    assert.equal(board.hidden, false);
  });
  test(`${view} link opens directly into an active round and resizes past scores when idle again`, () => {
    const d = display(view);
    d.render(snapshot('pve'));
    assert.equal(d.get('orientation-screen').hidden, false);
    assert.equal(d.get('leaderboard-screen').hidden, true);
    assert.match(d.get('intro-announcement').innerHTML, /hunt is on/);
    d.render(snapshot('lobby', { scoreHistory: [{ roundId: 'older', players: Array.from({ length: 20 }, () => player) }] }));
    assert.equal(d.get('standings').rows.filter(row => !row.hidden).length, 6);
    d.context.window.innerHeight = 600;
    d.render(snapshot('lobby', { scoreHistory: [{ roundId: 'older', players: Array.from({ length: 20 }, () => player) }] }));
    assert.equal(d.get('standings').rows.filter(row => !row.hidden).length, 3);
    d.render(snapshot('lobby', { scoreHistory: [], startedAt: null, players: [] }));
    assert.match(d.get('standings').innerHTML, /assembling/);
    assert.equal(d.get('orientation-screen').hidden, true);
  });
}
