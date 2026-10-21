# Prototype verification on October 21 2026

`npm run check` passes: production build plus **17 automated tests**.

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
| iPhone Safari, full room rehearsal, audio | Not run; actual equipment required; prototype has no audio |

No deployed URL or cloud resource was created. A passing build is not a live Vercel deployment. Receipt-time ties are implemented, but sub-20-ms physical scan accuracy is not established.
