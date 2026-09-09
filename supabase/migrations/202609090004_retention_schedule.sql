-- Supabase's PostgreSQL service supports pg_cron without an application secret
-- or a separate server. The embedded PostgreSQL test engine lacks pg_cron;
-- only the scheduling branch is skipped there, never the cleanup function.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'tremp-retention-daily',
      '15 3 * * *',
      'select * from private.run_retention_cleanup();'
    );
  else
    raise notice 'pg_cron is unavailable: configure a trusted daily invocation of private.run_retention_cleanup().';
  end if;
end;
$$;
