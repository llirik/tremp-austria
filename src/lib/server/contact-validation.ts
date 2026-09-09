import { validatePublicText } from '../domain';
import type { PrivateContact } from './backend';

// Keep this aligned with private_contacts.valid_contact_value in the migration.
export function validEmail(value: string): boolean {
	return value.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(value);
}

export function parseProfile(form: FormData): { display_name: string; contact: PrivateContact } | { error: string } {
	const display_name = String(form.get('display_name') || '').trim();
	const method = String(form.get('method') || '');
	let value = String(form.get('value') || '').trim();
	if (display_name.length < 2 || display_name.length > 40) return { error: 'השם לתצוגה צריך להכיל 2–40 תווים.' };
	const publicError = validatePublicText(display_name);
	if (publicError) return { error: publicError };
	if (!['whatsapp', 'telegram', 'email'].includes(method)) return { error: 'בחרו איך נוח לכם להמשיך את השיחה.' };
	if (value.length > 254 || [...value].some((character) => character.charCodeAt(0) < 32)) return { error: 'פרטי הקשר אינם תקינים.' };
	if (method === 'email' && !validEmail(value)) return { error: 'יש להזין כתובת אימייל תקינה באותיות לטיניות.' };
	if (method === 'whatsapp') {
		value = value.replace(/[\s()-]/g, '');
		if (!/^\+[1-9]\d{6,14}$/.test(value)) return { error: 'הזינו מספר WhatsApp עם קידומת מדינה, למשל ‎+43…‎.' };
	}
	if (method === 'telegram') {
		value = value.replace(/^@/, '');
		if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value)) return { error: 'הזינו שם משתמש תקין בטלגרם, בלי קישור.' };
	}
	return { display_name, contact: { method: method as PrivateContact['method'], value } };
}
