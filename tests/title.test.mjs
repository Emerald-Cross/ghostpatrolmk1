import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('primary game title is consistent in browser metadata, shared header, and homepage', () => {
  const title = "Save Jebediah Crow's pumpkin patch";
  assert.ok(html.includes(`<title>${title}</title>`), 'browser title uses the requested title');
  assert.ok(html.includes('aria-label="Save Jebediah Crow&#39;s pumpkin patch"'), 'shared header has an accessible title');
  assert.ok(html.includes(`<span class="brand-kicker">Save Jebediah Crow's</span><strong>pumpkin patch</strong>`), 'visible shared header uses the requested title');
  assert.ok(app.includes(`const gameTitle = "${title}";`), 'homepage headline uses the canonical title');
  assert.ok(app.includes('hero(gameTitle.replace(" Crow\'s", "<br>Crow\'s").replace(" patch", "<br>patch")'), 'homepage formats the canonical title across lines');
});
