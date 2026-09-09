<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { ArrowRight, Mail, ArrowUpLeft, CheckCheck, LockKeyhole, Info } from '@lucide/svelte';
	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head
	><title>נכנסים לקהילה · טרמפ אוסטריה</title><meta name="robots" content="noindex" /></svelte:head
>
<div class="auth-shell">
	<a class="back-link" href={resolve('/')}><ArrowRight size={17} />אפשר תמיד לעיין בלוח</a>
	<div class="surface">
		{#if form?.success}<span class="auth-icon"><CheckCheck size={27} /></span>
			<h1>נפגשים בתיבת הדואר.</h1>
			<p class="auth-description">
				אם ניתן לשלוח קישור לכתובת <bdi>{form.email}</bdi>, הוא בדרך אליכם. לחיצה עליו תחזיר אתכם
				לכאן, מחוברים.
			</p>
			<div class="notice info">
				כדאי לבדוק גם את תיקיית הספאם. הקישור אישי ומיועד לשימוש חד־פעמי.
			</div>
			<a class="button button-secondary button-wide" href={resolve('/')}>בינתיים, בחזרה ללוח</a
			>{:else}<span class="auth-icon"><Mail size={27} /></span>
			<h1>רגע קטן, ואתם בפנים.</h1>
			<p class="auth-description">
				כדי לפרסם נסיעה או ליצור קשר, נשלח לכם קישור כניסה לאימייל. בלי סיסמה, בלי סיבוכים.
			</p>
			{#if !data.configured}<div class="notice info">
					<Info size={18} /><span
						>אנחנו עדיין מכינים את הקהילה ליציאה לדרך. הכניסה ופרסום הנסיעות יהיו זמינים בקרוב.</span
					>
				</div>{/if}{#if form?.error || data.error}<div class="notice error" role="alert">
					{form?.error || data.error}
				</div>{/if}
			<form
				method="POST"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update({ reset: false });
						busy = false;
					};
				}}
			>
				<input type="hidden" name="next" value={data.next} /><label for="email"
					>כתובת האימייל שלכם</label
				><input
					id="email"
					name="email"
					type="email"
					value={form && 'values' in form
						? (form.values as Record<string, string> | undefined)?.email
						: ''}
					placeholder="you@example.com"
					autocomplete="email"
					required
					dir="ltr"
					maxlength="254"
					style="margin-top:8px"
				/><button
					class="button button-primary button-wide"
					type="submit"
					disabled={busy || !data.configured}
					>{busy ? 'שולחים קישור…' : 'שלחו לי קישור כניסה'}<ArrowUpLeft size={18} /></button
				>
			</form>
			<p class="privacy-hint"><LockKeyhole size={15} />כתובת האימייל לא מוצגת בלוח הנסיעות.</p>{/if}
	</div>
	<p class="auth-footnote">
		בכניסה, אתם מסכימים להשתמש בלוח לצורך תיאום קהילתי.<br /><a
			class="text-link"
			href={resolve('/privacy')}>איך נשמרת הפרטיות שלכם</a
		>
	</p>
</div>
