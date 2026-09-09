import { redirect } from '@sveltejs/kit';
import { finishAuthCallback } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	redirect(303, await finishAuthCallback(locals.demo ? null : locals.supabase, url));
};
