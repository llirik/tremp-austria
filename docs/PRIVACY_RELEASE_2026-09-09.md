# Privacy hardening release — 9 September 2026

Production: [tremp-austria.vercel.app](https://tremp-austria.vercel.app). Application commit: `4d44e88`; database commit: `da69f21`.

## Verified checks

| Check                                     | Result                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Unit/integration tests                    | 80 passed                                                                                       |
| PostgreSQL authorization/retention checks | 94 passed                                                                                       |
| Public Playwright tests                   | 9 passed across 390, 430 and 1440-pixel viewports                                               |
| Real Supabase application flows           | 13 flow groups passed locally and 13 against production                                         |
| Synthetic-data cleanup                    | All 3 synthetic Auth fixtures and their dependent data removed after each flow run              |
| OAuth checks                              | 8 passed, covering requested scopes, disabled email, PKCE, CSRF and safe return paths           |
| Production public-page smoke checks       | 7 routes passed at each of 390, 430 and 1440 pixels; HTTP 200, RTL, footer and exact legal text |

A real existing Google session was refreshed into the updated account page through Chrome. The observed Supabase authorization redirect requests exactly `email` and `profile`; no Gmail, Contacts, Calendar or Drive permissions were requested. Google remains the active production login method.

The authenticated flows exercised profile/legal acknowledgment, ride creation and management, contact request/acceptance/revocation, private reports and complete self-service Auth/application deletion. Local validation also passed type checking, lint and the production build.

The existing production listing's data checksum and account count were unchanged after migrations, scheduled cleanup and synthetic tests. No test reports or acceptance records remained.

## Retention verified on hosted PostgreSQL

Migrations `202609090003_privacy_controls.sql` and `202609090004_retention_schedule.sql` were applied. Hosted `pg_cron` is version **1.6.4**. Job ID **1**, `tremp-retention-daily`, is active with schedule **`15 3 * * *`** and GMT/UTC timing: **03:15 UTC daily**.

For execution verification, the job was temporarily scheduled every minute. Actual automatic runs succeeded at **17:30 UTC** and **17:31 UTC** on 9 September 2026. The daily schedule was then restored and confirmed. This verifies scheduler execution, not merely installation of a cleanup function.

## Tracking and reproducible verification

The source audit and local/production public-page requests found no application analytics or tracking. The production audit covered seven public routes at three viewport sizes, with no third-party requests, tracking endpoints, cookies or browser runtime errors. No analytics SDK is included. Vercel API metadata contains analytics identifiers, which alone do not establish that collection is enabled; this record does not claim account-level settings are disabled. Provider technical logs are separate from application analytics.

Repeat the checks with `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e` and `pnpm build`; the GitHub Actions workflow runs these checks on Node.js 24 for each pushed commit. `pnpm test:privacy` runs the real Supabase flow with the environment documented in the README. See [OPERATIONS.md](OPERATIONS.md) for retention job queries and private report review.

The hosted runner's unrelated Google Chrome APT source returned a checksum mismatch on two installation attempts. CI excludes that source before installing Ubuntu browser libraries and Playwright's own Chromium; package verification is not bypassed.

## Operator follow-through

The published operator is **Kirill Vodopianov**, **Kaiserstraße 63, 6370 Reith bei Kitzbühel, Austria**, **tremp.austria@gmail.com** (postal address updated 10 September 2026 from operator-supplied details). No private telephone number is published. Verify that this exact mailbox receives mail, monitor it and review reports regularly in protected Supabase administration. Maintain applicable provider agreement/transfer records and confirm the Austrian legal-notice classification. [LEGAL_REVIEW.md](LEGAL_REVIEW.md) records these legal questions; technical checks are not a blanket compliance certification.
