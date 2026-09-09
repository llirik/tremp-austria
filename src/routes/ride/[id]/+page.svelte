<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import {
		ArrowRight,
		ArrowLeft,
		CalendarDays,
		Clock3,
		MapPin,
		UsersRound,
		Plane,
		MessageCircle,
		ShieldCheck,
		Pencil,
		Info,
		CheckCheck
	} from '@lucide/svelte';
	import { directions, rideTypes, dateLabel, timeLabel, flexibilityLabel } from '$lib/domain';
	import RideCard from '$lib/components/RideCard.svelte';
	import ShareActions from '$lib/components/ShareActions.svelte';
	import ReportListing from '$lib/components/ReportListing.svelte';
	let { data, form } = $props();
	let ride = $derived(data.ride);
	let route = $derived(directions[ride.direction]);
	let busy = $state(false);
</script>

<svelte:head
	><title>{route.from} אל {route.to} · טרמפ אוסטריה</title><meta
		name="description"
		content={`${rideTypes[ride.ride_type]} — ${dateLabel(ride.departure_at)}, ${timeLabel(ride.departure_at)}. מצטרפים בדרך בין וינה לשדה התעופה ברטיסלבה.`}
	/></svelte:head
>
<div class="narrow-shell">
	<a class="back-link" href={resolve('/')}><ArrowRight size={17} />בחזרה ללוח הנסיעות</a>
	{#if data.demo}<div class="demo-notice">
			<Info size={15} />זו נסיעה לדוגמה. יצירת קשר אינה זמינה בלוח ההדגמה.
		</div>{/if}
	{#if form?.error}<div class="notice error" role="alert">{form.error}</div>{/if}
	<article class="surface details-panel">
		<span class={`type-badge ${ride.ride_type}`}>{rideTypes[ride.ride_type]}</span>
		<h1 class="ride-direction">
			<span>{route.from}</span><ArrowLeft size={24} /><span>{route.to}</span>
		</h1>
		<div class="details-grid">
			<div class="detail-item">
				<span><CalendarDays size={15} />תאריך הנסיעה</span><strong
					>{dateLabel(ride.departure_at)}</strong
				>
			</div>
			<div class="detail-item">
				<span><Clock3 size={15} />שעת יציאה</span><strong
					><bdi>{timeLabel(ride.departure_at)}</bdi></strong
				><small>{flexibilityLabel(ride.flexibility_minutes)} · שעון וינה</small>
			</div>
			<div class="detail-item">
				<span><MapPin size={15} />אזור איסוף</span><strong>{ride.origin_area}</strong>
			</div>
			<div class="detail-item">
				<span><MapPin size={15} />אזור הגעה</span><strong>{ride.destination_area}</strong>
			</div>
			<div class="detail-item">
				<span
					><UsersRound size={15} />{ride.ride_type === 'driver'
						? 'מקומות ברכב'
						: 'מספר נוסעים'}</span
				><strong
					>{ride.ride_type === 'driver'
						? ride.available_seats === 0
							? 'הרכב מלא'
							: `${ride.available_seats} מקומות פנויים`
						: `${ride.passenger_count} נוסעים`}</strong
				>
			</div>
			{#if ride.flight_number}<div class="detail-item">
					<span><Plane size={15} />מספר טיסה</span><strong><bdi>{ride.flight_number}</bdi></strong>
				</div>{/if}
		</div>
		{#if ride.note}<p class="detail-note">{ride.note}</p>{/if}
		<div class="detail-author">
			<span class="avatar" aria-hidden="true">{ride.display_name?.slice(0, 1)}</span>
			<div>{ride.display_name}<small>חבר/ת הקהילה</small></div>
		</div>
	</article>
	<div class="contact-panel">
		{#if data.isOwner}<h2>זו הנסיעה שלכם</h2>
			<p>אפשר לעדכן פרטים או לטפל בבקשות קשר באזור האישי.</p>
			<a class="button button-primary" href={resolve('/ride/[id]/edit', { id: ride.id })}
				><Pencil size={17} />עריכת הנסיעה</a
			>{:else if data.contactRequest?.status === 'accepted'}<h2>
				<CheckCheck size={19} style="display:inline;vertical-align:middle" /> בקשת הקשר אושרה
			</h2>
			<p>אפשר לראות את פרטי הקשר באזור האישי ולהמשיך לתאם ישירות.</p>
			<a class="button button-primary" href={resolve('/account')}>לפרטי הקשר</a
			>{:else if data.contactRequest?.status === 'pending'}<h2>בקשת הקשר בדרך</h2>
			<p>הבקשה נשלחה ל{ride.display_name}. אחרי אישור, פרטי הקשר של שניכם יופיעו באזור האישי.</p>
			<a class="button button-secondary" href={resolve('/account')}>מעקב באזור שלי</a
			>{:else if data.contactRequest}<h2>הבקשה נסגרה</h2>
			<p>אפשר לבדוק נסיעות נוספות בלוח ולמצוא דרך אחרת לנסוע יחד.</p>
			<a class="button button-secondary" href={resolve('/')}>לנסיעות נוספות</a>{:else}<h2>
				מתאים לכם לנסוע ביחד?
			</h2>
			<p>
				שולחים בקשת קשר ל{ride.display_name}. רק אחרי אישור, תוכלו לראות את פרטי הקשר ולהמשיך לתאם.
			</p>
			<form
				method="POST"
				action="?/requestContact"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<button
					class="button button-primary"
					type="submit"
					disabled={busy ||
						data.demo ||
						(ride.ride_type === 'driver' && ride.available_seats === 0)}
					><MessageCircle size={18} />{busy
						? 'שולחים בקשה…'
						: data.demo
							? 'יצירת קשר זמינה בנסיעות אמיתיות'
							: ride.ride_type === 'driver' && ride.available_seats === 0
								? 'אין כרגע מקומות פנויים'
								: 'בקשה ליצירת קשר'}</button
				>
			</form>{/if}
	</div>
	<ShareActions {ride} />
	<p class="privacy-hint">
		<ShieldCheck size={15} />הנסיעה מתואמת ישירות ביניכם. הלוח אינו מספק שירותי הסעה.
	</p>
	<ReportListing
		rideId={ride.id}
		authenticated={data.authenticated}
		demo={data.demo}
		open={data.reportOpen}
		success={Boolean(form && 'reportSuccess' in form && form.reportSuccess)}
		error={form && 'reportError' in form ? form.reportError : undefined}
		values={form && 'reportValues' in form
			? (form.reportValues as Record<string, string>)
			: undefined}
	/>
	{#if data.matches.length}<section class="matches-section">
			<h2>אולי אתם באותו כיוון</h2>
			<p>נסיעות עם כיוון, זמן ומקומות מתאימים. כדאי לוודא את הפרטים יחד.</p>
			<div class="ride-list">
				{#each data.matches as match (match.id)}<RideCard ride={match} matched />{/each}
			</div>
		</section>{/if}
</div>
