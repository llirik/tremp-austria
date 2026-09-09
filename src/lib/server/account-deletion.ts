import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from './backend';

export async function deleteOwnAccount(event: RequestEvent) {
	const { supabase } = requireUser(event);
	const form = await event.request.formData();
	if (form.get('confirm_delete') !== 'delete') {
		return fail(400, { error: 'כדי למחוק את החשבון, יש לסמן את תיבת האישור המפורשת.' });
	}
	// No target account identifier or privileged key is accepted from the browser.
	const result = await supabase.rpc('delete_my_account', { p_confirm: true });
	if (result.error) return fail(400, { error: 'לא הצלחנו למחוק את החשבון. נסו שוב או פנו לכתובת שבעמוד הפרטיות.' });
	try {
		await supabase.auth.signOut({ scope: 'local' });
	} catch {
		// Auth may already reject the deleted user; remove local cookies below regardless.
	}
	for (const cookie of event.cookies.getAll()) {
		if (/^sb-[\w-]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(cookie.name)) {
			event.cookies.delete(cookie.name, { path: '/' });
		}
	}
	event.locals.user = null;
	redirect(303, '/account-deleted');
}
