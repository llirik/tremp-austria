<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<nav class="legal-links" aria-label="מידע על המיזם ותנאי השימוש">
	<a class="text-link" href={resolve('/about')}>על המיזם</a>
	<a class="text-link" href={resolve('/privacy')}>פרטיות</a>
	<a class="text-link" href={resolve('/terms')}>תנאי שימוש</a>
	<a class="text-link" href={resolve('/impressum')}>פרטי המפעיל · Impressum</a>
</nav>

<style>
	.legal-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0 20px;
		margin-top: 28px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
		font-size: 13px;
	}
</style>
