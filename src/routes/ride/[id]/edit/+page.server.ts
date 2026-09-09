import { error, fail, redirect } from '@sveltejs/kit';
import { parseRide } from '$lib/domain';
import { actionError, formValues, ownRide, requireUser, rideFormFields } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { user, supabase } = requireUser(event);
	const ride = await ownRide(supabase, user.id, event.params.id);
	if (!ride) error(404, 'הנסיעה לא נמצאה.');
	return { ride };
};

export const actions: Actions = {
	save: async (event) => {
		const { user, supabase } = requireUser(event);
		const ride = await ownRide(supabase, user.id, event.params.id);
		if (!ride) return fail(404, { error: 'הנסיעה לא נמצאה.' });
		if (ride.status === 'cancelled') return fail(400, { error: 'לא ניתן לערוך נסיעה שבוטלה.' });
		const form = await event.request.formData();
		const values = formValues(form, rideFormFields);
		const parsed = parseRide(form);
		if (!parsed.data) return fail(400, { error: parsed.error || 'בדקו את פרטי הנסיעה.', values });
		const { error: updateError } = await supabase.from('rides').update(parsed.data).eq('id', ride.id).eq('owner_id', user.id);
		if (updateError) return fail(400, { error: actionError(updateError, 'לא הצלחנו לשמור את השינויים. נסו שוב.'), values });
		redirect(303, `/ride/${ride.id}`);
	},
	cancel: async (event) => {
		const { user, supabase } = requireUser(event);
		const ride = await ownRide(supabase, user.id, event.params.id);
		if (!ride) return fail(404, { error: 'הנסיעה לא נמצאה.' });
		const { error: cancelError } = await supabase.from('rides').update({ status: 'cancelled' }).eq('id', ride.id).eq('owner_id', user.id);
		if (cancelError) return fail(400, { error: 'לא הצלחנו לבטל את הנסיעה. נסו שוב.' });
		redirect(303, '/account?cancelled=1');
	}
};
