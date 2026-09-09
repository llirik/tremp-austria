import { addDays, localDate, localDeparture, type Ride } from './domain';

/** Invented examples only. Never inserted into a hosted database. Dates roll with local Vienna day. */
export function demoRides(now = new Date()): Ride[] {
	const today = localDate(now);
	const examples: Array<Partial<Ride> & { day: number; time: string }> = [
		{
			day: 0,
			time: '22:30',
			ride_type: 'taxi',
			direction: 'bts_to_vienna',
			passenger_count: 2,
			display_name: 'מיה',
			origin_area: 'אולם הנחיתות, BTS',
			destination_area: 'לאופולדשטאדט',
			note: 'נוחתים מישראל עם שתי מזוודות. נשמח לחלוק מונית בדרך הביתה.',
			flight_number: 'W6 2812'
		},
		{
			day: 1,
			time: '09:00',
			ride_type: 'driver',
			available_seats: 3,
			display_name: 'דניאל',
			note: 'יוצא בבוקר, יש מקום גם למזוודות. אפשר לתאם איסוף ליד תחנת הרכבת.'
		},
		{
			day: 1,
			time: '09:30',
			ride_type: 'passenger',
			passenger_count: 2,
			display_name: 'נועה',
			note: 'שני נוסעים עם טרולי, נשמח להצטרף לדרך.',
			flexibility_minutes: 60
		},
		{
			day: 1,
			time: '23:00',
			ride_type: 'taxi',
			direction: 'bts_to_vienna',
			display_name: 'איתי',
			note: 'מגיע בטיסת ערב. מחפש עוד אנשים למונית למרכז וינה.',
			origin_area: 'שדה התעופה BTS',
			destination_area: 'מרכז וינה'
		},
		{
			day: 2,
			time: '10:00',
			ride_type: 'driver',
			available_seats: 2,
			display_name: 'יעל',
			note: 'נוסעת ביום שישי לשדה. בשמחה אקח עוד שניים בדרך.',
			flexibility_minutes: 30
		},
		{
			day: 2,
			time: '10:30',
			ride_type: 'passenger',
			passenger_count: 1,
			display_name: 'אור',
			flexibility_minutes: 120,
			note: 'גמיש בשעת היציאה, טס בצהריים.'
		},
		{
			day: 3,
			time: '14:00',
			ride_type: 'taxi',
			direction: 'bts_to_vienna',
			display_name: 'תמר',
			flexibility_minutes: null,
			note: 'נחיתה בצהריים. אפשר לחכות קצת ולנסוע יחד.',
			origin_area: 'אולם הנחיתות, BTS',
			destination_area: 'וינה, רובע 2'
		},
		{
			day: 3,
			time: '16:30',
			ride_type: 'taxi',
			direction: 'bts_to_vienna',
			display_name: 'יונתן',
			origin_area: 'אולם הנחיתות, BTS',
			destination_area: 'מרכז וינה',
			note: 'נוסע יחיד עם מזוודה, אשמח לשותפים.'
		},
		{
			day: 4,
			time: '11:00',
			ride_type: 'driver',
			available_seats: 0,
			display_name: 'רוני',
			note: 'כל המקומות נתפסו, נתראה בנסיעה הבאה.'
		}
	];
	return examples
		.map(({ day, time, ...overrides }, i): Ride => ({
			id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
			ride_type: 'driver',
			direction: 'vienna_to_bts',
			departure_at: localDeparture(addDays(today, day), time),
			flexibility_minutes: 30,
			passenger_count: 1,
			available_seats: null,
			origin_area: 'וינה, פראטרשטרן',
			destination_area: 'שדה התעופה ברטיסלבה',
			flight_number: null,
			note: null,
			display_name: 'דניאל',
			status: 'active',
			created_at: now.toISOString(),
			...overrides
		}))
		.filter((ride) => Date.parse(ride.departure_at) >= now.getTime());
}
