<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { Check, X, ArrowUpLeft, LockKeyhole } from '@lucide/svelte';
	type Request = {
		id: string;
		ride_id: string;
		status: string;
		created_at: string;
		updated_at: string;
		is_owner: boolean;
		requester_display_name: string;
		owner_display_name: string;
		contact: { method: string; value: string } | null;
	};
	let { request }: { request: Request } = $props();
	let busy = $state(false);
	let name = $derived(
		request.is_owner ? request.requester_display_name : request.owner_display_name
	);
	const statuses: Record<string, string> = {
		pending: 'ממתינה לאישור',
		accepted: 'הקשר אושר',
		rejected: 'הבקשה נדחתה',
		revoked: 'הגישה בוטלה'
	};
</script>

<article class="request-card">
	<h3>{request.is_owner ? `${name} רוצה לתאם איתכם נסיעה` : `הבקשה שלכם ל${name}`}</h3>
	<p>
		<a class="text-link" href={resolve('/ride/[id]', { id: request.ride_id })}
			>לפרטי הנסיעה<ArrowUpLeft size={13} /></a
		>
	</p>
	<span class="status-label" class:accepted={request.status === 'accepted'}
		>{statuses[request.status] || request.status}</span
	>
	{#if request.contact}<div class="private-contact">
			<LockKeyhole size={16} />
			{#if request.contact.method === 'email'}
				<a href={`mailto:${encodeURIComponent(request.contact.value)}`}
					><bdi>{request.contact.value}</bdi></a
				>
			{:else if request.contact.method === 'whatsapp'}
				<a
					href={`https://wa.me/${request.contact.value.replace(/\D/g, '')}`}
					target="_blank"
					rel="noopener noreferrer"><bdi>{request.contact.value}</bdi></a
				>
			{:else}
				<a
					href={`https://t.me/${request.contact.value.replace(/^@/, '')}`}
					target="_blank"
					rel="noopener noreferrer"><bdi>{request.contact.value}</bdi></a
				>
			{/if}
		</div>
		<p>הפרטים האלה גלויים רק למשתתפים בקשר שאושר.</p>{/if}
	{#if request.is_owner && request.status === 'pending'}<div class="request-actions">
			<form
				method="POST"
				action="?/respond"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<input type="hidden" name="request_id" value={request.id} />
				<div class="share-actions">
					<button
						type="submit"
						name="status"
						value="accepted"
						class="button button-primary"
						disabled={busy}><Check size={16} />אישור וחשיפת פרטים</button
					><button
						type="submit"
						name="status"
						value="rejected"
						class="button button-secondary"
						disabled={busy}><X size={16} />דחייה</button
					>
				</div>
			</form>
		</div>{/if}
	{#if request.status === 'accepted' || (!request.is_owner && request.status === 'pending')}<form
			method="POST"
			action="?/revoke"
			use:enhance
		>
			<input type="hidden" name="request_id" value={request.id} /><button
				class="text-link"
				type="submit"
				style="font-size:11px;background:transparent"
				>{request.status === 'accepted' ? 'ביטול הגישה לפרטי הקשר' : 'ביטול הבקשה'}</button
			>
		</form>{/if}
</article>
