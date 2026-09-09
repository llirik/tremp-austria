import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { requireUser } from './backend';

function event(overrides: Partial<App.Locals> = {}): RequestEvent {
	return {
		url: new URL('https://example.test/ride/a5103482-e921-4aa6-a97c-a7013d8f20dc/edit'),
		locals: { user: null, supabase: null, configured: false, demo: false, ...overrides }
	} as RequestEvent;
}

describe('authenticated route boundary', () => {
	it('sends an anonymous user to login with their intended destination', () => {
		expect(() => requireUser(event())).toThrow(expect.objectContaining({
			status: 303,
			location: '/login?next=%2Fride%2Fa5103482-e921-4aa6-a97c-a7013d8f20dc%2Fedit'
		}));
	});
	it('never carries an external redirect into login', () => {
		expect(() => requireUser(event(), '//evil.example')).toThrow(expect.objectContaining({ location: '/login?next=%2Faccount' }));
	});
	it('rejects authenticated mutations without a configured database', () => {
		expect(() => requireUser(event({ user: { id: 'verified-user' } as User }))).toThrow(expect.objectContaining({ status: 503 }));
	});
	it('never treats the public demo as an authenticated writable database', () => {
		expect(() => requireUser(event({ user: { id: 'verified-user' } as User, supabase: {} as SupabaseClient, demo: true }))).toThrow(expect.objectContaining({ status: 503 }));
	});
});
