import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRequest, PrivateContact } from './backend';

// Keep UUID filters below URL limits. With the existing 1,000-row API limit,
// contact lookups use at most 20 fetches instead of one fetch per acceptance.
const batchSize = 100;

type RequestParticipant = {
	id: string;
	status: ContactRequest['status'];
	requester_id: string;
	owner_id: string;
};
type ParticipantContact = PrivateContact & { user_id: string };

export async function withRequestContacts(
	supabase: SupabaseClient,
	userId: string,
	requests: ContactRequest[]
): Promise<(ContactRequest & { contact: PrivateContact | null })[]> {
	const accepted = requests.filter((request) => request.status === 'accepted');
	const contactsByRequest = new Map<string, PrivateContact>();
	for (let offset = 0; offset < accepted.length; offset += batchSize) {
		const batch = accepted.slice(offset, offset + batchSize);
		const requested = new Map(batch.map((request) => [request.id, request]));
		try {
			// Both reads use the user's existing RLS permissions. Participant IDs
			// are used only here and never added to the returned account data.
			const participants = await supabase
				.from('contact_requests')
				.select('id,status,requester_id,owner_id')
				.eq('status', 'accepted')
				.in('id', [...requested.keys()]);
			if (participants.error) continue;
			const participantByRequest = new Map<string, string>();
			for (const row of (participants.data || []) as RequestParticipant[]) {
				const request = requested.get(row.id);
				if (!request || row.status !== 'accepted') continue;
				const otherId = request.is_owner
					? row.owner_id === userId
						? row.requester_id
						: null
					: row.requester_id === userId
						? row.owner_id
						: null;
				if (otherId && otherId !== userId) participantByRequest.set(row.id, otherId);
			}
			const otherIds = new Set(participantByRequest.values());
			if (!otherIds.size) continue;
			const contacts = await supabase
				.from('private_contacts')
				.select('user_id,method,value')
				.in('user_id', [...otherIds]);
			if (contacts.error) continue;
			const contactByParticipant = new Map<string, PrivateContact>();
			for (const row of (contacts.data || []) as ParticipantContact[]) {
				if (otherIds.has(row.user_id)) {
					contactByParticipant.set(row.user_id, { method: row.method, value: row.value });
				}
			}
			for (const [requestId, otherId] of participantByRequest) {
				const contact = contactByParticipant.get(otherId);
				if (contact) contactsByRequest.set(requestId, contact);
			}
		} catch {
			// Preserve the existing failed-lookup behavior: requests still render,
			// but this batch exposes no contacts when either lookup fails.
		}
	}
	return requests.map((request) => ({
		...request,
		contact: request.status === 'accepted' ? contactsByRequest.get(request.id) || null : null
	}));
}
