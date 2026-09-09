import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal';
import { acceptLegalDocuments, hasCurrentLegalAcceptance, requireLegalAcceptance } from './legal';

function client(data: unknown = true, error: unknown = null) {
	const rpc = vi.fn().mockResolvedValue({ data, error });
	return { rpc, supabase: { rpc } as unknown as SupabaseClient };
}

function confirmation(overrides: Record<string, string> = {}) {
	const form = new FormData();
	for (const [key, value] of Object.entries({ accept_legal: 'yes', terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, ...overrides })) form.set(key, value);
	return form;
}

describe('explicit current legal acceptance', () => {
	it('does not silently accept missing, unchecked or forged confirmation', async () => {
		const auth = client();
		for (const form of [new FormData(), confirmation({ accept_legal: 'false' }), confirmation({ accept_legal: 'true' })]) {
			expect(await acceptLegalDocuments(auth.supabase, form)).toBeTypeOf('string');
		}
		expect(auth.rpc).not.toHaveBeenCalled();
	});
	it('requires another review when either document version differs', async () => {
		const auth = client();
		expect(await acceptLegalDocuments(auth.supabase, confirmation({ terms_version: '2026-09-08' }))).toContain('רעננו');
		expect(await acceptLegalDocuments(auth.supabase, confirmation({ privacy_version: '2026-09-08' }))).toContain('רעננו');
		expect(auth.rpc).not.toHaveBeenCalled();
	});
	it('records only current versions without a user-controlled account or timestamp', async () => {
		const auth = client();
		expect(await acceptLegalDocuments(auth.supabase, confirmation({ user_id: 'another-account', accepted_at: 'forged' }))).toBeNull();
		expect(auth.rpc).toHaveBeenCalledExactlyOnceWith('accept_legal_documents', { p_terms_version: TERMS_VERSION, p_privacy_version: PRIVACY_VERSION });
	});
	it('does not report success or disclose internals on a failed write', async () => {
		const auth = client(null, { message: 'private database error' });
		const result = await acceptLegalDocuments(auth.supabase, confirmation());
		expect(result).toBeTypeOf('string');
		expect(result).not.toContain('private database');
	});
	it('allows protected writes only after an authoritative true result', async () => {
		const auth = client();
		expect(await hasCurrentLegalAcceptance(auth.supabase)).toBe(true);
		await expect(requireLegalAcceptance(auth.supabase, '/new')).resolves.toBeUndefined();
		for (const data of [false, null, 'true']) {
			await expect(requireLegalAcceptance(client(data).supabase, '/new')).rejects.toMatchObject({ status: 303, location: '/account?legal=required&next=%2Fnew' });
		}
	});
	it('does not permit an external redirect or proceed during a database error', async () => {
		await expect(requireLegalAcceptance(client(false).supabase, '//evil.example')).rejects.toMatchObject({ location: '/account?legal=required&next=%2Faccount' });
		await expect(requireLegalAcceptance(client(null, { message: 'private' }).supabase, '/new')).rejects.toMatchObject({ status: 503 });
	});
});
