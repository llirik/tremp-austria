import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { deleteOwnAccount } from './account-deletion';

function deletionEvent(values: Record<string, string | undefined> = { confirm_delete: 'delete' }, authenticated = true) {
	const rpc = vi.fn().mockResolvedValue({ error: null });
	const signOut = vi.fn().mockResolvedValue({ error: null });
	const deleteCookie = vi.fn();
	const body = new FormData();
	for (const [key, value] of Object.entries(values)) if (value !== undefined) body.set(key, value);
	const event = {
		url: new URL('https://example.test/account?/deleteAccount'),
		request: new Request('https://example.test/account?/deleteAccount', { method: 'POST', body }),
		locals: { user: authenticated ? { id: 'verified-current-user' } as User : null, supabase: { rpc, auth: { signOut } } as unknown as SupabaseClient, configured: true, demo: false },
		cookies: { getAll: () => [
			{ name: 'sb-test-auth-token.0', value: 'private-session' },
			{ name: 'sb-test-auth-token.1', value: 'private-session' },
			{ name: 'sb-test-auth-token-code-verifier', value: 'private-pkce' },
			{ name: 'unrelated-preference', value: 'keep' }
		], delete: deleteCookie }
	} as unknown as RequestEvent;
	return { event, rpc, signOut, deleteCookie };
}

describe('self-service account deletion boundary', () => {
	it('rejects anonymous requests without touching any account', async () => {
		const context = deletionEvent(undefined, false);
		await expect(deleteOwnAccount(context.event)).rejects.toMatchObject({ status: 303, location: expect.stringContaining('/login?next=') });
		expect(context.rpc).not.toHaveBeenCalled();
	});
	it.each([{}, { confirm_delete: 'false' }, { confirm_delete: 'true' }])('requires explicit deletion confirmation: %o', async (values) => {
		const context = deletionEvent(values);
		expect(await deleteOwnAccount(context.event)).toHaveProperty('status', 400);
		expect(context.rpc).not.toHaveBeenCalled();
		expect(context.signOut).not.toHaveBeenCalled();
	});
	it('passes no injected target account and clears only auth cookies after deletion', async () => {
		const context = deletionEvent({ confirm_delete: 'delete', user_id: 'victim', target_id: 'victim' });
		await expect(deleteOwnAccount(context.event)).rejects.toMatchObject({ status: 303, location: '/account-deleted' });
		expect(context.rpc).toHaveBeenCalledExactlyOnceWith('delete_my_account', { p_confirm: true });
		expect(context.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
		expect(context.deleteCookie).toHaveBeenCalledTimes(3);
		expect(context.deleteCookie).not.toHaveBeenCalledWith('unrelated-preference', expect.anything());
		expect(context.event.locals.user).toBeNull();
	});
	it('retains the session and returns a safe error when deletion fails', async () => {
		const context = deletionEvent();
		context.rpc.mockResolvedValue({ error: { message: 'private failure details' } });
		const result = await deleteOwnAccount(context.event);
		expect(result).toHaveProperty('status', 400);
		expect(JSON.stringify(result)).not.toContain('private failure');
		expect(context.signOut).not.toHaveBeenCalled();
		expect(context.deleteCookie).not.toHaveBeenCalled();
		expect(context.event.locals.user).not.toBeNull();
	});
	it('clears the invalid local session even if Auth rejects sign-out for the deleted user', async () => {
		const context = deletionEvent();
		context.signOut.mockRejectedValue(new Error('user no longer exists'));
		await expect(deleteOwnAccount(context.event)).rejects.toMatchObject({ location: '/account-deleted' });
		expect(context.deleteCookie).toHaveBeenCalledTimes(3);
	});
});
