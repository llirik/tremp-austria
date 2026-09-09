<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { ShieldCheck, LogOut, Plus, Pencil, ArrowUpLeft, Inbox, Check, Trash2 } from '@lucide/svelte';
	import { localDate } from '$lib/domain';
	import RideCard from '$lib/components/RideCard.svelte';
	import ContactRequestCard from '$lib/components/ContactRequestCard.svelte';
	import LegalAcceptance from '$lib/components/LegalAcceptance.svelte';
	let { data, form } = $props();
	let values = $derived(form && 'values' in form ? form.values : undefined);
	let method = $derived(values?.method ?? data.contact?.method ?? 'whatsapp');
	let displayName = $derived(values?.display_name ?? data.profile?.display_name ?? '');
	let contactValue = $derived(values?.value ?? data.contact?.value ?? '');
	let busy = $state(false);
	let deleting = $state(false);
	let activeRides = $derived(
		data.rides.filter(
			(ride) => ride.status === 'active' && Date.parse(ride.departure_at) >= Date.now()
		)
	);
	let pastRides = $derived(
		data.rides.filter((ride) => !activeRides.some((active) => active.id === ride.id))
	);
	let received = $derived(data.requests.filter((request) => request.is_owner));
	let sent = $derived(data.requests.filter((request) => !request.is_owner));
</script>

<svelte:head
	><title>האזור שלי · טרמפ אוסטריה</title><meta name="robots" content="noindex" /></svelte:head
>
<div class="narrow-shell">
	<div class="page-heading">
		<div class="eyebrow">הדרך המשותפת שלכם</div>
		<h1>שלום{data.profile?.display_name ? `, ${data.profile.display_name}` : ''}.</h1>
		<p>הנסיעות, בקשות הקשר והפרטים שלכם — במקום אחד.</p>
	</div>
	{#if form?.error || data.loadError}<div class="notice error" role="alert">
			{form?.error || data.loadError}
		</div>{/if}{#if form?.success}<div class="notice success" role="status">
			<Check size={17} />{form.success}
		</div>{/if}
	{#if !data.legalAccepted && data.profile && data.contact}
		<section class="surface legal-update" aria-labelledby="legal-heading">
			<h2 id="legal-heading" class="form-heading">לפני שממשיכים לתאם</h2>
			<p class="section-description">יש לקרוא ולאשר את המסמכים העדכניים לפני פרסום, עריכה או אישור קשר. אפשר לעדכן פרטים אישיים, לבטל נסיעות או גישה ולמחוק את החשבון גם ללא אישור מחודש.</p>
			<form method="POST" action="?/acceptLegal" use:enhance>
				<input type="hidden" name="next" value={data.next || ''} />
				<LegalAcceptance />
				<button class="button button-primary" type="submit">אישור והמשך</button>
			</form>
		</section>
	{/if}
	<section class="surface" aria-labelledby="profile-heading">
		<h2 id="profile-heading" class="form-heading">נעים להכיר</h2>
		<p class="section-description">מספיק שם פרטי ודרך אחת לשמור על קשר.</p>
		<form
			method="POST"
			action="?/saveProfile"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<input type="hidden" name="next" value={data.next || ''} />
			<div class="form-grid">
				<label class="form-field-full"
					>השם שיופיע בלוח<input
						name="display_name"
						bind:value={displayName}
						minlength="2"
						maxlength="40"
						autocomplete="given-name"
						placeholder="למשל: דניאל"
						required
					/></label
				><label
					>דרך פרטית ליצירת קשר<select name="method" bind:value={method}
						><option value="whatsapp">וואטסאפ</option><option value="telegram">טלגרם</option><option
							value="email">אימייל</option
						></select
					></label
				><label
					>{method === 'email'
						? 'כתובת אימייל'
						: method === 'telegram'
							? 'שם משתמש בטלגרם'
							: 'מספר עם קידומת מדינה'}<input
						name="value"
						type={method === 'email' ? 'email' : method === 'whatsapp' ? 'tel' : 'text'}
						bind:value={contactValue}
						placeholder={method === 'email'
							? 'you@example.com'
							: method === 'telegram'
								? '@username'
								: '+43 660 1234567'}
						maxlength="254"
						required
						dir="ltr"
					/></label
				>
			</div>
			<p class="privacy-hint">
				<ShieldCheck size={16} />פרטי הקשר אינם ציבוריים. אישור בקשה חושף אותם רק לשני הצדדים, עד
				לביטול הגישה.
			</p>
			{#if !data.legalAccepted && (!data.profile || !data.contact)}<LegalAcceptance />{/if}
			<button type="submit" class="button button-primary" disabled={busy}
				>{busy ? 'שומרים…' : data.next ? 'שמירה והמשך' : 'שמירת הפרטים'}</button
			>
		</form>
	</section>
	<section class="account-section">
		<h2>בקשות שקיבלתי <span class="results-count">{received.length}</span></h2>
		{#if received.length}{#each received as request (request.id)}<ContactRequestCard
					{request}
				/>{/each}{:else}<div class="empty-state" style="padding:25px">
				<Inbox size={25} style="margin:auto auto 10px;color:#82926e" />
				<h3 style="font-size:16px">בקשות חדשות יופיעו כאן</h3>
				<p style="margin-bottom:0">כשתאשרו בקשה, שניכם תוכלו לראות את פרטי הקשר.</p>
			</div>{/if}
	</section>
	{#if sent.length}<section class="account-section">
			<h2>בקשות ששלחתי <span class="results-count">{sent.length}</span></h2>
			{#each sent as request (request.id)}<ContactRequestCard {request} />{/each}
		</section>{/if}
	<section class="account-section">
		<div class="results-heading">
			<h2>הנסיעות שלי</h2>
			<a class="button button-soft" href={resolve('/new')}><Plus size={16} />נסיעה חדשה</a>
		</div>
		{#if activeRides.length}{#each activeRides as ride (ride.id)}<div class="own-ride">
					<RideCard {ride} />
					<div class="own-ride-actions">
						<a href={resolve('/ride/[id]/edit', { id: ride.id })}
							><Pencil size={14} />עריכה או ביטול</a
						><a href={resolve('/ride/[id]', { id: ride.id })}
							><ArrowUpLeft size={14} />לפרטי הנסיעה</a
						>
					</div>
				</div>{/each}{:else}<div class="empty-state">
				<h3>הנסיעה הבאה שלכם מתחילה כאן</h3>
				<p>
					יש מקום ברכב? מחפשים טרמפ או שותפים למונית?<br />פרסמו בלוח ותמצאו את מי שבאותו כיוון.
				</p>
				<a class="button button-primary" href={resolve('/new')}>פרסום נסיעה<Plus size={16} /></a>
			</div>{/if}
	</section>
	{#if pastRides.length}<section class="account-section">
			<h2>נסיעות קודמות וביטולים</h2>
			{#each pastRides as ride (ride.id)}<div class="own-ride">
					<span class="status-label" style="margin-bottom:7px"
						>{ride.status === 'cancelled' ? 'בוטלה' : 'הסתיימה'} · {localDate(
							ride.departure_at
						)}</span
					><RideCard {ride} />
				</div>{/each}
		</section>{/if}
	<form class="logout-form" method="POST" action="?/logout">
		<button type="submit" class="button button-secondary"><LogOut size={16} />יציאה מהחשבון</button>
	</form>
	<section class="account-section delete-account" aria-labelledby="delete-heading">
		<h2 id="delete-heading">מחיקת החשבון</h2>
		<p>מחיקה קבועה של חשבון הכניסה, הפרופיל ופרטי הקשר, כל המודעות שלכם, בקשות הקשר שבהן השתתפתם, הדיווחים ששלחתם ורישום אישור המסמכים. הפעולה אינה ניתנת לביטול.</p>
		<p>חשבון Google שלכם לא יימחק. מידע שאחרים כבר העתיקו לא ניתן למחוק אצלם, וגיבויים ורישומים טכניים כפופים לתקופות השמירה של הספקים. <a class="text-link" href={resolve('/privacy')}>פרטים במדיניות הפרטיות</a>.</p>
		<form method="POST" action="?/deleteAccount" use:enhance={() => {
			deleting = true;
			return async ({ update }) => {
				await update();
				deleting = false;
			};
		}}>
			<label class="delete-confirmation"><input type="checkbox" name="confirm_delete" value="delete" required /><span>אני מבין/ה שהמחיקה קבועה ומבקש/ת למחוק את החשבון והמידע שלי.</span></label>
			<button type="submit" class="button button-danger" disabled={deleting}><Trash2 size={16} />{deleting ? 'מוחקים…' : 'מחיקה קבועה של החשבון'}</button>
		</form>
	</section>
</div>

<style>
	.legal-update { margin-bottom: 24px; }
	.delete-account { border-top: 1px solid var(--border, #deded4); padding-top: 25px; }
	.delete-account p { font-size: 13px; line-height: 1.8; color: var(--muted, #6b7066); }
	.delete-confirmation { display: flex; align-items: flex-start; gap: 10px; font-weight: 400; line-height: 1.7; margin: 18px 0; }
	.delete-confirmation input { width: 18px; height: 18px; min-height: 18px; flex: 0 0 18px; margin-top: 4px; }
</style>
