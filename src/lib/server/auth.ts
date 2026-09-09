import type { SupabaseClient } from '@supabase/supabase-js';
import { safeNext } from '../domain';

type AuthEnvironment = {
	[name: string]: string | undefined;
	PUBLIC_GOOGLE_AUTH_ENABLED?: string;
	PUBLIC_EMAIL_AUTH_ENABLED?: string;
};

export function authMethods(environment: AuthEnvironment, development: boolean) {
	return {
		googleEnabled: environment.PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
		emailEnabled:
			environment.PUBLIC_EMAIL_AUTH_ENABLED === 'true' ||
			(environment.PUBLIC_EMAIL_AUTH_ENABLED === undefined && development)
	};
}

function authOrigin(origin: string, canonicalOrigin: string | undefined): string {
	if (canonicalOrigin) {
		try {
			const canonical = new URL(canonicalOrigin);
			if (
				['https:', 'http:'].includes(canonical.protocol) &&
				!canonical.username &&
				!canonical.password
			)
				return canonical.origin;
		} catch {
			// Invalid configuration cannot become an arbitrary redirect target.
		}
	}
	return new URL(origin).origin;
}

/** Move to the callback origin before creating the origin-bound PKCE cookie. */
export function canonicalLoginUrl(
	origin: string,
	canonicalOrigin: string | undefined,
	next: string | null | undefined
): string | null {
	const targetOrigin = authOrigin(origin, canonicalOrigin);
	if (new URL(origin).origin === targetOrigin) return null;
	const target = new URL('/login', targetOrigin);
	target.searchParams.set('next', safeNext(next));
	return target.toString();
}

export function authCallbackUrl(
	origin: string,
	canonicalOrigin: string | undefined,
	next: string | null | undefined
): string {
	const callback = new URL('/auth/callback', authOrigin(origin, canonicalOrigin));
	callback.searchParams.set('next', safeNext(next));
	return callback.toString();
}

export function authErrorMessage(code: string | null): string | null {
	if (!code) return null;
	if (code === 'oauth_cancelled') return 'הכניסה לא הושלמה. אפשר לנסות שוב כשתרצו.';
	return 'לא הצלחנו להשלים את הכניסה. אפשר לנסות שוב מכאן.';
}

export async function startGoogleSignIn(
	supabase: SupabaseClient | null,
	enabled: boolean,
	callback: string
): Promise<{ url: string } | { error: string; status: 400 | 503 }> {
	if (!enabled || !supabase)
		return {
			error: 'הכניסה עם Google עדיין בהכנה. אפשר לעיין בלוח ולנסות שוב בהמשך.',
			status: 503
		};
	try {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: callback, skipBrowserRedirect: true }
		});
		// Return only the redirect URL. Provider/session details never become page data.
		if (!error && data.url) return { url: data.url };
	} catch {
		// A provider/network error must not expose its internal error response.
	}
	return { error: 'לא הצלחנו להתחיל את הכניסה עם Google. נסו שוב בעוד רגע.', status: 400 };
}

export async function finishAuthCallback(
	supabase: SupabaseClient | null,
	url: URL
): Promise<string> {
	const next = safeNext(url.searchParams.get('next'));
	const code = url.searchParams.get('code');
	const providerError = url.searchParams.get('error');
	if (code && supabase && !providerError) {
		try {
			const { error } = await supabase.auth.exchangeCodeForSession(code);
			if (!error) return next;
		} catch {
			// Expired PKCE codes and temporary Auth outages share a safe retry path.
		}
	}
	const errorCode = providerError === 'access_denied' ? 'oauth_cancelled' : 'callback';
	return `/login?error=${errorCode}&next=${encodeURIComponent(next)}`;
}
