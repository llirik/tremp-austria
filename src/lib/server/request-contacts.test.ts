import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRequest } from './backend';
import { withRequestContacts } from './request-contacts';

const userId = '10000000-0000-4000-8000-000000000001';
const otherId = (index: number) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function request(index: number, overrides: Partial<ContactRequest> = {}): ContactRequest {
	return {
		id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		ride_id: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		status: 'accepted',
		created_at: '2026-09-10T10:00:00Z',
		updated_at: '2026-09-10T10:00:00Z',
		is_owner: true,
		requester_display_name: 'מבקש/ת',
		owner_display_name: 'מפרסם/ת',
		...overrides
	};
}

function participant(item: ContactRequest, contactId: string) {
	return {
		id: item.id,
		status: item.status,
		requester_id: item.is_owner ? contactId : userId,
		owner_id: item.is_owner ? userId : contactId
	};
}

function contact(index: number) {
	return { user_id: otherId(index), method: 'email', value: `private-${index}@example.invalid` };
}

type Lookup = { table: string; columns: string; status?: string; column: string; ids: string[] };
type Result = { data: unknown[] | null; error: { message: string } | null };

function client(respond: (lookup: Lookup) => Result | Promise<Result>) {
	const lookups: Lookup[] = [];
	const from = vi.fn((table: string) => ({
		select(columns: string) {
			let status: string | undefined;
			const query = {
				eq(column: string, value: string) {
					expect(column).toBe('status');
					status = value;
					return query;
				},
				in(column: string, ids: string[]) {
					const lookup = { table, columns, status, column, ids };
					lookups.push(lookup);
					return respond(lookup);
				}
			};
			return query;
		}
	}));
	return { supabase: { from } as unknown as SupabaseClient, from, lookups };
}

const result = (data: unknown[]): Result => ({ data, error: null });

describe('RLS-backed account contact batches', () => {
	it('loads 1,000 accepted contacts in 20 bounded queries and keeps identity fields server-only', async () => {
		const requests = Array.from({ length: 1000 }, (_, index) =>
			request(index, { is_owner: index % 2 === 0 })
		);
		const participants = new Map(
			requests.map((item, index) => [item.id, participant(item, otherId(index))])
		);
		const contacts = new Map(requests.map((_, index) => [otherId(index), contact(index)]));
		const context = client((lookup) =>
			result(
				lookup.ids.map((id) =>
					(lookup.table === 'contact_requests' ? participants : contacts).get(id)
				)
			)
		);

		const loaded = await withRequestContacts(context.supabase, userId, requests);

		expect(context.lookups).toHaveLength(20);
		for (const lookup of context.lookups) {
			expect(lookup.ids).toHaveLength(100);
			const filter = new URLSearchParams({ [lookup.column]: `in.(${lookup.ids.join(',')})` });
			expect(filter.toString().length).toBeLessThan(5000);
			if (lookup.table === 'contact_requests') expect(lookup.status).toBe('accepted');
		}
		expect(loaded).toEqual(
			requests.map((item, index) => ({
				...item,
				contact: { method: 'email', value: `private-${index}@example.invalid` }
			}))
		);
		expect(JSON.stringify(loaded)).not.toContain(userId);
		expect(JSON.stringify(loaded)).not.toContain('20000000-0000-4000-8000');
		expect(JSON.stringify(loaded)).not.toMatch(/requester_id|owner_id|user_id/);
	});

	it('deduplicates a shared participant and preserves the request order and both participant roles', async () => {
		const requests = [request(2, { is_owner: false }), request(1)];
		const context = client((lookup) =>
			result(
				lookup.table === 'contact_requests'
					? requests.toReversed().map((item) => participant(item, otherId(9)))
					: [contact(9)]
			)
		);
		const loaded = await withRequestContacts(context.supabase, userId, requests);
		expect(context.lookups).toHaveLength(2);
		expect(context.lookups[1].ids).toEqual([otherId(9)]);
		expect(loaded.map((item) => item.id)).toEqual(requests.map((item) => item.id));
		expect(loaded.map((item) => item.contact)).toEqual([
			{ method: 'email', value: 'private-9@example.invalid' },
			{ method: 'email', value: 'private-9@example.invalid' }
		]);
	});

	it('never looks up contact details for pending, rejected or revoked requests', async () => {
		const requests = [
			request(1, { status: 'pending' }),
			request(2, { status: 'rejected' }),
			request(3, { status: 'revoked' })
		];
		const context = client(() => {
			throw new Error('No lookup should run');
		});
		expect(await withRequestContacts(context.supabase, userId, requests)).toEqual(
			requests.map((item) => ({ ...item, contact: null }))
		);
		expect(context.from).not.toHaveBeenCalled();
	});

	it('excludes unknown IDs, unrelated or mismatched participants, self-contact and changed request states', async () => {
		const requests = Array.from({ length: 7 }, (_, index) => request(index));
		const context = client((lookup) =>
			result(
				lookup.table === 'contact_requests'
					? [
							participant(requests[0], otherId(0)),
							{ ...participant(requests[1], otherId(1)), owner_id: otherId(99) },
							{
								...participant(requests[2], otherId(2)),
								owner_id: otherId(2),
								requester_id: userId
							},
							{ ...participant(requests[3], otherId(3)), status: 'rejected' },
							{ ...participant(requests[4], otherId(4)), status: 'revoked' },
							{ ...participant(requests[5], otherId(5)), status: 'pending' },
							participant(requests[6], userId),
							participant(request(99), otherId(99))
						]
					: [contact(99), contact(0)]
			)
		);
		const loaded = await withRequestContacts(context.supabase, userId, requests);
		expect(context.lookups[1].ids).toEqual([otherId(0)]);
		expect(loaded[0].contact).toEqual({ method: 'email', value: 'private-0@example.invalid' });
		expect(loaded.slice(1).every((item) => item.contact === null)).toBe(true);
		expect(JSON.stringify(loaded)).not.toContain('private-99');
	});

	it('does not reuse another contact when RLS omits the requested participant', async () => {
		const item = request(1);
		const context = client((lookup) =>
			result(lookup.table === 'contact_requests' ? [participant(item, otherId(1))] : [contact(99)])
		);
		expect(await withRequestContacts(context.supabase, userId, [item])).toEqual([
			{ ...item, contact: null }
		]);
	});

	it('skips contact reads when RLS no longer returns any accepted request', async () => {
		const item = request(1);
		const context = client(() => result([]));
		expect(await withRequestContacts(context.supabase, userId, [item])).toEqual([
			{ ...item, contact: null }
		]);
		expect(context.lookups).toHaveLength(1);
	});

	it.each(['contact_requests', 'private_contacts'])(
		'fails closed on %s errors, even if a failed response includes data',
		async (failedTable) => {
			const item = request(1);
			const context = client((lookup) => ({
				data: lookup.table === 'contact_requests' ? [participant(item, otherId(1))] : [contact(1)],
				error: lookup.table === failedTable ? { message: 'Private database failure' } : null
			}));
			const loaded = await withRequestContacts(context.supabase, userId, [item]);
			expect(loaded).toEqual([{ ...item, contact: null }]);
			expect(JSON.stringify(loaded)).not.toContain('Private database failure');
			expect(context.lookups).toHaveLength(failedTable === 'contact_requests' ? 1 : 2);
		}
	);

	it.each(['contact_requests', 'private_contacts'])(
		'retains the account request when the %s lookup rejects',
		async (failedTable) => {
			const item = request(1);
			const context = client(async (lookup) => {
				if (lookup.table === failedTable) throw new Error('Private network failure');
				return result(
					lookup.table === 'contact_requests' ? [participant(item, otherId(1))] : [contact(1)]
				);
			});
			expect(await withRequestContacts(context.supabase, userId, [item])).toEqual([
				{ ...item, contact: null }
			]);
		}
	);

	it('reveals only independently verified contacts when another batch fails', async () => {
		const requests = Array.from({ length: 101 }, (_, index) => request(index));
		const participants = new Map(
			requests.map((item, index) => [item.id, participant(item, otherId(index))])
		);
		const context = client((lookup) => {
			if (lookup.table === 'contact_requests')
				return result(lookup.ids.map((id) => participants.get(id)));
			if (lookup.ids.includes(otherId(0)))
				return { data: [contact(0)], error: { message: 'Failed batch' } };
			return result([contact(100)]);
		});
		const loaded = await withRequestContacts(context.supabase, userId, requests);
		expect(context.lookups).toHaveLength(4);
		expect(loaded.slice(0, 100).every((item) => item.contact === null)).toBe(true);
		expect(loaded[100].contact).toEqual({ method: 'email', value: 'private-100@example.invalid' });
	});
});
