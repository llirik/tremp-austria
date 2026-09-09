import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/domain';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const next = safeNext(url.searchParams.get('next'));
	const code = url.searchParams.get('code');
	if (code && locals.supabase && !locals.demo) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next);
	}
	redirect(303, `/login?error=callback&next=${encodeURIComponent(next)}`);
};
