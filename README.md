# Ghosts in the Materials Pumpkin Patch!

First playable prototype for the October 28, 2026 department Halloween event.

Staff connect each scanner workstation once. Players enter their own names at the shared welcome hub and scan its test QR. Staff then start the round. The shared display shows Jebediah’s orientation during setup, then live scores during play and final scores until staff select Next group. The repository includes Jebediah and the other supplied art, printable QR targets, and ambience screens.

## Run a local trial

Install **Node.js 22.9 through 24** and npm.

1. Extract the archive and open a terminal in `ghost-patch`.
2. Copy `.env.example` to `.env`.
3. Set `SESSION_SECRET` to a random value of at least 32 characters for automatic station sessions. No user passwords are needed. Do not use the example values on a network.
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

1. Open the homepage on each device and choose its computer, then click the screen buttons underneath. You can also skip to the individual screens.
2. East offers the combined leaderboard/orientation display, ambience scene 1, and Green scan capture. Central offers ambience scene 2 and Blue scan capture. Student main offers the control hub and Red scan capture. The iPhone offers a button for the combined Setup Station / boss page in the current tab.
3. Computer selection only reveals buttons; click each button to open that screen. Move display tabs onto their displays and leave the scan capture tab active on each computer. Assigned capture tabs connect automatically; manual capture links offer a computer selector and Connect button.
4. Enter player names on the iPhone, then scan its test code with each blaster. No passwords are required. The control hub stays available for round controls throughout play.
5. Start from the Student main control hub. The iPhone automatically switches to the boss display for the round, and the East display switches from orientation to scores. Mirror the iPhone to its TV with AirPlay. The boss appears after 80 seconds and takes nine hits.
6. Jebediah thanks the players after the boss is defeated, including when PvP is disabled. The boss screen announces the PvP finale when enabled. Final scores stay visible on the leaderboard.
7. Select **Next group** at the control hub. Names and scores clear, scanner connections stay assigned, and the iPhone returns to setup. **Reset lobby & release all** also releases scanner assignments.

Keep the scanner browser focused. The page displays an inactive-window warning; a web page cannot force its window in front of other applications. Test the actual S740 keyboard output, speed, range, and terminator before the event. A scan is processed on its Enter/carriage-return key event. Unknown codes are ignored. Unconfirmed scans are not silently replayed later; rescan after the connection recovers.

## Screens

| URL | Use |
| --- | --- |
| `/` | Skippable computer setup chooser |
| `/?view=referee` | iPhone setup in lobby; boss display during play and results |
| `/?view=hub` | Always-available round controls and roster |
| `/?view=station` | Scanner capture, with password-free pairing |
| `/?view=leaderboard` | Shared TV display: orientation in setup, live leaderboard during play, final scores until Next group |
| `/?view=intro` | Alternate link to the same automatic leaderboard/orientation display |
| `/?view=boss` | Pumpkin patch, then the nine-hit Patch Phantom at 1:20 |
| `/?view=atmosphere&scene=1` | Projection 1: crossing ghost drifts |
| `/?view=atmosphere&scene=2` | Projection 2: a flowing ghost current |
| `/?view=atmosphere&scene=3` | Projection 3: a ceiling spiral |
| `/print.html?kind=ghosts` | 15 letter-size physical ghost pages |
| `/print.html?kind=badges` | Six color chest badges |
| `/print.html?kind=test` | One scanner test page |

Use the full screen button on desktop. iPhone Safari support must be verified on the actual phone; **Share → Add to Home Screen** may provide the desired app-like display. This is responsive HTML, not a claim of verified native fullscreen on every iPhone.

## Rules implemented

- Six paired scanner workstations, in order: `joshdesk` = Black, `barbdesk` = White, `center` = Blue, `studentprimary` = Red, `north` = Yellow, `east` = Green. The station page selects the assigned color automatically.
- Each `Ghost 1` through `Ghost 18` awards **100 points once per player per round**. No cooldown between different players.
- At **80 seconds**, the Patch Phantom appears on the boss screen. Its `Boss Ghost` code accepts **nine shared hits total**, awarding **100 points per hit** to the hunter who fires. One hunter can deliver all nine, with a **1.2-second rearm** between their accepted hits; different hunters can hit immediately. Health, cracks, and the last hunter’s name update on all boss displays. The code disappears when defeated. It becomes unavailable during PvP or at the round deadline. **Next group** restores full health.
- The two-minute countdown is decorative. Ghost hunting continues until the boss (appears at 80 seconds) is defeated, however long that takes.
- PvP enabled: defeating the boss starts the surprise finale, which runs until one hunter remains. Disabled: defeating the boss ends the round. The referee can always end a round manually.
- Only a referee can set the finale, and only in the lobby. Public state never contains that setting. Public countdowns show the same two-minute total either way.
- In PvP, scanning `Player Red` (or another active opponent’s badge) eliminates that player and transfers their entire current score to the attacker. Further scans by eliminated players cannot score.
- Reciprocal hits **less than 20 ms apart** tie: both are Vanquished, scores freeze, no transfer. Exactly 20 ms is not a tie.
- Vanquished players leave active standings but remain recorded. PvP ends when fewer than two active players remain. If none remain, there is no surviving winner; frozen scores are historical, not active standings.
- A short 200 ms settlement buffer allows competing hits to arrive. There is no deadline; the finale ends when one hunter is left (or the referee ends it).

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
node tests/browser-smoke.mjs
```

The development environment could not download Chromium because its download host was blocked, so **browser rendering and interaction have not been verified here**. Actual iPhone Safari, QR printing/scanning, shared cloud storage, and office audio still require trials. See [docs/REHEARSAL.md](docs/REHEARSAL.md).

## Prototype scope

This is a functional first prototype with static orientation text and an atmosphere animation. It includes user-activated original background music and sound effects, plus an original western-style finale sting. Recorded Jebediah narration, pausing, and a pre-round countdown are not included. Joining and releasing stations are lobby-only; a disconnected player can reconnect with the same valid token. “Next group” keeps assignments; full reset releases them. The referee can end a round early but cannot change its mode mid-round. One shared game room is supported.

Original art is included verbatim from the user’s seven attachments. `scripts/prepare-assets.py` regenerates QR SVGs with ReportLab and optionally recopies originals from a sibling `upload` directory. Committed SVGs work without Python at runtime. Keep QR quiet zones clear; decoration stays outside the code.

## Visual direction

The interface uses a dark illustrated pumpkin patch, large locally hosted spooky headings, and a restrained palette. See [ART-DIRECTION.md](docs/ART-DIRECTION.md) for the asset inventory, production rules, and current review limits.

## Projection, music, and cutout targets

Open one of the three atmosphere URLs on each projector and select **Full screen**. Ghosts loop against black for wall or ceiling projection. The screens subscribe to the game and poll every two seconds as a fallback. When the public phase actually becomes PvP, the scene warms, more ghosts appear, movement speeds up, and a brief finale announcement appears. The mode setting is not exposed beforehand.

Select **Enable sound** on one device (an atmosphere, intro, or leaderboard screen) to play the background score and game effects. The slider controls volume. Sound starts only after that gesture and starts muted after navigation or reload. A scanner station can enable local scan effects without background music. The western sting runs once on entry into PvP; historical captures do not replay when a display joins. All music is synthesized locally from original code, with no external music services or recordings.

Print `/print.html?kind=ghosts` on letter paper at 100% scale. Each page is one ghost: cut along its dashed outside outline, keeping the face and QR code together. The original QR data and white quiet zones are retained; the new QR canvas is about 5.2 inches wide. Test a printed cutout with the actual scanner before printing the full set.

## Boss and scanner scenery

Open `/?view=boss` on a dedicated display before the round. Until 80 seconds have elapsed, it shows only the quiet patch, a scarecrow silhouette, and slowly moving fog after the shared header fades. Move the pointer, tap, or press Tab to restore full-screen and sound controls. The boss drifts slowly across a 75-second sweep with an upright, unfiltered QR and a four-module white quiet zone. Each hit consumes one health segment and adds visible damage; after the ninth, the ghost fades away and Jebediah Crow appears to thank the players. Jebediah also appears at the start of PvP while gameplay continues. When the round ends, the boss, QR, health display, speech bubble, and Jebediah all clear immediately, leaving only the empty patch. The boss has no printed name tag; the HUD uses the generic Boss Battle heading. Taunts appear in a speech bubble attached to the moving boss, with its tail pointing toward him. Nine health segments and progressive cracks show damage; the next group resets the encounter. Multiple displays reflect the same encounter, rather than creating extra bosses.

Connected scanner stations automatically use the same patch scenery during ghost hunting and PvP. Their small bottom strip shows identity, the most recent scan result, and focus/connection status. The pairing form and blaster illustration return outside gameplay. Inactive-window and connection warnings stay visible in the strip; the scenery does not interfere with keyboard scanner capture. PvP warms the scene tint. Motion is reduced for devices requesting reduced motion.

The boss display also supports the existing user-activated room music, hit effects, and western PvP sting. Enable room sound on only one display. Scanner stations keep local scan feedback effects. No new database schema or external assets are required.

Both display links show orientation while the lobby is being prepared. Starting a round switches to the current group’s live leaderboard, which remains on screen through results until staff select **Next group** (or reset the lobby). Completed standings include vanquished players. Old round scores remain stored in shared history, but do not replace this group’s final standings. Refreshing selects the correct display from the shared server phase, including results. Switching happens in place, preserving fullscreen and enabled audio. The home screen has one combined Leaderboard & orientation tile.

