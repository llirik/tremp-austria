# Database and authorization

Run `supabase start` and `supabase db reset` for local Supabase. The local seed is synthetic and has no passwords or usable identities. Production uses `supabase db push` without `--include-seed`. Never run `seed.sql` against production.

All application tables use RLS. The `anon` role has SELECT access only to `public_rides`, an explicit, read-only projection of active listings and an author's display name. Its owner privileges are intentional: the underlying rides and profiles restrict direct access to the account's own rows. The view uses a security barrier and omits `owner_id`, authentication IDs, emails and all other private contact fields. An active past listing remains accessible through its share link; the default feed must filter `departure_at >= now()`.

`profiles` stores an account ID and display name. Only the account can read or modify its profile directly. `private_contacts` is separate and has owner-only writes. Read access is either to one's own contact or to the other participant of an accepted request. `contact_requests` is directly readable only by its participants; clients cannot insert, update or delete its rows directly. Definer functions have a fixed empty search path, qualified object references, explicit caller checks and limited EXECUTE grants.

## Application interface

Use the ordinary Supabase user session for all calls. The application does not need a service-role key.

- `public_rides`: `id, ride_type, direction, departure_at, flexibility_minutes, passenger_count, available_seats, origin_area, destination_area, flight_number, note, status, created_at, updated_at, display_name`.
- `rides`: own rows only, plus `owner_id`. Use normal insert/update/delete with the user's session. The default `owner_id` is `auth.uid()`, and RLS prevents impersonation. Owner, ID and creation timestamp are immutable.
- `profiles`: upsert `{ id: user.id, display_name }`.
- `private_contacts`: upsert `{ user_id: user.id, method, value }`. Methods are `whatsapp` (international `+` number), `telegram` (username with optional `@`) or `email`.
- `request_contact({ p_ride_id })` returns the request UUID. It derives the requester and owner, requires both to have private contacts, rejects one's own ride and unavailable rides, and is idempotent. Rejected or revoked requests cannot be silently reopened by the requester.
- `respond_contact_request({ p_request_id, p_status })` accepts `accepted` or `rejected`, returns void, and requires the owner of a pending request.
- `revoke_contact_request({ p_request_id })` returns void. Either participant may revoke a pending or accepted request.
- `get_my_contact_requests()` returns `id, ride_id, status, created_at, updated_at, is_owner, requester_display_name, owner_display_name`. It exposes no account IDs and only includes the caller's relationships.
- `get_request_contact({ p_request_id })` returns zero or one `{ method, value }` row. It returns the counterpart's contact only for an accepted request involving the caller.

`ride_type`: `driver | passenger | taxi`. `direction`: `vienna_to_bts | bts_to_vienna`. `status`: `active | cancelled`. Flexibility is `0 | 30 | 60 | 120 | null`; null means flexible. `passenger_count` is 1–8. `available_seats` is 0–8, required for drivers, null for passengers, and optional for taxi shares.

RLS checks consent on every read. Revoking a request removes access through that request immediately; another accepted request between the same pair still grants contact access. Information already copied outside the app cannot be recalled. Cancelling a listing hides it publicly but does not revoke existing accepted contacts. Deleting a listing cascades its requests and removes those relationships.

The database rejects obvious email addresses, long phone-like strings, URLs and non-whitespace control characters in all public free-text fields. Ordinary note line breaks and tabs are permitted. This is an accident-prevention measure, not a reliable detector for exact addresses or deliberately obfuscated contact information. The UI must also ask for approximate areas and warn users about public text.

Creation is limited per account to 12 rides/hour and 30/day; contact requests to 20/hour and 50/day. Private, atomic counters survive deleting content and use bounded storage. These simple limits complement Supabase Auth email limits; they are not a complete moderation system.

## Verification

Run `pnpm test:db`. The harness applies the actual migration to PostgreSQL through PGlite and exercises grants, RLS and RPCs as the `anon` and `authenticated` roles. It provides only the Supabase `auth.users`, `auth.uid()` and role primitives locally. It does not replace the policies or mock SQL behavior. The tests also execute the local seed and verify public/private projections and lifecycle constraints. Hosted Supabase additionally needs correct Auth redirect URLs and an end-to-end magic-link check.
