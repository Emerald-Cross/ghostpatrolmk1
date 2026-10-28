# Office rehearsal checklist

## First milestone

- [ ] Start the local prototype or configure the shared backend and deploy.
- [ ] On `north` in Chrome, pair the Yellow scanner.
- [ ] On the iPhone, save a name; confirm the private mode toggle is hidden during name entry.
- [ ] Scan the referee’s test QR. If screens cannot scan reliably, print the test target instead.
- [ ] With PvP off, start a one-player round. Scan Ghost 1 and see 100 points on another display.
- [ ] Repeat Ghost 1; verify the score stays unchanged.
- [ ] Disconnect and restore the network; verify visible connection status and recovery.
- [ ] Test next group and complete lobby reset, including stale token rejection.

## Six-player rehearsal

- [ ] Pair each workstation with its assigned scanner: `joshdesk` Black, `barbdesk` White, `center` Blue, `studentprimary` Red, `north` Yellow, and `east` Green.
- [ ] Confirm the scanners send complete known payloads followed by Enter without prefixes.
- [ ] Test range, angle, paper curl, print quality, dark corners, light reflections, and multiple nearby codes.
- [ ] Print all 15 ghost pages and six chest badges at letter size, single sided. Preserve white QR margins.
- [ ] Test Ghosts 16–18 on the gameplay projector at final size and brightness. Use printed replacements with the same IDs if projection fails.
- [ ] Test simultaneous scans and inspect server receipts. Determine whether the receipt-time 20 ms tie rule is acceptable; do not call it validated physical timing.
- [ ] Complete five minutes of ghost hunting, surprise reveal, point stealing, a tie, frozen Vanquished scores, and early ending with fewer than two players.
- [ ] Complete a PvP-disabled six-minute hunt and verify chest codes are ignored throughout.
- [ ] Review leaderboard readability at the back of the room, focus status, and iPhone landscape usability.
- [ ] Test next group with all stations still paired. Save new names and retest each wand.

## Atmosphere and event setup

- [ ] Assign TV 1 to the intro above Jebediah and TV 2 to the leaderboard, or adjust to suit the room.
- [ ] Aim two atmosphere projectors at suitable ceilings/corners; keep QR targets on a flat scan-friendly surface.
- [ ] Enable sound on one room device; test background music, capture effects, and the western PvP sting at the intended speaker volume.
- [ ] Keep walkways and exits clear of shelving props, cables, and streamers.
- [ ] Disable sleep/screensavers on event computers as permitted; keep scanner tabs active.
- [ ] Check Supabase is active, deployed credentials work, and quotas are sufficient before October 28.
- [ ] Choose each computer on the homepage and verify its assigned tabs, scan color, and browser focus.
- [ ] Keep paper targets and a manual tally option available for an outage.

## Projection and cutout trial

- [ ] Open scenes 1, 2, and 3 on the actual projectors, use full screen, and let the controls fade.
- [ ] Confirm all three scenes change when the actual game enters PvP; confirm a finale-disabled round stays in the hunt mood.
- [ ] Print one ghost at 100%, cut on the dashed outline, and scan it at the planned distance before printing all 15.

## Boss encounter and scanner ambience

1. Open `/?view=boss` before a trial. Let the controls fade: only the pumpkin patch, scarecrow silhouette, and subtle fog should remain.
2. Start a round. Confirm paired scanner stations switch to scenery and a minimal status strip; switch away from a station’s browser to check its focus warning, then restore focus.
3. At four minutes, verify the boss appears and drifts slowly with a clear upright code. Scan it once: one health segment disappears, damage appears, and the hunter gains 100 points.
4. Scan twice more, allowing at least 1.2 seconds between accepted hits from the same blaster. Different hunters may contribute immediately. Confirm only three hits score, the total bonus is 300, the code disappears, and the boss fades.
5. In a separate trial, leave the boss alive: it must stop accepting hits when PvP begins at five minutes. With finale disabled, it remains active until the six-minute deadline.
6. Choose Next group: health and damage must reset, with the patch alone visible again. Verify the projector’s physical scan range and that the small station strip remains readable.

