import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeNext, type Ride } from '../domain';

export const rideColumns = 'id,ride_type,direction,departure_at,flexibility_minutes,passenger_count,available_seats,origin_area,destination_area,flight_number,note,status,created_at';
export const publicRideColumns = `${rideColumns},display_name`;
export const rideFormFields = ['ride_type', 'direction', 'departure_date', 'departure_time', 'flexibility_minutes', 'passenger_count', 'available_seats', 'origin_area', 'destination_area', 'flight_number', 'note'];
export const unavailableMessage = 'החיבור לשירות עדיין לא הושלם. אפשר לחזור ללוח ולנסות שוב בהמשך.';
export type PrivateContact = { method: 'whatsapp' | 'telegram' | 'email'; value: string };
export type Profile = { display_name: string };
export type ContactRequest = {
	id: string; ride_id: string; status: 'pending' | 'accepted' | 'rejected' | 'revoked';
	created_at: string; updated_at: string; is_owner: boolean;
	requester_display_name: string; owner_display_name: string;
};

export function requireUser(event: RequestEvent, next = event.url.pathname + event.url.search) {
	if (!event.locals.user) redirect(303, `/login?next=${encodeURIComponent(safeNext(next))}`);
	if (!event.locals.supabase || event.locals.demo) error(503, unavailableMessage);
	return { user: event.locals.user, supabase: event.locals.supabase };
}

export function validId(value: string | null | undefined): value is string {
	return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

/** Echo only known fields after validation failures, including without JavaScript. */
export function formValues(form: FormData, fields: string[]): Record<string, string> {
	return Object.fromEntries(fields.map((field) => {
		const value = form.get(field);
		return [field, typeof value === 'string' ? value.slice(0, 1000) : ''];
	}));
}

export async function getProfile(supabase: SupabaseClient, userId: string) {
	const [profile, contact] = await Promise.all([
		supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
		supabase.from('private_contacts').select('method,value').eq('user_id', userId).maybeSingle()
	]);
	if (profile.error || contact.error) error(503, 'לא הצלחנו לטעון את הפרופיל. נסו שוב בעוד רגע.');
	return { profile: profile.data as Profile | null, contact: contact.data as PrivateContact | null, complete: Boolean(profile.data?.display_name && contact.data?.value) };
}

export async function requireProfile(event: RequestEvent, next: string) {
	const auth = requireUser(event, next);
	const profile = await getProfile(auth.supabase, auth.user.id);
	if (!profile.complete) redirect(303, `/account?setup=1&next=${encodeURIComponent(safeNext(next))}`);
	return { ...auth, ...profile };
}

export async function ownRide(supabase: SupabaseClient, userId: string, id: string): Promise<Ride | null> {
	if (!validId(id)) return null;
	const [ride, profile] = await Promise.all([
		supabase.from('rides').select(rideColumns).eq('id', id).eq('owner_id', userId).maybeSingle(),
		supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
	]);
	if (ride.error || profile.error) error(503, 'לא הצלחנו לטעון את הנסיעה. נסו שוב בעוד רגע.');
	return ride.data ? ({ ...ride.data, display_name: profile.data?.display_name || 'חבר/ת הקהילה' } as Ride) : null;
}

export async function myContactRequests(supabase: SupabaseClient): Promise<ContactRequest[]> {
	const { data, error: requestError } = await supabase.rpc('get_my_contact_requests');
	if (requestError) error(503, 'לא הצלחנו לטעון את בקשות הקשר. נסו שוב בעוד רגע.');
	return (data || []) as ContactRequest[];
}

export function actionError(cause: { code?: string; message?: string } | null, fallback: string) {
	// Keep database internals and identity details out of responses.
	if (cause?.code === '23505') return 'כבר קיימת בקשה כזו.';
	if (cause?.message?.includes('rate_limit') || cause?.message?.startsWith('Too many requests.')) return 'נשלחו יותר מדי בקשות. נסו שוב בהמשך.';
	return fallback;
}
