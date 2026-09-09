import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { addDays, localDate, parseRide } from '../domain';
import { parseProfile } from './contact-validation';

const db = new PGlite();
const userId = '50000000-0000-4000-8000-000000000001';

function form(values: Record<string, string>) {
	const result = new FormData();
	for (const [key, value] of Object.entries(values)) result.set(key, value);
	return result;
}

async function authenticated<T>(fn: (tx: Transaction) => Promise<T>) {
	return db.transaction(async (tx) => {
		await tx.exec('set local role authenticated');
		await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
		return fn(tx);
	});
}

beforeAll(async () => {
	await db.exec(`
		create role anon nologin;
		create role authenticated nologin;
		create schema auth;
		create table auth.users (id uuid primary key);
		create function auth.uid() returns uuid language sql stable as $$
			select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
		$$;
		grant usage on schema auth to anon, authenticated;
		grant execute on function auth.uid() to anon, authenticated;
	`);
	const migrations = import.meta.glob<string>('../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true });
	for (const name of Object.keys(migrations).sort()) {
		await db.exec(migrations[name]);
	}
	await db.query('insert into auth.users (id) values ($1)', [userId]);
	await authenticated((tx) => tx.query('insert into public.profiles (id, display_name) values ($1, $2)', [userId, 'דנה']));
}, 15000);

afterAll(async () => { await db.close(); });

describe('validated form values satisfy the real PostgreSQL schema', () => {
	it.each([
		{ method: 'whatsapp', value: '+43 (660) 123-4567' },
		{ method: 'telegram', value: '@dana_test' },
		{ method: 'email', value: 'dana+rides@example.test' }
	])('saves normalized $method contact under owner RLS', async ({ method, value }) => {
		const parsed = parseProfile(form({ display_name: 'דנה', method, value }));
		if ('error' in parsed) throw new Error(parsed.error);
		const saved = await authenticated((tx) => tx.query<{ method: string; value: string }>(`
			insert into public.private_contacts (user_id, method, value) values ($1, $2, $3)
			on conflict (user_id) do update set method = excluded.method, value = excluded.value
			returning method, value
		`, [userId, parsed.contact.method, parsed.contact.value]));
		expect(saved.rows[0]).toEqual(parsed.contact);
	});

	it.each(['driver', 'passenger', 'taxi'])('saves parsed %s listing under owner RLS', async (ride_type) => {
		const parsed = parseRide(form({
			ride_type, direction: 'vienna_to_bts', departure_date: addDays(localDate(), 2), departure_time: '10:30',
			flexibility_minutes: ride_type === 'taxi' ? 'flexible' : '30', passenger_count: '2', available_seats: '3',
			origin_area: 'מרכז וינה', destination_area: 'שדה התעופה ברטיסלבה', flight_number: 'W6 1234',
			note: 'יש מקום למזוודה.\nניפגש באזור התחנה.'
		}));
		if (!parsed.data) throw new Error(parsed.error);
		const input = parsed.data;
		// Column names come from the parser's typed object, never from raw form keys.
		const columns = Object.keys(input);
		const placeholders = columns.map((_, index) => `$${index + 1}`);
		const saved = await authenticated((tx) => tx.query<{ ride_type: string; note: string; flexibility_minutes: number | null }>(`
			insert into public.rides (${columns.join(',')}) values (${placeholders.join(',')})
			returning ride_type, note, flexibility_minutes
		`, Object.values(input)));
		expect(saved.rows[0]).toEqual({ ride_type, note: input.note, flexibility_minutes: input.flexibility_minutes });
	});
});
