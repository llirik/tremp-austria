<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowLeftRight,
		CalendarDays,
		CarFront,
		Footprints,
		CarTaxiFront,
		ListFilter,
		ArrowDownWideNarrow,
		ShieldCheck,
		ArrowUpLeft,
		HeartHandshake,
		Plane,
		Building2,
		Heart,
		Info,
		SearchX,
		Plus
	} from '@lucide/svelte';
	import RideCard from '$lib/components/RideCard.svelte';
	import { localDate, addDays, potentialMatches } from '$lib/domain';
	let { data } = $props();
	let direction = $state('all');
	let rideType = $state('all');
	let date = $state('');
	let shortcut = $state('all');
	const types = [
		{ value: 'all', label: 'כל הנסיעות', icon: ListFilter },
		{ value: 'driver', label: 'יש לי מקום', icon: CarFront },
		{ value: 'passenger', label: 'מחפש טרמפ', icon: Footprints },
		{ value: 'taxi', label: 'שותפים למונית', icon: CarTaxiFront }
	];
	let filtered = $derived(
		data.rides.filter((ride) => {
			const day = localDate(ride.departure_at);
			return (
				(direction === 'all' || ride.direction === direction) &&
				(rideType === 'all' || ride.ride_type === rideType) &&
				(!date || day === date) &&
				(shortcut !== 'week' || (day >= localDate() && day < addDays(localDate(), 7)))
			);
		})
	);
	function chooseDate(value: string) {
		shortcut = value;
		date = value === 'today' ? localDate() : value === 'tomorrow' ? addDays(localDate(), 1) : '';
	}
	function reset() {
		direction = 'all';
		rideType = 'all';
		date = '';
		shortcut = 'all';
	}
</script>

<div class="page-shell">
	<div class="page-heading">
		<div class="eyebrow"><span class="live-dot"></span>הלוח הקהילתי של וינה וברטיסלבה</div>
		<h1>אותה הדרך. נוסעים יחד.</h1>
		<p>
			מקום פנוי ברכב, טרמפ לשדה או שותפים למונית.<br class="mobile-break" /> מוצאים כאן את מי שבאותו כיוון.
		</p>
	</div>
	<div class="board-layout">
		<section aria-label="לוח הנסיעות">
			<div class="board-toolbar">
				<div class="filters-row">
					<div class="filter-control">
						<ArrowLeftRight size={17} /><label for="direction">כיוון</label><select
							id="direction"
							aria-label="סינון לפי כיוון"
							bind:value={direction}
							><option value="all">שני הכיוונים</option><option value="vienna_to_bts"
								>וינה ← ברטיסלבה BTS</option
							><option value="bts_to_vienna">ברטיסלבה BTS ← וינה</option></select
						>
					</div>
					<div class="filter-control">
						<CalendarDays size={17} /><label for="date">תאריך</label><input
							id="date"
							aria-label="סינון לפי תאריך"
							type="date"
							bind:value={date}
							onchange={() => (shortcut = date ? 'custom' : 'all')}
						/>
					</div>
				</div>
				<div class="date-shortcuts" aria-label="תאריכים מהירים">
					{#each [{ value: 'all', label: 'כל התאריכים' }, { value: 'today', label: 'היום' }, { value: 'tomorrow', label: 'מחר' }, { value: 'week', label: 'השבוע הקרוב' }] as item (item.value)}<button
							type="button"
							class:active={shortcut === item.value}
							aria-pressed={shortcut === item.value}
							onclick={() => chooseDate(item.value)}>{item.label}</button
						>{/each}
				</div>
				<div class="filter-tabs" aria-label="סוג הנסיעה">
					{#each types as type (type.value)}<button
							class="filter-tab"
							class:active={rideType === type.value}
							aria-pressed={rideType === type.value}
							onclick={() => (rideType = type.value)}><type.icon size={15} />{type.label}</button
						>{/each}
				</div>
			</div>
			{#if data.demo}<div class="demo-notice">
					<Info size={15} /><span
						>לוח לדוגמה — הנסיעות להמחשה בלבד. פרסום ויצירת קשר יהיו זמינים לאחר חיבור המערכת.</span
					>
				</div>{/if}
			{#if data.loadError}<div class="notice error" role="alert">
					{data.loadError} <a class="text-link" href={resolve('/')}>ניסיון נוסף</a>
				</div>{/if}
			<div class="results-heading">
				<h2>הנסיעות הקרובות <span class="results-count">{filtered.length} נסיעות</span></h2>
				<span class="results-sort"><ArrowDownWideNarrow size={13} />לפי מועד יציאה</span>
			</div>
			{#if filtered.length}<div class="ride-list">
					{#each filtered as ride (ride.id)}<RideCard
							{ride}
							matched={potentialMatches(ride, data.rides).length > 0}
						/>{/each}
				</div>{:else}<div class="empty-state">
					<span class="empty-icon"><SearchX size={27} /></span>
					<h2>
						{data.rides.length ? 'עדיין אין נסיעה שמתאימה לחיפוש' : 'הלוח מחכה לנסיעה הראשונה'}
					</h2>
					<p>
						{data.rides.length
							? 'אפשר לשנות את הסינון או לפרסם נסיעה משלכם.'
							: 'היו הראשונים להציע מקום או למצוא שותפים לדרך.'}<br />מישהו בקהילה כנראה בדרך שלכם.
					</p>
					<div class="share-actions">
						<button class="button button-secondary" onclick={reset}>איפוס הסינון</button><a
							class="button button-primary"
							href={resolve('/new')}><Plus size={17} />פרסום נסיעה</a
						>
					</div>
				</div>{/if}
		</section>
		<aside class="sidebar" aria-label="על הקהילה">
			<div class="side-community">
				<span class="side-eyebrow"><HeartHandshake size={15} />קהילה קטנה. דרך משותפת.</span>
				<h2>לשדה התעופה.<br />בחזרה הביתה.<br />עדיף ביחד.</h2>
				<p>מחברים בין אנשים שנוסעים בין וינה לשדה התעופה ברטיסלבה.</p>
				<div class="route-art" aria-hidden="true">
					<div class="route-connector"></div>
					<div class="route-stop first"><span><Building2 size={16} /></span>וינה</div>
					<Plane class="route-plane" size={29} />
					<div class="route-stop last"><span><Plane size={16} /></span>ברטיסלבה BTS</div>
				</div>
				<div class="community-note"><Heart size={13} />חינמי, קהילתי ובקוד פתוח</div>
			</div>
			<div class="side-info">
				<h3><ShieldCheck size={18} />פרטי הקשר שלכם נשארים שלכם</h3>
				<p>מצאתם נסיעה? שולחים בקשת קשר. הפרטים נחשפים לשני הצדדים רק אחרי אישור.</p>
				<a href={resolve('/privacy')}>ככה אנחנו שומרים על הפרטיות<ArrowUpLeft size={13} /></a>
			</div>
			<p class="sidebar-caption">אנחנו רק עושים את החיבור.<br />את הנסיעה מתאמים ישירות ביניכם.</p>
		</aside>
	</div>
</div>

<style>
	.mobile-break {
		display: none;
	}
	@media (max-width: 700px) {
		.mobile-break {
			display: block;
		}
	}
</style>
