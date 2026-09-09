<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowRight, SearchX } from '@lucide/svelte';
</script>

<svelte:head><title>העמוד לא זמין · טרמפ אוסטריה</title></svelte:head>
<div class="auth-shell">
	<div class="empty-state">
		<span class="empty-icon"><SearchX size={28} /></span>
		<h1 class="section-title">
			{page.status === 404 ? 'הנסיעה הזו כבר לא כאן.' : 'משהו התעכב בדרך.'}
		</h1>
		<p>
			{page.status === 404
				? 'יכול להיות שהקישור לא נכון או שהנסיעה בוטלה. אפשר למצוא נסיעות נוספות בלוח.'
				: 'לא הצלחנו לטעון את העמוד כרגע. אפשר לחזור ללוח ולנסות שוב.'}
		</p>
		<a class="button button-primary" href={resolve('/')}
			><ArrowRight size={17} />בחזרה ללוח הנסיעות</a
		>
	</div>
</div>
