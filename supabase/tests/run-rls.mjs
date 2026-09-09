import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine. Only Supabase's external Auth primitives are supplied
// here; migrations, grants, policies, triggers, constraints and RPCs are unmodified.
const db = new PGlite();
let passed = 0;
const ids = {
	owner: '30000000-0000-4000-8000-000000000001',
	requester: '30000000-0000-4000-8000-000000000002',
	outsider: '30000000-0000-4000-8000-000000000003',
	incomplete: '30000000-0000-4000-8000-000000000004',
	spammer: '30000000-0000-4000-8000-000000000005'
};
const rideId = '40000000-0000-4000-8000-000000000001';
let requestId;

async function check(name, fn) {
	await fn();
	passed += 1;
	console.log(`✓ ${name}`);
}

async function as(role, userId, fn) {
	return db.transaction(async (tx) => {
		// Role names are controlled by this test, never external input.
		assert.ok(['anon', 'authenticated'].includes(role));
		await tx.exec(`set local role ${role}`);
		await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
		return fn(tx);
	});
}
const user = (key, fn) => as('authenticated', ids[key], fn);
const anon = (fn) => as('anon', null, fn);
const denied = (fn, code = '42501') => assert.rejects(fn, (error) => error.code === code);
const rows = async (tx, sql, parameters = []) => (await tx.query(sql, parameters)).rows;

async function insertRide(tx, overrides = {}) {
	const ride = {
		id: crypto.randomUUID(),
		ride_type: 'driver',
		direction: 'vienna_to_bts',
		available_seats: 3,
		passenger_count: 1,
		origin_area: 'מרכז וינה',
		destination_area: 'שדה התעופה ברטיסלבה',
		note: 'יוצאים מחר בבוקר, יש מקום למזוודה.',
		...overrides
	};
	const columns = Object.keys(ride);
	const placeholders = columns.map((_, index) => `$${index + 1}`);
	return rows(
		tx,
		`insert into public.rides (${columns.join(',')}, departure_at)
    values (${placeholders.join(',')}, now() + interval '1 day') returning *`,
		Object.values(ride)
	);
}

try {
	await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key, aud text, role text, email text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb, raw_user_meta_data jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    -- Match Supabase's permissive defaults so missing explicit revokes fail tests.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
	const migrationDirectory = new URL('../migrations/', import.meta.url);
	for (const name of (await readdir(migrationDirectory))
		.filter((name) => name.endsWith('.sql'))
		.sort()) {
		await db.exec(await readFile(new URL(name, migrationDirectory), 'utf8'));
	}
	await db.exec(await readFile(new URL('../seed.sql', import.meta.url), 'utf8'));

	await check(
		'local seed includes all types, both directions, full, flexible and past rides',
		async () => {
			const [result] = await rows(
				db,
				`select count(*)::int as total,
      count(distinct ride_type)::int as kinds, count(distinct direction)::int as directions,
      count(*) filter (where available_seats = 0)::int as full,
      count(*) filter (where flexibility_minutes is null)::int as flexible,
      count(*) filter (where departure_at < now())::int as past from public.rides`
			);
			assert.deepEqual(result, {
				total: 12,
				kinds: 3,
				directions: 2,
				full: 1,
				flexible: 1,
				past: 1
			});
		}
	);
	await check('anonymous users browse only active listings, with upcoming filtering', () =>
		anon(async (tx) => {
			assert.equal((await rows(tx, 'select * from public.public_rides')).length, 11);
			assert.equal(
				(await rows(tx, 'select * from public.public_rides where departure_at >= now()')).length,
				10
			);
		})
	);
	await check('public view has no ownership/auth identifiers or private contact fields', () =>
		anon(async (tx) => {
			const [ride] = await rows(tx, 'select * from public.public_rides limit 1');
			assert.deepEqual(
				Object.keys(ride).sort(),
				[
					'id',
					'ride_type',
					'direction',
					'departure_at',
					'flexibility_minutes',
					'passenger_count',
					'available_seats',
					'origin_area',
					'destination_area',
					'flight_number',
					'note',
					'status',
					'created_at',
					'updated_at',
					'display_name'
				].sort()
			);
		})
	);
	for (const table of [
		'profiles',
		'rides',
		'private_contacts',
		'contact_requests',
		'private.rate_limits'
	]) {
		await check(`anonymous direct access to ${table} is denied`, () =>
			denied(() => anon((tx) => tx.query(`select * from ${table}`)))
		);
	}
	await check('anonymous contact RPC execution is denied', () =>
		denied(() => anon((tx) => tx.query('select public.request_contact($1)', [rideId])))
	);
	await check('authenticated role without a user JWT cannot create contact requests', () =>
		denied(() =>
			as('authenticated', null, (tx) => tx.query('select public.request_contact($1)', [rideId]))
		)
	);
	await check('public listing view cannot be mutated', () =>
		denied(() => anon((tx) => tx.query("update public.public_rides set note = 'changed'")), '55000')
	);
	await check('every user table and private rate counter has RLS enabled', async () => {
		const tables = await rows(
			db,
			`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where (n.nspname = 'public' and c.relname in ('profiles','rides','private_contacts','contact_requests'))
      or (n.nspname = 'private' and c.relname = 'rate_limits')`
		);
		assert.equal(tables.length, 5);
		assert.ok(tables.every((table) => table.relrowsecurity));
	});

	for (const [name, id] of Object.entries(ids)) {
		await db.query('insert into auth.users (id) values ($1)', [id]);
		await user(name, async (tx) => {
			await tx.query('insert into public.profiles (id, display_name) values ($1, $2)', [
				id,
				`משתמש ${name}`
			]);
			if (name !== 'incomplete')
				await tx.query(
					'insert into public.private_contacts (user_id, method, value) values ($1, $2, $3)',
					[id, 'email', `${name}@example.invalid`]
				);
		});
	}
	await user('owner', (tx) => insertRide(tx, { id: rideId }));

	await check('owner can read and edit their ride', () =>
		user('owner', async (tx) => {
			assert.equal((await rows(tx, 'select * from public.rides')).length, 1);
			assert.equal(
				(
					await rows(tx, 'update public.rides set available_seats = 2 where id = $1 returning id', [
						rideId
					])
				).length,
				1
			);
		})
	);
	await check('other users cannot read or update base ride records', () =>
		user('outsider', async (tx) => {
			assert.deepEqual(await rows(tx, 'select * from public.rides where id = $1', [rideId]), []);
			assert.deepEqual(
				await rows(tx, "update public.rides set note = 'changed' where id = $1 returning id", [
					rideId
				]),
				[]
			);
			assert.deepEqual(
				await rows(tx, 'delete from public.rides where id = $1 returning id', [rideId]),
				[]
			);
		})
	);
	await check('authenticated profiles are private and own profile remains readable', () =>
		user('requester', async (tx) => {
			assert.deepEqual(
				(await rows(tx, 'select id from public.profiles')).map((profile) => profile.id),
				[ids.requester]
			);
			assert.deepEqual(
				await rows(
					tx,
					"update public.profiles set display_name = 'changed' where id = $1 returning id",
					[ids.owner]
				),
				[]
			);
		})
	);
	await check('cannot create a ride for another account', () =>
		denied(() => user('requester', (tx) => insertRide(tx, { owner_id: ids.owner })))
	);
	await check('cannot change ride ownership', () =>
		denied(() =>
			user('owner', (tx) =>
				tx.query('update public.rides set owner_id = $1 where id = $2', [ids.requester, rideId])
			)
		)
	);
	await check('cannot change ride identity', () =>
		denied(() =>
			user('owner', (tx) =>
				tx.query('update public.rides set id = $1 where id = $2', [crypto.randomUUID(), rideId])
			)
		)
	);
	await check('cannot change profile identity', () =>
		denied(() =>
			user('owner', (tx) =>
				tx.query('update public.profiles set id = $1 where id = $2', [
					crypto.randomUUID(),
					ids.owner
				])
			)
		)
	);
	await check('contacts remain private before consent', () =>
		user('requester', async (tx) => {
			assert.deepEqual(
				(await rows(tx, 'select user_id from public.private_contacts')).map(
					(contact) => contact.user_id
				),
				[ids.requester]
			);
		})
	);
	await check('cannot insert another account contact', () =>
		denied(() =>
			user('requester', (tx) =>
				tx.query(
					"insert into public.private_contacts (user_id, method, value) values ($1, 'email', 'fake@example.invalid')",
					[ids.incomplete]
				)
			)
		)
	);
	await check('cannot mutate another account contact', () =>
		user('requester', async (tx) => {
			assert.deepEqual(
				await rows(
					tx,
					"update public.private_contacts set value = 'changed@example.invalid' where user_id = $1 returning user_id",
					[ids.owner]
				),
				[]
			);
			assert.deepEqual(
				await rows(tx, 'delete from public.private_contacts where user_id = $1 returning user_id', [
					ids.owner
				]),
				[]
			);
		})
	);
	await check('request relationships cannot be inserted directly', () =>
		denied(() =>
			user('requester', (tx) =>
				tx.query(
					'insert into public.contact_requests (ride_id, requester_id, owner_id) values ($1,$2,$3)',
					[rideId, ids.requester, ids.owner]
				)
			)
		)
	);
	await check('request_contact requires profile contact completion', () =>
		denied(
			() => user('incomplete', (tx) => tx.query('select public.request_contact($1)', [rideId])),
			'22023'
		)
	);
	await check('request_contact rejects own rides', () =>
		denied(
			() => user('owner', (tx) => tx.query('select public.request_contact($1)', [rideId])),
			'22023'
		)
	);
	await check('request_contact derives both participant IDs and starts pending', async () => {
		requestId = (
			await user('requester', (tx) => rows(tx, 'select public.request_contact($1) as id', [rideId]))
		)[0].id;
		const [request] = await rows(db, 'select * from public.contact_requests where id = $1', [
			requestId
		]);
		assert.equal(request.owner_id, ids.owner);
		assert.equal(request.requester_id, ids.requester);
		assert.equal(request.status, 'pending');
	});
	await check('duplicate requests are idempotent', () =>
		user('requester', async (tx) => {
			assert.equal(
				(await rows(tx, 'select public.request_contact($1) as id', [rideId]))[0].id,
				requestId
			);
			assert.equal(
				(await rows(tx, 'select * from public.contact_requests where ride_id = $1', [rideId]))
					.length,
				1
			);
		})
	);
	await check('pending requests never reveal the counterpart contact', () =>
		user('requester', async (tx) => {
			assert.deepEqual(
				await rows(tx, 'select * from public.get_request_contact($1)', [requestId]),
				[]
			);
			assert.deepEqual(
				await rows(tx, 'select * from public.private_contacts where user_id = $1', [ids.owner]),
				[]
			);
		})
	);
	await check('request list exposes participant names without auth IDs', () =>
		user('owner', async (tx) => {
			const [request] = await rows(tx, 'select * from public.get_my_contact_requests()');
			assert.equal(request.requester_display_name, 'משתמש requester');
			assert.equal(request.owner_display_name, 'משתמש owner');
			assert.equal(request.is_owner, true);
			assert.ok(!('owner_id' in request));
			assert.ok(!('requester_id' in request));
		})
	);
	await check('an outsider cannot enumerate requests or request names', () =>
		user('outsider', async (tx) => {
			assert.deepEqual(await rows(tx, 'select * from public.contact_requests'), []);
			assert.deepEqual(await rows(tx, 'select * from public.get_my_contact_requests()'), []);
		})
	);
	await check('requester cannot accept their own request', () =>
		denied(() =>
			user('requester', (tx) =>
				tx.query("select public.respond_contact_request($1, 'accepted')", [requestId])
			)
		)
	);
	await check('outsider cannot accept a request', () =>
		denied(() =>
			user('outsider', (tx) =>
				tx.query("select public.respond_contact_request($1, 'accepted')", [requestId])
			)
		)
	);
	await check('direct status updates cannot bypass the RPC', () =>
		denied(() =>
			user('requester', (tx) =>
				tx.query("update public.contact_requests set status = 'accepted' where id = $1", [
					requestId
				])
			)
		)
	);
	await check(
		'immutable relationships are also protected against accidental privileged updates',
		() =>
			denied(() =>
				db.query('update public.contact_requests set owner_id = $1 where id = $2', [
					ids.outsider,
					requestId
				])
			)
	);
	await check('respond RPC rejects invalid/null state', async () => {
		await denied(
			() =>
				user('owner', (tx) =>
					tx.query("select public.respond_contact_request($1, 'pending')", [requestId])
				),
			'22023'
		);
		await denied(
			() =>
				user('owner', (tx) =>
					tx.query('select public.respond_contact_request($1, null)', [requestId])
				),
			'22023'
		);
	});
	await check('owner can accept a pending request', () =>
		user('owner', (tx) =>
			tx.query("select public.respond_contact_request($1, 'accepted')", [requestId])
		)
	);
	await check('accepted requester sees only own and counterpart private contacts', () =>
		user('requester', async (tx) => {
			assert.deepEqual(
				await rows(tx, 'select * from public.get_request_contact($1)', [requestId]),
				[{ method: 'email', value: 'owner@example.invalid' }]
			);
			assert.deepEqual(
				(await rows(tx, 'select user_id from public.private_contacts order by user_id')).map(
					(contact) => contact.user_id
				),
				[ids.owner, ids.requester]
			);
		})
	);
	await check('accepted owner can reveal requester contact', () =>
		user('owner', async (tx) => {
			assert.deepEqual(
				await rows(tx, 'select * from public.get_request_contact($1)', [requestId]),
				[{ method: 'email', value: 'requester@example.invalid' }]
			);
		})
	);
	await check('outsider remains unable to access accepted contacts', () =>
		user('outsider', async (tx) => {
			assert.deepEqual(
				await rows(tx, 'select * from public.get_request_contact($1)', [requestId]),
				[]
			);
			assert.equal((await rows(tx, 'select * from public.private_contacts')).length, 1);
		})
	);
	await check('accepted counterpart still cannot modify private contact', () =>
		user('requester', async (tx) => {
			assert.deepEqual(
				await rows(
					tx,
					"update public.private_contacts set value = 'changed@example.invalid' where user_id = $1 returning user_id",
					[ids.owner]
				),
				[]
			);
		})
	);
	await check('outsider cannot revoke another pair consent', () =>
		denied(() =>
			user('outsider', (tx) => tx.query('select public.revoke_contact_request($1)', [requestId]))
		)
	);
	await check(
		'requester can revoke contact and database access disappears immediately',
		async () => {
			await user('requester', (tx) =>
				tx.query('select public.revoke_contact_request($1)', [requestId])
			);
			for (const key of ['owner', 'requester'])
				await user(key, async (tx) => {
					assert.deepEqual(
						await rows(tx, 'select * from public.get_request_contact($1)', [requestId]),
						[]
					);
					assert.equal((await rows(tx, 'select * from public.private_contacts')).length, 1);
				});
		}
	);
	await check('revoked requests cannot silently be reopened', () =>
		user('requester', async (tx) => {
			await tx.query('select public.request_contact($1)', [rideId]);
			assert.equal(
				(await rows(tx, 'select status from public.contact_requests where id = $1', [requestId]))[0]
					.status,
				'revoked'
			);
		})
	);
	await check('owner can reject a new request and no contacts become visible', async () => {
		const rejectedId = (
			await user('outsider', (tx) => rows(tx, 'select public.request_contact($1) as id', [rideId]))
		)[0].id;
		await user('owner', (tx) =>
			tx.query("select public.respond_contact_request($1, 'rejected')", [rejectedId])
		);
		await user('outsider', async (tx) =>
			assert.deepEqual(
				await rows(tx, 'select * from public.get_request_contact($1)', [rejectedId]),
				[]
			)
		);
	});

	for (const [field, value] of [
		['note', 'כתוב לי alex@example.com'],
		['note', 'טלפון +43 660 123 4567'],
		['note', 'https://example.com'],
		['origin_area', '+43 660 123 4567'],
		['destination_area', 'alex@example.com'],
		['note', 'a'.repeat(281)],
		['available_seats', 9],
		['available_seats', -1],
		['available_seats', null],
		['passenger_count', 0],
		['passenger_count', 9],
		['flexibility_minutes', 45],
		['flight_number', 'not a flight']
	]) {
		await check(
			`database rejects invalid public ride field ${field}: ${String(value).slice(0, 35)}`,
			() => denied(() => user('owner', (tx) => insertRide(tx, { [field]: value })), '23514')
		);
	}
	await check('database rejects public contact information in display name', () =>
		denied(
			() =>
				user('owner', (tx) =>
					tx.query('update public.profiles set display_name = $1 where id = $2', [
						'alex@example.com',
						ids.owner
					])
				),
			'23514'
		)
	);
	await check('database rejects malformed private WhatsApp number', () =>
		denied(
			() =>
				user('owner', (tx) =>
					tx.query(
						"update public.private_contacts set method = 'whatsapp', value = '123' where user_id = $1",
						[ids.owner]
					)
				),
			'23514'
		)
	);
	await check(
		'multiline public notes permit ordinary whitespace but still reject hidden control characters',
		async () => {
			await user('owner', (tx) => insertRide(tx, { note: 'יוצאים בבוקר.\nיש מקום למזוודה.' }));
			await denied(
				() => user('owner', (tx) => insertRide(tx, { note: 'טקסט\u0007מוסתר' })),
				'23514'
			);
		}
	);
	await check('valid full driver, passenger and flexible taxi listings are accepted', () =>
		user('owner', async (tx) => {
			await insertRide(tx, { available_seats: 0 });
			await insertRide(tx, { ride_type: 'passenger', available_seats: null, passenger_count: 8 });
			await insertRide(tx, { ride_type: 'taxi', available_seats: null, flexibility_minutes: null });
		})
	);
	await check('database rejects departure dates in the past or beyond one year', async () => {
		for (const interval of ['-1 day', '400 days'])
			await denied(
				() =>
					user('owner', (tx) =>
						tx.query('update public.rides set departure_at = now() + $1::interval where id = $2', [
							interval,
							rideId
						])
					),
				'22023'
			);
	});
	await check('owner cancellation hides public listing and prevents new requests', async () => {
		await user('owner', (tx) =>
			tx.query("update public.rides set status = 'cancelled' where id = $1", [rideId])
		);
		await anon(async (tx) =>
			assert.deepEqual(
				await rows(tx, 'select * from public.public_rides where id = $1', [rideId]),
				[]
			)
		);
		await denied(
			() => user('spammer', (tx) => tx.query('select public.request_contact($1)', [rideId])),
			'22023'
		);
		await user('owner', async (tx) =>
			assert.equal((await rows(tx, 'select * from public.rides where id = $1', [rideId])).length, 1)
		);
	});
	await check('past active ride remains shareable but cannot receive requests', async () => {
		const pastId = '20000000-0000-4000-8000-000000000011';
		await anon(async (tx) =>
			assert.equal(
				(await rows(tx, 'select * from public.public_rides where id = $1', [pastId])).length,
				1
			)
		);
		await denied(
			() => user('spammer', (tx) => tx.query('select public.request_contact($1)', [pastId])),
			'22023'
		);
	});
	await check('ride deletion cascades contact requests', async () => {
		await user('owner', (tx) => tx.query('delete from public.rides where id = $1', [rideId]));
		assert.deepEqual(
			await rows(db, 'select * from public.contact_requests where ride_id = $1', [rideId]),
			[]
		);
	});
	await check('deleting a ride removes its accepted contact access', async () => {
		const [ride] = await user('owner', (tx) => insertRide(tx));
		const acceptedId = (
			await user('requester', (tx) =>
				rows(tx, 'select public.request_contact($1) as id', [ride.id])
			)
		)[0].id;
		await user('owner', (tx) =>
			tx.query("select public.respond_contact_request($1, 'accepted')", [acceptedId])
		);
		await user('requester', async (tx) =>
			assert.equal(
				(await rows(tx, 'select * from public.get_request_contact($1)', [acceptedId])).length,
				1
			)
		);
		await user('owner', (tx) => tx.query('delete from public.rides where id = $1', [ride.id]));
		await user('requester', async (tx) => {
			assert.deepEqual(
				await rows(tx, 'select * from public.get_request_contact($1)', [acceptedId]),
				[]
			);
			assert.deepEqual(
				await rows(tx, 'select * from public.private_contacts where user_id = $1', [ids.owner]),
				[]
			);
		});
	});
	await check('rate limits cannot be reset by deleting rides', async () => {
		for (let index = 0; index < 12; index++)
			await user('spammer', async (tx) => {
				const [ride] = await insertRide(tx);
				await tx.query('delete from public.rides where id = $1', [ride.id]);
			});
		await denied(() => user('spammer', (tx) => insertRide(tx)), 'P0001');
	});
	await check('authenticated users cannot reset private rate counters', () =>
		denied(() => user('spammer', (tx) => tx.query('delete from private.rate_limits')))
	);
	await check('contact request rate limits survive deletion of the related ride', async () => {
		for (let index = 0; index < 20; index++) {
			const [ride] = await insertRide(db, { owner_id: ids.owner });
			await user('spammer', (tx) => tx.query('select public.request_contact($1)', [ride.id]));
			await db.query('delete from public.rides where id = $1', [ride.id]);
		}
		const [ride] = await insertRide(db, { owner_id: ids.owner });
		await denied(
			() => user('spammer', (tx) => tx.query('select public.request_contact($1)', [ride.id])),
			'P0001'
		);
	});
	await check('security definer functions pin an empty search_path', async () => {
		const functions = await rows(
			db,
			`select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public','private') and p.prosecdef`
		);
		assert.ok(functions.length >= 5);
		assert.ok(functions.every((fn) => fn.proconfig.includes('search_path=""')));
	});
	console.log(`\n${passed} PostgreSQL authorization and validation checks passed.`);
} finally {
	await db.close();
}
