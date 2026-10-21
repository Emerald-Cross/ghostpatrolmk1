# Deploy the first prototype on Render

The game runs as one Node web service on Render. Express serves the built browser files and HTTP game API; Socket.IO tells open screens to fetch the latest shared state. Supabase stores the authoritative round state so a Render restart or sleep does not erase the game. The Vercel route remains in the repository but is not part of this deployment.

## Render free service limits

Render's Free web services accept WebSocket connections. A free service sleeps after 15 minutes without inbound requests or WebSocket messages, then usually takes about a minute to wake on the next request. Its filesystem is temporary, free services can restart, and free services run as one instance. Open the game and test it shortly before the event and before each group. Never rely on server memory or local files for round data.

## Before importing

1. Create a private GitHub repository for this project and push the `ghost-patch` folder contents. Do not commit `.env`, API keys, or passphrases.
2. Create a Supabase project. In its SQL Editor, run `supabase/schema.sql` once.
3. From Supabase, copy the project HTTPS URL and a server secret key (`sb_secret_…`) or legacy `service_role` key. Keep the key server-side.

## Create the Render service

1. In Render, create a new Blueprint from the connected GitHub repository, or create a Web Service and use the settings below. The included `render.yaml` defines the service and asks for the four private environment variables.
2. Select the **Free** instance plan if creating the service manually.
3. Use the repository root as the service root directory.
4. Confirm these commands and health check:

   | Setting | Value |
   | --- | --- |
   | Build command | `npm install && npm run build` |
   | Start command | `npm start` |
   | Health check path | `/healthz` |

   Render supplies `PORT`; the server binds to `0.0.0.0` and uses that port.

## Add environment variables

Set these in Render's service environment. Keep the Supabase key private; do not add it to GitHub or paste it into chat.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project HTTPS URL |
| `SUPABASE_SECRET_KEY` | Supabase server secret or legacy service-role key |
| `REFEREE_SECRET` | A private passphrase with at least 16 characters |
| `SESSION_SECRET` | A different random secret with at least 32 characters |
| `LOCAL_DEMO` | `0` |

Redeploy after saving the environment. The production server refuses memory storage, including when Render restarts it.

## Verify the first deploy

1. Wait for Render's deploy to finish, then open the service URL and `/healthz`. The health check should return `ok`.
2. Open `/?view=referee` on the iPhone, `/?view=station` on a scanner workstation, and `/?view=leaderboard` on a display. The connection label should show **Connected**.
3. Unlock staff controls, connect one station, enter a name, scan the test code, and make sure readiness updates on the referee page.
4. Turn PvP off for the one-player trial, start a round, scan a printed ghost, and confirm the leaderboard updates immediately. Scan that ghost again; the score should remain unchanged.
5. Before the event, test all workstations and displays together on the actual office network. Test the S740 terminator, browser focus, sleep/wake behavior, and the referee setting's privacy.

Socket.IO notifications carry no game state; connected browsers fetch the latest public state over the existing API. The API keeps the referee-only PvP setting out of the public projection. The 20 ms tie rule still uses server receipt time, not a synchronized physical scan clock.

## Troubleshooting

- **Service reports shared database unavailable:** check the Supabase URL and key, confirm `supabase/schema.sql` ran successfully, and verify the Supabase project is active.
- **First page load is slow:** the free service may be waking after idle. Wait for it to start, then reload once.
- **Screens do not update live:** check the browser console for `/socket.io/socket.io.js` or connection errors. HTTP refresh remains as a recovery path; reload a screen if a notification was missed.
- **Scanner input is missing:** restore Chrome focus and test the S740's keyboard output and carriage return in a plain text field.
- **Do not set `LOCAL_DEMO=1` on Render:** the service blocks memory storage in Render. It is for local trials only.

## References

Reviewed October 21, 2026:

- [Render free services](https://render.com/docs/free)
- [Render web services](https://render.com/docs/web-services)
- [Render WebSockets](https://render.com/docs/websocket)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase REST API](https://supabase.com/docs/guides/api)
