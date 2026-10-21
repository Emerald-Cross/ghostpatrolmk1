import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHandler } from '../api/game.js';
import { memoryStore, supabaseStore, transact } from '../lib/store.mjs';
import { initialState, apply } from '../lib/game.mjs';

test('HTTP multi-session trial: setup, scan, shared scoreboard, secrecy, reset', async () => {
  let now=1000;
  const handler=createHandler({store:memoryStore(),refereeSecret:'test-referee-passphrase',sessionSecret:'test-session-secret-32-characters-long',clock:()=>now});
  const server=http.createServer(handler); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async (body,token,origin)=>{
    const r=await fetch(base,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
  };
  try {
    assert.equal((await call({action:'settings',pvpEnabled:false})).status,403);
    assert.equal((await call({action:'login',secret:'bad'})).status,403);
    const admin=(await call({action:'login',secret:'test-referee-passphrase'})).body.token;
    assert.equal((await call({action:'settings',pvpEnabled:false},admin,'http://evil.example')).status,403);
    await call({action:'settings',pvpEnabled:false},admin);
    const joined=(await call({action:'claim',color:'Red',station:'North'},admin)).body;
    const token=joined.token; const roundId=joined.state.roundId;
    await call({action:'name',color:'Red',name:'Matt'},admin);
    await call({action:'scan',payload:'TEST WAND',roundId,eventId:'wand-test-1'},token);
    await call({action:'start'},admin);now=2000;
    const hit={action:'scan',payload:'Ghost 1',eventId:'scan-event-1',roundId,clientAt:performance.timeOrigin+performance.now(),clientMono:performance.now()};
    await Promise.all([call(hit,token),call(hit,token)]);
    const board=await call();assert.equal(board.body.state.players[0].score,100);assert.equal(board.body.state.players[0].name,'Matt');
    assert.equal('pvpEnabled' in board.body.state,false);assert.equal(board.cache,'no-store');
    assert.equal((await call(null,admin)).body.state.pvpEnabled,false);
    await call({action:'reset'},admin);
    assert.equal((await call({action:'heartbeat'},token)).status,401);
    assert.equal((await call()).body.state.players.length,0);
  } finally { await new Promise(r=>server.close(r)); }
});

test('six concurrent player updates survive CAS conflicts with exactly-once scoring',async()=>{
  const store=memoryStore(), ref={role:'referee'}, claims={};
  for(const [i,color] of ['Red','Green','Blue','Yellow','White','Black'].entries()) {
    const result=await transact(store,s=>apply(s,'claim',{color,station:['North','Central','East','west','south','southwest'][i]},ref,1000));
    claims[color]=result.output.token;
    await transact(store,s=>apply(s,'name',{color,name:color},ref,1001));
    await transact(store,s=>apply(s,'scan',{payload:'TEST WAND',eventId:`test-id-${color}`,roundId:s.roundId},claims[color],1002));
  }
  await transact(store,s=>apply(s,'start',{},ref,1010));
  const tasks=[];
  for(const [color,auth] of Object.entries(claims))for(let ghost=1;ghost<=3;ghost++)tasks.push(transact(store,s=>apply(s,'scan',{payload:`Ghost ${ghost}`,roundId:s.roundId,eventId:`ghost-id-${ghost}-${color}`},auth,2000)));
  await Promise.all(tasks);
  const row=await store.read();
  for(const p of Object.values(row.data.players))assert.equal(p.score,300);
});

test('Supabase adapter protocol, CAS conflict retry and service key isolation',async()=>{
  let row=null,conflict=true;const seen=[];
  const fake=async(url,options)=>{
    seen.push({url,headers:options.headers});
    if(url.includes('/rpc/')) {
      const body=JSON.parse(options.body);
      if(conflict){conflict=false;row.version++;return Response.json(false);}
      if(body.expected_version!==row.version)return Response.json(false);
      row={version:row.version+1,data:body.next_state};return Response.json(true);
    }
    if(options.method==='POST'){if(!row)row=JSON.parse(options.body);return Response.json([row]);}
    return Response.json(row?[row]:[]);
  };
  const store=supabaseStore('https://test.supabase.co','sb_secret_test',fake);
  await transact(store,s=>{s.pvpEnabled=false;return {};});
  assert.equal(row.data.pvpEnabled,false);assert.equal(row.version,2);
  assert.ok(seen.every(r=>r.headers.apikey==='sb_secret_test'&&!r.headers.Authorization));
  assert.equal((await store.read()).data.phase,initialState().phase);
});
