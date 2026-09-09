import { createServerClient } from '@supabase/ssr';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;
	event.locals.configured = Boolean(url && key);
	event.locals.demo = env.PUBLIC_DEMO_MODE === 'true' || (dev && !event.locals.configured);
	event.locals.supabase = null;
	event.locals.user = null;
	if (url && key) {
		event.locals.supabase = createServerClient(url, key, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookies) => {
					for (const { name, value, options } of cookies) {
						event.cookies.set(name, value, { ...options, path: '/', httpOnly: true, secure: event.url.protocol === 'https:', sameSite: 'lax' });
					}
				}
			}
		});
		// Never authorize from getSession(): the cookie payload alone is untrusted.
		try {
			const { data, error } = await event.locals.supabase.auth.getUser();
			event.locals.user = error ? null : data.user;
		} catch {
			// An Auth outage must not prevent anonymous browsing or trust an old cookie.
			event.locals.user = null;
		}
	}
	const response = await resolve(event);
	// SSR includes account-specific navigation. Never share cached authenticated HTML.
	response.headers.set('cache-control', 'private, no-store');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('x-frame-options', 'DENY');
	return response;
};
