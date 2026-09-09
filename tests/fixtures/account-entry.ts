import { mount } from 'svelte';
import AccountPage from '../../src/routes/account/+page.svelte';
import '../../src/app.css';
import '@fontsource-variable/heebo';

const method = new URL(location.href).searchParams.get('method') ?? 'telegram';
if (method !== 'telegram' && method !== 'email' && method !== 'whatsapp') {
	throw new Error('Unsupported contact fixture method');
}
const values: Record<'telegram' | 'email' | 'whatsapp', string> = {
	telegram: 'layout_fixture',
	email: 'layout-fixture@example.com',
	whatsapp: '+436601112222'
};

// Loaded only by Playwright's intercepted fixture document through the Vite dev server.
// No application route, authentication override, or backend request is involved.
mount(AccountPage, {
	target: document.getElementById('account-test-root')!,
	props: {
		form: null,
		data: {
			user: { display_name: 'בדיקת תצוגה' },
			configured: true,
			demo: false,
			loadError: null,
			profile: { display_name: 'בדיקת תצוגה' },
			contact: { method, value: values[method] },
			rides: [],
			requests: [],
			legalAccepted: true,
			next: ''
		}
	}
});
