import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { safeNext } from '$lib/domain';
import { formValues, unavailableMessage } from '$lib/server/backend';
import { validEmail } from '$lib/server/contact-validation';
import {
	authCallbackUrl,
	authErrorMessage,
	authMethods,
	canonicalLoginUrl,
	startGoogleSignIn
} from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	const canonical = canonicalLoginUrl(url.origin, env.PUBLIC_SITE_URL, next);
	if (canonical) redirect(303, canonical);
	if (locals.user) redirect(303, next);
	return {
		next,
		configured: locals.configured && !locals.demo,
		...authMethods(env, dev),
		error: authErrorMessage(url.searchParams.get('error'))
	};
};

export const actions: Actions = {
	email: async ({ request, locals, url }) => {
		const form = await request.formData();
		const next = safeNext(String(form.get('next') || ''));
		const canonical = canonicalLoginUrl(url.origin, env.PUBLIC_SITE_URL, next);
		if (canonical) redirect(303, canonical);
		if (!locals.supabase || locals.demo || !authMethods(env, dev).emailEnabled)
			return fail(503, { error: unavailableMessage });
		const values = formValues(form, ['email', 'next']);
		const email = String(form.get('email') || '').trim();
		if (!validEmail(email))
			return fail(400, { error: 'יש להזין כתובת אימייל תקינה באותיות לטיניות.', values });
		const callback = authCallbackUrl(url.origin, env.PUBLIC_SITE_URL, next);
		const { error: authError } = await locals.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: callback }
		});
		if (authError) {
			const message =
				authError.code === 'email_address_not_authorized'
					? 'הכניסה לקהילה עדיין בהכנה. אפשר לעיין בלוח ולנסות שוב בהמשך.'
					: authError.status === 429
						? 'נשלחו יותר מדי בקשות. המתינו מעט ונסו שוב.'
						: 'לא הצלחנו לשלוח את הקישור. נסו שוב בעוד רגע.';
			return fail(400, { error: message, values });
		}
		return { success: true, email };
	},
	google: async ({ request, locals, url }) => {
		const form = await request.formData();
		const next = safeNext(String(form.get('next') || ''));
		const canonical = canonicalLoginUrl(url.origin, env.PUBLIC_SITE_URL, next);
		if (canonical) redirect(303, canonical);
		if (locals.user) redirect(303, next);
		const callback = authCallbackUrl(url.origin, env.PUBLIC_SITE_URL, next);
		const result = await startGoogleSignIn(
			locals.demo ? null : locals.supabase,
			authMethods(env, dev).googleEnabled,
			callback
		);
		if ('error' in result) return fail(result.status, { error: result.error });
		redirect(303, result.url);
	}
};
