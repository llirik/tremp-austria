<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ShieldCheck } from '@lucide/svelte';
	import RideForm from '$lib/components/RideForm.svelte';
	let { data, form } = $props();
</script>

<svelte:head
	><title>פרסום נסיעה · טרמפ אוסטריה</title><meta name="robots" content="noindex" /></svelte:head
>
<div class="narrow-shell">
	<a class="back-link" href={resolve('/')}><ArrowRight size={17} />בחזרה ללוח</a>
	<h1 class="section-title">יש לכם דרך משותפת.</h1>
	<p class="section-description">כמה פרטים קצרים, והנסיעה שלכם בלוח.</p>
	{#if !data.profileComplete}<div class="notice info">
			<ShieldCheck size={17} /><span
				>לפני הפרסום צריך להוסיף שם ודרך ליצירת קשר. <a
					class="text-link"
					href={resolve('/account?next=/new')}>השלמת הפרטים</a
				></span
			>
		</div>{/if}
	<div class="surface"><RideForm error={form?.error} values={form?.values} /></div>
</div>
