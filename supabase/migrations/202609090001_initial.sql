-- Tremp Austria: public listings, private profiles/contact details, and explicit consent.
-- No public view exposes an auth UUID or a contact value.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.ride_type as enum ('driver', 'passenger', 'taxi');
create type public.ride_direction as enum ('vienna_to_bts', 'bts_to_vienna');
create type public.ride_status as enum ('active', 'cancelled');
create type public.contact_method as enum ('whatsapp', 'telegram', 'email');
create type public.contact_request_status as enum ('pending', 'accepted', 'rejected', 'revoked');

-- A deliberately conservative accident-prevention check, not an address detector.
-- It also covers author names/areas, because these are as public as the note.
create function public.public_text_is_safe(value text)
returns boolean language sql immutable parallel safe
set search_path = ''
as $$
  select value is null or (
    value !~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
    and value !~ '(\+?[0-9][[:space:]().\-]*){7,}'
    and value !~* '(https?://|www\.|wa\.me|t\.me|mailto:|tel:)'
    and regexp_replace(value, E'[\\n\\r\\t]', '', 'g') !~ '[[:cntrl:]]'
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(btrim(display_name)) between 1 and 40
    and public.public_text_is_safe(display_name)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  method public.contact_method not null,
  value text not null check (char_length(value) between 3 and 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_contact_value check (
    (method = 'whatsapp' and value ~ '^\+[1-9][0-9]{6,14}$')
    or (method = 'telegram' and value ~ '^@?[A-Za-z][A-Za-z0-9_]{4,31}$')
    or (method = 'email' and value ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~\-]+@[A-Z0-9](?:[A-Z0-9.\-]*[A-Z0-9])?\.[A-Z]{2,}$')
  )
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  ride_type public.ride_type not null,
  direction public.ride_direction not null,
  departure_at timestamptz not null,
  flexibility_minutes smallint default 30 check (flexibility_minutes in (0, 30, 60, 120)),
  passenger_count smallint not null default 1 check (passenger_count between 1 and 8),
  available_seats smallint check (available_seats between 0 and 8),
  origin_area text not null check (char_length(btrim(origin_area)) between 2 and 80 and public.public_text_is_safe(origin_area)),
  destination_area text not null check (char_length(btrim(destination_area)) between 2 and 80 and public.public_text_is_safe(destination_area)),
  flight_number text check (flight_number is null or (flight_number ~ '^[A-Z0-9]{2,3}[ ]?[0-9]{1,4}[A-Z]?$' and public.public_text_is_safe(flight_number))),
  note text check (note is null or (char_length(note) <= 280 and public.public_text_is_safe(note))),
  status public.ride_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_seats_required check (ride_type <> 'driver' or available_seats is not null),
  constraint passenger_has_no_seats check (ride_type <> 'passenger' or available_seats is null)
);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status public.contact_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint not_self_contact check (requester_id <> owner_id),
  constraint one_request_per_ride unique (ride_id, requester_id)
);

create index rides_active_departure_idx on public.rides (departure_at) where status = 'active';
create index rides_matching_idx on public.rides (direction, ride_type, departure_at) where status = 'active';
create index rides_owner_idx on public.rides (owner_id, departure_at desc);
create index contact_requests_owner_idx on public.contact_requests (owner_id, created_at desc);
create index contact_requests_requester_idx on public.contact_requests (requester_id, created_at desc);
create index contact_requests_accepted_idx on public.contact_requests (owner_id, requester_id) where status = 'accepted';

-- Private counters survive deletion of rides/requests and serialize concurrent writes.
-- Bounded to one row per account/action/window size, with no cleanup job required.
create table private.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_seconds integer not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (user_id, action, window_seconds)
);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

create function private.consume_rate_limit(p_action text, p_max integer, p_seconds integer)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_seconds) * p_seconds);
  total integer;
begin
  -- Migrations/service maintenance without a user JWT are not end-user writes.
  if actor is null then return; end if;
  insert into private.rate_limits (user_id, action, window_seconds, window_start, count)
  values (actor, p_action, p_seconds, bucket, 1)
  on conflict (user_id, action, window_seconds) do update
    set window_start = excluded.window_start,
        count = case when private.rate_limits.window_start = excluded.window_start
          then private.rate_limits.count + 1 else 1 end
  returning count into total;
  if total > p_max then
    raise exception 'Too many requests. Please try again later.' using errcode = 'P0001';
  end if;
end;
$$;

create function private.protect_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.created_at <> old.created_at) then
    raise exception 'Profile identity cannot be changed.' using errcode = '42501';
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end;
$$;
create trigger protect_profile before insert or update on public.profiles
for each row execute function private.protect_profile();

create function private.protect_private_contact()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.created_at <> old.created_at) then
    raise exception 'Contact identity cannot be changed.' using errcode = '42501';
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end;
$$;
create trigger protect_private_contact before insert or update on public.private_contacts
for each row execute function private.protect_private_contact();

create function private.protect_ride()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.owner_id <> old.owner_id or new.id <> old.id or new.created_at <> old.created_at) then
    raise exception 'Ride ownership and identity cannot be changed.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or new.departure_at is distinct from old.departure_at then
    if new.departure_at < now() - interval '15 minutes' or new.departure_at > now() + interval '366 days' then
      raise exception 'Choose a departure in the next year.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' then
    perform private.consume_rate_limit('create_ride', 12, 3600);
    perform private.consume_rate_limit('create_ride', 30, 86400);
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger protect_ride before insert or update on public.rides
for each row execute function private.protect_ride();

create function private.protect_contact_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.ride_id <> old.ride_id or new.requester_id <> old.requester_id
    or new.owner_id <> old.owner_id or new.created_at <> old.created_at
  ) then
    raise exception 'Contact request relationships cannot be changed.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.owner_id is distinct from (select owner_id from public.rides where id = new.ride_id) then
      raise exception 'Request owner must own this ride.' using errcode = '42501';
    end if;
    perform private.consume_rate_limit('request_contact', 20, 3600);
    perform private.consume_rate_limit('request_contact', 50, 86400);
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger protect_contact_request before insert or update on public.contact_requests
for each row execute function private.protect_contact_request();

alter table public.profiles enable row level security;
alter table public.private_contacts enable row level security;
alter table public.rides enable row level security;
alter table public.contact_requests enable row level security;

create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy rides_read_own on public.rides for select to authenticated using (owner_id = (select auth.uid()));
create policy rides_insert_own on public.rides for insert to authenticated with check (owner_id = (select auth.uid()));
create policy rides_update_own on public.rides for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy rides_delete_own on public.rides for delete to authenticated using (owner_id = (select auth.uid()));

create policy requests_read_participant on public.contact_requests for select to authenticated
using (requester_id = (select auth.uid()) or owner_id = (select auth.uid()));
-- Request writes are intentionally RPC-only; callers cannot supply either participant ID.

create policy contacts_read_consented on public.private_contacts for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.contact_requests cr
    where cr.status = 'accepted' and (
      (cr.requester_id = (select auth.uid()) and cr.owner_id = private_contacts.user_id)
      or (cr.owner_id = (select auth.uid()) and cr.requester_id = private_contacts.user_id)
    )
  )
);
create policy contacts_insert_own on public.private_contacts for insert to authenticated with check (user_id = (select auth.uid()));
create policy contacts_update_own on public.private_contacts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy contacts_delete_own on public.private_contacts for delete to authenticated using (user_id = (select auth.uid()));

-- Intentionally runs as its owner: base tables expose only a user's own data.
-- The security barrier and explicit projection are the public privacy boundary.
create view public.public_rides with (security_barrier = true) as
select r.id, r.ride_type, r.direction, r.departure_at, r.flexibility_minutes,
  r.passenger_count, r.available_seats, r.origin_area, r.destination_area,
  r.flight_number, r.note, r.status, r.created_at, r.updated_at, p.display_name
from public.rides r join public.profiles p on p.id = r.owner_id
where r.status = 'active';
comment on view public.public_rides is 'Public projection. Deliberately omits owner/auth UUIDs and private contact fields. Callers filter departure_at for an upcoming feed.';

create function public.request_contact(p_ride_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ride_owner uuid;
  result_id uuid;
begin
  if actor is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select owner_id into ride_owner from public.rides
    where id = p_ride_id and status = 'active' and departure_at >= now()
    for share;
  if ride_owner is null then raise exception 'Ride is no longer available.' using errcode = '22023'; end if;
  if ride_owner = actor then raise exception 'Cannot contact yourself.' using errcode = '22023'; end if;
  if not exists (select 1 from public.private_contacts where user_id = actor)
    or not exists (select 1 from public.private_contacts where user_id = ride_owner) then
    raise exception 'Both participants need a private contact method.' using errcode = '22023';
  end if;
  -- Retrying a request is idempotent, including after rejection/revocation.
  select id into result_id from public.contact_requests where ride_id = p_ride_id and requester_id = actor;
  if result_id is not null then return result_id; end if;
  insert into public.contact_requests (ride_id, requester_id, owner_id)
    values (p_ride_id, actor, ride_owner)
    on conflict (ride_id, requester_id) do nothing
    returning id into result_id;
  if result_id is null then
    select id into result_id from public.contact_requests where ride_id = p_ride_id and requester_id = actor;
  end if;
  return result_id;
end;
$$;

create function public.respond_contact_request(p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('accepted', 'rejected') then
    raise exception 'Choose accepted or rejected.' using errcode = '22023';
  end if;
  update public.contact_requests set status = p_status::public.contact_request_status
    where id = p_request_id and owner_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pending request not found.' using errcode = '42501'; end if;
end;
$$;

create function public.revoke_contact_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  update public.contact_requests set status = 'revoked'
    where id = p_request_id and (owner_id = auth.uid() or requester_id = auth.uid())
      and status in ('pending', 'accepted');
  if not found then raise exception 'Open request not found.' using errcode = '42501'; end if;
end;
$$;

create function public.get_my_contact_requests()
returns table (
  id uuid, ride_id uuid, status public.contact_request_status,
  created_at timestamptz, updated_at timestamptz, is_owner boolean,
  requester_display_name text, owner_display_name text
) language sql stable security definer set search_path = ''
as $$
  select cr.id, cr.ride_id, cr.status, cr.created_at, cr.updated_at,
    cr.owner_id = auth.uid(), requester.display_name, owner.display_name
  from public.contact_requests cr
  join public.profiles requester on requester.id = cr.requester_id
  join public.profiles owner on owner.id = cr.owner_id
  where auth.uid() is not null and (cr.requester_id = auth.uid() or cr.owner_id = auth.uid())
  order by cr.created_at desc;
$$;

create function public.get_request_contact(p_request_id uuid)
returns table (method public.contact_method, value text)
language sql stable security invoker set search_path = ''
as $$
  select pc.method, pc.value
  from public.contact_requests cr
  join public.private_contacts pc on pc.user_id = case
    when cr.requester_id = auth.uid() then cr.owner_id else cr.requester_id end
  where cr.id = p_request_id and cr.status = 'accepted'
    and (cr.requester_id = auth.uid() or cr.owner_id = auth.uid());
$$;

-- Explicit grants avoid Supabase's broad default table/function grants.
revoke all on public.profiles, public.private_contacts, public.rides, public.contact_requests, public.public_rides from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.public_rides to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.private_contacts, public.rides to authenticated;
grant select on public.contact_requests to authenticated;
revoke all on function public.public_text_is_safe(text) from public, anon;
grant execute on function public.public_text_is_safe(text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.request_contact(uuid), public.respond_contact_request(uuid, text),
  public.revoke_contact_request(uuid), public.get_my_contact_requests(), public.get_request_contact(uuid)
  from public, anon, authenticated;
grant execute on function public.request_contact(uuid), public.respond_contact_request(uuid, text),
  public.revoke_contact_request(uuid), public.get_my_contact_requests(), public.get_request_contact(uuid)
  to authenticated;
