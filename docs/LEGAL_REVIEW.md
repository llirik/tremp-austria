# Legal and privacy implementation review

Reviewed 9 September 2026. This is an engineering record of the implemented notice, service boundaries and unresolved legal questions; it is not an Austrian legal opinion or a guarantee of compliance.

Operator address updated 10 September 2026 using the full postal address supplied and authorized for publication by the operator, whose instruction cited WKO Tirol guidance requiring a ladungsfähige postalische Anschrift. The underlying correspondence has not been reviewed.

## Operator supplied for publication

- Operator, media owner and data controller: **Kirill Vodopianov**.
- Postal address: **Kaiserstraße 63, 6370 Reith bei Kitzbühel, Austria**.
- Legal and privacy contact: **tremp.austria@gmail.com**.

The supplied full postal address replaces the earlier Gemeinde-only notice. No private telephone number, company number or tax registration has been inferred or published. The operator should verify that this exact mailbox exists, receives mail and is monitored; application code cannot establish that.

## Published address and notice classification

The media-owner disclosure in [Mediengesetz § 25](https://ris.bka.gv.at/eli/bgbl/1981/314/P25/NOR40134353) uses the owner's name and place of residence or seat. Its reduced disclosure rule in paragraph 5 depends on the medium's content and capacity to influence public opinion. It is **not** a general exemption for every free website. The Impressum identifies the individual owner, full postal address, purpose and basic direction of this community board without assuming a corporate form. The [current consolidated Mediengesetz](https://www.ris.bka.gv.at/geltendefassung.wxe?abfrage=bundesnormen&gesetzesnummer=10000719) also contains § 25a, effective from May 2026, for qualifying media-service providers; its applicability must not be inferred merely from operating a website.

A different rule applies if this activity is an information-society service within [ECG § 3](https://ris.bka.gv.at/eli/bgbl/i/2001/152/P3/NOR40258259): [ECG § 5(1)(2)](https://ris.bka.gv.at/eli/bgbl/i/2001/152/P5/NOR40025801) then requires the geographic address where the provider is established. A Gemeinde alone would not meet that separate address requirement. “Free to the user” does not by itself settle the statutory economic-service classification.

The supplied operating facts are that this board is free, non-commercial, volunteer operated and has no advertising, fares, commissions, paid priority or transportation payments. Publishing the operator-supplied full postal address resolves the previously missing address detail; no further address is being requested or inferred. The operating facts do not establish a binding exemption from other notice obligations. Revisit the notice classification if the operation, funding, editorial content or commercial use changes.

## GDPR purposes and legal bases

The privacy page is mapped to the application schema and authentication code. It distinguishes intentional public listings from authentication metadata, private contact details, contact requests, report records and acceptance records. The selected public name is separate from Google account metadata. Only an accepted contact relationship authorizes participants to read each other's private contact details; revoking one request does not revoke another accepted relationship.

The stated basis for requested account, listing and coordination functions is GDPR Article 6(1)(b). Reasonable security, abuse controls and report handling use Article 6(1)(f), with the specific service-integrity interest stated. Accepting Terms and acknowledging the Privacy Policy is not treated as GDPR consent. Mandatory account fields support only their requested functionality; browsing remains open. The notice includes retention criteria, recipients, international-processing information and applicable access, correction, erasure, restriction, objection and portability rights. [GDPR Articles 5, 6, 12–21, 28 and 44–49](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) are the underlying framework.

The operator must maintain a proportionate assessment of the security/moderation legitimate interest, respond to rights requests, and handle any real restriction request or incident. These require operational judgment, not another checkbox. Complaints can be made to the [Österreichische Datenschutzbehörde](https://dsb.gv.at/eingabe-an-die-dsb/beschwerde); the public page does not reproduce unnecessary authority addresses or phone numbers.

## Providers, contracts and international processing

Google supplies OAuth identity; Supabase provides Auth and the PostgreSQL database; Vercel hosts the application. The public policy describes these functions rather than assigning every piece of their processing the same legal role. The production OAuth redirect requests only `email` and `profile`; Google Cloud also permits the basic `openid` scope, but the current Supabase flow does not request it. There is no Gmail, Contacts, Calendar or Drive permission and no offline-access request in the application.

Primary provider references reviewed:

- [Google Privacy Policy](https://policies.google.com/privacy) and [Google international data-transfer frameworks](https://policies.google.com/privacy/frameworks).
- [Supabase GDPR and residency documentation](https://supabase.com/docs/guides/security/gdpr-compliance): the chosen EU region covers the primary database/Auth deployment; other processing, logs, backups and subprocessors require separate consideration.
- [Supabase DPA](https://supabase.com/legal/dpa), including its SCC provisions, and [Supabase Privacy Policy](https://supabase.com/privacy).
- [Vercel DPA](https://vercel.com/legal/dpa), including distinct roles for customer and service-generated data and cross-border transfer provisions, and [Vercel Privacy Notice](https://vercel.com/legal/privacy-policy).

These public documents describe provider arrangements; reading them does not prove the precise contractual version, customer details, subprocessor scope or transfer assessment for this operator's accounts. The operator should retain applicable provider agreement records and confirm the actual transfers and safeguards, making additional information available to users on request. Frankfurt hosting is not a promise that all processing remains in the EU. Provider-controlled logs and backups follow provider retention and deletion processes; the app cannot instantly purge them or assign an invented duration.

## Parallel Cloudflare candidate and DPA record

On 10 September 2026, [Cloudflare Workers Free](https://tremp-austria.tremp-austria.workers.dev) is a parallel migration candidate. Vercel remains the live production host and has not been retired. Cutover is held because observed server-rendering CPU use exceeds Free's nominal 10 ms request budget; [OPERATIONS.md](OPERATIONS.md) records the diagnostic limits and verification status. Successful test responses do not establish sustained hosting suitability.

The requested migration seeks a clearer self-service hosting/data-processing contractual setup for this non-commercial EU service. It does not establish that the prior Vercel setup was unlawful. Supabase Frankfurt and Google OAuth remain unchanged. If cutover becomes safe, Cloudflare will be described conservatively as application hosting/edge infrastructure, without claiming exclusively EU processing. The production Privacy provider update is deferred; current Terms/Privacy acknowledgment versions remain `2026-09-09`, and no historical acceptance record or timestamp is changed.

| Field                           | Official reference checked for the self-service candidate                      |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Provider                        | Cloudflare, Inc.                                                               |
| Document title                  | Cloudflare Data Processing Addendum                                            |
| Official URL                    | [Cloudflare Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) |
| Explicit version/effective date | Version 6.4, effective April 3, 2026                                           |
| Date checked                    | 10 September 2026                                                              |

The [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) (last updated September 12, 2025) covers Free Services in section 2.6 and incorporates the DPA for covered personal data in section 6.1. Cloudflare's [GDPR FAQ for self-service customers](https://www.cloudflare.com/trust-hub/gdpr/) says no additional action is needed for the transfer mechanisms incorporated through its standard self-service DPA. These public references do not evidence a separate mandatory DPA-signing step. They do not verify this account's contracting identity, acceptance history or any account-specific override; the operator should retain the applicable account agreement records and resolve any discrepancy with Cloudflare. [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/) distinguishes processing on customers' behalf from its own processing of certain service information.

A future provider-only disclosure can be separated from the application's required acknowledgment edition where purposes, legal bases, data categories, visibility, retention and rights remain unchanged. That is not a new consent basis or proof that historical acceptance covers awareness of a later provider. The [EDPB transparency guidance](https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf) calls for effective notification of material changes; appropriate communication and timing must be assessed at cutover. No new provider notice, reacceptance prompt or completed migration is claimed at this checkpoint.

## Retention, deletion and reports

Migrations `202609090003_privacy_controls.sql` and `202609090004_retention_schedule.sql` implement the policy. Eligible expired/cancelled rides are deleted 90 days after the applicable event, with dependent contact requests and reports removed through foreign-key cascades. Cancellation uses the earlier of the first cancellation and departure time, preventing later edits from extending retention. Reports also expire 90 days after creation, including pending reports. The daily PostgreSQL job is `tremp-retention-daily` at 03:15 UTC. Deployments must verify that the job is installed, active and executing; infrastructure pauses or failures require recovery and catch-up. Do not claim automatic cleanup on a deployment that only has the cleanup function.

Self-service deletion removes the current user's Supabase Auth record, profile, private contacts, owned rides, related requests, submitted reports, acceptance record and rate counters. No application service-role secret is introduced. Deletion does not remove the user's Google account, revoke an external Google permission grant, erase copies already saved by another participant or instantly remove provider backups/logs.

Reports are authenticated, private and reviewed by the operator in the Supabase dashboard/database. There is no automated email notification or promise of immediate moderation. Operational instructions and SQL are maintained in the project documentation. The operator should regularly review reports before the 90-day cleanup, avoid making personal exports, and monitor the contact mailbox. Allegations in a report are unverified; the app is not a register of criminal convictions. Do not seek identity documents or sensitive personal information when a short description of the listing issue suffices.

## Cookies and tracking

The code audit found authentication/session cookies and no analytics, advertising SDK, tracking pixel or fingerprinting implementation. Fonts are bundled locally. The app does not add a consent banner for strictly necessary login mechanisms; [TKG 2021 § 165(3)](https://www.ris.bka.gv.at/Dokumente/Bundesnormen/NOR40238623/NOR40238623.pdf) distinguishes strictly necessary storage/access from consent-dependent use. This does not authorize adding analytics later under the same notice. Production network behavior and any account-level Vercel injection or telemetry setting should be checked separately from repository source.

## Service boundary and questions code cannot resolve

The UI and Terms describe a coordination board, not a carrier, taxi dispatcher, booking agent or paid transport service. They prohibit unlawful/unlicensed commercial passenger transport and make users responsible for checking licensing, insurance, vehicle safety and their direct arrangements. They do not decide whether a particular real trip or expense-sharing arrangement is lawful. Liability is limited only where applicable law permits, without overriding mandatory Austrian/EU rules.

Remaining operational/legal decisions include the applicable notice obligations, the operator's provider agreements and transfer assessment, handling individual rights requests and abuse, and transport-law classification of actual use. Whether the Digital Services Act or further Austrian obligations apply must be assessed against the real operating model; a small user-report form alone is not a claim of DSA compliance. The project introduces no age collection or special children's flow; if use by children becomes intended, reassess the contract/privacy requirements before targeting them.
