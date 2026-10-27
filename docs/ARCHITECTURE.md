# Prototype architecture

Static browser screens → `/api/game` → Supabase REST API → one versioned Postgres state row.

## Why this backend

Supabase supplies a persistent Postgres database and REST API in its free plan. The API server owns the rules and projects separate public and referee views. Short polling avoids depending on WebSocket behavior or a persistent process in a serverless deployment. One Supabase project and one Vercel account are sufficient for this design; no browser Supabase SDK is required.

The alternatives considered were Supabase Realtime subscriptions, an external WebSocket relay, and a local-only server. Realtime delivery would reduce display latency but adds subscription authorization and reconnect work without resolving physical scanner timing. A local server is useful for hardware testing and as a possible event fallback; it is not interchangeable with production serverless memory.

## Concurrent mutations

The server reads `{version,data}`, applies a pure state transition to a cloned document, and calls `gip_cas(expected_version,next_state)`. Postgres updates the row only if the version still matches. Conflicting requests reload and recompute, with up to 20 bounded retries. Thus different function instances share one authority. An unchanged poll does not write. Device scan IDs deduplicate deliveries within a round, while a per-player captured-ghost set prevents repeat scoring even across different event IDs.

Round state is intentionally small: at most six players, 18 unique ghost captures per player, a bounded log of 30 messages, and a cap of 5,000 recognized scan events per round. The next group clears event history. Polling by public screens is read-only unless phase transitions or hit settlement are due; these clock-driven state updates still use CAS. There is no background clock worker: the first request after a deadline advances the state.

## Permissions and privacy

- Strong staff passphrase exchanges for a signed 24-hour referee token. Referee tokens stay in sessionStorage; station tokens stay in localStorage for reload recovery. Use trusted staff devices, a private deployment URL, and a strong passphrase. This prototype has no distributed sign-in rate limiter or organizational identity integration.
- Staff pair a station using the passphrase. The station receives a signed color token bound to an epoch and assignment ID. Releasing a color or resetting the lobby invalidates its old token. Next group preserves station assignment IDs while replacing the round ID.
- Only referees can change names, settings, start/end/reset, or release another station. Public clients cannot mutate scoring. Player scans must use the current round ID and a valid assignment token.
- Server-only Supabase secret credentials and restricted SQL grants prevent browser roles from writing the database. No Supabase key is returned to the client.
- Public responses omit the PvP setting, assignment secrets, pending hits, raw diagnostic scan timestamps, and per-round deduplication data. Both game modes have the same initial total timer. The staff panel is hidden during name entry, but staff must close it before showing the phone to participants.
- Display names are rendered as text or HTML-escaped. JSON endpoints use `Cache-Control: no-store`, reject unexpected origins, and require JSON for writes. The prototype supports one shared room; knowledge of its public URL permits viewing the leaderboard and display names.

## Timing and recovery

Each scan records the client’s epoch/high-resolution timestamp, monotonic timestamp, and server receipt timestamp. The latter uses Node `performance.timeOrigin + performance.now()`. Browser clocks are not compared for winner selection. Hits are settled after a 200 ms buffer using server receipt ordering; reciprocal hits within strictly 20 ms eliminate both. Networks and server instances still introduce timing uncertainty. The server exposes no claim of validated physical simultaneity.

An offline scan is not queued for later scoring, preventing a stale scan from arriving in a later phase. An ambiguous network failure may already have committed; a rescan will not double-score a ghost. Assigned stations can reconnect after transient failures with their token. Releasing a station is a lobby-only staff action. The referee sees name, readiness, station, and heartbeat freshness; a claimed but disconnected station blocks starting until it reconnects or is released.

## Capacity estimate

Fallback HTTP refreshes run every two seconds for scanner stations and projection screens, and every fifteen seconds for other active screens. Six stations, three projectors, and three other screens therefore generate approximately 4.7 requests per second before scans and Socket.IO invalidations. Each connected screen also refreshes when the shared state changes. Close unused sessions and inspect deployment usage after rehearsal.

## Test boundary

Automated HTTP tests run the real game handler with an in-process store. Parallel tests exercise CAS retries and six concurrent colors. A simulated Supabase HTTP service checks request construction and conflict handling. The real SQL migration and remote project have not been executed here. Chromium download restrictions prevented browser QA. These are explicit follow-up checks, not passed tests.
