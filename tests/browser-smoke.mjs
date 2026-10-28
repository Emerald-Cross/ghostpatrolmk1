// Optional browser QA. Start the local server first. Not part of npm test.
// Install playwright + its Chromium separately, or point PLAYWRIGHT_MODULE to its index.mjs.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const errors=[];
try {
  const stationContext=await browser.newContext();
  const refContext=await browser.newContext({viewport:{width:844,height:390}});
  const displayContext=await browser.newContext({viewport:{width:1920,height:1080}});
  const station=await stationContext.newPage(),ref=await refContext.newPage(),board=await displayContext.newPage();
  for(const page of [station,ref,board])page.on('pageerror',e=>errors.push(e.message));
  await ref.goto(base+'/?view=hub');
  await ref.locator('#unlocked').waitFor({state:'visible'});
  ref.once('dialog',d=>d.accept());await ref.locator('#reset').click();
  await ref.waitForTimeout(1000);
  await ref.locator('#pvp').uncheck();
  await station.goto(base+'/?view=station');
  await station.locator('#station').selectOption('studentprimary');
  await station.getByRole('button',{name:'Connect station'}).click();
  await station.locator('#linked').waitFor({state:'visible'});
  await ref.getByLabel('Red player name').fill('Test Hunter');
  await ref.locator('#row-Red').getByRole('button',{name:'Save',exact:true}).click();
  await station.bringToFront();await station.locator('#focus').click();
  await station.keyboard.type('TEST WAND');await station.keyboard.press('Enter');
  await ref.waitForFunction(()=>document.querySelector('#row-Red .readiness')?.textContent.includes('tested'));
  await board.goto(base+'/?view=leaderboard');
  await board.locator('#orientation-screen').waitFor({state:'visible'});
  assert.equal(await board.locator('#leaderboard-screen').isVisible(),false);
  await ref.locator('#start').click();
  await board.locator('#leaderboard-screen').waitFor({state:'visible'});
  assert.equal(await board.locator('#orientation-screen').isVisible(),false);
  await station.bringToFront();await station.locator('#focus').click();
  await station.keyboard.type('Ghost 1');await station.keyboard.press('Enter');
  await board.waitForFunction(()=>document.querySelector('.score-row .score-value')?.textContent==='100');
  await station.keyboard.type('Ghost 1');await station.keyboard.press('Enter');await board.waitForTimeout(1500);
  const captured=await (await board.request.get(base+'/api/game')).json();
  assert.equal(captured.state.players.find(p=>p.color==='Red').score,100);
  await board.reload();
  await board.locator('#leaderboard-screen').waitFor({state:'visible'});
  ref.once('dialog',d=>d.accept());await ref.locator('#finish').click();
  await board.waitForFunction(()=>document.body.dataset.phase==='results');
  await board.locator('#leaderboard-screen').waitFor({state:'visible'});
  assert.equal(await board.locator('.score-row').filter({hasText:'Test Hunter'}).first().locator('.score-value').textContent(),'100');
  assert.equal(await board.locator('#orientation-screen').isVisible(),false);
  ref.once('dialog',d=>d.accept());await ref.locator('#new-round').click();
  await board.locator('#orientation-screen').waitFor({state:'visible'});
  assert.equal(await board.locator('#leaderboard-screen').isVisible(),false);
  const publicView=await (await board.request.get(base+'/api/game')).json();
  assert.equal('pvpEnabled' in publicView.state,false);
  for (const page of [station,ref,board]) assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const mode of ['intro','referee','atmosphere']){await board.goto(base+'/?view='+mode);await board.waitForTimeout(300);}
  assert.deepEqual(errors,[]);
  console.log('Browser trial passed: pairing, iPhone-size referee layout, test scan, automatic display transitions and reload, duplicate scoring, results, hidden controls, display modes.');
} finally { await browser.close(); }


