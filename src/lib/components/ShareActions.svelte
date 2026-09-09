<script lang="ts">
	import { page } from '$app/state';
	import { Share2, Copy, MessageCircle } from '@lucide/svelte';
	import { shareText, type Ride } from '$lib/domain';
	let { ride }: { ride: Ride } = $props();
	let feedback = $state('');
	let url = $derived(`${page.url.origin}/ride/${ride.id}`);
	let message = $derived(shareText(ride, url));
	async function copy() {
		try {
			await navigator.clipboard.writeText(message);
			feedback = 'הקישור ופרטי הנסיעה הועתקו. אפשר לשלוח לקבוצה.';
		} catch {
			feedback = 'לא ניתן להעתיק אוטומטית. אפשר להעתיק את כתובת העמוד משורת הכתובת.';
		}
	}
	async function share() {
		if (!navigator.share) {
			await copy();
			return;
		}
		try {
			await navigator.share({ title: 'טרמפ אוסטריה', text: shareText(ride, ''), url });
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError'))
				feedback = 'השיתוף לא הושלם. אפשר להעתיק את הקישור.';
		}
	}
</script>

<div class="share-actions">
	<button class="button button-secondary" onclick={share}><Share2 size={17} />שיתוף</button><a
		class="button button-secondary"
		href={`https://wa.me/?text=${encodeURIComponent(message)}`}
		target="_blank"
		rel="noopener noreferrer"><MessageCircle size={17} />וואטסאפ</a
	><button class="button button-secondary" onclick={copy}><Copy size={16} />העתקת קישור</button>
</div>
{#if feedback}<p class="share-feedback" role="status">{feedback}</p>{/if}
