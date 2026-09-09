import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { safeNext } from '$lib/domain';
import { formValues, unavailableMessage } from '$lib/server/backend';
import { validEmail } from '$lib/server/contact-validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.user) redirect(303, next);
	return { next, configured: locals.configured && !locals.demo, error: url.searchParams.has('error') ? 'קישור הכניסה לא תקף או שפג תוקפו. אפשר לבקש קישור חדש.' : null };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase || locals.demo) return fail(503, { error: unavailableMessage });
		const form = await request.formData();
		const values = formValues(form, ['email', 'next']);
		const email = String(form.get('email') || '').trim();
		if (!validEmail(email)) return fail(400, { error: 'יש להזין כתובת אימייל תקינה באותיות לטיניות.', values });
		const next = safeNext(String(form.get('next') || ''));
		const callback = new URL('/auth/callback', env.PUBLIC_SITE_URL || url.origin);
		callback.searchParams.set('next', next);
		const { error: authError } = await locals.supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
		if (authError) {
			const message = authError.code === 'email_address_not_authorized'
				? 'הכניסה לקהילה עדיין בהכנה. אפשר לעיין בלוח ולנסות שוב בהמשך.'
				: authError.status === 429
					? 'נשלחו יותר מדי בקשות. המתינו מעט ונסו שוב.'
					: 'לא הצלחנו לשלוח את הקישור. נסו שוב בעוד רגע.';
			return fail(400, { error: message, values });
		}
		return { success: true, email };
	}
};
