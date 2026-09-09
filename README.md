# טרמפ אוסטריה · Tremp Austria

A free, non-commercial, volunteer-operated community ride board between Vienna and Bratislava Airport, released as open source. Browse in Hebrew, offer spare seats, find a ride, or coordinate a shared taxi. Personal contact details become available only after a contact request is accepted.

This community board does not provide transport, employ drivers, dispatch taxis, book rides, arrange transportation payments or determine fares. There are no advertisements or commissions. Participants make their own arrangements.

**App:** [tremp-austria.vercel.app](https://tremp-austria.vercel.app) · **Source:** [llirik/tremp-austria](https://github.com/llirik/tremp-austria) · **License:** [MIT](LICENSE)

**Deployment:** Vercel hosts the application; Supabase Auth and PostgreSQL use Frankfurt. Google OAuth is the active production sign-in method. Email sign-in is disabled; optional email support in the code must remain off until custom SMTP and a verified sender are configured. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp). Apply all committed migrations and verify the retention job when deploying.

**Operator / media owner / data controller:** Kirill Vodopianov · Reith bei Kitzbühel, Austria · [tremp.austria@gmail.com](mailto:tremp.austria@gmail.com). Public notices: [About](https://tremp-austria.vercel.app/about), [Privacy](https://tremp-austria.vercel.app/privacy), [Terms](https://tremp-austria.vercel.app/terms), [Impressum](https://tremp-austria.vercel.app/impressum).

## Features

- Public browsing, direction/date/type filters, stable `/ride/<id>` links and Hebrew WhatsApp sharing.
- **יש לי מקום** — spare seats; **מחפש טרמפ** — looking for a ride; **שותפים למונית** — sharing a taxi.
- Google sign-in; onboarding asks for a selected display name and one private contact method: WhatsApp, Telegram or email. Authentication email and Google profile metadata are not published automatically.
- Personal listings, editing, cancellation, received/sent contact requests, acceptance, rejection and revocation.
- Potential matches based on direction, departure flexibility, listing type and seats.
- Mobile layouts, Hebrew RTL, Vienna/Bratislava local times and accessible native forms.
- Explicit versioned Terms acceptance and Privacy acknowledgment before account onboarding and coordination writes.
- Self-service account deletion, private listing reports and daily database retention cleanup.

There are no maps, live flight data, internal chat or payments. Optional flight numbers are stored separately from public notes.

<img src="docs/images/mobile-board.png" width="320" alt="Hebrew RTL ride board on a mobile screen, using synthetic local demo listings">

Screenshots use synthetic local demo listings. [View the desktop layout](docs/images/desktop-board.png). Production contains only community-submitted listings.

## Architecture

SvelteKit and TypeScript provide server-rendered pages and form actions. The UI uses Svelte 5, Tailwind CSS 4, Lucide and a locally bundled Heebo font. Supabase provides PostgreSQL and Auth. The Vercel adapter targets Node.js 24 in Frankfurt (`fra1`); there is no separate backend service.

```text
Browser → SvelteKit loads/form actions → Supabase Auth + PostgreSQL
                                            ├─ public_rides projection
                                            ├─ owner-scoped tables with RLS
                                            └─ restricted contact, acceptance, report and deletion RPCs
```

| Path                         | Responsibility                                               |
| ---------------------------- | ------------------------------------------------------------ |
| `src/lib/domain.ts`          | Types, ride validation, matching, sharing and time handling  |
| `src/lib/components/`        | Ride cards, short forms and share actions                    |
| `src/lib/server/`            | Auth boundaries, explicit projections and contact validation |
| `src/hooks.server.ts`        | Supabase SSR cookies, verified users and security headers    |
| `src/routes/`                | Board, detail pages, authentication and account actions      |
| `supabase/migrations/`       | Schema, privileges, RLS, restricted RPCs and retention       |
| `supabase/tests/run-rls.mjs` | PostgreSQL authorization regression suite                    |

Hebrew is the initial language. Shared labels and formatting helpers are isolated in `domain.ts`; English translation remains future work.

## Local development

Use **Node.js 24** and the **pnpm version in `package.json`**.

```sh
git clone https://github.com/llirik/tremp-austria.git
cd tremp-austria
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Open `http://localhost:5173`. Without Supabase credentials, the development server shows a clearly labeled, read-only demonstration with synthetic Hebrew listings. It cannot create accounts, save rides or send contact requests.

For a working local backend, install the [Supabase CLI and a Docker-compatible runtime](https://supabase.com/docs/guides/local-development/cli/getting-started), then run:

```sh
supabase start
supabase db reset
supabase status
```

`db reset` rebuilds the **local** database and loads `supabase/seed.sql`, discarding existing local data. Copy the local API URL and publishable key from `supabase status` into `.env`, keep demo mode false, and restart the app. Local sign-in messages appear in the mail viewer at `http://localhost:54324`; open the magic link in the same browser that requested it.

Seed data covers both directions, all listing types, potential matches, full vehicles, flexible departures, past rides and cancellations. Synthetic profiles use reserved `.invalid` contacts and have no passwords or usable identities. Create a local account through the app to test authenticated actions.

### Environment

| Variable                          | Purpose                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `PUBLIC_SUPABASE_URL`             | Local or hosted Supabase API origin                                                              |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key; legacy `PUBLIC_SUPABASE_ANON_KEY` is also supported                             |
| `PUBLIC_SITE_URL`                 | Canonical app origin; `http://localhost:5173` locally                                            |
| `PUBLIC_DEMO_MODE`                | `false` for real environments; `true` only for an intentional, labeled demonstration             |
| `PUBLIC_GOOGLE_AUTH_ENABLED`      | `true` only after Google OAuth is configured in Google Cloud and Supabase Auth                   |
| `PUBLIC_EMAIL_AUTH_ENABLED`       | `true` only with working email delivery; defaults to true in development and false in production |

The application never needs a service-role key. Keep Google client secrets, database passwords, management tokens and SMTP credentials out of the repository and every `PUBLIC_` variable. `.env` and provider CLI state are ignored by Git. Google client secrets belong only in Supabase's provider settings.

Production does **not** substitute demo data when configuration or database access fails. Keep `PUBLIC_DEMO_MODE=false`; an empty production board means nobody has posted yet.

## Privacy and authorization

Six application tables—`profiles`, `rides`, `private_contacts`, `contact_requests`, `legal_acceptances` and `listing_reports`—plus private rate counters use RLS. Anonymous clients read only `public_rides`, a projection of active listings and selected display names. It excludes account IDs and private contacts. Direct profile and ride-table reads are limited to their owner.

Contact RPCs derive participants from the user session and ride. Only a pending request's owner can accept or reject it. An accepted relationship lets the pair query each other's private contact. Either participant can revoke an individual request; another accepted request between the pair still grants access. Cancelling a listing hides it publicly but preserves accepted relationships. These rules apply to direct Supabase requests as well as the UI. See [the database contract](supabase/README.md).

The account area offers permanent deletion with explicit confirmation. The restricted `delete_my_account` RPC derives its sole target from `auth.uid()` and deletes that Supabase Auth user, cascading their application data. No service-role key is added to the app. Existing Google permission grants, provider backups/logs and information already copied by another participant are outside this deletion.

Terms and Privacy versions are `2026-09-09`, defined in `src/lib/legal.ts` and enforced by database functions. The account stores the accepted versions and a server timestamp. New onboarding, ride publishing/editing, contact requests and accepting contact require current acceptance. Rectification of an existing profile/contact, cancellation, rejection, revocation, reporting and account deletion remain available without accepting changed terms. Acceptance is not used as blanket GDPR consent.

Authenticated users can report listings before profile onboarding. Reports are private, limited to one per user/listing, and rate-limited to 5/hour and 20/day. Users cannot read other reports or moderation status, or modify reports. The operator reviews them directly in Supabase; no email service or moderation dashboard is introduced. See [operations instructions](docs/OPERATIONS.md).

Daily PostgreSQL cleanup deletes expired/cancelled rides once eligible after 90 days, with related contact requests and reports cascading. Reports also expire 90 days after creation. Account/profile data remains while the account exists. The job is `tremp-retention-daily`, scheduled for 03:15 UTC; deployments must verify that it is active and running. Provider logs/backups follow provider-controlled policies.

Public fields reject obvious emails, phone-like strings, links and unsupported controls. This does not reliably identify exact addresses or disguised contact details. Database creation limits allow 12 rides/hour and 30/day, and 20 contact requests/hour and 50/day per account; deleting content does not reset counters.

Sessions use server-managed HttpOnly cookies and Supabase `getUser()` verification. Google login uses PKCE and only identity/email/profile scopes. Public page data never serializes an Auth user, authentication email or account UUID. No analytics, advertising, tracking pixel or fingerprinting SDK is included; fonts are local. Account-level provider settings and technical logs are distinct from app tracking.

The operator details are now published. The operator still needs to monitor the exact contact mailbox, review reports, verify retention job health and maintain applicable provider agreements and privacy-request handling. [Legal review notes](docs/LEGAL_REVIEW.md) explain the conditional Austrian notice/address assessment and questions that code cannot settle.

## Matching and lifecycle

`isPotentialMatch()` and `potentialMatches()` in `src/lib/domain.ts` implement the isolated algorithm:

1. Listings must differ, be active and have the same direction.
2. Drivers and passengers match when enough seats are available; taxi-share listings match other taxi shares.
3. Finite windows overlap when the departure difference is no greater than the sum of both flexibility windows. “Flexible” means the same `Europe/Vienna` calendar day.

Matches are suggestions, not reservations. Detail pages compare against upcoming candidates. The default feed filters out past departures immediately. A past active listing keeps its shareable detail page until cancellation or retention deletion, but cannot receive new contact requests. Owners can see historical and cancelled entries until deletion. Expired active rides become eligible after departure plus 90 days; cancelled rides use the earlier of their departure and first cancellation plus 90 days.

Timestamps use `timestamptz`; forms interpret input in `Europe/Vienna`. Ambiguous or nonexistent times during daylight-saving transitions are rejected for clarification.

## Checks

```sh
pnpm check       # Svelte/TypeScript
pnpm lint        # ESLint
pnpm test        # Matching, validation, redirects and auth-boundary unit tests
pnpm test:db     # Actual PostgreSQL grants, RLS, RPC and constraint checks via PGlite
pnpm build      # Production build
pnpm validate   # All five checks above; also runs in GitHub Actions
```

The database harness applies every migration and the seed to a fresh PostgreSQL engine. It supplies Supabase's Auth role/identity primitives and exercises the actual policies. Its 94 checks cover public projections, impersonation, immutable ownership, contact authorization/revocation, acceptance enforcement, report privacy, self-deletion, retention and persistent rate limits. No hosted credentials or Docker daemon are needed.

For browser tests, run `pnpm exec playwright install chromium`, then `pnpm test:e2e`. Inspect Hebrew RTL at approximately 390×844, 430×932 and 1440×900 after UI changes. Release QA must also exercise real Google sign-in, acceptance, profile and listing actions, a request/accept/revoke exchange, reporting and deletion against the hosted backend with synthetic accounts. Clean up every test account/listing afterward. Test command output is the source of current unit/browser totals; the embedded suite does not itself prove production OAuth or the hosted scheduler works.

`pnpm test:privacy` runs the authenticated browser regression against an already running application and migrated Supabase. Supply `TEST_BASE_URL` (default `http://127.0.0.1:5176`), `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` and `SUPABASE_TEST_SERVICE_KEY` through the test process environment. The privileged test key provisions and cleans up three synthetic Auth fixtures; application actions use ordinary user sessions. Never put it in a `PUBLIC_` variable or the deployed application. Non-local targets require explicit `ALLOW_HOSTED_PRIVACY_TESTS=1`. The test removes its fixtures in `finally` and stores screenshots/results under ignored `output/playwright/`; it does not complete Google consent.

## Deploying a fork

Create a Supabase project and apply the committed migrations:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Never pass `--include-seed` or run the local seed against production. Add future changes as new migrations so deployed databases can upgrade reproducibly.

Import the GitHub repository into Vercel with the SvelteKit preset, Node.js 24, `pnpm install --frozen-lockfile` and `pnpm build`. The adapter is already configured; do not override the static output directory. Set the environment variables above and redeploy after changing them.

Set Supabase Auth's Site URL to the canonical app origin and permit `/auth/callback` redirects including the `next` query string. Preview deployments should use a separate test backend and an intentionally permitted callback origin.

For Google sign-in, create a web OAuth client in a separate Google Cloud project. Its authorized redirect URI is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` (the Supabase callback), and its authorized JavaScript origin is your app origin. Configure the client ID and secret in Supabase Auth's Google provider. In Google Data Access, select only `openid`, `https://www.googleapis.com/auth/userinfo.email` and `https://www.googleapis.com/auth/userinfo.profile`, and make the consent screen available to the intended audience. Then set `PUBLIC_GOOGLE_AUTH_ENABLED=true` and redeploy. See the [Supabase Google provider guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

Without optional Google brand verification or a custom Supabase domain, Google's consent screen can show your Supabase project domain. This does not prevent the basic sign-in flow; a custom domain or brand verification can improve recognition later.

For optional email sign-in, enable the Supabase email provider and configure a verified sender through custom SMTP before setting `PUBLIC_EMAIL_AUTH_ENABLED=true`. Keep this flag false when delivery is unavailable; Google sign-in does not require SMTP. Keep SMTP and management credentials in provider settings.

Verify anonymous browsing, legal/footer links, mobile layout, Google sign-in, Terms acknowledgment, onboarding, listing creation/editing/cancellation, reporting, account deletion and a request/accept/revoke exchange. Verify that unrelated and anonymous clients cannot retrieve private contacts or reports. Follow [OPERATIONS.md](docs/OPERATIONS.md) to verify the database retention job and review reports.

## Contributing

Small pull requests are welcome. Explain the user-visible change, preserve Hebrew RTL and mobile usability, add a regression test when behavior changes, and run `pnpm validate`. Extend the database tests whenever public projections or contact permissions change.

Use GitHub issues for ordinary bugs. Report vulnerabilities privately through the [security advisory form](https://github.com/llirik/tremp-austria/security/advisories/new); never put contact details or credentials in public issues. See [SECURITY.md](docs/SECURITY.md).

Released under the [MIT license](LICENSE).
