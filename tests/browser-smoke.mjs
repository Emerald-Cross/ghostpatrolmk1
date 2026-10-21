// Optional browser QA. Start the local server first. Not part of npm test.
// Install playwright + its Chromium separately, or point PLAYWRIGHT_MODULE to its index.mjs.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const secret = process.env.REFEREE_TEST_SECRET;
if (!secret) throw Error('Set REFEREE_TEST_SECRET to the local test server passphrase.');
const browser = await chromium.launch({ headless: true });
const errors=[];
try {
  const stationContext=await browser.newContext();
  const refContext=await browser.newContext({viewport:{width:844,height:390}});
  const displayContext=await browser.newContext({viewport:{width:1920,height:1080}});
  const station=await stationContext.newPage(),ref=await refContext.newPage(),board=await displayContext.newPage();
  for(const page of [station,ref,board])page.on('pageerror',e=>errors.push(e.message));
  await ref.goto(base+'/?view=referee');
  await ref.getByRole('button',{name:'Staff controls',exact:true}).click();
  await ref.locator('#staff-secret').fill(secret);
  await ref.getByRole('button',{name:'Unlock controls'}).click();
  await ref.locator('#unlocked').waitFor({state:'visible'});
  ref.once('dialog',d=>d.accept());await ref.locator('#reset').click();
  await ref.waitForTimeout(1000);
  await ref.locator('#pvp').uncheck();
  await station.goto(base+'/?view=station');
  await station.locator('#station').selectOption('North');await station.locator('#color').selectOption('Red');
  await station.locator('#pair-secret').fill(secret);await station.getByRole('button',{name:'Connect station'}).click();
  await station.locator('#linked').waitFor({state:'visible'});
  await ref.getByLabel('Red player name').fill('Test Hunter');
  await ref.locator('#row-Red').getByRole('button',{name:'Save',exact:true}).click();
  await station.bringToFront();await station.locator('#focus').click();
  await station.keyboard.type('TEST WAND');await station.keyboard.press('Enter');
  await ref.waitForFunction(()=>document.querySelector('#row-Red .readiness')?.textContent.includes('tested'));
  await ref.locator('#start').click();
  await board.goto(base+'/?view=leaderboard');
  await station.bringToFront();await station.locator('#focus').click();
  await station.keyboard.type('Ghost 1');await station.keyboard.press('Enter');
  await board.waitForFunction(()=>document.querySelector('.score-card>strong')?.textContent==='100');
  await station.keyboard.type('Ghost 1');await station.keyboard.press('Enter');await board.waitForTimeout(1500);
  assert.equal(await board.locator('.score-card>strong').textContent(),'100');
  await ref.getByRole('button',{name:'Return to welcome screen'}).click();
  assert.equal(await ref.locator('#staff-panel').isVisible(),false);
  const publicView=await (await board.request.get(base+'/api/game')).json();
  assert.equal('pvpEnabled' in publicView.state,false);
  for (const page of [station,ref,board]) assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const mode of ['intro','targets','atmosphere']){await board.goto(base+'/?view='+mode);await board.waitForTimeout(300);}
  assert.deepEqual(errors,[]);
  console.log('Browser trial passed: pairing, iPhone-size referee layout, test scan, shared scoreboard, duplicate scoring, hidden controls, display modes.');
} finally { await browser.close(); }
