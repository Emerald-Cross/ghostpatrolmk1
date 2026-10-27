import { rm, cp, access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
for (const path of ['public/index.html', 'public/app.js', 'public/style.css', 'public/qr/test.svg', 'supabase/schema.sql']) await access(path);
for (const path of ['server.mjs', 'api/game.js', 'lib/game.mjs', 'lib/store.mjs', 'lib/auth.mjs', 'lib/render-server.mjs', 'public/app.js', 'public/icons.js', 'public/audio.js', 'public/atmosphere.js', 'public/ghost-cutout.js', 'public/scanner.js', 'public/realtime.js']) execFileSync(process.execPath, ['--check', path]);
const source = await readFile('public/app.js', 'utf8');
if (/sb_secret_|service_role|REFEREE_SECRET/.test(source)) throw Error('Private configuration in client code.');
await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
console.log('Production build ready in dist/. Render serves the static app and game API from the Node service.');
