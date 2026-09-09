import { fail, redirect } from '@sveltejs/kit';
import { parseRide } from '$lib/domain';
import { actionError, formValues, requireProfile, rideFormFields } from '$lib/server/backend';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireProfile(event, '/new');
	return { profileComplete: true };
};

export const actions: Actions = {
	default: async (event) => {
		const { user, supabase } = await requireProfile(event, '/new');
		const form = await event.request.formData();
		const values = formValues(form, rideFormFields);
		const parsed = parseRide(form);
		if (!parsed.data) return fail(400, { error: parsed.error || 'בדקו את פרטי הנסיעה.', values });
		const { data, error } = await supabase.from('rides').insert({ ...parsed.data, owner_id: user.id }).select('id').single();
		if (error) return fail(400, { error: actionError(error, 'לא הצלחנו לפרסם את הנסיעה. נסו שוב בעוד רגע.'), values });
		redirect(303, `/ride/${data.id}`);
	}
};
