# Deploying clarifyd-backend to Vercel

Run these yourself (interactive — vercel login needs your browser).

## Prereq
```bash
npm i -g vercel
```

## 1. Link project
From `C:\Users\ahmed\clarifyd-backend`:
```bash
! vercel login
! vercel link
```
- Pick scope (your Vercel team / personal).
- Pick **new project** name e.g. `clarifyd-backend`.
- Confirm root dir `./`.

## 2. Pull existing env (none yet, sets baseline)
```bash
! vercel env pull .env.production.local
```

## 3. Add production envs
Required (paste current dev values OR generate new for prod):
```bash
! vercel env add DATABASE_URL production
# paste your Neon pooler connection string: postgresql://<user>:<password>@<host>-pooler.../neondb?sslmode=require&channel_binding=require

! vercel env add POSTGRES_URL production
# paste same as DATABASE_URL

! vercel env add NIM_API_URL production
# paste: https://integrate.api.nvidia.com/v1/chat/completions

! vercel env add NIM_API_KEY production
# paste your NVIDIA NIM key: nvapi-<your-key>

! vercel env add NIM_MODEL_ID production
# paste: meta/llama-3.3-70b-instruct

! vercel env add NIM_EMBED_URL production
# paste: https://integrate.api.nvidia.com/v1/embeddings

! vercel env add NIM_EMBED_MODEL_ID production
# paste: nvidia/nv-embedqa-e5-v5

! vercel env add AUTH_SECRET production
# paste a fresh 32-byte base64 secret: `openssl rand -base64 32`

! vercel env add VAULT_KEY production
# paste a fresh 32-byte base64 key (encrypts the vault): `openssl rand -base64 32`

! vercel env add CRON_SECRET production
# paste a fresh random hex secret: `openssl rand -hex 32`

! vercel env add APP_URL production
# paste: https://clarifyd-backend.vercel.app   (or your real domain)

! vercel env add AUTH_URL production
# paste: https://clarifyd-backend.vercel.app

! vercel env add AUTH_TRUST_HOST production
# paste: true

! vercel env add FREE_TIER_SCAN_LIMIT production
# paste: 3
```

**Optional** (add when ready — graceful fallback w/o):
```bash
! vercel env add RESEND_API_KEY production       # re_xxx (replaces dev auth bypass)
! vercel env add RESEND_FROM production          # auth@yourdomain.com (verified)
! vercel env add UPSTASH_REDIS_REST_URL production
! vercel env add UPSTASH_REDIS_REST_TOKEN production
! vercel env add INNGEST_EVENT_KEY production
! vercel env add INNGEST_SIGNING_KEY production
! vercel env add SENTRY_DSN production
! vercel env add SLACK_CLIENT_ID production
! vercel env add SLACK_CLIENT_SECRET production
! vercel env add SLACK_SIGNING_SECRET production
! vercel env add GOOGLE_CLIENT_ID production
! vercel env add GOOGLE_CLIENT_SECRET production
! vercel env add GOOGLE_REDIRECT_URI production
! vercel env add NOTION_CLIENT_ID production
! vercel env add NOTION_CLIENT_SECRET production
```

**Do NOT add** `DEV_AUTH_BYPASS` in production — only in dev.

## 4. Deploy
```bash
! vercel --prod
```
Watch build log. First deploy ≈ 2-3 min.

## 5. Apply DB schema (one-time)
The Neon DB already has the schema from local push. If using a fresh Neon project for prod:
```bash
! DATABASE_URL='postgresql://...' npx tsx scripts/wipe.ts
! DATABASE_URL='postgresql://...' npx tsx scripts/migrate.ts
! DATABASE_URL='postgresql://...' npx tsx scripts/seed.ts
```

## 6. Verify Vercel Cron
Vercel dashboard → Project → Settings → Cron Jobs. Should list 5 entries from `vercel.json`. Each shows next-run timestamp. Hit "Run Now" on one to test:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-deploy.vercel.app/api/cron/retention-sweep
```

## 7. Smoke test prod
```bash
BASE=https://your-deploy.vercel.app
curl "$BASE/api/health"
curl "$BASE/api/security/posture"
```
Both should return 200 JSON.

## 8. Replace dev auth bypass (before real users)
Currently `DEV_AUTH_BYPASS=1` is dev-only. Production auth requires Resend (or alt provider) magic link. To enable:

1. Sign up at https://resend.com.
2. Add a verified domain (or use `onboarding@resend.dev` for testing — only sends to your own signup email).
3. Add envs:
   ```bash
   ! vercel env add RESEND_API_KEY production    # re_xxx
   ! vercel env add RESEND_FROM production       # auth@yourdomain.com
   ```
4. Redeploy: `! vercel --prod`
5. Auth.js magic-link flow now live at `/api/auth/signin`.

## 9. Custom domain (optional)
Vercel dashboard → Project → Settings → Domains → Add → e.g. `api.clarifyd.com`. Update `APP_URL` + `AUTH_URL` envs to match. Redeploy.

## 10. Monitor
- Vercel logs: dashboard → Project → Logs.
- Vercel Web Analytics: dashboard → Project → Analytics (free tier OK).
- (Optional) Sentry: add `SENTRY_DSN` env + `npm i @sentry/nextjs` to activate the shim in `src/lib/observability.ts`.

## Rollback
```bash
! vercel rollback
```
Or pin a specific deployment:
```bash
! vercel alias set <deployment-url> clarifyd-backend.vercel.app
```
