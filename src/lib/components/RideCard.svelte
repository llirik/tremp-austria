<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		MapPin,
		UsersRound,
		CarFront,
		Footprints,
		CarTaxiFront,
		ArrowUpLeft,
		Share2,
		Sparkles
	} from '@lucide/svelte';
	import { directions, rideTypes, dateLabel, timeLabel, shareText, type Ride } from '$lib/domain';
	let { ride, matched = false }: { ride: Ride; matched?: boolean } = $props();
	let copied = $state(false);
	let shareError = $state(false);
	let route = $derived(directions[ride.direction]);
	const icons = { driver: CarFront, passenger: Footprints, taxi: CarTaxiFront };
	let TypeIcon = $derived(icons[ride.ride_type]);
	let shortFlex = $derived(
		ride.flexibility_minutes === null
			? 'שעה גמישה'
			: ride.flexibility_minutes === 0
				? 'שעה מדויקת'
				: `± ${ride.flexibility_minutes} דקות`
	);
	async function share() {
		const url = `${location.origin}/ride/${ride.id}`;
		try {
			if (navigator.share)
				await navigator.share({ title: 'טרמפ אוסטריה', text: shareText(ride, ''), url });
			else {
				await navigator.clipboard.writeText(shareText(ride, url));
				copied = true;
			}
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError')) {
				copied = false;
				shareError = true;
			}
		}
	}
</script>

<article class="ride-card">
	<a
		class="ride-card-body"
		href={resolve('/ride/[id]', { id: ride.id })}
		aria-label={`${rideTypes[ride.ride_type]}, ${route.from} אל ${route.to}, ${dateLabel(ride.departure_at)}, ${timeLabel(ride.departure_at)}`}
	>
		<div class="card-topline">
			<span class={`type-badge ${ride.ride_type}`}
				><TypeIcon size={13} />{rideTypes[ride.ride_type]}</span
			>{#if matched}<span class="match-pill"><Sparkles size={11} />התאמה אפשרית</span>{/if}<span
				class="card-date">{dateLabel(ride.departure_at)}</span
			>
		</div>
		<div class="ride-mainline">
			<h3 class="ride-direction">
				<span>{route.from === 'שדה התעופה ברטיסלבה' ? 'ברטיסלבה BTS' : route.from}</span><ArrowLeft
					size={19}
				/><span>{route.to === 'שדה התעופה ברטיסלבה' ? 'ברטיסלבה BTS' : route.to}</span>
			</h3>
			<div class="ride-time">
				<bdi>{timeLabel(ride.departure_at)}</bdi><span class="time-flexibility"
					><bdi>{shortFlex}</bdi></span
				>
			</div>
		</div>
		<div class="ride-meta">
			<span
				><UsersRound size={14} />{ride.ride_type === 'driver'
					? ride.available_seats === 0
						? 'הרכב מלא'
						: `${ride.available_seats} מקומות פנויים`
					: `${ride.passenger_count} נוסעים`}</span
			><span><MapPin size={14} />{ride.origin_area}</span>
		</div>
		{#if ride.note}<p class="card-note">{ride.note}</p>{/if}
	</a>
	<div class="card-footer">
		<span class="avatar" aria-hidden="true">{ride.display_name?.slice(0, 1) || 'נ'}</span><span
			class="author-name">{ride.display_name || 'חבר/ת הקהילה'}</span
		><a class="card-detail-link" href={resolve('/ride/[id]', { id: ride.id })}
			>פרטי הנסיעה<ArrowUpLeft size={15} /></a
		><button
			class="icon-button share-mini"
			type="button"
			onclick={share}
			aria-label={copied ? 'הקישור הועתק' : 'שיתוף הנסיעה'}
			title={copied ? 'הקישור הועתק' : 'שיתוף'}><Share2 size={16} /></button
		>
	</div>
	{#if copied}<span class="share-feedback" role="status" style="padding:0 22px 9px"
			>הקישור הועתק</span
		>{/if}
	{#if shareError}<span class="share-feedback" role="status" style="padding:0 22px 9px"
			>השיתוף לא הושלם. <a class="text-link" href={resolve('/ride/[id]', { id: ride.id })}
				>אפשר לשתף בוואטסאפ בעמוד הנסיעה</a
			></span
		>{/if}
</article>
