import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleGhost } from '../public/atmosphere.js';
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
  const ctx={setTransform(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){if(this.globalAlpha>.01)visible++;}};
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
