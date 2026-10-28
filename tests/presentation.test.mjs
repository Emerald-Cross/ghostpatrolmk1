import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleGhost, sampleBat } from '../public/atmosphere.js';
import { createGameAudio } from '../public/audio.js';
import { ghostCutout } from '../public/ghost-cutout.js';

class Param {
  constructor(){this.value=0;}
  setValueAtTime(value){this.value=value;} exponentialRampToValueAtTime(value){this.value=value;} setTargetAtTime(value){this.value=value;}
}
class Node {
  constructor(ctx,kind){this.ctx=ctx;this.kind=kind;this.gain=new Param();this.frequency=new Param();this.threshold=new Param();this.ratio=new Param();}
  connect(){} start(time){this.ctx.started.push({kind:this.kind,time,buffer:this.buffer});} stop(){this.onended?.();}
}
class AudioContextStandin {
  static instances=[];
  constructor(){this.currentTime=10;this.sampleRate=8000;this.state='suspended';this.started=[];AudioContextStandin.instances.push(this);}
  createGain(){return new Node(this,'gain');} createOscillator(){return new Node(this,'oscillator');}
  createBiquadFilter(){return new Node(this,'filter');} createDynamicsCompressor(){return new Node(this,'compressor');}
  createBufferSource(){return new Node(this,'buffer');}
  createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
  async resume(){this.state='running';} async suspend(){this.state='suspended';} async close(){this.state='closed';}
}
const snapshot=(phase,log=[])=>({phase,roundId:'round-one',log});
test('audio waits for activation, plays the western transition once, and does not reveal a lobby finale setting',async()=>{
  const before=AudioContextStandin.instances.length;
  const sound=createGameAudio({music:true,AudioContextClass:AudioContextStandin});
  try{
    sound.update({...snapshot('lobby'),pvpEnabled:true});assert.equal(AudioContextStandin.instances.length,before);
    await sound.enable();const ctx=AudioContextStandin.instances.at(-1),initial=ctx.started.length;
    sound.update({...snapshot('lobby'),pvpEnabled:true});assert.equal(ctx.started.length,initial);
    sound.update(snapshot('pve'));const hunt=ctx.started.length;
    sound.update(snapshot('pvp'));const finale=ctx.started.length;assert.ok(finale>hunt+20,'plucks, whistle, and percussion are scheduled');
    sound.update(snapshot('pvp'));await sound.enable();assert.equal(ctx.started.length,finale,'repeated updates and enable do not replay sting');
    assert.ok(ctx.started.every(s=>s.time>=ctx.currentTime));
    for(const s of ctx.started.filter(s=>s.buffer))assert.ok(s.buffer.getChannelData(0).every(Number.isFinite),'string synthesis stays finite');
    sound.disable();assert.equal(sound.enabled,false);
  }finally{sound.destroy();}
});
test('sound effects skip historical feed entries and deduplicate repeated snapshots',async()=>{
  const sound=createGameAudio({events:true,AudioContextClass:AudioContextStandin});
  try{
    const old={at:1,message:'Matthew captured Ghost 1. +100'};
    sound.update(snapshot('pve',[old]));await sound.enable();const ctx=AudioContextStandin.instances.at(-1),before=ctx.started.length;
    sound.update(snapshot('pve',[old]));assert.equal(ctx.started.length,before);
    const fresh={at:2,message:'Josh captured Ghost 2. +100'};
    sound.update(snapshot('pve',[old,fresh]));assert.equal(ctx.started.length,before+2);
    sound.update(snapshot('pve',[old,fresh]));assert.equal(ctx.started.length,before+2);
    sound.update({...snapshot('pve',[fresh]),roundId:'round-two'});assert.equal(ctx.started.length,before+2,'new round seeds its log');
  }finally{sound.destroy();}
});
test('three projection paths stay finite and fade at their wrap boundaries',()=>{
  for(const scene of [1,2,3])for(let i=0;i<14;i++)for(const t of [-200,0,.1,10,22,80,1000]){
    const g=sampleGhost(scene,i,t);for(const key of ['x','y','scale','angle','alpha'])assert.ok(Number.isFinite(g[key]));
    assert.ok(g.alpha>=0&&g.alpha<=1);assert.ok(g.scale>0);
  }
  for(const scene of [1,2,3]){assert.equal(sampleGhost(scene,0,0).alpha,0);assert.equal(sampleGhost(scene,0,22).alpha,0);}
  assert.notDeepEqual(sampleGhost(1,2,10),sampleGhost(2,2,10));assert.notDeepEqual(sampleGhost(2,2,10),sampleGhost(3,2,10));
});
test('ghost cutouts contain each original QR reference and no separate ghost icon',()=>{
  for(let n=1;n<=15;n++){
    const svg=ghostCutout(n);assert.match(svg,/class="cut-line"/);assert.ok(svg.includes(`href="/qr/ghost-${n}.svg"`));
    assert.match(svg,/width="500" height="500"/);assert.ok(!svg.includes('ghost-sprite'));
  }
  assert.throws(()=>ghostCutout(0));assert.throws(()=>ghostCutout(19));
});

test('projection canvas follows live PvP state, adds ghosts, and releases its animation on teardown',async()=>{
  const {mountAtmosphere}=await import('../public/atmosphere.js');
  const originals=new Map();
  const put=(key,value)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  let callback,cancelled=false,removed=false,visible=0;
  const ctx={beginPath(){},moveTo(){},quadraticCurveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},setTransform(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){if(this.globalAlpha>.01)visible++;}};
  const canvas={dataset:{},getContext:()=>ctx};let projection;
  try{
    put('Image',class{constructor(){this.complete=true;this.naturalWidth=1800;this.naturalHeight=600;}});
    put('innerWidth',1920);put('innerHeight',1080);put('devicePixelRatio',2);put('matchMedia',()=>({matches:false}));
    put('window',{addEventListener(){},removeEventListener(){removed=true;}});
    put('requestAnimationFrame',fn=>{callback=fn;return 7;});put('cancelAnimationFrame',()=>{cancelled=true;});
    projection=mountAtmosphere(canvas,1);assert.equal(canvas.width,2880);assert.equal(canvas.height,1620);
    projection.update(snapshot('pve'));callback(1000);const hunt=visible;
    projection.update(snapshot('pvp'));for(let i=1;i<=90;i++){visible=0;callback(1000+i*33);}
    assert.equal(canvas.dataset.phase,'pvp');assert.ok(visible>hunt,'more ghosts become visible during PvP');assert.ok(ctx.shadowBlur>10,'warm finale aura is active');
  }finally{projection?.destroy();for(const [key,d] of originals){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}}
  assert.ok(cancelled&&removed);
});

test('boss damage display keeps its QR stable, hides it after defeat, and clears damage for the next group',async()=>{
  const {updateBoss,bossGhost,bossThanks,patchScene}=await import('../public/patch-scene.js');
  const node=()=>{const classes=new Set();return {dataset:{},style:{},hidden:true,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle(k,on){if(on)classes.add(k);else classes.delete(k);}}};};
  const ids=Object.fromEntries(['boss-float','boss-ghost','boss-hud','boss-status','boss-heading','boss-health','boss-code','boss-taunt','boss-thanks'].map(id=>[id,node()]));
  const hearts=Array.from({length:9},node);const document={getElementById:id=>ids[id],querySelectorAll:()=>hearts};
  const state={roundId:'one',phase:'pve',startedAt:1000,serverNow:81000,boss:{status:'waiting',health:9,maxHealth:9,hits:[]}};
  updateBoss(document,state);assert.equal(ids['boss-float'].hidden,true);assert.equal(ids['boss-hud'].hidden,true);
  state.boss.status='active';updateBoss(document,state);assert.equal(ids['boss-code'].style.visibility,'visible');
  state.boss.health=8;state.boss.hits.push({name:'Hunter <script>'});updateBoss(document,state);
  assert.equal(ids['boss-ghost'].dataset.damage,'1');assert.equal(ids['boss-ghost'].classList.contains('boss-hit'),true);
  assert.match(ids['boss-status'].textContent,/Hunter <script> · 1 of 9 hits/,'player names remain text');
  ids['boss-ghost'].classList.remove('boss-hit');updateBoss(document,state);
  assert.equal(ids['boss-ghost'].classList.contains('boss-hit'),false,'unchanged poll does not replay damage');
  assert.equal(hearts.filter(h=>h.classList.contains('is-spent')).length,1);
  assert.equal(ids['boss-taunt'].hidden,false);assert.equal(ids['boss-thanks'].hidden,true);
  for(let damage=2;damage<=8;damage++){
    state.boss.health=9-damage;updateBoss(document,state);
    assert.equal(ids['boss-ghost'].dataset.damageStage,String(Math.ceil(damage/3)));
    assert.equal(hearts.filter(h=>h.classList.contains('is-spent')).length,damage);
  }
  state.boss.health=0;state.boss.status='defeated';updateBoss(document,state);
  assert.equal(ids['boss-code'].style.visibility,'hidden');assert.equal(ids['boss-heading'].textContent,'BOSS VANQUISHED!');
  assert.equal(ids['boss-ghost'].classList.contains('is-defeated'),true);
  assert.equal(ids['boss-thanks'].hidden,false);assert.equal(ids['boss-taunt'].hidden,true);assert.equal(ids['boss-hud'].hidden,true);
  state.phase='results';updateBoss(document,state);
  for(const id of ['boss-float','boss-hud','boss-taunt','boss-thanks'])assert.equal(ids[id].hidden,true,`${id} clears when the round ends, even with defeated boss state`);
  assert.equal(ids['boss-code'].style.visibility,'hidden');assert.equal(ids['boss-ghost'].dataset.damage,'0');
  assert.equal(ids['boss-status'].textContent,'');
  updateBoss(document,{roundId:'two',phase:'lobby',startedAt:null,boss:{status:'waiting',health:9,maxHealth:9,hits:[]}});
  assert.equal(ids['boss-thanks'].hidden,true);assert.equal(hearts.filter(h=>h.classList.contains('is-spent')).length,0);
  for(const phase of ['pvp','results']){
    updateBoss(document,{roundId:'two',phase,startedAt:1000,boss:{status:'waiting',health:4,maxHealth:9,hits:[]}});
    assert.equal(ids['boss-thanks'].hidden,phase==='results','Jebediah appears during the finale but clears at the round end');
    assert.equal(ids['boss-code'].style.visibility,'hidden');
  }
  updateBoss(document,{roundId:'three',phase:'lobby',startedAt:null});
  assert.equal(ids['boss-thanks'].hidden,true);
  assert.equal(ids['boss-float'].hidden,true);assert.equal(ids['boss-ghost'].dataset.damage,'0');assert.equal(ids['boss-ghost'].classList.contains('is-defeated'),false);
  assert.match(bossThanks(),/jebediah-victory.webp/);assert.match(bossThanks(),/Thank you, ghost busters!/);
  assert.doesNotMatch(bossGhost(),/THE PATCH PHANTOM/,'the boss has no name tag');
  assert.match(bossGhost(),/href="\/qr\/boss.svg"/);assert.match(patchScene(),/patch-silhouette/);
});

test('boss PvP announcement follows boss defeat, dismisses automatically, and clears with the round',async()=>{
  const {createBossPvpAnnouncement,bossPvpAnnouncement}=await import('../public/patch-scene.js');
  const classes=new Set(),timers=[];
  const element={hidden:true,offsetWidth:0,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
  const announcement=createBossPvpAnnouncement(element,{duration:7000,setTimer:fn=>{timers.push(fn);return timers.length;},clearTimer:()=>{}});
  const hunt={roundId:'one',phase:'pve',boss:{status:'active',health:1}};
  const defeated={roundId:'one',phase:'pvp',boss:{status:'defeated',health:0,maxHealth:9,hits:Array.from({length:9},()=>({}))}};
  announcement.update(hunt);assert.equal(element.hidden,true);
  announcement.update(defeated);assert.equal(element.hidden,false,'the ninth-hit PvP transition reveals the boss-screen announcement');
  assert.equal(classes.has('boss-pvp-enter'),true,'the announcement starts its entrance animation');
  announcement.update(defeated);assert.equal(timers.length,1,'repeated PvP polls do not restart its timer');
  timers[0]();assert.equal(element.hidden,true,'the announcement dismisses after its short interval');
  announcement.update({roundId:'one',phase:'results',boss:{status:'defeated',health:0}});
  announcement.update({roundId:'two',phase:'lobby',boss:{status:'waiting',health:9}});
  assert.equal(element.hidden,true,'round end and next group leave the boss announcement cleared');
  announcement.destroy();
  const reloaded={hidden:true,classList:{add(){},remove(){}}};
  createBossPvpAnnouncement(reloaded).update(defeated);
  assert.equal(reloaded.hidden,true,'a display loaded mid-finale does not replay the announcement');
  assert.match(bossPvpAnnouncement(),/Scan your opponents’ chest badges!/);
  assert.match(bossPvpAnnouncement(),/role="status" aria-live="assertive"/);
});

test('bat silhouettes cross all projection scenes with finite wing motion and a still-wing reduced-motion variant',()=>{
  for(const scene of [1,2,3])for(let i=0;i<4;i++)for(const seconds of [0,1,15,40,1000]){
    const b=sampleBat(scene,i,seconds);
    for(const key of ['x','y','flap','scale','angle'])assert.ok(Number.isFinite(b[key]));
    assert.ok(b.x>=-.15&&b.x<=1.15);assert.ok(Math.abs(b.flap)<=1);
    assert.equal(sampleBat(scene,i,seconds,true).flap,.35);
  }
  assert.notEqual(sampleBat(1,0,0).flap,sampleBat(1,0,1).flap);
});

test('boss cycles all five requested taunts every six seconds only while active',async()=>{
  const {BOSS_TAUNTS,bossTaunt}=await import('../public/patch-scene.js');
  const state={startedAt:1000,serverNow:81000,boss:{status:'active'}};
  for(let i=0;i<10;i++)assert.equal(bossTaunt({...state,serverNow:81000+i*6000}),BOSS_TAUNTS[i%5]);
  assert.equal(bossTaunt({...state,serverNow:86999}),BOSS_TAUNTS[0]);
  assert.equal(bossTaunt({...state,serverNow:207000,boss:{status:'active',appearsAt:201000}}),BOSS_TAUNTS[1]);
  for(const status of ['waiting','defeated'])assert.equal(bossTaunt({...state,boss:{status}}),null);
  assert.deepEqual(BOSS_TAUNTS,['It’s on order, it’ll be here in 4-6 months','No packing slip','Shipping was delayed','There are no more LTM-1U','The carts are gone']);
});

