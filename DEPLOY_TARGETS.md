# Deployment Targets

> 2026-11-05 repository handoff: the deployment entries below are historical snapshots from their stated verification dates. Current mobile source is version 0.1.20/build 21; iOS preparation is documented in [docs/IOS_BUILD.md](./docs/IOS_BUILD.md). This Git update does not deploy either site.

Last verified: `2026-10-28`. Start with [MAINTENANCE_HANDOFF.md](./MAINTENANCE_HANDOFF.md)
for the current production state, completed changes, known risks, and the next maintenance sequence.

This file records non-secret deployment details for the two production sites.
The SSH private key is deliberately untracked at `.codex-deploy/tarot-deploy_ed25519`.
On `2026-07-27`, its ED25519 public key (`SHA256:XMtbyPpaOYoZcXrq6VvAOAiIrbjbyAv3wmP7iHh6bm4`,
comment `tarot-clone-deploy-2026-07-24`) was installed and verified for:

- `root@121.40.27.226` (mainland)
- `ubuntu@43.172.90.37` (overseas)

Use the key above for mainland maintenance. For the overseas host, follow the shared
SSH credential instructions and use the `engsay` alias with fingerprint verification.
Do not add server passwords,
API keys, database passwords, OAuth secrets, or the private key to this repository.

## APP internal preview

- Mobile UI: `/app` on each site; Android version `0.1.1`, fixed regional API per build.
- Android artifacts/checksums: `/downloads/`; choose the package matching the account region.
- Bundled assets: 78 offline card faces; AI and history sync require connectivity.
- Native build/verification: [docs/MOBILE_NATIVE.md](./docs/MOBILE_NATIVE.md). Apple compilation/signing is deferred at the user's request.

## Mainland Site

- Public URL: `https://tarot.zaopic.cn`
- Current user-confirmed access point: `https://121.40.27.226:9443`. Use this existing HTTPS port for the mainland site for now. Domain HTTPS has an expired certificate and ACME HTTP validation receives an Alibaba ICP-filing `403`; domain certificate recovery is deferred.
- Server: `121.40.27.226:22` as `root`
- Repository: `/home/workspace/toart/Tarot`
- Backend: PM2 process `tarot-api`, port `5174`
- Frontend: `/var/www/tarot.zaopic.cn/dist`
- Default locale: `zh-CN`
- Payment policy: **closed**. Build with `VITE_PAYMENT_MODE=disabled`; do not add payment provider credentials or payment migrations to this server.
- Current release: frontend `20261028-mobile-002`; backend `20261028-mobile-001`.
- Frontend rollback: `/var/www/tarot.zaopic.cn/dist.pre-20261028-mobile-002`
- Latest frontend source rollback: `/home/workspace/toart/Tarot/.releases/20261028-mobile-002/rollback`.
- Code rollback: `/home/workspace/toart/Tarot/.releases/20261028-mobile-001/rollback` (backend runtime dependencies unchanged; frontend native plugins are recorded in the updated lockfile).
- Pre-release database backup: `/home/workspace/toart/Tarot/database-backups/pre-20261028-mobile-001.sql`
- Latest non-payment migration: `029_mobile_ai_requests.sql` (durable native request identity and quota reservation; existing business rows unchanged).
- Public application origin: PM2 `APP_PUBLIC_ORIGIN=https://121.40.27.226:9443`; keep frontend and backend public origins aligned while this port is the active entry.
- Daily quota boundary: `Asia/Shanghai`, saved in the PM2 environment; production `.env` was preserved.

Build the mainland frontend with:

```powershell
$env:VITE_PAYMENT_MODE = 'disabled'
$env:VITE_DEFAULT_LOCALE = 'zh-CN'
$env:VITE_PUBLIC_APP_ORIGIN = 'https://121.40.27.226:9443'
npx.cmd vite build --outDir .codex-domestic-dist
```

Only run non-payment migrations: `004_cemetery_lnglat.sql`, `019_fate_birth_context.sql`,
`020_fate_choice_guidance.sql`, `022_invitation_management.sql`,
`024_daily_fortune_quota.sql`, `025_fate_dual_quota.sql`,
`026_fate_choice_locale.sql`, `027_user_login_activity.sql`, `028_admin_config_history.sql`, and `029_mobile_ai_requests.sql`. Never add `021_creem_payments.sql` or
`023_payment_entitlement_provenance.sql` to the mainland migration directory.

## Overseas Site

- Public URL: `https://asktarot.zaopic.cn`
- Server: `43.172.90.37:22` as `ubuntu`
- Repository: `/home/ubuntu/tarot-global`
- Backend: PM2 process `tarot-global-api`, port `5174`
- Frontend: `/var/www/asktarot.zaopic.cn/dist`
- Default locale: `en-US`
- Google OAuth Web Client ID: `23313319975-6in17ja17q6onrs553bt8is43a4vd9ct.apps.googleusercontent.com`
- Payment policy: Creem is configured only on this server. Its payment credentials remain in the server `.env` and are never copied to the mainland site.
- Daily quota boundary: `QUOTA_TIME_ZONE=UTC` (the mainland deployment uses `Asia/Shanghai`).
- Current release: frontend `20261028-mobile-002`; backend `20261028-mobile-001`.
- Frontend rollback: `/var/www/asktarot.zaopic.cn/dist.pre-20261028-mobile-002`
- Latest frontend source rollback: `/home/ubuntu/tarot-global/.releases/20261028-mobile-002/rollback`.
- Code rollback: `/home/ubuntu/tarot-global/.releases/20261028-mobile-001/rollback` (backend runtime dependencies unchanged; frontend native plugins are recorded in the updated lockfile).
- Pre-release database backup: `/home/ubuntu/tarot-global/database-backups/pre-20261028-mobile-001.sql`
- Latest migration: `029_mobile_ai_requests.sql`; native JSON auth and durable mobile AI requests are deployed. Admin statistics use the configured UTC business day. No active overseas administrator existed at verification; none was created for tests.

Build the overseas frontend with `VITE_DEFAULT_LOCALE=en-US`,
`VITE_PUBLIC_APP_ORIGIN=https://asktarot.zaopic.cn`, and the public Google
OAuth Client ID. Keep `VITE_PAYMENT_MODE` unset (the default `auto` mode).

## Shared Operations

- Public customer support email: `luckycn521@gmail.com` on both sites.
- Keep CREEM Dashboard `Settings -> Business Details` support email aligned to
  `luckycn521@gmail.com` before requesting review.
- Preserve each server's `.env`, uploads, database, Nginx configuration, and
  PM2 process configuration during releases.
- Both sites require `DEEPSEEK_API_KEY`. Set `DEEPSEEK_BASE_URL` to
  `https://api.deepseek.com` only when that server can reach it; otherwise use
  the URL of an approved OpenAI-compatible gateway (it may include `/v1`). Do
  not put either value in this repository. After changing either value, restart
  the corresponding PM2 process and run one authenticated tarot-reading check.
- Before backend migration work, create a database export on the target. After
  every release, verify `/health`, the public home page, and the membership
  page. On the mainland site, verify payment stays unavailable.
