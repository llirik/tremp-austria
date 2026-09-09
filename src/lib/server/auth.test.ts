import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	authCallbackUrl,
	authErrorMessage,
	authMethods,
	canonicalLoginUrl,
	finishAuthCallback,
	startGoogleSignIn
} from './auth';

function client() {
	const signInWithOAuth = vi.fn().mockResolvedValue({
		data: {
			provider: 'google',
			url: 'https://project.supabase.co/auth/v1/authorize?provider=google'
		},
		error: null
	});
	const exchangeCodeForSession = vi.fn().mockResolvedValue({
		data: { session: { access_token: 'must-stay-private', provider_token: 'must-stay-private' } },
		error: null
	});
	return {
		supabase: { auth: { signInWithOAuth, exchangeCodeForSession } } as unknown as SupabaseClient,
		signInWithOAuth,
		exchangeCodeForSession
	};
}

describe('configured authentication methods', () => {
	it('keeps Google opt-in and enables default email only in development', () => {
		expect(authMethods({}, true)).toEqual({ googleEnabled: false, emailEnabled: true });
		expect(authMethods({}, false)).toEqual({ googleEnabled: false, emailEnabled: false });
		expect(
			authMethods({ PUBLIC_GOOGLE_AUTH_ENABLED: 'true', PUBLIC_EMAIL_AUTH_ENABLED: 'false' }, true)
		).toEqual({ googleEnabled: true, emailEnabled: false });
		expect(authMethods({ PUBLIC_EMAIL_AUTH_ENABLED: 'true' }, false).emailEnabled).toBe(true);
	});
	it('rejects a disabled Google provider before calling the SDK', async () => {
		const auth = client();
		expect(
			await startGoogleSignIn(auth.supabase, false, 'https://example.test/auth/callback')
		).toHaveProperty('status', 503);
		expect(auth.signInWithOAuth).not.toHaveBeenCalled();
		expect(
			await startGoogleSignIn(null, true, 'https://example.test/auth/callback')
		).toHaveProperty('status', 503);
	});
	it('starts Google PKCE with the canonical callback and returns only a redirect', async () => {
		const auth = client();
		const callback = authCallbackUrl(
			'https://tremp.example.test',
			'https://tremp.example.test',
			'/new'
		);
		expect(await startGoogleSignIn(auth.supabase, true, callback)).toEqual({
			url: 'https://project.supabase.co/auth/v1/authorize?provider=google'
		});
		expect(auth.signInWithOAuth).toHaveBeenCalledWith({
			provider: 'google',
			options: {
				redirectTo: 'https://tremp.example.test/auth/callback?next=%2Fnew',
				skipBrowserRedirect: true
			}
		});
	});
	it('never returns provider error details', async () => {
		const auth = client();
		auth.signInWithOAuth.mockRejectedValue(new Error('private provider response'));
		const result = await startGoogleSignIn(
			auth.supabase,
			true,
			'https://example.test/auth/callback'
		);
		expect(result).toHaveProperty('status', 400);
		expect(JSON.stringify(result)).not.toContain('private provider response');
	});
});

describe('canonical login handoff', () => {
	it('moves preview login to the callback origin before PKCE begins', () => {
		const target = canonicalLoginUrl(
			'https://preview.example.test',
			'https://tremp.example.test/path?ignored=1',
			'/new'
		);
		expect(target).toBe('https://tremp.example.test/login?next=%2Fnew');
		const canonical = new URL(target!);
		expect(canonicalLoginUrl(canonical.origin, 'https://tremp.example.test/', '/new')).toBeNull();
		expect(
			new URL(authCallbackUrl(canonical.origin, 'https://tremp.example.test', '/new')).origin
		).toBe(canonical.origin);
	});
	it('retains local login when local settings name the current origin', () => {
		expect(canonicalLoginUrl('http://localhost:5173', 'http://localhost:5173/', '/new')).toBeNull();
		expect(canonicalLoginUrl('http://localhost:5173', undefined, '/new')).toBeNull();
	});
	it('does not let the next parameter choose the handoff origin', () => {
		expect(
			canonicalLoginUrl(
				'https://preview.example.test',
				'https://tremp.example.test',
				'//evil.example'
			)
		).toBe('https://tremp.example.test/login?next=%2Faccount');
	});
	it.each(['javascript:alert(1)', 'https://user:password@example.test', 'not a URL'])(
		'ignores invalid canonical origin %s',
		(configured) => {
			expect(canonicalLoginUrl('https://tremp.example.test', configured, '/new')).toBeNull();
			expect(
				new URL(authCallbackUrl('https://tremp.example.test', configured, '/new')).origin
			).toBe('https://tremp.example.test');
		}
	);
});

describe('shared email and OAuth callback', () => {
	it('preserves intended internal navigation and omits all session/provider tokens', async () => {
		const auth = client();
		const result = await finishAuthCallback(
			auth.supabase,
			new URL('https://example.test/auth/callback?code=single-use-code&next=%2Fnew')
		);
		expect(result).toBe('/new');
		expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('single-use-code');
		expect(result).not.toContain('must-stay-private');
	});
	it.each([
		'https://evil.example',
		'//evil.example',
		'/\\evil.example',
		'/login',
		'/auth/callback'
	])('rejects an unsafe return target %s', async (next) => {
		const auth = client();
		const callback = new URL(authCallbackUrl('https://example.test', undefined, next));
		expect(callback.searchParams.get('next')).toBe('/account');
		callback.searchParams.set('code', 'single-use-code');
		expect(await finishAuthCallback(auth.supabase, callback)).toBe('/account');
	});
	it('keeps OAuth cancellation readable without echoing provider descriptions', async () => {
		const auth = client();
		const result = await finishAuthCallback(
			auth.supabase,
			new URL(
				'https://example.test/auth/callback?error=access_denied&error_description=private-detail&next=%2Fnew'
			)
		);
		expect(result).toBe('/login?error=oauth_cancelled&next=%2Fnew');
		expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
		expect(authErrorMessage('oauth_cancelled')).toContain('הכניסה לא הושלמה');
	});
	it('handles missing, expired, and failed code exchanges through the login retry path', async () => {
		const auth = client();
		const url = new URL('https://example.test/auth/callback?code=expired&next=%2Fnew');
		auth.exchangeCodeForSession.mockResolvedValue({
			data: null,
			error: { message: 'private auth detail' }
		});
		expect(await finishAuthCallback(auth.supabase, url)).toBe('/login?error=callback&next=%2Fnew');
		auth.exchangeCodeForSession.mockRejectedValue(new Error('network failure'));
		expect(await finishAuthCallback(auth.supabase, url)).toBe('/login?error=callback&next=%2Fnew');
		expect(await finishAuthCallback(null, url)).toBe('/login?error=callback&next=%2Fnew');
		expect(
			await finishAuthCallback(auth.supabase, new URL('https://example.test/auth/callback'))
		).toBe('/login?error=callback&next=%2Faccount');
		expect(authErrorMessage('callback')).toContain('לא הצלחנו להשלים');
	});
});
