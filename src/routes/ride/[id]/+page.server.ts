import { error, fail, redirect } from '@sveltejs/kit';
import { demoRides } from '$lib/demo';
import { potentialMatches, type Ride } from '$lib/domain';
import {
	actionError,
	formValues,
	myContactRequests,
	ownRide,
	publicRideColumns,
	requireProfile,
	requireUser,
	unavailableMessage,
	validId
} from '$lib/server/backend';
import { parseReport } from '$lib/reports';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (locals.demo) {
		const rides = demoRides();
		const ride = rides.find((item) => item.id === params.id);
		if (!ride) error(404, 'הנסיעה לא נמצאה.');
		return {
			ride,
			matches: potentialMatches(ride, rides),
			isOwner: false,
			contactRequest: null,
			demo: true,
			authenticated: false,
			reportOpen: false
		};
	}
	if (!locals.supabase) error(503, unavailableMessage);
	if (!validId(params.id)) error(404, 'הנסיעה לא נמצאה.');
	const [publicResult, owned] = await Promise.all([
		locals.supabase
			.from('public_rides')
			.select(publicRideColumns)
			.eq('id', params.id)
			.maybeSingle(),
		locals.user ? ownRide(locals.supabase, locals.user.id, params.id) : Promise.resolve(null)
	]);
	if (publicResult.error) error(503, 'לא הצלחנו לטעון את הנסיעה. נסו שוב בעוד רגע.');
	const ride = owned || (publicResult.data as Ride | null);
	if (!ride) error(404, 'הנסיעה לא נמצאה או בוטלה.');
	const candidates = await locals.supabase
		.from('public_rides')
		.select(publicRideColumns)
		.eq('direction', ride.direction)
		.gte('departure_at', new Date().toISOString())
		.order('departure_at')
		.limit(300);
	const requests = locals.user ? await myContactRequests(locals.supabase) : [];
	const request = requests.find((item) => item.ride_id === ride.id && !item.is_owner);
	return {
		ride,
		matches: potentialMatches(ride, (candidates.data || []) as Ride[]),
		isOwner: Boolean(owned),
		contactRequest: request ? { id: request.id, status: request.status } : null,
		demo: false,
		authenticated: Boolean(locals.user),
		reportOpen: url.searchParams.get('report') === '1'
	};
};

export const actions: Actions = {
	reportListing: async (event) => {
		// Safety reports remain available without accepting new Terms or creating a public profile.
		const { supabase } = requireUser(event, `/ride/${event.params.id}?report=1`);
		if (!validId(event.params.id)) return fail(404, { reportError: 'המודעה לא נמצאה.' });
		const form = await event.request.formData();
		const input = parseReport(form);
		const reportValues = formValues(form, ['reason', 'explanation']);
		if ('error' in input) return fail(400, { reportError: input.error, reportValues });
		const { error: reportError } = await supabase.rpc('report_listing', {
			p_ride_id: event.params.id,
			p_reason: input.reason,
			p_explanation: input.explanation
		});
		if (reportError)
			return fail(400, {
				reportError: actionError(
					reportError,
					'לא הצלחנו לשלוח את הדיווח. ייתכן שהמודעה כבר הוסרה; נסו שוב מאוחר יותר.'
				),
				reportValues
			});
		return { reportSuccess: true };
	},
	requestContact: async (event) => {
		const { supabase } = await requireProfile(event, `/ride/${event.params.id}`);
		if (!validId(event.params.id)) return fail(404, { error: 'הנסיעה לא נמצאה.' });
		const { error: requestError } = await supabase.rpc('request_contact', {
			p_ride_id: event.params.id
		});
		if (requestError)
			return fail(400, {
				error: actionError(
					requestError,
					'לא ניתן לשלוח בקשה כרגע. ייתכן שהנסיעה כבר חלפה או שהבקשה כבר קיימת.'
				)
			});
		redirect(303, `/ride/${event.params.id}?requested=1`);
	}
};
