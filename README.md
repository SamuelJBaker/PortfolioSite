# samueljbaker.dev

Portfolio site. Next.js 15 (App Router), React 19, three.js via React Three Fiber,
Tailwind CSS 4, on Cloudflare Workers via OpenNext. Analytics in D1 and KV.

## Develop
    npm install && npm run dev    # http://localhost:3000

## Build
    npx opennextjs-cloudflare build

## Deploy
Push to `main`; Cloudflare builds and deploys automatically.

## Secrets
`LASTFM_API_KEY`, `LASTFM_USER` as Worker secrets, or in `.dev.vars` locally
(see `.dev.vars.example`). Bindings: `ANALYTICS_DB` (D1), `ANALYTICS_KV` (KV).

## Admin auth
`/admin` and `/api/admin` sit behind Cloudflare Access (team domain and
audience in `wrangler.jsonc` vars). The worker re-verifies the Access JWT in
`src/middleware.ts`; there is no password or session cookie of its own. Under
`next dev` with no token the identity is `dev@localhost`.

## D1 migration
    npx wrangler d1 migrations apply samueljbaker-analytics --remote
