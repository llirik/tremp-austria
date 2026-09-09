# Database and authorization

Run `supabase start` and `supabase db reset` for local Supabase. The seed is synthetic and has no passwords or usable identities. Production uses `supabase db push` without `--include-seed`; never run the seed or local reset against production.

Six application tables—`profiles`, `private_contacts`, `rides`, `contact_requests`, `legal_acceptances`, `listing_reports`—and `private.rate_limits` use RLS. The `anon` role can read only `public_rides`, an explicit, read-only projection of active listings and selected display names. Its owner privileges intentionally project underlying owner-only data through a security barrier. It omits account IDs, authentication metadata and private contacts. Past active listings remain accessible through their links until cancellation or retention deletion; the default feed filters future departures.

## User-session API

Use the ordinary Supabase user session. The application needs no service-role key.

| Object / RPC                                                     | Contract                                                                                                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public_rides`                                                   | `id, ride_type, direction, departure_at, flexibility_minutes, passenger_count, available_seats, origin_area, destination_area, flight_number, note, status, created_at, updated_at, display_name`    |
| `rides`                                                          | Own rows only. Normal insert/update/delete; `owner_id` defaults to `auth.uid()`. Owner, ID, creation time and the first `cancelled_at` are protected by triggers.                                    |
| `profiles`                                                       | Own read/update; initial insert requires current acceptance. Upsert `{ id: user.id, display_name }`.                                                                                                 |
| `private_contacts`                                               | Owner-only writes; read own contact or an accepted counterpart. Initial insert requires current acceptance. Methods: `whatsapp`, `telegram`, `email`.                                                |
| `request_contact({ p_ride_id })`                                 | Returns UUID, derives requester/owner, requires their contacts and current acceptance, rejects own/unavailable rides. Repeats are idempotent; rejected/revoked requests cannot be silently reopened. |
| `respond_contact_request({ p_request_id, p_status })`            | Pending request owner only. Accepts `accepted` or `rejected`; accepting requires current legal acceptance.                                                                                           |
| `revoke_contact_request({ p_request_id })`                       | Either participant may revoke a pending/accepted request without renewed legal acceptance.                                                                                                           |
| `get_my_contact_requests()`                                      | Caller relationships only: request/ride IDs, status, timestamps, `is_owner` and both display names. No account IDs.                                                                                  |
| `get_request_contact({ p_request_id })`                          | Zero/one counterpart `{ method, value }`, only for an accepted relationship involving the caller.                                                                                                    |
| `has_current_legal_acceptance()`                                 | Whether the caller has accepted both required versions.                                                                                                                                              |
| `accept_legal_documents({ p_terms_version, p_privacy_version })` | Caller only; accepts current versions only and records server time. Repeating the same versions preserves that timestamp.                                                                            |
| `report_listing({ p_ride_id, p_reason, p_explanation })`         | Authenticated existing user, no profile/Terms prerequisite; active listing only. One report per caller/listing, returning its UUID; repeat submission is idempotent.                                 |
| `delete_my_account({ p_confirm: true })`                         | Existing authenticated caller only. No target ID parameter; deletes that Auth user and cascades application records atomically. False/null confirmation fails.                                       |

`ride_type` is `driver | passenger | taxi`; direction is `vienna_to_bts | bts_to_vienna`; status is `active | cancelled`. Flexibility is `0 | 30 | 60 | 120 | null`, with null meaning flexible. Passenger counts are 1–8; seats are 0–8, required for drivers, null for passengers and optional for taxi shares.

Contact-request rows are directly readable only by participants, with no client insert/update/delete grants. RLS checks contact access on each read. Revocation applies to one relationship; another accepted request between the pair still grants access. Cancellation hides the listing but does not revoke accepted requests. Ride deletion cascades its requests and reports. Copies already saved outside the app cannot be recalled.

## Terms and Privacy acknowledgment

Current versions are `2026-09-09` for both documents. `legal_acceptances` stores `user_id`, `accepted_terms_version`, `accepted_privacy_version`, `accepted_at`, with own-read access and RPC-only writes. This records Terms acceptance and awareness of the Privacy Policy, not blanket GDPR consent.

Database triggers require current acceptance for first profile/contact insertion, ride creation/editing, new contact requests and accepting requests. Existing profile/contact rectification, pure cancellation, rejection, revocation, reporting and deletion remain possible without renewed acceptance. Cancellation cannot include publishing edits to bypass the gate.

To require renewed acceptance after a material change, update the legal text and `src/lib/legal.ts`, then add a migration updating both `has_current_legal_acceptance()` and `accept_legal_documents()` to the new versions. Do not rewrite an already-deployed migration. Existing records retain their prior versions until users explicitly accept the replacement.

## Reports and rate limits

Reasons are `spam`, `scam`, `personal_information`, `illegal_activity`, `harassment`, `other`; optional explanation is at most 500 characters. Status is `pending | reviewed | dismissed`, controlled only by database operators. Clients have SELECT on their own `id, ride_id, reporter_id, reason, explanation, created_at` columns only. They cannot select status, see others' reports, or modify any report directly. Operator review instructions are in [OPERATIONS.md](../docs/OPERATIONS.md).

Private atomic counters limit each account to 12 ride creations/hour and 30/day, 20 contact requests/hour and 50/day, and 5 reports/hour and 20/day. Counters survive content deletion, occupy bounded storage, and are deleted with the Auth account.

Public fields reject obvious email addresses, long phone-like strings, URLs and unsupported controls. Ordinary note whitespace is allowed. This reduces accidents; it is not a reliable exact-address or obfuscated-contact detector.

## Account deletion and retention

`delete_my_account` deletes the verified caller's `auth.users` row. Foreign keys cascade profile, private contacts, owned rides, related contact requests, submitted reports, acceptance and rate counters; Supabase's Auth schema cascades its account-owned identities/sessions. The app clears its cookies after success. A later Google login creates a fresh account. External Google permissions and provider backups/logs are outside this deletion.

`private.run_retention_cleanup()` accepts no caller-controlled date. It deletes:

- Active rides with departure at least 90 days ago.
- Cancelled rides 90 days after the earlier of departure or first cancellation. Legacy cancelled rows are initialized from their existing server-controlled `updated_at`.
- Related contact requests and reports through cascades.
- Any report created at least 90 days ago, including pending reports, even if its listing is newer.

The cleanup returns `deleted_rides` and `deleted_reports`; the report count counts direct age-based deletions, not reports subsequently cascaded from rides. Accounts and profiles remain until account deletion. Provider technical logs/backups have separate retention.

Migration `202609090004_retention_schedule.sql` installs `pg_cron` when available and schedules `tremp-retention-daily` at 03:15 UTC. Hosted Supabase supports it. If unavailable, the migration emits a notice and a trusted daily invocation must be configured; having the cleanup function alone is not automatic deletion. Verify the active job and execution history using [OPERATIONS.md](../docs/OPERATIONS.md). A paused project must resume and run cleanup.

## Verification

`pnpm test:db` applies all application migrations and seeds in PostgreSQL through PGlite, then runs 94 grants/RLS/RPC/retention checks as actual database roles. Only Supabase's Auth role and identity primitives are supplied by the harness. The embedded engine lacks `pg_cron`; the cleanup logic is exercised, but hosted scheduling and real Auth cascades need integration checks. Run the full commands in the main README and verify actual Google OAuth, private contact flows and deletion with synthetic hosted accounts.
