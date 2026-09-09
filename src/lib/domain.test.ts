import { describe, expect, it } from 'vitest';
import {
	addDays,
	isPotentialMatch,
	localDate,
	localDeparture,
	parseRide,
	safeNext,
	validatePublicText,
	type Ride
} from './domain';
import { demoRides } from './demo';

const baseline: Ride = {
	id: 'a',
	ride_type: 'driver',
	direction: 'vienna_to_bts',
	departure_at: '2026-09-11T08:00:00Z',
	flexibility_minutes: 30,
	passenger_count: 1,
	available_seats: 2,
	origin_area: 'וינה',
	destination_area: 'ברטיסלבה',
	flight_number: null,
	note: null,
	display_name: 'דניאל',
	status: 'active',
	created_at: '2026-09-09T08:00:00Z'
};
const passenger: Ride = {
	...baseline,
	id: 'b',
	ride_type: 'passenger',
	passenger_count: 2,
	available_seats: null,
	departure_at: '2026-09-11T09:00:00Z'
};
describe('potential matches', () => {
	it('includes windows touching at one boundary symmetrically', () => {
		expect(isPotentialMatch(baseline, passenger)).toBe(true);
		expect(isPotentialMatch(passenger, baseline)).toBe(true);
	});
	it('rejects insufficient seats, opposite direction, cancellation and self', () => {
		expect(isPotentialMatch({ ...baseline, available_seats: 1 }, passenger)).toBe(false);
		expect(isPotentialMatch(baseline, { ...passenger, direction: 'bts_to_vienna' })).toBe(false);
		expect(isPotentialMatch(baseline, { ...passenger, status: 'cancelled' })).toBe(false);
		expect(isPotentialMatch(baseline, baseline)).toBe(false);
	});
	it('matches taxis and treats flexible as the same Vienna day', () => {
		const taxi: Ride = { ...baseline, ride_type: 'taxi', flexibility_minutes: null };
		expect(
			isPotentialMatch(taxi, {
				...passenger,
				ride_type: 'taxi',
				departure_at: '2026-09-11T20:00:00Z'
			})
		).toBe(true);
		expect(
			isPotentialMatch(taxi, {
				...passenger,
				ride_type: 'taxi',
				departure_at: '2026-09-11T23:00:00Z'
			})
		).toBe(false);
		expect(isPotentialMatch(taxi, passenger)).toBe(false);
	});
	it('supports finite windows overlapping across midnight', () => {
		expect(
			isPotentialMatch(
				{ ...baseline, departure_at: '2026-09-11T21:45:00Z' },
				{ ...passenger, departure_at: '2026-09-11T22:15:00Z' }
			)
		).toBe(true);
	});
});
describe('Vienna date/time', () => {
	it('uses summer and winter offsets and calendar arithmetic', () => {
		expect(localDeparture('2026-09-11', '10:00')).toBe('2026-09-11T08:00:00Z');
		expect(localDeparture('2026-12-11', '10:00')).toBe('2026-12-11T09:00:00Z');
		expect(localDate('2026-09-11T23:30:00Z')).toBe('2026-09-12');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
	it('rejects missing and duplicate DST clock times', () => {
		expect(() => localDeparture('2027-03-28', '02:30')).toThrow();
		expect(() => localDeparture('2026-10-25', '02:30')).toThrow();
	});
});
function validForm(): FormData {
	const form = new FormData();
	Object.entries({
		ride_type: 'driver',
		direction: 'vienna_to_bts',
		departure_date: '2026-09-11',
		departure_time: '10:00',
		flexibility_minutes: '30',
		available_seats: '2',
		origin_area: 'פראטרשטרן',
		destination_area: 'שדה התעופה ברטיסלבה',
		flight_number: 'W6 1234'
	}).forEach(([k, v]) => form.set(k, v));
	return form;
}
describe('ride validation and public privacy', () => {
	const now = new Date('2026-09-09T08:00:00Z');
	it('accepts realistic Hebrew and keeps flight separate', () => {
		const result = parseRide(validForm(), now);
		expect(result.error).toBeUndefined();
		expect(result.data?.flight_number).toBe('W6 1234');
	});
	it('rejects malformed counts, private contacts in notes/areas and past departures', () => {
		for (const [key, value] of [
			['available_seats', '2.5'],
			['note', 'תתקשרו +43 660 123 4567'],
			['origin_area', 'alex@example.com'],
			['departure_date', '2026-09-08'],
			['note', 'א'.repeat(281)]
		]) {
			const form = validForm();
			form.set(key, value);
			expect(parseRide(form, now).error).toBeTruthy();
		}
	});
	it('rejects contact links but permits ordinary place descriptions', () => {
		expect(validatePublicText('wa.me/436601234567')).toBeTruthy();
		expect(validatePublicText('וינה, רובע 2')).toBeNull();
	});
	it('never accepts external return targets', () => {
		for (const path of [
			'https://evil.test',
			'//evil.test',
			'/\\evil.test',
			'/login',
			'/auth/callback'
		])
			expect(safeNext(path)).toBe('/account');
		expect(safeNext('/ride/abc?contact=1')).toBe('/ride/abc?contact=1');
	});
	it('demo examples cover both routes, all types, full rides and matches', () => {
		const rides = demoRides(now);
		expect(new Set(rides.map((r) => r.ride_type)).size).toBe(3);
		expect(new Set(rides.map((r) => r.direction)).size).toBe(2);
		expect(rides.some((r) => r.available_seats === 0)).toBe(true);
		expect(rides.some((a) => rides.some((b) => isPotentialMatch(a, b)))).toBe(true);
	});
});
