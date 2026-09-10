# Community service operations

Operator / media owner / data controller: **Kirill Vodopianov** · **Kaiserstraße 63** · **6370 Reith bei Kitzbühel** · **Austria** · **tremp.austria@gmail.com**.

Use the exact mailbox above for legal/privacy requests. Verify delivery and monitor it. Google is the active login provider; email login remains disabled. No transactional-email provider or automatic report email is configured.

## Hosting migration checkpoint — 10 September 2026

**Cutover is on hold.** [Vercel](https://tremp-austria.vercel.app/) remains live production. The parallel [Cloudflare Workers Free candidate](https://tremp-austria.tremp-austria.workers.dev) is available for verification, but Vercel has not been retired and production Privacy still correctly names Vercel. Publishing a Cloudflare provider update and any associated acknowledgment/version decision are deferred until a safe cutover.

- Cloudflare account: **Llirik@gmail.com's Account**, ID `1c677f9a2686b11457133df779540c28`; Worker **tremp-austria**.
- Current source: official `@sveltejs/adapter-cloudflare`, Wrangler and `wrangler.jsonc`; static assets plus `nodejs_compat`. No D1, KV, R2 or Durable Objects were introduced.
- Supabase Auth/PostgreSQL remain in Frankfurt, project `wzoxmvpumpnetbzzstqx`; API row cap remains 1000. No schema/RLS/retention migration is part of this hosting change.
- Supabase Site URL remains `https://tremp-austria.vercel.app`. Both production-origin `/auth/callback` redirects are temporarily allowed. The candidate explicitly uses its Cloudflare origin; Google's redirect remains the Supabase `/auth/v1/callback`. Google scopes and branding are unchanged.
- The Cloudflare GitHub app is installed for **llirik/tremp-austria** only. Native Workers Builds is **not connected**; no deployment API token was created. Automatic production deployment remains unconfigured pending a safe cutover. GitHub validation is separate from deployment.

### Workers Free CPU blocker

[Cloudflare documents](https://developers.cloudflare.com/workers/platform/limits/#cpu-time) a **10 ms CPU limit per Free HTTP invocation**, excluding network wait. A small live diagnostic returned successful HTTP responses while reporting these CPU times:

| Listings rendered | Observed CPU time, milliseconds |
| ----------------- | ------------------------------- |
| 30                | 20.7, 33.1, 108                 |
| 100               | 41.1, 58, 121                   |
| 300               | 74, 128                         |

Cloudflare allows infrequent overruns and describes [rollover from requests below the limit](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/#cpu-time-per-execution). Neither is a guaranteed sustained budget above 10 ms; repeated overruns can terminate requests with `1102` / `exceededCpu`. This diagnostic does not prove a particular failure rate or maximum safe listing count. It does leave a material capacity gap, so successful functional tests alone do not justify retiring the working host. No small supported fix was established; broader SSR, pagination or caching changes would need a separately scoped decision rather than silently changing product behavior.

Latest candidate: source [`1d989d2`](https://github.com/llirik/tremp-austria/commit/1d989d2), Worker version `bef2b0ef-a22a-4e9d-a3d1-9fa31717a505`. Typecheck, lint, **99 unit tests, 94 PostgreSQL/RLS checks, 61 browser tests**, production build and Wrangler dry run passed. [GitHub CI](https://github.com/llirik/tremp-austria/actions/runs/34495359747) passed for this source. [GitHub production smoke](https://github.com/llirik/tremp-austria/actions/runs/34495686346) verified **19 public/mobile checks** on this deployment over ordinary DNS and verified TLS. **21 authenticated scenario groups** also passed on this deployment over ordinary DNS, including 36 contact-layout cases, matching, edit/cancel, reject/accept/revoke, reports, acknowledgment and self-only Auth deletion. All three synthetic accounts and their cascading data were removed, with zero browser runtime errors. A real Google account separately completed logout and fresh login back to the Cloudflare account page. Physical Samsung hardware was not used; mobile checks use browser emulation and enlarged text. These checks do not establish sustained Free-plan suitability. The Supabase retention job was independently checked as active at `15 3 * * *`, with a successful 10 September run.

The CPU diagnostic used a separate temporary Worker with synthetic listings, no real account data, and outbound requests disabled. All 12 HTTP checks succeeded with the expected listing counts; captured telemetry covered 11 invocations with zero errors and zero subrequests. The temporary Worker was deleted and its absence verified. This was a small capacity diagnostic, not a sustained load test.

The final security audit found no exact privileged-key values in 154 tracked/generated local files or 39 deployed JavaScript assets. Anonymous public smoke checks loaded no third-party resources and set no cookies. OAuth initiation used PKCE with Secure, HttpOnly, SameSite=Lax, host-only cookies; server cookie handling preserves these protections for the session. Supabase's redirect allowlist was read back with both candidate and Vercel callbacks, while Site URL remained Vercel.

### Deploy the parallel candidate

Use Node.js 24 and the pinned pnpm/Wrangler versions:

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler whoami
pnpm validate
pnpm test:e2e
pnpm deploy:check
pnpm deploy
```

If needed, authenticate with `pnpm exec wrangler login`. `pnpm deploy` invokes Wrangler, and `build.command` runs `pnpm build` before deployment. The dry run also builds without publishing. These commands update the Cloudflare candidate, not the existing Vercel deployment. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) must be recorded and tested before claiming future automatic deployment.

The six application bindings in `wrangler.jsonc` are public runtime configuration: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_SITE_URL`, `PUBLIC_DEMO_MODE=false`, `PUBLIC_GOOGLE_AUTH_ENABLED=true` and `PUBLIC_EMAIL_AUTH_ENABLED=false`. Review and redeploy configuration changes. The publishable key does not bypass RLS; the app needs no service-role key. Google secrets stay in Supabase. Any future private server binding must use a Cloudflare secret, for example `pnpm exec wrangler secret put SECRET_NAME` with interactive input, never `vars` or a `PUBLIC_` name. Tokens, `.env`, `.dev.vars` and CLI authentication state remain outside Git.

No Web Analytics beacon was added; Worker observability is disabled. Provider-controlled infrastructure/security information is distinct from application analytics and is not claimed absent.

### Roll back the candidate or rebuild the fallback

```sh
pnpm exec wrangler deployments list
pnpm exec wrangler versions list
pnpm exec wrangler rollback VERSION_ID
```

Replace `VERSION_ID` with a verified working version of this Worker. [Rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) changes the Worker deployment; it does not restore Supabase data, Auth settings or external resources. Verify candidate browsing and login after rollback. Redeploy corrected source with `pnpm deploy`, which rebuilds its output.

Vercel's working source/configuration is preserved at [`6ff875b`](https://github.com/llirik/tremp-austria/commit/6ff875b). Rebuild that revision in an isolated checkout if the fallback needs redeployment; the current Cloudflare adapter cannot rebuild it. Vercel's automatic attempts to build the new adapter fail without replacing its existing working deployment, which was rechecked as HTTP 200. GitHub's validation workflow is green; those Vercel deployment checks are not. Keep the live Vercel project, production origin and Auth configuration until Cloudflare's suitability is established and cutover is explicitly completed. Never reset or seed production Supabase as a hosting rollback.

The migration was requested for a clearer self-service hosting/data-processing contractual setup for this non-commercial EU project, without concluding that the previous Vercel setup was unlawful. [LEGAL_REVIEW.md](LEGAL_REVIEW.md) records the Cloudflare DPA reference and deferred disclosure decision.

## Review listing reports privately

Use the project's Supabase dashboard SQL editor with the operator's protected account. Ordinary app users have no moderation access; do not add a client service-role key, public report view or public moderation notes. Review regularly before reports expire after 90 days. A report is an unverified allegation, not proof of misconduct.

List pending reports with only the information needed for review:

```sql
select id, ride_id, reason, explanation, created_at
from public.listing_reports
where status = 'pending'
order by created_at
limit 50;
```

Inspect the referenced listing inside the dashboard or its public link. Avoid copying explanations or account identifiers into public GitHub issues. If further information is needed, use the private contact channel and collect only what is necessary.

Replace the placeholder below with a report ID already inspected, then mark it reviewed (or use `dismissed` when appropriate):

```sql
update public.listing_reports
set status = 'reviewed'
where id = '<REPORT_UUID>'::uuid
  and status = 'pending'
returning id, status;
```

To hide an abusive listing, first verify its ID and contents. Cancellation preserves the report until retention cleanup and allows the decision to be reviewed:

```sql
update public.rides
set status = 'cancelled'
where id = '<RIDE_UUID>'::uuid
  and status = 'active'
returning id, status, cancelled_at;
```

Cancellation alone does **not** revoke accepted contact access. If the case also calls for withdrawing that listing's contact permissions, inspect its pending/accepted requests and then revoke those relationships explicitly:

```sql
update public.contact_requests
set status = 'revoked'
where ride_id = '<RIDE_UUID>'::uuid
  and status in ('pending', 'accepted')
returning id, status;
```

Other accepted relationships between the same participants can still grant contact access. Broader abuse may require reviewing those relationships and restricting the account through Supabase's protected Auth administration. Do not promise that moderation can recover information another person has already copied. Users can request review of a moderation decision at the operator mailbox.

## Verify daily retention

After applying migrations, check the actual job. Both schedule and active state must be present; a successful migration alone is insufficient evidence of execution:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'tremp-retention-daily';

select start_time, end_time, status, return_message
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname = 'tremp-retention-daily'
)
order by start_time desc
limit 10;
```

Expected schedule: `15 3 * * *`, daily at **03:15 UTC** with the project's UTC cron configuration. Review execution failures and verify successful runs after deployment, database restarts or free-tier pauses. Local Supabase can run `pg_cron`; PGlite tests verify the cleanup function but cannot schedule it.

To catch up after an outage, an authorized database operator can invoke the same bounded cleanup manually:

```sql
select * from private.run_retention_cleanup();
```

This removes eligible active rides 90 days after departure, or cancelled rides 90 days after the earlier of departure/first cancellation. Requests and reports attached to a deleted ride cascade. Reports also expire 90 days after submission, even when still pending. The returned report count covers direct age-based deletion, not subsequent ride cascades. No cutoff parameter allows accidentally sweeping future active listings.

If `pg_cron` is unavailable, configure a trusted daily database invocation before claiming automatic retention. Do not expose the private function as an unauthenticated HTTP endpoint. Paused infrastructure cannot run jobs; resume it, run cleanup and confirm scheduling. Google/Supabase/Vercel technical logs and backups follow their separate provider-controlled retention; the SQL job does not purge them.

## Account deletion and privacy requests

Authenticated users can delete their own account from the account area after explicit confirmation. `delete_my_account(p_confirm)` derives the only target from the user's JWT, confirms the Auth row exists, and deletes Auth plus cascading application records. It requires no new secret. Never offer an RPC accepting a target account ID or send operator credentials to the browser.

For emailed access, correction, restriction, objection, portability or erasure requests:

1. Verify the requester's connection to the account proportionately; do not request identity documents by default.
2. Use protected Supabase administration to inspect only that person's data and relevant relationships. Do not include another person's private contact information in an export.
3. Provide the applicable response through a private channel within the legal deadline, generally one month. Record any justified extension or refusal and communicate it as required.
4. Avoid unnecessary local exports. If a temporary copy is needed, keep it outside the repository, restrict access and delete it after secure delivery and completion of the request.

Routine self-service deletion removes the user's Auth account, profile, private contact, owned rides, involved requests, submitted reports, legal acceptance and rate counters. It does not delete the person's Google account or revoke Google's permission grant, and does not erase recipient copies or immediately purge provider backups. There is no separate retained application-history archive.

## Keep legal versions and provider settings aligned

Current Terms and Privacy versions are both `2026-09-09`. For material changes, update the texts and `src/lib/legal.ts`, then add a migration changing both legal-acceptance RPC version checks. Users receive an unchecked acknowledgment before affected coordination writes; safety reports, deletion and existing profile/contact corrections remain available without accepting revised terms.

Keep Google scopes to identity/profile/email. Store its client secret only in Supabase provider settings. Verify actual provider agreement records, subprocessors and international-processing safeguards, and check any account-level Vercel telemetry settings independently of the source audit. No analytics/tracking SDK should be introduced without a separate deliberate review. [LEGAL_REVIEW.md](LEGAL_REVIEW.md) records the supplied postal address and remaining Austrian notice and provider-contract questions.
