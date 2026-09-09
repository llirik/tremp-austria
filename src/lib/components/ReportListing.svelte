<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Flag } from '@lucide/svelte';
	import { reportReasons } from '$lib/reports';
	let {
		rideId,
		authenticated,
		demo,
		open = false,
		success = false,
		error,
		values
	}: {
		rideId: string;
		authenticated: boolean;
		demo: boolean;
		open?: boolean;
		success?: boolean;
		error?: string;
		values?: Record<string, string>;
	} = $props();
	let busy = $state(false);
</script>

<details class="report-listing" open={open || success || Boolean(error)}>
	<summary><Flag size={15} aria-hidden="true" />דיווח על המודעה</summary>
	<div class="report-content">
		{#if demo}
			<p>אפשר לדווח על מודעות אמיתיות לאחר כניסה לחשבון.</p>
		{:else if success}
			<p class="notice info" role="status">
				הדיווח התקבל לבדיקה אצל מפעיל הלוח. תודה שעוזרים לשמור על הקהילה.
			</p>
		{:else if !authenticated}
			<p>כדי לצמצם דיווחי ספאם, צריך להיכנס לחשבון לפני שליחת דיווח.</p>
			<a
				class="text-link"
				href={resolve(`/login?next=${encodeURIComponent(`/ride/${rideId}?report=1`)}`)}
				>כניסה כדי לדווח</a
			>
		{:else}
			<p>
				הדיווח נשלח למפעיל הלוח ואינו מתפרסם למשתמשים אחרים. אין ניטור רציף; במקרה חירום פנו לשירותי
				החירום המתאימים.
			</p>
			{#if error}<p class="notice error" role="alert">{error}</p>{/if}
			<form
				method="POST"
				action="?/reportListing"
				aria-busy={busy}
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						try {
							await update({ reset: false });
						} finally {
							busy = false;
						}
					};
				}}
			>
				<label for="report-reason">סיבת הדיווח</label>
				<select
					id="report-reason"
					name="reason"
					required
					value={values?.reason || ''}
					disabled={busy}
				>
					<option value="" disabled>בחרו סיבה</option>
					{#each Object.entries(reportReasons) as [value, label] (value)}<option {value}
							>{label}</option
						>{/each}
				</select>
				<label for="report-explanation">הסבר קצר <span>(לא חובה)</span></label>
				<textarea
					id="report-explanation"
					name="explanation"
					maxlength="500"
					rows="3"
					value={values?.explanation || ''}
					disabled={busy}
					aria-describedby="report-hint"></textarea>
				<p id="report-hint" class="report-hint">
					עד 500 תווים. אל תוסיפו מידע אישי שאינו נחוץ לבדיקת הדיווח.
				</p>
				<button class="button button-secondary" type="submit" disabled={busy}
					>{busy ? 'שולחים דיווח…' : 'שליחת דיווח'}</button
				>
			</form>
		{/if}
	</div>
</details>

<style>
	.report-listing {
		border-top: 1px solid var(--border);
		margin-top: 28px;
		padding-top: 12px;
	}
	summary {
		align-items: center;
		cursor: pointer;
		display: flex;
		gap: 8px;
		min-height: 44px;
		font-size: 13px;
		color: var(--muted);
		width: fit-content;
	}
	summary:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 4px;
		border-radius: 4px;
	}
	.report-content {
		padding: 4px 0 12px;
		font-size: 14px;
		line-height: 1.8;
	}
	form {
		display: grid;
		gap: 10px;
		margin-top: 16px;
	}
	label span,
	.report-hint {
		font-size: 12px;
		color: var(--muted);
	}
	.report-hint {
		margin: 0;
	}
	button {
		justify-self: start;
	}
</style>
