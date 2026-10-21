import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, tick, publicState, parseScan, HOLD_MS } from '../lib/game.mjs';
import { createScanner } from '../public/scanner.js';
import { signToken, verifyToken } from '../lib/auth.mjs';
const ref = { role: 'referee' };
function setup(pvp = true, count = 2) {
  const s = initialState(), auth = {};
  apply(s, 'settings', { pvpEnabled: pvp }, ref, 1000);
  for (const [i, color] of ['Red','Blue','Green','Yellow','White','Black'].slice(0, count).entries()) {
    auth[color] = apply(s, 'claim', { color, station: ['North','Central','East','west','south','southwest'][i] }, ref, 1000).token;
    apply(s, 'name', { color, name: color+' Hunter' }, ref, 1000);
    scan(s, auth[color], 'TEST WAND', 1001);
  }
  apply(s, 'start', {}, ref, 1010);
  return { s, auth };
}
let id = 0;
function scan(s, auth, payload, now, eventId = `scan-id-${++id}`) {
  return apply(s, 'scan', { payload, eventId, roundId: s.roundId, clientAt: now, clientMono: now }, auth, now);
}
test('18 known ghosts, 6 badges, test payload; unknown values ignored', () => {
  for (let i=1;i<=18;i++) assert.equal(parseScan(`Ghost ${i}\r`).id, i);
  for (const value of ['Ghost 0','Ghost 19','Ghost 01','ghost 1','https://example.com','Player Purple','<script>']) assert.equal(parseScan(value), null);
});
test('ghost is worth 100 once per player; other players score immediately', () => {
  const { s, auth } = setup();
  scan(s, auth.Red, 'Ghost 1', 1100); scan(s, auth.Red, 'Ghost 1', 1101);
  scan(s, auth.Blue, 'Ghost 1', 1101);
  assert.equal(s.players.Red.score, 100); assert.equal(s.players.Blue.score, 100);
  scan(s, auth.Red, 'Ghost 2', 1102, 'same-event-id'); scan(s, auth.Red, 'Ghost 3', 1103, 'same-event-id');
  assert.equal(s.players.Red.score, 200);
});
test('PvP setting is absent from public state, for either setting and both lobby and hunt', () => {
  for (const enabled of [true,false]) {
    const s = initialState(); s.pvpEnabled=enabled;
    assert.equal('pvpEnabled' in publicState(s, 1000), false);
    const {s: running} = setup(enabled);
    const publicView = publicState(running, 2000);
    for (const field of ['pvpEnabled','pending','epoch','events','timing']) assert.equal(field in publicView, false);
    assert.equal(publicView.endsAt-running.startedAt,360000);
    assert.equal('tokenId' in publicView.players[0],false);
  }
});
test('phase changes at five minutes; no ghost points during finale', () => {
  const {s,auth}=setup();
  scan(s,auth.Red,'Player Blue',2000); assert.equal(s.pending.length,0);
  tick(s,301010); assert.equal(s.phase,'pvp');
  scan(s,auth.Red,'Ghost 1',301011); assert.equal(s.players.Red.score,0);
});
test('PvP off lasts six minutes and chest scans never eliminate', () => {
  const {s,auth}=setup(false);
  tick(s,301010); assert.equal(s.phase,'pve');
  scan(s,auth.Red,'Player Blue',301020); assert.equal(s.pending.length,0);
  scan(s,auth.Red,'Ghost 1',361010); assert.equal(s.phase,'results'); assert.equal(s.players.Red.score,0);
});
test('ordinary elimination steals all points and rejects later scans by victim', () => {
  const {s,auth}=setup(); scan(s,auth.Red,'Ghost 1',2000); scan(s,auth.Blue,'Ghost 1',2000);
  tick(s,301010); scan(s,auth.Red,'Player Blue',301020);
  assert.equal(s.players.Blue.vanquished,false); tick(s,301020+HOLD_MS);
  assert.equal(s.players.Red.score,200); assert.equal(s.players.Blue.score,0); assert.equal(s.players.Blue.frozenScore,100);
  assert.equal(s.players.Blue.vanquished,true); assert.equal(s.phase,'results');
  scan(s,auth.Blue,'Player Red',301300); assert.equal(s.players.Red.vanquished,false);
});
test('reciprocal blasts under 20ms freeze both scores without a transfer', () => {
  const {s,auth}=setup(); scan(s,auth.Red,'Ghost 1',2000); scan(s,auth.Blue,'Ghost 2',2000);
  tick(s,301010); scan(s,auth.Red,'Player Blue',301020); scan(s,auth.Blue,'Player Red',301039.99);
  tick(s,301300);
  for (const p of Object.values(s.players)) { assert.equal(p.vanquished,true); assert.equal(p.score,100); assert.equal(p.frozenScore,100); assert.equal(p.reason,'tie'); }
  assert.equal(s.phase,'results');
});
test('exactly 20ms is not a tie; repeated targeting does not duplicate loot', () => {
  const {s,auth}=setup(); scan(s,auth.Blue,'Ghost 1',2000);
  tick(s,301010); scan(s,auth.Red,'Player Blue',301020); scan(s,auth.Red,'Player Blue',301021); scan(s,auth.Blue,'Player Red',301040);
  tick(s,301400); assert.equal(s.players.Red.vanquished,false); assert.equal(s.players.Red.score,100);
});
test('three-way sequence conserves active points; one survivor ends finale', () => {
  const {s,auth}=setup(true,3); for (const a of Object.values(auth)) scan(s,a,'Ghost 1',2000);
  tick(s,301010); scan(s,auth.Red,'Player Blue',301020); tick(s,301300);
  assert.equal(s.phase,'pvp'); scan(s,auth.Green,'Player Red',301400); tick(s,301700);
  assert.equal(s.players.Green.score,300); assert.equal(s.phase,'results');
});
test('accepted pre-buzzer hit settles; post-buzzer scans cannot score', () => {
  const {s,auth}=setup(true,3); scan(s,auth.Blue,'Ghost 1',2000); tick(s,301010);
  scan(s,auth.Red,'Player Blue',361009); scan(s,auth.Green,'Player Red',361010);
  tick(s,361300); assert.equal(s.players.Red.score,100); assert.equal(s.players.Red.vanquished,false); assert.equal(s.phase,'results');
});
test('staff access, duplicate station claims, readiness, old round and revoked assignment', () => {
  let s=initialState(); assert.throws(()=>apply(s,'settings',{pvpEnabled:false},{role:'public'},1000),/Referee/);
  const claim=apply(s,'claim',{color:'Red',station:'North'},ref,1000);
  assert.throws(()=>apply(s,'claim',{color:'Blue',station:'North'},ref,1000),/already/);
  assert.throws(()=>apply(s,'start',{},ref,1000),/name/);
  const reset=apply(s,'reset',{},ref,1000); s=reset.replacement;
  assert.throws(()=>apply(s,'heartbeat',{},claim.token,1001),/released/);
  const run=setup(false,1); const oldRound=run.s.roundId;
  const next=apply(run.s,'newRound',{},ref,2000).replacement;
  assert.equal(next.players.Red.ready,false); assert.equal(next.players.Red.name,'');
  assert.equal(apply(next,'scan',{roundId:oldRound,payload:'Ghost 1'},run.auth.Red,2001).result,'Old round ignored.');
});
test('scanner handles Enter, CRLF Enter repetition, unknown input, prefixes and idle reset', () => {
  const scans=[]; let now=0; const read=createScanner((v)=>scans.push(v),()=>now);
  function type(value){for(const key of value){read({key,preventDefault(){}});now+=5;}}
  type('Ghost 12');read({key:'Enter'});read({key:'Enter'});
  type('unknown');read({key:'Enter'});
  type('Ghost ');now+=1100;type('1');read({key:'Enter'});
  type('TEST WAND');read({key:'Enter'});
  assert.deepEqual(scans,['Ghost 12','TEST WAND']);
});
test('signed roles expire and cannot be tampered with', () => {
  const token=signToken({role:'referee'},'test signing secret',1000);
  assert.equal(verifyToken(token,'test signing secret',1001).role,'referee');
  assert.throws(()=>verifyToken(token+'x','test signing secret',1001),/expired/);
  assert.throws(()=>verifyToken(token,'test signing secret',86401000),/expired/);
});
