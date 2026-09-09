<script lang="ts">
	import { resolve } from '$app/paths';
	import { PRIVACY_VERSION, TERMS_VERSION } from '$lib/legal';
</script>

<input type="hidden" name="terms_version" value={TERMS_VERSION} />
<input type="hidden" name="privacy_version" value={PRIVACY_VERSION} />
<label class="legal-confirmation">
	<input type="checkbox" name="accept_legal" value="yes" required />
	<span>
		אני מקבל/ת את <a class="text-link" href={resolve('/terms')} target="_blank" rel="noopener">תנאי השימוש</a>
		ומאשר/ת שקראתי את <a class="text-link" href={resolve('/privacy')} target="_blank" rel="noopener">מדיניות הפרטיות</a>.
		<span class="legal-version">תנאים: <bdi>{TERMS_VERSION}</bdi> · פרטיות: <bdi>{PRIVACY_VERSION}</bdi>. הקישורים נפתחים בלשונית חדשה.</span>
	</span>
</label>

<style>
	.legal-confirmation { display: flex; align-items: flex-start; gap: 10px; margin: 18px 0; line-height: 1.7; font-weight: 400; }
	.legal-confirmation input { width: 18px; height: 18px; min-height: 18px; flex: 0 0 18px; margin-top: 5px; accent-color: var(--green, #294c3d); }
	.legal-version { display: block; font-size: 11px; color: var(--muted, #6b7066); }
</style>
