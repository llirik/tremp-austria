import { describe, expect, it } from 'vitest';
import { parseProfile } from './contact-validation';
import { validId } from './backend';

function profile(values: Record<string, string | undefined> = {}) {
	const form = new FormData();
	for (const [name, value] of Object.entries({ display_name: 'דנה', method: 'whatsapp', value: '+43 660 123 4567', ...values })) if (value !== undefined) form.set(name, value);
	return form;
}

describe('private contact validation', () => {
	it('normalizes a private international phone number', () => {
		expect(parseProfile(profile())).toEqual({ display_name: 'דנה', contact: { method: 'whatsapp', value: '+436601234567' } });
	});
	it('accepts private email and Telegram handles', () => {
		expect(parseProfile(profile({ method: 'email', value: 'hello@example.test' }))).not.toHaveProperty('error');
		expect(parseProfile(profile({ method: 'telegram', value: '@dana_test' }))).toHaveProperty('contact.value', 'dana_test');
	});
	it.each([
		{ display_name: 'hello@example.test' },
		{ display_name: '+43 660 1234567' },
		{ display_name: 'https://example.test' },
		{ value: '06601234567' },
		{ value: '+430000000000000000000' },
		{ method: 'telegram', value: 'https://t.me/dana_test' },
		{ method: 'telegram', value: 'dana?redirect=evil' },
		{ method: 'email', value: 'person@example.test\nBcc: other@example.test' },
		{ method: 'email', value: 'a@b.c' },
		{ method: 'email', value: 'דנה@example.test' },
		{ method: 'email', value: 'person@-example.test' },
		{ method: 'unknown' }
	])('rejects malformed private contact or public contact leakage: %o', (values) => {
		expect(parseProfile(profile(values))).toHaveProperty('error');
	});
});

describe('database identifier boundary', () => {
	it('accepts UUIDs and rejects unsafe or missing input', () => {
		expect(validId('a5103482-e921-4aa6-a97c-a7013d8f20dc')).toBe(true);
		for (const value of [null, undefined, '', '../account', 'owner_id.eq.other', '00000000']) expect(validId(value)).toBe(false);
	});
});
