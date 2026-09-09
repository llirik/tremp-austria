import { Temporal } from '@js-temporal/polyfill';

export const TIME_ZONE = 'Europe/Vienna';
export const rideTypes = { driver: 'יש לי מקום', passenger: 'מחפש טרמפ', taxi: 'שותפים למונית' } as const;
export const directions = {
  vienna_to_bts: { from: 'וינה', to: 'שדה התעופה ברטיסלבה', label: 'וינה ← שדה התעופה ברטיסלבה' },
  bts_to_vienna: { from: 'שדה התעופה ברטיסלבה', to: 'וינה', label: 'שדה התעופה ברטיסלבה ← וינה' }
} as const;
export type RideType = keyof typeof rideTypes;
export type Direction = keyof typeof directions;
export interface RideInput {
  ride_type: RideType;
  direction: Direction;
  departure_at: string;
  flexibility_minutes: number | null;
  passenger_count: number;
  available_seats: number | null;
  origin_area: string;
  destination_area: string;
  flight_number: string | null;
  note: string | null;
}
export interface Ride extends RideInput {
  id: string;
  display_name: string;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

export function localDate(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function localTime(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
export const timeLabel = localTime;
export function dateLabel(value: string | Date): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value));
}
export function flexibilityLabel(minutes: number | null): string {
  return minutes === null ? 'שעה גמישה' : minutes === 0 ? 'בשעה מדויקת' : minutes === 30 ? 'חצי שעה לכאן או לכאן' : minutes === 60 ? 'שעה לכאן או לכאן' : 'שעתיים לכאן או לכאן';
}
export function localDeparture(date: string, time: string): string {
  // Reject both nonexistent spring-forward and ambiguous fall-back local times.
  return Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(TIME_ZONE, { disambiguation: 'reject' }).toInstant().toString();
}
export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function safeNext(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, 'https://tremp.invalid');
    if (parsed.origin !== 'https://tremp.invalid' || parsed.pathname.startsWith('/auth/') || parsed.pathname === '/login') return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch { return fallback; }
}
export function validatePublicText(value: string): string | null {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) || /(?:\+?\d[\s().-]*){7,}/.test(value) || /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/)/i.test(value)) {
    return 'פרטי קשר וקישורים נשארים פרטיים. יש להסיר אותם מהטקסט הציבורי.';
  }
  return null;
}
export function parseRide(form: FormData, now = new Date()): { data?: RideInput; error?: string } {
  const get = (key: string) => String(form.get(key) ?? '').trim();
  const type = get('ride_type');
  const direction = get('direction');
  if (!Object.hasOwn(rideTypes, type) || !Object.hasOwn(directions, direction)) return { error: 'יש לבחור סוג נסיעה וכיוון.' };
  const date = get('departure_date');
  const time = get('departure_time');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: 'יש לבחור תאריך ושעה תקינים.' };
  let departure: string;
  try { departure = localDeparture(date, time); } catch { return { error: 'השעה אינה חד־משמעית בגלל מעבר שעון. יש לבחור שעה אחרת.' }; }
  const delta = new Date(departure).getTime() - now.getTime();
  if (delta < 0 || delta > 366 * 86400000) return { error: 'יש לבחור מועד עתידי במהלך השנה הקרובה.' };
  const flex = get('flexibility_minutes');
  if (!['0', '30', '60', '120', 'flexible', ''].includes(flex)) return { error: 'יש לבחור גמישות תקינה.' };
  const passengers = type === 'driver' ? 1 : Number(get('passenger_count'));
  const seats = type === 'driver' ? Number(get('available_seats')) : null;
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 8 || (seats !== null && (!Number.isInteger(seats) || seats < 0 || seats > 8))) return { error: 'מספר הנוסעים או המקומות חייב להיות בין 1 ל־8 (אפשר לסמן רכב מלא עם 0 מקומות).' };
  const origin = get('origin_area');
  const destination = get('destination_area');
  const note = get('note');
  if (origin.length < 2 || destination.length < 2 || origin.length > 80 || destination.length > 80) return { error: 'יש להזין אזור איסוף ויעד, בין 2 ל־80 תווים.' };
  if (note.length > 280) return { error: 'ההערה יכולה להכיל עד 280 תווים.' };
  for (const text of [origin, destination, note]) { const error = validatePublicText(text); if (error) return { error }; }
  const flight = get('flight_number').toUpperCase();
  if (flight && !/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/.test(flight)) return { error: 'מספר הטיסה אינו תקין. לדוגמה: W6 1234.' };
  return { data: { ride_type: type as RideType, direction: direction as Direction, departure_at: departure, flexibility_minutes: flex === '' || flex === 'flexible' ? null : Number(flex), passenger_count: passengers, available_seats: seats, origin_area: origin, destination_area: destination, flight_number: flight || null, note: note || null } };
}

/** Flexible means any time on the same Vienna calendar day. Otherwise intersect ± windows. */
export function isPotentialMatch(a: Ride, b: Ride): boolean {
  if (a.id === b.id || a.status !== 'active' || b.status !== 'active' || a.direction !== b.direction) return false;
  const compatible = (a.ride_type === 'taxi' && b.ride_type === 'taxi') ||
    (a.ride_type === 'driver' && b.ride_type === 'passenger' && (a.available_seats ?? 0) >= b.passenger_count) ||
    (b.ride_type === 'driver' && a.ride_type === 'passenger' && (b.available_seats ?? 0) >= a.passenger_count);
  if (!compatible) return false;
  if (a.flexibility_minutes === null || b.flexibility_minutes === null) return localDate(a.departure_at) === localDate(b.departure_at);
  return Math.abs(Date.parse(a.departure_at) - Date.parse(b.departure_at)) <= (a.flexibility_minutes + b.flexibility_minutes) * 60000;
}
export function potentialMatches(ride: Ride, rides: Ride[]): Ride[] { return rides.filter((candidate) => isPotentialMatch(ride, candidate)); }
export function shareText(ride: Ride, url: string): string {
  const route = directions[ride.direction];
  const count = ride.ride_type === 'driver' ? `יש ${ride.available_seats} מקומות פנויים` : ride.ride_type === 'taxi' ? `${ride.passenger_count} נוסעים מחפשים שותפים למונית` : `${ride.passenger_count} נוסעים מחפשים טרמפ`;
  return `${route.from} ← ${route.to}, ${dateLabel(ride.departure_at)} ב־${timeLabel(ride.departure_at)}. ${count}.\n${url}`;
}
