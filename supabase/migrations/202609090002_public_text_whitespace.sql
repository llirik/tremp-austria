-- A public note is a textarea: ordinary line breaks and tabs are valid.
-- Keep rejecting other controls as well as obvious contact information.
create or replace function public.public_text_is_safe(value text)
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
