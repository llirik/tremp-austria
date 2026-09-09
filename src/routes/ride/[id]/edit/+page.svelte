<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, CircleX } from '@lucide/svelte';
	import RideForm from '$lib/components/RideForm.svelte';
	let { data, form } = $props();
	let cancelling = $state(false);
</script>

<svelte:head
	><title>עריכת נסיעה · טרמפ אוסטריה</title><meta name="robots" content="noindex" /></svelte:head
>
<div class="narrow-shell">
	<a class="back-link" href={resolve('/ride/[id]', { id: data.ride.id })}
		><ArrowRight size={17} />בחזרה לנסיעה</a
	>
	<h1 class="section-title">עדכון קטן, ויוצאים לדרך.</h1>
	<p class="section-description">אפשר לשנות שעה, מקומות פנויים או פרטים נוספים.</p>
	<div class="surface">
		<RideForm
			ride={data.ride}
			error={form?.error}
			values={form && 'values' in form ? (form.values as Record<string, string>) : undefined}
			editing
			action="?/save"
		/>
	</div>
	<div class="contact-panel">
		<h2>הנסיעה כבר לא רלוונטית?</h2>
		<p>ביטול יסיר אותה מהלוח הציבורי. היא תישאר בהיסטוריית הנסיעות שלכם.</p>
		{#if cancelling}<form method="POST" action="?/cancel">
				<p>לבטל את הנסיעה?</p>
				<div class="share-actions">
					<button type="submit" class="button button-danger">כן, ביטול הנסיעה</button><button
						type="button"
						class="button button-secondary"
						onclick={() => (cancelling = false)}>להשאיר אותה</button
					>
				</div>
			</form>{:else}<button
				type="button"
				class="button button-secondary"
				onclick={() => (cancelling = true)}><CircleX size={17} />ביטול הנסיעה</button
			>{/if}
	</div>
</div>
