-- Privacy controls are enforced here as well as in server forms. No service key
-- is needed by the application: authenticated RPCs derive their actor from JWT.

create table public.legal_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accepted_terms_version text not null,
  accepted_privacy_version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_read_own on public.legal_acceptances
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.legal_acceptances from public, anon, authenticated;
grant select on public.legal_acceptances to authenticated;

create function public.has_current_legal_acceptance()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.legal_acceptances a join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid()
      and a.accepted_terms_version = '2026-09-09'
      and a.accepted_privacy_version = '2026-09-09'
  );
$$;

create function public.accept_legal_documents(p_terms_version text, p_privacy_version text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (select 1 from auth.users where id = actor) then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_terms_version is distinct from '2026-09-09'
    or p_privacy_version is distinct from '2026-09-09' then
    raise exception 'Review the current legal documents.' using errcode = '22023';
  end if;
  insert into public.legal_acceptances (user_id, accepted_terms_version, accepted_privacy_version, accepted_at)
  values (actor, p_terms_version, p_privacy_version, now())
  on conflict (user_id) do update set
    accepted_terms_version = excluded.accepted_terms_version,
    accepted_privacy_version = excluded.accepted_privacy_version,
    accepted_at = excluded.accepted_at
  -- A retry of the same acceptance preserves its original server timestamp.
  where public.legal_acceptances.accepted_terms_version is distinct from excluded.accepted_terms_version
    or public.legal_acceptances.accepted_privacy_version is distinct from excluded.accepted_privacy_version;
end;
$$;

create function private.require_current_legal_acceptance()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  -- Database migrations/operator maintenance have no end-user JWT.
  if auth.uid() is not null and not public.has_current_legal_acceptance() then
    raise exception 'Accept the current Terms and Privacy Policy first.' using errcode = '42501';
  end if;
end;
$$;

create function private.require_legal_acceptance_for_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_current_legal_acceptance();
  return new;
end;
$$;
create trigger require_profile_legal_acceptance before insert on public.profiles
  for each row execute function private.require_legal_acceptance_for_insert();
create trigger require_contact_legal_acceptance before insert on public.private_contacts
  for each row execute function private.require_legal_acceptance_for_insert();

alter table public.rides add column cancelled_at timestamptz;
-- Existing cancellations already carry a server-controlled last-modification
-- timestamp. From this migration onward the first cancellation time is immutable.
update public.rides set cancelled_at = updated_at where status = 'cancelled';

create or replace function private.protect_ride()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.owner_id <> old.owner_id or new.id <> old.id or new.created_at <> old.created_at) then
    raise exception 'Ride ownership and identity cannot be changed.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    perform private.require_current_legal_acceptance();
    new.cancelled_at := case when new.status = 'cancelled' then now() else null end;
  else
    -- Cancellation remains available without renewed acceptance, but cannot be
    -- combined with publishing edits to bypass the acceptance requirement.
    if not (new.status = 'cancelled'
      and (to_jsonb(new) - array['status', 'updated_at', 'cancelled_at'])
        = (to_jsonb(old) - array['status', 'updated_at', 'cancelled_at'])) then
      perform private.require_current_legal_acceptance();
    end if;
    new.cancelled_at := coalesce(old.cancelled_at, case when new.status = 'cancelled' then now() else null end);
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

create function private.require_contact_request_legal_acceptance()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (new.status = 'accepted' and old.status is distinct from 'accepted') then
    perform private.require_current_legal_acceptance();
  end if;
  return new;
end;
$$;
create trigger require_contact_request_legal_acceptance before insert or update on public.contact_requests
  for each row execute function private.require_contact_request_legal_acceptance();

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'personal_information', 'illegal_activity', 'harassment', 'other')),
  explanation text check (explanation is null or char_length(explanation) <= 500),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  constraint one_report_per_user_listing unique (ride_id, reporter_id)
);
create index listing_reports_review_idx on public.listing_reports (status, created_at);
alter table public.listing_reports enable row level security;
create policy listing_reports_read_own on public.listing_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
-- Status can only be updated by database operators. There are no client-write
-- grants or moderation notes exposed by this table.
revoke all on public.listing_reports from public, anon, authenticated;
grant select (id, ride_id, reporter_id, reason, explanation, created_at) on public.listing_reports to authenticated;

create function public.report_listing(p_ride_id uuid, p_reason text, p_explanation text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result_id uuid;
  explanation_value text := nullif(btrim(p_explanation), '');
begin
  if actor is null or not exists (select 1 from auth.users where id = actor) then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('spam', 'scam', 'personal_information', 'illegal_activity', 'harassment', 'other')
    or char_length(explanation_value) > 500 then
    raise exception 'Choose a report reason and a short explanation.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rides where id = p_ride_id and status = 'active') then
    raise exception 'Listing is no longer available.' using errcode = '22023';
  end if;
  select id into result_id from public.listing_reports where ride_id = p_ride_id and reporter_id = actor;
  if result_id is not null then return result_id; end if;
  perform private.consume_rate_limit('report_listing', 5, 3600);
  perform private.consume_rate_limit('report_listing', 20, 86400);
  insert into public.listing_reports (ride_id, reporter_id, reason, explanation)
    values (p_ride_id, actor, p_reason, explanation_value)
    on conflict (ride_id, reporter_id) do nothing returning id into result_id;
  if result_id is null then
    select id into result_id from public.listing_reports where ride_id = p_ride_id and reporter_id = actor;
  end if;
  return result_id;
end;
$$;

create function public.delete_my_account(p_confirm boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (select 1 from auth.users where id = actor) then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_confirm is distinct from true then
    raise exception 'Confirm permanent account deletion.' using errcode = '22023';
  end if;
  -- There is deliberately no target-user argument. The Auth deletion cascades
  -- sessions/identities as maintained by Supabase, and all application-owned
  -- profile, contact, ride, request, report, acceptance and rate-limit data.
  delete from auth.users where id = actor;
  if not found then raise exception 'Account not found.' using errcode = '42501'; end if;
end;
$$;

create function private.run_retention_cleanup()
returns table (deleted_rides bigint, deleted_reports bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  -- No caller-controlled cutoff: maintenance cannot accidentally erase a future
  -- active ride. Related requests and reports follow the ride foreign keys.
  delete from public.listing_reports where created_at <= now() - interval '90 days';
  get diagnostics deleted_reports = row_count;
  delete from public.rides where
    (status = 'active' and departure_at <= now() - interval '90 days')
    or (status = 'cancelled'
      and least(departure_at, coalesce(cancelled_at, updated_at)) <= now() - interval '90 days');
  get diagnostics deleted_rides = row_count;
  return next;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.has_current_legal_acceptance(), public.accept_legal_documents(text, text),
  public.report_listing(uuid, text, text), public.delete_my_account(boolean) from public, anon, authenticated;
grant execute on function public.has_current_legal_acceptance(), public.accept_legal_documents(text, text),
  public.report_listing(uuid, text, text), public.delete_my_account(boolean) to authenticated;
