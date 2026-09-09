<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { SvelteDate } from 'svelte/reactivity';
	import {
		CarFront,
		Footprints,
		CarTaxiFront,
		ShieldCheck,
		ArrowUpLeft,
		LoaderCircle
	} from '@lucide/svelte';
	import { localDate, localTime, addDays, type Ride, type RideType } from '$lib/domain';
	let {
		ride,
		error,
		values,
		action = '',
		editing = false
	}: {
		ride?: Ride;
		error?: string | null;
		values?: Record<string, string>;
		action?: string;
		editing?: boolean;
	} = $props();
	const suggestedDeparture = new SvelteDate(Date.now() + 60 * 60 * 1000);
	suggestedDeparture.setUTCMinutes(0, 0, 0);
	let rideType = $derived<RideType>((values?.ride_type as RideType) ?? ride?.ride_type ?? 'driver');
	let direction = $derived(values?.direction ?? ride?.direction ?? 'vienna_to_bts');
	let departureDate = $derived(
		values?.departure_date ?? localDate(ride?.departure_at ?? suggestedDeparture)
	);
	let departureTime = $derived(
		values?.departure_time ?? localTime(ride?.departure_at ?? suggestedDeparture)
	);
	let flexibility = $derived(
		values?.flexibility_minutes ?? (ride ? String(ride.flexibility_minutes ?? 'flexible') : '30')
	);
	let seats = $derived(
		values?.available_seats !== undefined
			? Number(values.available_seats)
			: (ride?.available_seats ?? 2)
	);
	let passengers = $derived(
		values?.passenger_count !== undefined
			? Number(values.passenger_count)
			: (ride?.passenger_count ?? 1)
	);
	let origin = $derived(
		values?.origin_area ??
			ride?.origin_area ??
			(direction === 'vienna_to_bts' ? '' : 'טרמינל הנוסעים BTS')
	);
	let destination = $derived(
		values?.destination_area ??
			ride?.destination_area ??
			(direction === 'vienna_to_bts' ? 'שדה התעופה ברטיסלבה' : '')
	);
	let note = $derived(values?.note ?? ride?.note ?? '');
	let flight = $derived(values?.flight_number ?? ride?.flight_number ?? '');
	let busy = $state(false);
	const options = [
		{ type: 'driver', label: 'יש לי מקום', icon: CarFront },
		{ type: 'passenger', label: 'מחפש טרמפ', icon: Footprints },
		{ type: 'taxi', label: 'שותפים למונית', icon: CarTaxiFront }
	];
</script>

<form
	method="POST"
	{action}
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	{#if error}<div class="notice error" role="alert">{error}</div>{/if}
	<fieldset style="border:0;padding:0;margin:0">
		<legend class="form-heading">מה מתאים לנסיעה שלכם?</legend>
		<div class="form-type-options">
			{#each options as option (option.type)}<label
					class="form-type-option"
					class:selected={rideType === option.type}
					><input
						type="radio"
						name="ride_type"
						value={option.type}
						bind:group={rideType}
					/><option.icon size={24} /><span>{option.label}</span></label
				>{/each}
		</div>
	</fieldset>
	<div class="form-grid">
		<label class="form-field-full"
			>לאיזה כיוון?<select name="direction" bind:value={direction}
				><option value="vienna_to_bts">וינה ← שדה התעופה ברטיסלבה</option><option
					value="bts_to_vienna">שדה התעופה ברטיסלבה ← וינה</option
				></select
			></label
		>
		<label
			>תאריך<input
				type="date"
				name="departure_date"
				bind:value={departureDate}
				min={localDate()}
				max={addDays(localDate(), 365)}
				required
			/></label
		>
		<label
			>שעת יציאה<input
				type="time"
				name="departure_time"
				bind:value={departureTime}
				required
				dir="ltr"
			/></label
		>
		<label
			>גמישות בשעה<select name="flexibility_minutes" bind:value={flexibility}
				><option value="0">שעה מדויקת</option><option value="30">כחצי שעה לכאן או לכאן</option
				><option value="60">כשעה לכאן או לכאן</option><option value="120"
					>כשעתיים לכאן או לכאן</option
				><option value="flexible">גמישים לאורך היום</option></select
			></label
		>
		{#if rideType === 'driver'}<label
				>מקומות פנויים<select name="available_seats" bind:value={seats}
					>{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as count (count)}<option value={count}
							>{count === 0 ? 'הרכב מלא' : `${count} מקומות`}</option
						>{/each}</select
				></label
			>{:else}<label
				>{rideType === 'taxi' ? 'כמה אתם בקבוצה?' : 'מספר נוסעים'}<select
					name="passenger_count"
					bind:value={passengers}
					>{#each [1, 2, 3, 4, 5, 6, 7, 8] as count (count)}<option value={count}
							>{count} נוסעים</option
						>{/each}</select
				></label
			>{/if}
		<label
			>אזור איסוף<input
				name="origin_area"
				bind:value={origin}
				placeholder="למשל: הרובע השני, וינה"
				required
				minlength="2"
				maxlength="80"
				autocomplete="off"
			/></label
		>
		<label
			>אזור הגעה<input
				name="destination_area"
				bind:value={destination}
				placeholder="למשל: מרכז וינה"
				required
				minlength="2"
				maxlength="80"
				autocomplete="off"
			/></label
		>
	</div>
	<p class="field-hint">כל השעות לפי השעון המקומי של וינה וברטיסלבה.</p>
	<div class="form-divider"></div>
	<div class="form-grid">
		<label class="form-field-full"
			>משהו שכדאי לדעת? <span class="muted">(לא חובה)</span><textarea
				name="note"
				bind:value={note}
				maxlength="280"
				rows="3"
				placeholder="למשל: יש מקום לשתי מזוודות, אפשר לאסוף בדרך"
				aria-describedby="note-privacy"></textarea><span class="field-hint"
				>{note.length}/280 תווים</span
			></label
		><label class="form-field-full"
			>מספר טיסה <span class="muted">(לא חובה)</span><input
				name="flight_number"
				bind:value={flight}
				maxlength="9"
				placeholder="W6 1234"
				dir="ltr"
				autocomplete="off"
			/></label
		>
	</div>
	<p id="note-privacy" class="privacy-hint">
		<ShieldCheck size={16} /><span
			>הפרטים כאן גלויים לכולם. ציינו אזור כללי בלבד, בלי כתובת מדויקת, מספר טלפון או אימייל. פרטי
			הקשר נחשפים רק לאחר אישור בקשת קשר.</span
		>
	</p>
	<div class="form-actions">
		<button class="button button-primary" type="submit" disabled={busy}
			>{#if busy}<LoaderCircle size={17} />שומרים את הנסיעה…{:else}{editing
					? 'שמירת השינויים'
					: 'פרסום הנסיעה'}<ArrowUpLeft size={18} />{/if}</button
		><a class="button button-secondary" href={resolve(ride ? `/ride/${ride.id}` : '/')}>ביטול</a>
	</div>
</form>
