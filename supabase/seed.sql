-- LOCAL DEVELOPMENT ONLY. Synthetic names and reserved .invalid contacts.
-- These fixtures have no password or identity and cannot log in. Never seed production.
begin;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo-noam@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'demo-maya@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'demo-daniel@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'demo-tamar@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}')
on conflict (id) do nothing;

insert into public.profiles (id, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'נועם'),
  ('10000000-0000-4000-8000-000000000002', 'מאיה'),
  ('10000000-0000-4000-8000-000000000003', 'דניאל'),
  ('10000000-0000-4000-8000-000000000004', 'תמר')
on conflict (id) do nothing;

insert into public.private_contacts (user_id, method, value) values
  ('10000000-0000-4000-8000-000000000001', 'email', 'demo-noam@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'email', 'demo-maya@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'email', 'demo-daniel@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'email', 'demo-tamar@example.invalid')
on conflict (user_id) do nothing;

-- Backdating is only needed for the past-ride fixture. The trigger is restored
-- in this transaction, so a seed failure cannot leave it disabled.
alter table public.rides disable trigger protect_ride;
with local_date as (
  select (now() at time zone 'Europe/Vienna')::date as today
), fixture(id_suffix, owner_suffix, kind, direction, day_offset, departure_time, flex, passengers, seats, origin, destination, flight, note, status) as (
  values
    ('001', '001', 'driver', 'vienna_to_bts', 1, '08:00', 30, 1, 3, 'לאופולדשטאדט', 'שדה התעופה ברטיסלבה', 'W6 2327', 'יוצא אחרי קפה של בוקר. יש מקום גם למזוודות.', 'active'),
    ('002', '002', 'passenger', 'vienna_to_bts', 1, '08:30', 60, 2, null, 'פראטר', 'שדה התעופה ברטיסלבה', null, 'אנחנו שניים, עם מזוודה אחת קטנה.', 'active'),
    ('003', '003', 'taxi', 'bts_to_vienna', 1, '23:30', 60, 2, 2, 'שדה התעופה ברטיסלבה', 'מרכז וינה', 'FR 1024', 'נוחתים מאוחר ומחפשים עוד שותפים למונית.', 'active'),
    ('004', '004', 'taxi', 'bts_to_vienna', 1, '23:45', 30, 1, 2, 'שדה התעופה ברטיסלבה', 'וינה', null, 'גמישה באזור ההורדה בתוך העיר.', 'active'),
    ('005', '002', 'driver', 'bts_to_vienna', 2, '14:00', 0, 1, 1, 'שדה התעופה ברטיסלבה', 'לנדשטראסה', null, 'חוזרת בצהריים, מקום לתיק גב.', 'active'),
    ('006', '004', 'passenger', 'bts_to_vienna', 2, '13:45', 30, 1, null, 'שדה התעופה ברטיסלבה', 'וינה', null, 'מחפשת מקום אחד בחזרה לעיר.', 'active'),
    ('007', '003', 'driver', 'vienna_to_bts', 3, '10:00', null, 1, 2, 'מרכז וינה', 'שדה התעופה ברטיסלבה', null, 'אפשר לתאם את שעת היציאה, אני גמיש.', 'active'),
    ('008', '001', 'driver', 'vienna_to_bts', 3, '16:00', 120, 1, 0, 'דונאושטאדט', 'שדה התעופה ברטיסלבה', null, 'כרגע כל המקומות מלאים.', 'active'),
    ('009', '004', 'passenger', 'vienna_to_bts', 4, '06:00', 30, 3, null, 'אלזרגרונד', 'שדה התעופה ברטיסלבה', 'W6 2341', 'שלושה נוסעים עם תיקים קטנים, לטיסת בוקר.', 'active'),
    ('010', '002', 'taxi', 'vienna_to_bts', 5, '12:30', 60, 2, 2, 'תחנת הרכבת המרכזית', 'שדה התעופה ברטיסלבה', null, 'מחפשים שותפים לנסיעה בשעות הצהריים.', 'active'),
    ('011', '001', 'driver', 'bts_to_vienna', -1, '20:00', 30, 1, 2, 'שדה התעופה ברטיסלבה', 'וינה', null, 'נסיעת עבר לבדיקת האזור האישי.', 'active'),
    ('012', '003', 'passenger', 'vienna_to_bts', 2, '09:00', 60, 1, null, 'וינה', 'שדה התעופה ברטיסלבה', null, 'הרשומה בוטלה לצורך בדיקת התצוגה האישית.', 'cancelled')
)
insert into public.rides (
  id, owner_id, ride_type, direction, departure_at, flexibility_minutes,
  passenger_count, available_seats, origin_area, destination_area, flight_number, note, status
)
select
  ('20000000-0000-4000-8000-000000000' || id_suffix)::uuid,
  ('10000000-0000-4000-8000-000000000' || owner_suffix)::uuid,
  kind::public.ride_type, direction::public.ride_direction,
  ((today + day_offset) + departure_time::time) at time zone 'Europe/Vienna',
  flex, passengers, seats, origin, destination, flight, note, status::public.ride_status
from fixture cross join local_date
on conflict (id) do nothing;
alter table public.rides enable trigger protect_ride;
commit;
