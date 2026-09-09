# Community service operations

Operator / media owner / data controller: **Kirill Vodopianov** · **Reith bei Kitzbühel, Austria** · **tremp.austra@gmail.com**.

Use the exact mailbox above for legal/privacy requests. Verify delivery and monitor it. Google is the active login provider; email login remains disabled. No transactional-email provider or automatic report email is configured.

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

Keep Google scopes to identity/profile/email. Store its client secret only in Supabase provider settings. Verify actual provider agreement records, subprocessors and international-processing safeguards, and check any account-level Vercel telemetry settings independently of the source audit. No analytics/tracking SDK should be introduced without a separate deliberate review. [LEGAL_REVIEW.md](LEGAL_REVIEW.md) records the remaining Austrian notice/address and provider-contract questions.
