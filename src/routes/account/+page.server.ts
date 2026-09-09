import { fail, redirect } from '@sveltejs/kit';
import { safeNext, type Ride } from '$lib/domain';
import { actionError, formValues, getProfile, myContactRequests, requireUser, rideColumns, validId, type PrivateContact } from '$lib/server/backend';
import { parseProfile } from '$lib/server/contact-validation';
import { acceptLegalDocuments, hasCurrentLegalAcceptance, requireLegalAcceptance } from '$lib/server/legal';
import { deleteOwnAccount } from '$lib/server/account-deletion';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { user, supabase } = requireUser(event);
	const [{ profile, contact }, ridesResult, requests, legalAccepted] = await Promise.all([
		getProfile(supabase, user.id),
		supabase.from('rides').select(rideColumns).eq('owner_id', user.id).order('departure_at', { ascending: false }).limit(200),
		myContactRequests(supabase),
		hasCurrentLegalAcceptance(supabase)
	]);
	const withContacts = await Promise.all(requests.map(async (request) => {
		if (request.status !== 'accepted') return { ...request, contact: null };
		const { data } = await supabase.rpc('get_request_contact', { p_request_id: request.id });
		const contact = Array.isArray(data) ? data[0] : data;
		return { ...request, contact: (contact || null) as PrivateContact | null };
	}));
	return {
		profile, contact, legalAccepted,
		rides: (ridesResult.data || []).map((ride) => ({ ...ride, display_name: profile?.display_name || 'חבר/ת הקהילה' })) as Ride[],
		requests: withContacts,
		next: event.url.searchParams.has('next') ? safeNext(event.url.searchParams.get('next')) : null,
		loadError: ridesResult.error ? 'לא הצלחנו לטעון את הנסיעות שלך. נסו לרענן.' : null
	};
};

export const actions: Actions = {
	saveProfile: async (event) => {
		const { user, supabase } = requireUser(event);
		const form = await event.request.formData();
		const values = formValues(form, ['display_name', 'method', 'value', 'next']);
		const parsed = parseProfile(form);
		if ('error' in parsed) return fail(400, { error: parsed.error, values });
		const existing = await getProfile(supabase, user.id);
		if (!existing.complete && !(await hasCurrentLegalAcceptance(supabase))) {
			const acceptanceError = await acceptLegalDocuments(supabase, form);
			if (acceptanceError) return fail(400, { error: acceptanceError, values });
		}
		const { error: profileError } = existing.profile
			? await supabase.from('profiles').update({ display_name: parsed.display_name }).eq('id', user.id)
			: await supabase.from('profiles').insert({ id: user.id, display_name: parsed.display_name });
		if (profileError) return fail(400, { error: actionError(profileError, 'לא הצלחנו לשמור את השם. נסו שוב.'), values });
		const { error: contactError } = existing.contact
			? await supabase.from('private_contacts').update(parsed.contact).eq('user_id', user.id)
			: await supabase.from('private_contacts').insert({ user_id: user.id, ...parsed.contact });
		if (contactError) return fail(400, { error: 'השם נשמר, אך פרטי הקשר לא נשמרו. בדקו אותם ונסו שוב.', values });
		const next = String(form.get('next') || '');
		if (next) redirect(303, safeNext(next));
		return { success: 'הפרטים נשמרו. פרטי הקשר נשארים פרטיים עד אישור בקשה.' };
	},
	acceptLegal: async (event) => {
		const { supabase } = requireUser(event);
		const form = await event.request.formData();
		const acceptanceError = await acceptLegalDocuments(supabase, form);
		if (acceptanceError) return fail(400, { error: acceptanceError });
		const next = String(form.get('next') || '');
		if (next) redirect(303, safeNext(next));
		return { success: 'האישור נשמר. אפשר להמשיך לתאם נסיעות.' };
	},
	respond: async (event) => {
		const { supabase } = requireUser(event);
		const form = await event.request.formData();
		const requestId = String(form.get('request_id') || '');
		const status = String(form.get('status') || '');
		if (!validId(requestId) || !['accepted', 'rejected'].includes(status)) return fail(400, { error: 'הבקשה אינה תקינה.' });
		if (status === 'accepted') await requireLegalAcceptance(supabase, '/account');
		const { error: responseError } = await supabase.rpc('respond_contact_request', { p_request_id: requestId, p_status: status });
		if (responseError) return fail(400, { error: 'לא הצלחנו לעדכן את הבקשה. ייתכן שכבר השתנתה.' });
		return { success: status === 'accepted' ? 'הבקשה אושרה. כעת אפשר לראות את פרטי הקשר של שני הצדדים.' : 'הבקשה נדחתה. פרטי הקשר נשארו פרטיים.' };
	},
	revoke: async (event) => {
		const { supabase } = requireUser(event);
		const requestId = String((await event.request.formData()).get('request_id') || '');
		if (!validId(requestId)) return fail(400, { error: 'הבקשה אינה תקינה.' });
		const { error: revokeError } = await supabase.rpc('revoke_contact_request', { p_request_id: requestId });
		if (revokeError) return fail(400, { error: 'לא הצלחנו לבטל את הגישה. נסו שוב.' });
		return { success: 'האישור לבקשה הזו בוטל. בקשות אחרות שאושרו ביניכם עדיין מאפשרות גישה. פרטים שכבר הועתקו אינם ניתנים למחיקה.' };
	},
	deleteAccount: deleteOwnAccount,
	logout: async (event) => {
		const { supabase } = requireUser(event);
		const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' });
		if (logoutError) return fail(400, { error: 'לא הצלחנו להתנתק. נסו שוב.' });
		redirect(303, '/');
	}
};
