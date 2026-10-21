# Ghostbusters in the Pumpkin Patch

First playable prototype for the October 28, 2026 department Halloween event.

Staff connect each scanner workstation once. The referee enters player names on an iPhone, displays a test QR, and starts the round. Scans update a shared leaderboard. The repository includes Jebediah and the other supplied art, printable QR targets, and separate intro, leaderboard, target, and atmosphere screens.

## Run a local trial

Install **Node.js 22.9 through 24** and npm.

1. Extract the archive and open a terminal in `ghost-patch`.
2. Copy `.env.example` to `.env`.
3. Replace `REFEREE_SECRET` with a private passphrase of at least 16 characters. Set `SESSION_SECRET` to a different random value of at least 32 characters. Do not use the example values on a network.
4. In the project folder, run `npm install` once to install Express and Socket.IO.
5. Leave `LOCAL_DEMO=1`, with the two Supabase values empty.
6. Run `npm run dev` and visit `http://localhost:3000`.

On Windows PowerShell, step 2 is `Copy-Item .env.example .env`. Generate a signing secret using:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For an iPhone or another workstation, use the host computer’s LAN IP and port 3000, if the office network and firewall allow it. LAN HTTP is a temporary test environment; use HTTPS for deployment. LAN device connectivity has not been verified here.

**Memory mode is only for one local trial.** It resets when the process stops and is disabled on Render and Vercel. The deployed game requires Supabase shared storage.

## First scanner trial

1. Open `/?view=referee` on the iPhone. Tap **Staff controls** and unlock with your passphrase.
2. Privately turn off the surprise PvP finale for the one-player trial. Tap **Return to welcome screen**. The player-facing setup contains no finale setting.
3. On a scanner’s workstation, open `/?view=station`. Staff select its computer name and scanner color, enter the passphrase, and connect. The browser stores a signed player token, not the staff passphrase.
4. On the referee screen, enter and save the player’s name. Scan the displayed **Wand check** code. Its status should become **Wand tested**.
5. On a separate display, open `/?view=leaderboard`. Start the round from private staff controls.
6. Open `/print.html?kind=ghosts` and print Ghost 1. Scan it: the player gets **100 points**. Scan it again: the score stays **100**. A second player may score that same ghost independently.
7. End the round. **Next group** clears names and scores while keeping workstation assignments. **Reset lobby & release all** also invalidates station tokens; staff must reconnect them.

Keep the scanner browser focused. The page displays an inactive-window warning; a web page cannot force its window in front of other applications. Test the actual S740 keyboard output, speed, range, and terminator before the event. A scan is processed on its Enter/carriage-return key event. Unknown codes are ignored. Unconfirmed scans are not silently replayed later; rescan after the connection recovers.

## Screens

| URL | Use |
| --- | --- |
| `/` | Staff session chooser |
| `/?view=referee` | Landscape-friendly referee and player setup |
| `/?view=station` | Scanner capture, with staff pairing once |
| `/?view=leaderboard` | Live scores for a TV |
| `/?view=intro` | Jebediah’s welcome, test QR, and readiness |
| `/?view=targets` | Ghosts 16–18, stationary for scan reliability |
| `/?view=atmosphere` | Floating gauze ghost, no game controls |
| `/print.html?kind=ghosts` | 15 letter-size physical ghost pages |
| `/print.html?kind=badges` | Six color chest badges |
| `/print.html?kind=test` | One scanner test page |

Use the full screen button on desktop. iPhone Safari support must be verified on the actual phone; **Share → Add to Home Screen** may provide the desired app-like display. This is responsive HTML, not a claim of verified native fullscreen on every iPhone.

## Rules implemented

- Six player colors: Red, Green, Blue, Yellow, White, Black. Color is distinct from computer identity.
- Primary stations: North, Central, East, west. Extra choices: south, southwest, drewPC. One scanner/color per active station; at most six colors.
- Each `Ghost 1` through `Ghost 18` awards **100 points once per player per round**. No cooldown between different players.
- PvP enabled: five minutes of ghost hunting, then a one-minute surprise finale. Disabled: six minutes of ghost hunting. Setup happens before the timer starts.
- Only a referee can set the finale, and only in the lobby. Public state never contains that setting. Public countdowns show the same six-minute total either way.
- In PvP, scanning `Player Red` (or another active opponent’s badge) eliminates that player and transfers their entire current score to the attacker. Further scans by eliminated players cannot score.
- Reciprocal hits **less than 20 ms apart** tie: both are Vanquished, scores freeze, no transfer. Exactly 20 ms is not a tie.
- Vanquished players leave active standings but remain recorded. PvP ends when fewer than two active players remain. If none remain, there is no surviving winner; frozen scores are historical, not active standings.
- A short 200 ms settlement buffer allows competing hits to arrive. Hits must arrive before the round deadline; already accepted hits can settle after the buzzer.

### Timing limitation

The prototype records `performance.timeOrigin + performance.now()` and a monotonic client timestamp at the Enter key, plus a high resolution server receipt time. **It arbitrates ties by server receipt time, not a verified shared physical scan clock.** Scanner decoding, keyboard delivery, WAN latency, cold starts, and clock differences can move results across the 20 ms boundary. High resolution numbers do not remove those errors. The UI refreshes roughly every one to two seconds; this refresh interval is separate from receipt-time hit ordering.

Do not represent the 20 ms rule as physically accurate until office trials measure it. If accurate simultaneous scan arbitration is essential, the next engineering milestone is a single local event collector with timing measurements and an agreed fairness policy. This repository implements the requested rule on receipts and preserves diagnostic timestamps for the current players’ most recent scans.

## Render service and shared backend

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase setup and Render import. The Node web service serves the game and uses Socket.IO to notify open screens when shared game state changes. Supabase Free remains the database candidate; live account provisioning, SQL execution in the real project, deployed synchronization, and quota behavior remain unverified without the user’s account.

The backend uses Postgres versioned compare-and-swap to prevent simultaneous updates overwriting each other. Credentials stay server-side; the database table and CAS function are unavailable to browser roles. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The Render free service uses an ephemeral filesystem and may restart or sleep. Game state therefore lives in Supabase, not server memory. Allow about a minute for the first request after a 15-minute idle period; open and test the game before each group.

## Verification

```sh
npm run check
```

Automated checks cover ghost scoring, concurrent updates from six colors, duplicate deliveries, phase boundaries, disabled PvP, point transfer, ties, the exact 20 ms boundary, elimination, reset, expired assignments, scanner parsing, HTTP authorization, public-state secrecy, and the Supabase adapter protocol with a simulated service. Build output is `dist/`; Vercel deploys `api/game.js` separately.

An optional real-browser trial is in `tests/browser-smoke.mjs`. With Playwright installed and its Chromium browser available, start the local server and run:

```sh
REFEREE_TEST_SECRET=your-local-passphrase node tests/browser-smoke.mjs
```

The development environment could not download Chromium because its download host was blocked, so **browser rendering and interaction have not been verified here**. Actual iPhone Safari, QR printing/scanning, shared cloud storage, digital target scanning, and office audio still require trials. See [docs/REHEARSAL.md](docs/REHEARSAL.md).

## Prototype scope

This is a functional first prototype with static orientation text and an atmosphere animation. It does not yet include audio cues, recorded Jebediah narration, pausing, or a pre-round countdown. Joining and releasing stations are lobby-only; a disconnected player can reconnect with the same valid token. “Next group” keeps assignments; full reset releases them. The referee can end a round early but cannot change its mode mid-round. One shared game room is supported.

Original art is included verbatim from the user’s seven attachments. `scripts/prepare-assets.py` regenerates QR SVGs with ReportLab and optionally recopies originals from a sibling `upload` directory. Committed SVGs work without Python at runtime. Keep QR quiet zones clear; decoration stays outside the code.
