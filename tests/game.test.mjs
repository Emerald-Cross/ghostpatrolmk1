import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, tick, publicState, parseScan, HOLD_MS } from '../lib/game.mjs';
import { createScanner } from '../public/scanner.js';
import { signToken, verifyToken } from '../lib/auth.mjs';
const ref = { role: 'referee' };
function setup(pvp = true, count = 2) {
  const s = initialState(), auth = {};
  apply(s, 'settings', { pvpEnabled: pvp }, ref, 1000);
  for (const color of ['Red','Blue','Green','Yellow','White','Black'].slice(0, count)) {
    const station = { Black:'joshdesk', White:'barbdesk', Blue:'center', Red:'studentprimary', Yellow:'north', Green:'east' }[color];
    auth[color] = apply(s, 'claim', { color, station }, ref, 1000).token;
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
  const claim=apply(s,'claim',{color:'Red',station:'studentprimary'},ref,1000);
  assert.throws(()=>apply(s,'claim',{color:'Blue',station:'studentprimary'},ref,1000),/assigned color/);
  assert.throws(()=>apply(s,'claim',{color:'Red',station:'joshdesk'},ref,1000),/assigned color/);
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

test('boss appears at four minutes, accepts three shared hits, rejects repeats, and awards exactly 300 points', () => {
  const {s,auth}=setup();const at=s.startedAt+240000;
  assert.deepEqual(parseScan('Boss Ghost'),{kind:'boss'});
  assert.equal(publicState(s,at-1).boss.status,'waiting');
  assert.equal(scan(s,auth.Red,'Boss Ghost',at-1).result,'Boss is not available.');
  assert.equal(publicState(s,at).boss.status,'active');
  assert.equal(scan(s,auth.Red,'Boss Ghost',at,'boss-hit-first').result,'Boss hit! +100');
  assert.equal(scan(s,auth.Red,'Boss Ghost',at+1,'boss-hit-first').result,'Duplicate delivery ignored.');
  assert.match(scan(s,auth.Red,'Boss Ghost',at+1199).result,/recharging/);
  assert.equal(scan(s,auth.Blue,'Boss Ghost',at+1199).result,'Boss hit! +100','another hunter can hit immediately');
  assert.equal(publicState(s,at+1199).boss.health,1);
  assert.equal(scan(s,auth.Red,'Boss Ghost',at+1200).result,'Boss vanquished! +100');
  const boss=publicState(s,at+1200).boss;
  assert.equal(boss.health,0);assert.equal(boss.status,'defeated');assert.equal(boss.hits.length,3);
  assert.deepEqual(boss.hits.map(h=>h.color),['Red','Blue','Red']);
  assert.equal(boss.defeatedAt,at+1200);
  assert.equal(scan(s,auth.Blue,'Boss Ghost',at+2400).result,'Boss already vanquished!');
  assert.equal(s.players.Red.score+s.players.Blue.score,300);
  assert.equal(s.players.Red.captured.length,0,'boss damage does not inflate ordinary ghost captures');
});

test('boss closes at PvP, lasts to the buzzer without PvP, and resets cleanly across groups and old stored state', () => {
  for(const enabled of [true,false]){
    const {s,auth}=setup(enabled);const start=s.startedAt;
    scan(s,auth.Red,'Boss Ghost',start+240000);
    scan(s,auth.Blue,'Boss Ghost',start+300000);
    assert.equal(s.boss.hits.length,enabled?1:2);
    assert.equal(publicState(s,start+300000).boss.status,enabled?'waiting':'active');
    scan(s,auth.Red,'Boss Ghost',s.endsAt);assert.equal(s.phase,'results');
    assert.equal(s.boss.hits.length,enabled?1:2,'buzzer rejects boss damage');
    const next=apply(s,'newRound',{},ref,s.endsAt+1).replacement;
    assert.equal(next.boss.hits.length,0);assert.equal(next.boss.defeatedAt,null);assert.equal(publicState(next,s.endsAt+1).boss.status,'waiting');
    delete next.boss;tick(next,s.endsAt+2);assert.deepEqual(next.boss,{hits:[],defeatedAt:null});
  }
});

test('boss rejects old round deliveries, eliminated hunters, and scans in lobby', () => {
  const {s,auth}=setup(false,1);const at=s.startedAt+240000;
  const data={payload:'Boss Ghost',eventId:'old-boss-hit',roundId:'old-round'};
  assert.equal(apply(s,'scan',data,auth.Red,at).result,'Old round ignored.');
  s.players.Red.vanquished=true;
  assert.equal(scan(s,auth.Red,'Boss Ghost',at+1).result,'Scan ignored outside active play.');
  const next=apply(s,'newRound',{},ref,at+2).replacement;
  assert.equal(scan(next,auth.Red,'Boss Ghost',at+3).result,'Scan ignored outside active play.');
  assert.equal(next.boss.hits.length,0);
});

test('scanner delivers the boss code from keyboard input once per Enter terminator', () => {
  const hits=[];let now=0;const scanner=createScanner(value=>hits.push(value),()=>now);
  for(const key of 'Boss Ghost'){scanner({key});now+=5;}
  scanner({key:'Enter'});scanner({key:'Enter'});
  assert.deepEqual(hits,['Boss Ghost']);
});

test('previous scores survive next group, lobby edits, repeated resets, and public reloads without exposing credentials',()=>{
  const {s,auth}=setup(false,1);
  scan(s,auth.Red,'Ghost 1',2000);apply(s,'finish',{},ref,3000);
  const next=apply(s,'newRound',{},ref,3001).replacement;
  assert.equal(next.players.Red.score,0);assert.equal(next.players.Red.name,'');
  const old=publicState(next,3001).previousRound;
  assert.equal(old.players[0].name,'Red Hunter');assert.equal(old.players[0].score,100);
  for(const field of ['tokenId','lastScan','captured','epoch'])assert.equal(field in old.players[0],false);
  apply(next,'name',{color:'Red',name:'New Hunter'},ref,3002);
  assert.equal(publicState(next,3002).previousRound.players[0].name,'Red Hunter');
  const reset=apply(next,'reset',{},ref,3003).replacement;
  assert.deepEqual(publicState(reset,3003).previousRound,old);
  const again=apply(reset,'newRound',{},ref,3004).replacement;
  assert.deepEqual(again.previousRound,old);
  scan(next,auth.Red,'TEST WAND',3005);apply(next,'start',{},ref,3006);
  scan(next,auth.Red,'Ghost 2',3100);scan(next,auth.Red,'Ghost 3',3200);
  apply(next,'finish',{},ref,3300);
  const latest=apply(next,'reset',{},ref,3400).replacement;
  assert.equal(latest.previousRound.players[0].name,'New Hunter');assert.equal(latest.previousRound.players[0].score,200);
  assert.equal(publicState(initialState(),1000).previousRound,null);
});

test('score history retains multiple rounds once each across lobby resets',()=>{
  const {s,auth}=setup(false,1);scan(s,auth.Red,'Ghost 1',2000);apply(s,'finish',{},ref,3000);
  let next=apply(s,'newRound',{},ref,3001).replacement;
  apply(next,'name',{color:'Red',name:'Second Hunter'},ref,3002);scan(next,auth.Red,'TEST WAND',3003);apply(next,'start',{},ref,3004);
  scan(next,auth.Red,'Ghost 1',3100);scan(next,auth.Red,'Ghost 2',3200);apply(next,'finish',{},ref,3300);
  next=apply(next,'newRound',{},ref,3400).replacement;
  assert.deepEqual(publicState(next,3400).scoreHistory.map(r=>r.players[0].score),[100,200]);
  next=apply(next,'reset',{},ref,3500).replacement;
  assert.equal(next.scoreHistory.length,2,'lobby resets do not duplicate rounds');
  const legacy={...next,scoreHistory:undefined};
  assert.equal(publicState(legacy,3600).scoreHistory.length,1,'previous single-round snapshots remain usable');
});

test('players can name themselves at the public hub in lobby while staff actions stay protected',()=>{
  const s=initialState(),publicAuth={role:'public'};
  apply(s,'settings',{pvpEnabled:false},ref,1000);
  const auth=apply(s,'claim',{color:'Red',station:'studentprimary'},ref,1000).token;
  apply(s,'name',{color:'Red',name:'  My Own Name  '},publicAuth,1001);
  assert.equal(s.players.Red.name,'My Own Name');
  for(const name of ['', 'x'.repeat(25),'Bad\nName'])assert.throws(()=>apply(s,'name',{color:'Red',name},publicAuth,1002),/visible characters/);
  assert.throws(()=>apply(s,'name',{color:'Blue',name:'No Station'},publicAuth,1002),/not joined/);
  for(const action of ['start','finish','reset','newRound','release','settings','claim'])assert.throws(()=>apply(s,action,{},publicAuth,1003),/Referee/);
  scan(s,auth,'TEST WAND',1004);apply(s,'start',{},ref,1005);
  assert.throws(()=>apply(s,'name',{color:'Red',name:'Mid Game'},publicAuth,1006),/lobby/);
  assert.equal(s.players.Red.name,'My Own Name');
});
