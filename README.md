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
`ADMIN_PASSWORD`, `COOKIE_SECRET`, `LASTFM_API_KEY`, `LASTFM_USER` as Worker
secrets, or in `.dev.vars` locally. Bindings: `ANALYTICS_DB` (D1), `ANALYTICS_KV` (KV).

## D1 migration
    npx wrangler d1 migrations apply samueljbaker-analytics --remote
