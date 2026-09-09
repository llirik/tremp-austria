# Security

Report vulnerabilities privately using [the repository's security advisory form](https://github.com/llirik/tremp-austria/security/advisories/new). Include the affected route or SQL operation, expected permission boundary and reproduction steps with synthetic data. Never attach actual contacts, cookies, credentials or access tokens to a public issue.

Private vulnerability reporting is enabled. If the form is unavailable, contact [tremp.austria@gmail.com](mailto:tremp.austria@gmail.com) privately; do not publish exploit details. This volunteer service does not promise an immediate response.

The latest `main` branch is maintained. Keep application and database policy versions aligned by applying the committed migrations.

## Authorization design

- All six public application tables and private rate counters use RLS. Anonymous access is limited to an explicit public listing projection without account IDs or private contacts.
- Profiles and ride writes are owner-scoped. Contact RPCs derive participants from the authenticated user and ride; users cannot approve someone else's request.
- Private contacts are readable only by their owner or an accepted counterpart. Revocation removes one request's authorization; another accepted relationship may retain access.
- Terms and Privacy acknowledgment is versioned and enforced in PostgreSQL for new onboarding and coordination writes, including direct API calls. Existing profile/contact rectification, cancellation, rejection, revocation, reports and deletion remain available without renewed acceptance.
- Reports require authentication, including before profile onboarding. Clients can read only their own submitted fields, cannot read moderation status, and have no direct report-write grants. The report RPC derives the reporter and applies validation, uniqueness and persistent rate limits.
- Account deletion requires a verified user and explicit confirmation. `delete_my_account(p_confirm)` has no target-user argument: it deletes only `auth.uid()` after checking that Auth user exists. The Auth deletion cascades application data and is atomic.
- Privileged RPCs have fixed search paths, qualified references, caller checks and narrow EXECUTE grants. Retention cleanup is private and callable only through trusted database maintenance.
- The application uses only the publishable Supabase key and each user's session. There is no application service-role credential, including for account deletion. OAuth client secrets stay in Supabase provider settings.

Run `pnpm test:db` for 94 actual PostgreSQL authorization/retention checks, plus `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm test:e2e` and `pnpm build`. See [the database contract](../supabase/README.md).

## Operation and limitations

Operator / media owner / data controller: **Kirill Vodopianov**, **Reith bei Kitzbühel, Austria**, **tremp.austria@gmail.com**. Public notices contain no street or private telephone number. [Operations](OPERATIONS.md) covers private report review, abuse handling, rights requests and checking the daily retention job.

Protect Google Cloud, hosting and Supabase operator accounts. Google is the production login method; keep email login off unless custom SMTP is deliberately configured and tested. Review provider agreements, logs, backup retention and any account-level telemetry setting separately. No analytics/tracking SDK is present in application source.

The 03:15 UTC database job deletes eligible expired/cancelled rides and their requests after 90 days, and reports after 90 days. Monitor actual executions, particularly after free-tier pauses or outages. Provider logs/backups have separate provider-controlled retention.

Cancelling a listing hides it publicly but preserves accepted contact access. Self-service account deletion removes Auth and application records; it does not recall copied information, delete the user's Google account or revoke their external Google permission grant. Public-text validation and per-account limits reduce accidental disclosure and spam; they do not verify identity, transport licensing, insurance or safety. The operator's legal/administrative obligations remain described in [LEGAL_REVIEW.md](LEGAL_REVIEW.md).
