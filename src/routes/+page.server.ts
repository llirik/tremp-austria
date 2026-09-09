import { demoRides } from '$lib/demo';
import type { Ride } from '$lib/domain';
import { publicRideColumns, unavailableMessage } from '$lib/server/backend';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.demo) return { rides: demoRides(), demo: true, loadError: null };
	if (!locals.supabase) return { rides: [] as Ride[], demo: false, loadError: unavailableMessage };
	const { data, error } = await locals.supabase.from('public_rides').select(publicRideColumns).eq('status', 'active').gte('departure_at', new Date().toISOString()).order('departure_at').limit(300);
	return { rides: error ? [] : ((data || []) as Ride[]), demo: false, loadError: error ? 'לא הצלחנו לטעון את הנסיעות. אפשר לרענן את הדף בעוד רגע.' : null };
};
