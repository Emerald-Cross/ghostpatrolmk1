# Prototype verification on October 28 2026

`npm run check` passes: production build plus **31 automated tests**.

| Area | Result |
| --- | --- |
| Recognized and unknown payloads | Passed |
| One capture per player per ghost; 100 points | Passed |
| Duplicate delivery deduplication | Passed |
| Six simultaneous colors and CAS retries | Passed locally |
| Five-minute transition and six-minute disabled mode | Passed |
| All-point theft, elimination and survivor ending | Passed |
| Reciprocal under-20-ms ties, frozen points, exact boundary | Passed with controlled server timestamps |
| Hits at the buzzer | Passed |
| Staff permissions, reset, revoked assignments | Passed |
| Scanner Enter handling, empty repeats, idle reset | Passed with synthetic key events |
| Signed token tampering and expiry | Passed |
| Public projection omits private mode and tokens | Passed |
| Real HTTP handler plus separate client requests | Passed locally |
| Supabase REST request construction and conflict retry | Passed against a simulated service |
| All screen assets, QR SVGs, and local server routes | Passed HTTP serving checks |
| Real Supabase SQL migration and remote synchronization | Not run; user project required |
| Browser rendering and interactive browser smoke script | Not run; Chromium download host blocked |
| S740 scanning, printed targets, projected targets | Not run; office hardware required |
| iPhone Safari, full room rehearsal, audio | Not run on actual equipment; synthesized music, sound effects, and western finale sting are implemented |

Changes are published to the existing GitHub repository for Render to deploy. A passing build does not verify Render rollout or the deployed application. Receipt-time ties are implemented, but sub-20-ms physical scan accuracy is not established.

October 27 refinements: automated checks cover audio activation, one-shot PvP music, feed deduplication, all three looping projection trajectories, and ghost cutout references. DOM checks cover leaderboard rows, projection announcement states, pairing and name input, and the 15/6/1 print counts. The entire QR canvas was verified inside the ghost silhouette and an SVG preview was rendered and inspected. Browser rendering, audio listening on the actual speakers, and physical scanner range remain unverified here.

October 28 boss refinement: tests cover the exact four-minute appearance boundary; three shared hits and 300 total points; duplicate event IDs; same-player rearm versus immediate hits by other hunters; PvP and buzzer rejection; old-round and eliminated-player rejection; new-group reset and older persisted-state initialization; keyboard delivery of `Boss Ghost`; simultaneous HTTP blasts from four clients with CAS retries; stable QR nodes, damage segments, and QR removal on defeat. DOM checks cover 40 page/phase combinations, all four boss damage states, and station scenery transitions. A composited SVG artwork preview was inspected; it is not a browser screenshot. The new route, scene module, and QR also pass HTTP serving checks. Real browser layout and projected-code scans still require an office trial.
