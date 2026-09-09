# Security

Report vulnerabilities privately using [the repository's security advisory form](https://github.com/llirik/tremp-austria/security/advisories/new). Include the affected route or SQL operation, the expected permission boundary, and reproduction steps with synthetic data. Never attach actual contacts, session cookies, database credentials or access tokens to a public issue.

Private vulnerability reporting is enabled for this repository. If the form is unavailable, open an issue asking maintainers to restore it without describing the exploit. No response-time commitment or dedicated security email address has been established.

The latest `main` branch is maintained. Keep application and database policy versions aligned by applying the committed migrations.

## Authorization design

- Anonymous reads use an explicit public projection without owner IDs or private contacts.
- Owner-scoped RLS protects profiles and ride writes.
- Restricted contact RPCs derive identities from the authenticated session.
- Private contacts are readable by their owner or an accepted counterpart.
- Revocation applies to one request; another accepted request between the same people retains consent.
- The application does not use a service-role key. Privileged keys belong only in operator-controlled tooling.

See [the database documentation](../supabase/README.md) and run `pnpm test:db` for authorization regression checks.

## Operator responsibilities

Before wider use, supply the actual operator identity and a monitored privacy/support contact in the privacy page, and establish a process for access, deletion and abuse requests. No operator identity, business address or private contact channel is assumed by this repository.

Verify custom SMTP delivery, protect hosting and Supabase accounts, review provider logs and retention settings, and monitor abuse and capacity. Public-text checks and per-account limits reduce accidental disclosure and spam; they do not verify identity, driver suitability or transport safety.

Cancelling a listing hides it publicly but preserves accepted contact access. Account deletion currently requires an authorized operator. Information copied or shared outside the app cannot be recalled.
