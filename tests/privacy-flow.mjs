import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// Run against an already-started application and migrated Supabase test instance.
// Secrets are environment-only. The privileged client creates/verifies/removes
// synthetic Auth fixtures; application operations use each user's ordinary JWT.
const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:5176').origin;
const supabaseUrl = process.env.SUPABASE_TEST_URL;
const publicKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
assert.ok(supabaseUrl && publicKey && serviceKey, 'Provide SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY and SUPABASE_TEST_SERVICE_KEY.');
const loopback = (url) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
assert.ok((loopback(base) && loopback(supabaseUrl)) || process.env.ALLOW_HOSTED_PRIVACY_TESTS === '1', 'Hosted testing requires explicit ALLOW_HOSTED_PRIVACY_TESTS=1. Only synthetic accounts will be modified.');
const fixturePrefix = `tremp-privacy-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(supabaseUrl, serviceKey, clientOptions);
const anonymous = createClient(supabaseUrl, publicKey, clientOptions);
const fixtures = [];
const checks = [];
const runtimeErrors = [];
const artifactDirectory = 'output/playwright';
let browser;
let currentPage;
let stage = 'initialization';
let completed = false;
let cleaned = 0;

function checked(name) {
	checks.push(name);
	console.log(`PASS ${name}`);
}

function assertSafeResult(result, message) {
	assert.ok(!result.error, message);
	return result.data;
}

async function boundedWait(promise, message, timeoutMs = 10_000) {
	let timeout;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), timeoutMs); })
		]);
	} finally { clearTimeout(timeout); }
}

async function visit(page, path, status = 200) {
	currentPage = page;
	const response = await page.goto(`${base}${path}`);
	assert.equal(response?.status(), status, `Unexpected response status for ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')}`);
	if (status === 200) await page.waitForLoadState('networkidle');
	return response;
}

async function mobile(page) {
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile page overflows horizontally');
}

async function screenshot(page, name) {
	currentPage = page;
	await mobile(page);
	await page.screenshot({ path: `${artifactDirectory}/privacy-${name}.png`, fullPage: true });
}

async function post(page, path, form) {
	// Match a normal browser form: SvelteKit's JSON enhancement protocol instead
	// wraps action failures/redirects inside an HTTP 200 response.
	return page.request.post(`${base}${path}`, { form, headers: { origin: base, accept: 'text/html' }, maxRedirects: 0 });
}

async function account(role, width) {
	const email = `${fixturePrefix}-${role}@example.test`;
	const password = `Temporary-A9!${randomUUID()}`;
	const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
	assert.ok(!created.error && created.data.user, 'Synthetic Auth fixture creation failed');
	const fixture = { id: created.data.user.id, email, deleted: false };
	fixtures.push(fixture);
	const jar = new Map();
	const client = createServerClient(supabaseUrl, publicKey, { cookies: {
		getAll: () => [...jar.values()],
		setAll: (cookies) => { for (const cookie of cookies) jar.set(cookie.name, cookie); }
	} });
	assertSafeResult(await client.auth.signInWithPassword({ email, password }), 'Synthetic fixture sign-in failed');
	const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 932 }, locale: 'he-IL', timezoneId: 'Europe/Vienna' });
	await context.addCookies([...jar.values()].map((cookie) => ({ name: cookie.name, value: cookie.value, domain: new URL(base).hostname, path: '/', httpOnly: true, secure: base.startsWith('https:'), sameSite: 'Lax' })));
	const page = await context.newPage();
	page.on('pageerror', (error) => runtimeErrors.push(error.name));
	return { ...fixture, fixture, page, client, context, contact: `${fixturePrefix}-${role}-contact@example.test` };
}

async function saveProfile(actor, displayName, exerciseAcceptance = false) {
	const { page, client } = actor;
	await visit(page, '/account');
	const form = page.locator('form[action="?/saveProfile"]');
	const checkbox = form.locator('[name="accept_legal"]');
	await expect(checkbox).not.toBeChecked();
	const termsVersion = await form.locator('[name="terms_version"]').inputValue();
	const privacyVersion = await form.locator('[name="privacy_version"]').inputValue();
	const values = { display_name: displayName, method: 'email', value: actor.contact, terms_version: termsVersion, privacy_version: privacyVersion };
	if (exerciseAcceptance) {
		const missing = await post(page, '/account?/saveProfile', values);
		assert.equal(missing.status(), 400, 'Profile write bypassed unchecked Terms acceptance');
		const stale = await post(page, '/account?/saveProfile', { ...values, accept_legal: 'yes', privacy_version: '2000-01-01' });
		assert.equal(stale.status(), 400, 'Stale legal form was silently accepted');
		const profiles = assertSafeResult(await client.from('profiles').select('display_name'), 'Own profile query failed');
		assert.deepEqual(profiles, [], 'Failed acceptance must not create a profile');
		assert.equal(assertSafeResult(await client.rpc('has_current_legal_acceptance'), 'Acceptance status query failed'), false);
		checked('Unchecked and stale legal submissions fail before profile creation');
	}
	await form.locator('[name="display_name"]').fill(displayName);
	await form.locator('[name="method"]').selectOption('email');
	await form.locator('[name="value"]').fill(actor.contact);
	await expect(form.locator('[name="display_name"]')).toHaveValue(displayName);
	if (exerciseAcceptance) await screenshot(page, 'acceptance-390');
	await checkbox.check();
	await form.getByRole('button', { name: 'שמירת הפרטים', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('הפרטים נשמרו');
	const acceptance = assertSafeResult(await client.from('legal_acceptances').select('accepted_terms_version,accepted_privacy_version,accepted_at').single(), 'Acceptance record could not be read');
	assert.equal(acceptance.accepted_terms_version, termsVersion);
	assert.equal(acceptance.accepted_privacy_version, privacyVersion);
	assert.ok(Number.isFinite(Date.parse(acceptance.accepted_at)), 'Acceptance timestamp is missing');
	await mobile(page);
}

async function exerciseContactDrafts(actor) {
	const { page, client } = actor;
	await visit(page, '/account');
	const form = page.locator('form[action="?/saveProfile"]');
	const method = form.locator('[name="method"]');
	const value = form.locator('[name="value"]');
	// Keep the locator stable when the button switches to its saving label.
	const save = form.locator('button[type="submit"]');
	const telegramSeed = 'tremp_test_fixture';
	const telegramDraft = '@tremp_roundtrip_fixture';
	const emailDraft = actor.contact;
	const phoneDraft = '+43 (660) 123-4567';
	const canonicalPhone = '+436601234567';
	const invalidPhone = 'local invalid phone draft';
	const savedContact = async () => assertSafeResult(await client.from('private_contacts').select('method,value').single(), 'Saved contact query failed');
	const submit = async (expectedStatus) => {
		const [response] = await Promise.all([
			page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/account?/saveProfile')),
			save.click()
		]);
		const result = await response.json();
		assert.equal(result.status, expectedStatus, 'Unexpected profile action result');
		assert.equal(result.type, expectedStatus === 200 ? 'success' : 'failure');
		await expect(save).toBeEnabled();
	};

	// Seed through the real form; reload so no prior email draft survives in memory.
	await method.selectOption('telegram');
	await value.fill(`@${telegramSeed}`);
	await submit(200);
	await expect(value).toHaveValue(telegramSeed);
	assert.deepEqual(await savedContact(), { method: 'telegram', value: telegramSeed });
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(method).toHaveValue('telegram');
	await expect(value).toHaveValue(telegramSeed);
	const originalViewport = page.viewportSize();
	for (const width of [320, 1440]) {
		await page.setViewportSize({ width, height: width === 320 ? 812 : 1000 });
		await screenshot(page, `account-contact-after-${width}`);
		await page.locator('section[aria-labelledby="profile-heading"]').screenshot({ path: `${artifactDirectory}/account-contact-panel-after-${width}.png` });
	}
	await page.setViewportSize(originalViewport);
	await method.selectOption('email');
	await expect(value).toHaveValue('');
	await value.fill(emailDraft);
	await method.selectOption('whatsapp');
	await expect(value).toHaveValue('');
	await value.fill(phoneDraft);
	await method.selectOption('telegram');
	await expect(value).toHaveValue(telegramSeed);
	await value.fill('');
	await method.selectOption('email');
	await expect(value).toHaveValue(emailDraft);
	await method.selectOption('telegram');
	await expect(value).toHaveValue('');
	await value.fill(telegramDraft);
	await method.selectOption('whatsapp');
	await expect(value).toHaveValue(phoneDraft);
	checked('Contact drafts seed only the saved method and survive switches, including an explicitly cleared value');

	await value.fill(invalidPhone);
	await submit(400);
	await expect(page.getByRole('alert')).toContainText('WhatsApp');
	await expect(method).toHaveValue('whatsapp');
	await expect(value).toHaveValue(invalidPhone);
	assert.deepEqual(await savedContact(), { method: 'telegram', value: telegramSeed });
	await method.selectOption('email');
	await expect(value).toHaveValue(emailDraft);
	await method.selectOption('telegram');
	await expect(value).toHaveValue(telegramDraft);
	await method.selectOption('whatsapp');
	await expect(value).toHaveValue(invalidPhone);
	checked('Server validation failure retains the active contact value and other method drafts without changing saved data');

	await value.fill(phoneDraft);
	const submitted = await form.evaluate((element) => [...new FormData(element).entries()]);
	assert.deepEqual(submitted.filter(([name]) => name === 'value'), [['value', phoneDraft]]);
	assert.deepEqual(submitted.filter(([name]) => name === 'method'), [['method', 'whatsapp']]);
	for (const unused of [emailDraft, telegramDraft]) assert.equal(JSON.stringify(submitted).includes(unused), false, 'An unused contact draft entered the submitted form');
	await submit(200);
	await expect(value).toHaveValue(canonicalPhone);
	assert.deepEqual(await savedContact(), { method: 'whatsapp', value: canonicalPhone });
	await method.selectOption('email');
	await expect(value).toHaveValue(emailDraft);
	await method.selectOption('telegram');
	await expect(value).toHaveValue(telegramDraft);
	await method.selectOption('whatsapp');
	await expect(value).toHaveValue(canonicalPhone);
	// Hold the captured request while the user edits. Its eventual real response
	// must not overwrite a newer draft or selection made while saving is pending.
	const pendingPhoneDraft = '+43 (660) 765-4321';
	const requestReady = Promise.withResolvers();
	const releaseRequest = Promise.withResolvers();
	const requestContinued = Promise.withResolvers();
	let routeStarted = false;
	const savePattern = /\/account\?\/saveProfile(?:$|&)/;
	await page.route(savePattern, async (route) => {
		routeStarted = true;
		requestReady.resolve();
		try {
			await releaseRequest.promise;
			await route.continue();
			requestContinued.resolve(null);
		} catch (error) { requestContinued.resolve(error); }
	});
	try {
		await value.fill(phoneDraft);
		// Observe rejections immediately, even if an earlier interaction fails and
		// this response is never awaited. Outer fixture cleanup must still run.
		const pendingResponse = page.waitForResponse(
			(response) => response.request().method() === 'POST' && response.url().includes('/account?/saveProfile'),
			{ timeout: 10_000 }
		).then((response) => ({ response, error: null }), (error) => ({ response: null, error }));
		await save.click();
		await boundedWait(requestReady.promise, 'Profile save did not start a request');
		await expect(save).toBeDisabled();
		await value.fill(pendingPhoneDraft);
		await method.selectOption('email');
		await expect(value).toHaveValue(emailDraft);
		releaseRequest.resolve();
		assert.equal(await boundedWait(requestContinued.promise, 'Held profile request did not continue'), null, 'Held profile request could not continue');
		const pending = await pendingResponse;
		assert.ok(!pending.error && pending.response, 'Profile save response did not arrive');
		assert.equal((await pending.response.json()).type, 'success');
		await expect(save).toBeEnabled();
		await expect(method).toHaveValue('email');
		await expect(value).toHaveValue(emailDraft);
		await method.selectOption('whatsapp');
		await expect(value).toHaveValue(pendingPhoneDraft);
		assert.deepEqual(await savedContact(), { method: 'whatsapp', value: canonicalPhone });
	} finally {
		releaseRequest.resolve();
		try {
			if (routeStarted) await boundedWait(requestContinued.promise, 'Held request cleanup timed out', 2_000);
		} finally { await page.unroute(savePattern); }
	}
	checked('Saving submits only the selected method, normalizes its value and preserves newer edits made while the response is pending');

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(method).toHaveValue('whatsapp');
	await expect(value).toHaveValue(canonicalPhone);
	await method.selectOption('email');
	await expect(value).toHaveValue('');
	await method.selectOption('telegram');
	await expect(value).toHaveValue('');
	const browserStorage = await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
	assert.equal(browserStorage.local.length, 0, 'Contact editing wrote to localStorage');
	// SvelteKit may store navigation/scroll state in sessionStorage. None of those
	// framework entries may contain a private contact value or unsaved draft.
	for (const contact of [telegramSeed, telegramDraft, emailDraft, phoneDraft, canonicalPhone, pendingPhoneDraft]) {
		assert.equal(JSON.stringify(browserStorage).includes(contact), false, 'Private drafts were persisted in browser storage');
	}
	checked('Reload retains only the saved contact method and does not persist private drafts in browser storage');

	// Restore the fixture's original contact for the existing participant tests.
	await method.selectOption('email');
	await value.fill(actor.contact);
	await submit(200);
	assert.deepEqual(await savedContact(), { method: 'email', value: actor.contact });
	await mobile(page);
}

async function deleteThroughUi(actor, survivor) {
	const { page } = actor;
	await visit(page, '/account');
	const missing = await post(page, '/account?/deleteAccount', { target_id: survivor.id });
	assert.equal(missing.status(), 400, 'Missing deletion confirmation was accepted');
	assertSafeResult(await admin.auth.admin.getUserById(actor.id), 'Unconfirmed deletion removed the Auth fixture');
	const form = page.locator('form[action="?/deleteAccount"]');
	await expect(form.locator('[name="confirm_delete"]')).not.toBeChecked();
	await expect(page.getByRole('heading', { name: 'מחיקת החשבון', exact: true })).toBeVisible();
	await screenshot(page, `deletion-${page.viewportSize().width}`);
	await form.locator('[name="confirm_delete"]').check();
	await form.getByRole('button', { name: 'מחיקה קבועה של החשבון', exact: true }).click();
	await page.waitForURL(`${base}/account-deleted`);
	await expect(page.getByRole('heading', { name: 'החשבון נמחק', exact: true })).toBeVisible();
	const removed = await admin.auth.admin.getUserById(actor.id);
	assert.ok(removed.error && !removed.data.user, 'Self-service deletion left the Auth user behind');
	actor.fixture.deleted = true;
	assertSafeResult(await admin.auth.admin.getUserById(survivor.id), 'Deletion affected another Auth account');
	assert.equal((await actor.context.cookies()).some((cookie) => /^sb-.*-auth-token/.test(cookie.name) && cookie.value), false, 'Deleted user retained a session cookie');
	await page.goto(`${base}/account`);
	await page.waitForURL(/\/login\?/);
}

try {
	await mkdir(artifactDirectory, { recursive: true });
	browser = await chromium.launch({ headless: true });
	const anonContext = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: 'he-IL' });
	const anonPage = await anonContext.newPage();
	anonPage.on('pageerror', (error) => runtimeErrors.push(error.name));
	stage = 'public legal pages';
	for (const path of ['/about', '/privacy', '/terms', '/impressum']) {
		await visit(anonPage, path);
		await mobile(anonPage);
		for (const legalPath of ['/about', '/privacy', '/terms', '/impressum']) await expect(anonPage.locator(`footer a[href="${legalPath}"]`)).toBeVisible();
	}
	await expect(anonPage.locator('main')).toContainText('Kirill Vodopianov');
	await expect(anonPage.locator('main')).toContainText('Kaiserstraße 63');
	await expect(anonPage.locator('main')).toContainText('6370 Reith bei Kitzbühel');
	await expect(anonPage.locator('main')).toContainText('Austria');
	await expect(anonPage.locator('main')).toContainText('tremp.austria@gmail.com');
	await screenshot(anonPage, 'impressum-430');
	checked('Legal pages and footer are public, Hebrew RTL and mobile-safe');

	stage = 'synthetic account onboarding';
	const owner = await account('owner', 390);
	const requester = await account('requester', 430);
	const reporter = await account('reporter', 390);
	await saveProfile(owner, 'בדיקת פרטיות א', true);
	await saveProfile(requester, 'בדיקת פרטיות ב');
	checked('Two mobile profiles explicitly accept current document versions');
	stage = 'private contact draft handling';
	await exerciseContactDrafts(owner);

	stage = 'ride creation';
	await visit(owner.page, '/new');
	const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 3 * 86400000));
	await owner.page.locator('[name="departure_date"]').fill(date);
	await owner.page.locator('[name="departure_time"]').fill('10:30');
	await owner.page.locator('[name="origin_area"]').fill('מרכז וינה');
	await owner.page.locator('[name="destination_area"]').fill('שדה התעופה ברטיסלבה');
	await owner.page.locator('[name="available_seats"]').selectOption('3');
	await owner.page.locator('[name="flight_number"]').fill('W6 1234');
	await owner.page.locator('[name="note"]').fill('כתבו אל privacy-test@example.test');
	await owner.page.getByRole('button', { name: 'פרסום הנסיעה', exact: true }).click();
	await expect(owner.page.getByRole('alert')).toContainText('פרטי קשר');
	assert.equal(new URL(owner.page.url()).pathname, '/new', 'A public note with contact details was published');
	checked('Public note validation rejects obvious contact details with a Hebrew explanation');
	await owner.page.locator('[name="note"]').fill('בדיקה זמנית של המערכת.\nיש מקום למזוודה.');
	await screenshot(owner.page, 'create-390');
	await owner.page.getByRole('button', { name: 'פרסום הנסיעה', exact: true }).click();
	await owner.page.waitForURL(/\/ride\/[0-9a-f-]+$/);
	const rideId = new URL(owner.page.url()).pathname.split('/').at(-1);
	assert.match(rideId, /^[0-9a-f-]{36}$/);
	checked('An accepted account creates a listing through the mobile UI');

	stage = 'public/private data separation';
	await visit(anonPage, `/ride/${rideId}`);
	await expect(anonPage.locator('.detail-author')).toContainText('בדיקת פרטיות א');
	const publicHtml = await anonPage.content();
	for (const privateValue of [owner.contact, requester.contact, owner.id, requester.id, owner.email, requester.email]) assert.equal(publicHtml.includes(privateValue), false, 'Public HTML leaked private account data');
	const publicRows = assertSafeResult(await anonymous.from('public_rides').select('*').eq('id', rideId), 'Public listing query failed');
	assert.equal(publicRows.length, 1);
	for (const privateColumn of ['owner_id', 'user_id', 'email', 'contact', 'value']) assert.equal(privateColumn in publicRows[0], false, 'Public view exposed a private column');
	assert.ok((await anonymous.from('private_contacts').select('value')).error, 'Anonymous private contact query unexpectedly succeeded');
	assert.deepEqual(assertSafeResult(await requester.client.from('profiles').select('display_name').eq('id', owner.id), 'Private profile isolation query failed'), []);
	assert.deepEqual(assertSafeResult(await requester.client.from('private_contacts').select('value').eq('user_id', owner.id), 'Private-contact isolation query failed'), []);
	checked('Public page and direct anonymous queries expose only intended listing data');

	stage = 'anonymous and authenticated reporting';
	await anonPage.locator('.report-listing summary').click();
	await expect(anonPage.getByRole('link', { name: 'כניסה כדי לדווח', exact: true })).toBeVisible();
	const anonymousReport = await post(anonPage, `/ride/${rideId}?/reportListing`, { reason: 'spam' });
	assert.equal(anonymousReport.status(), 303);
	assert.ok(anonymousReport.headers().location?.startsWith('/login?'), 'Anonymous report did not require sign-in');
	assert.equal(assertSafeResult(await reporter.client.rpc('has_current_legal_acceptance'), 'Reporter acceptance status failed'), false);
	await visit(reporter.page, `/ride/${rideId}?report=1`);
	const reportText = 'בדיקה פרטית עבור מפעיל הלוח בלבד';
	await reporter.page.locator('[name="reason"]').selectOption('spam');
	await reporter.page.locator('[name="explanation"]').fill(reportText);
	await screenshot(reporter.page, 'report-390');
	await reporter.page.getByRole('button', { name: 'שליחת דיווח', exact: true }).click();
	await expect(reporter.page.getByRole('status')).toContainText('הדיווח התקבל');
	const reports = assertSafeResult(await reporter.client.from('listing_reports').select('id,ride_id,reason,explanation,created_at').eq('ride_id', rideId), 'Reporter could not read own report');
	assert.equal(reports.length, 1);
	assert.equal(reports[0].explanation, reportText);
	assert.deepEqual(assertSafeResult(await owner.client.from('listing_reports').select('id,explanation').eq('ride_id', rideId), 'Other report query failed'), []);
	assert.ok((await reporter.client.from('listing_reports').select('status')).error, 'Reporter read internal moderation status');
	assert.ok((await owner.client.from('listing_reports').update({ status: 'dismissed' }).eq('id', reports[0].id)).error, 'Another user could change report moderation status');
	await visit(anonPage, `/ride/${rideId}`);
	assert.equal((await anonPage.content()).includes(reportText), false, 'Report explanation leaked into public HTML');
	checked('Reporting requires authentication, works before onboarding and keeps moderation data private');

	stage = 'deletion before legal acceptance';
	await deleteThroughUi(reporter, owner);
	const reportAfterDeletion = await reporter.client.from('listing_reports').select('id').eq('ride_id', rideId);
	assert.ok(reportAfterDeletion.error || reportAfterDeletion.data.length === 0, 'Deleted reporter left an authored report behind');
	await visit(anonPage, `/ride/${rideId}`);
	checked('An account without legal acceptance can delete itself; another account and listing survive');

	stage = 'contact request and approval';
	await visit(requester.page, `/ride/${rideId}`);
	await requester.page.getByRole('button', { name: 'בקשה ליצירת קשר', exact: true }).click();
	await expect(requester.page.getByRole('heading', { name: 'בקשת הקשר בדרך' })).toBeVisible();
	await visit(requester.page, '/account');
	await expect(requester.page.locator('.private-contact')).toHaveCount(0);
	await visit(owner.page, '/account');
	await owner.page.getByRole('button', { name: 'אישור וחשיפת פרטים', exact: true }).click();
	await expect(owner.page.locator('.private-contact')).toContainText(requester.contact);
	await requester.page.reload();
	await expect(requester.page.locator('.private-contact')).toContainText(owner.contact);
	assert.equal(assertSafeResult(await requester.client.from('private_contacts').select('value').eq('user_id', owner.id), 'Accepted contact query failed')[0]?.value, owner.contact);
	await screenshot(requester.page, 'contact-430');
	checked('Pending contact requests stay private and owner approval reveals contacts only to participants');

	stage = 'contact revocation';
	await requester.page.getByRole('button', { name: 'ביטול הגישה לפרטי הקשר', exact: true }).click();
	await expect(requester.page.locator('.private-contact')).toHaveCount(0);
	await owner.page.reload();
	await expect(owner.page.locator('.private-contact')).toHaveCount(0);
	assert.deepEqual(assertSafeResult(await requester.client.from('private_contacts').select('value').eq('user_id', owner.id), 'Revoked contact query failed'), []);
	checked('Revocation removes counterpart contact access from UI and direct database queries');

	stage = 'ride ownership, editing and cancellation';
	await visit(requester.page, `/ride/${rideId}/edit`, 404);
	const forbiddenWrite = await post(requester.page, `/ride/${rideId}/edit?/cancel`, {});
	assert.equal(forbiddenWrite.status(), 404, 'Another user could cancel the listing');
	await visit(owner.page, `/ride/${rideId}/edit`);
	await owner.page.locator('[name="available_seats"]').selectOption('2');
	await owner.page.getByRole('button', { name: 'שמירת השינויים', exact: true }).click();
	await owner.page.waitForURL(`${base}/ride/${rideId}`);
	await expect(owner.page.getByText('2 מקומות פנויים', { exact: true })).toBeVisible();
	await visit(owner.page, `/ride/${rideId}/edit`);
	await owner.page.getByRole('button', { name: 'ביטול הנסיעה', exact: true }).click();
	await owner.page.getByRole('button', { name: 'כן, ביטול הנסיעה', exact: true }).click();
	await owner.page.waitForURL(/\/account\?cancelled=1$/);
	await visit(anonPage, `/ride/${rideId}`, 404);
	checked('Only the owner can edit/cancel a listing, and cancellation removes public access');

	stage = 'own account and application-data deletion';
	await deleteThroughUi(owner, requester);
	assert.deepEqual(assertSafeResult(await requester.client.rpc('get_my_contact_requests'), 'Survivor contact request query failed'), []);
	const ownDeletedRows = await owner.client.from('rides').select('id').eq('id', rideId);
	assert.ok(ownDeletedRows.error || ownDeletedRows.data.length === 0, 'Account deletion retained the owner listing');
	const privateDeletedRows = await owner.client.from('private_contacts').select('value').eq('user_id', owner.id);
	assert.ok(privateDeletedRows.error || privateDeletedRows.data.length === 0, 'Account deletion retained private contact details');
	await visit(requester.page, '/account');
	await expect(requester.page.locator('[name="display_name"]')).toHaveValue('בדיקת פרטיות ב');
	checked('Explicit self-service deletion removes Auth, profile/contact, listings and requests while preserving another account');
	assert.deepEqual(runtimeErrors, [], 'Browser runtime errors occurred');
	checked('No browser runtime errors during the complete privacy and core ride flows');
	completed = true;
} catch (error) {
	if (currentPage) await currentPage.screenshot({ path: `${artifactDirectory}/privacy-flow-failure.png`, fullPage: true }).catch(() => {});
	// Provider objects, credentials, cookies and tokens never enter test reports.
	let message = error instanceof Error ? error.message : 'Unknown test failure';
	for (const key of [serviceKey, publicKey]) message = message.replaceAll(key, '[redacted]');
	console.error(`FAIL ${stage}: ${message.slice(0, 1600)}`);
	process.exitCode = 1;
} finally {
	for (const fixture of fixtures) {
		if (fixture.deleted) { cleaned += 1; continue; }
		try {
			const { error } = await admin.auth.admin.deleteUser(fixture.id);
			if (error) { console.error('FAIL synthetic fixture cleanup'); process.exitCode = 1; }
			else cleaned += 1;
		} catch { console.error('FAIL synthetic fixture cleanup'); process.exitCode = 1; }
	}
	console.log(`Cleanup: removed ${cleaned}/${fixtures.length} synthetic Auth accounts and cascading test data.`);
	if (browser) await browser.close();
	await mkdir(artifactDirectory, { recursive: true });
	await writeFile(`${artifactDirectory}/privacy-flow-results.json`, JSON.stringify({ completed: completed && cleaned === fixtures.length, passed: checks, failedStage: completed ? null : stage, runtimeErrorCount: runtimeErrors.length, syntheticAccountsRemoved: cleaned === fixtures.length }, null, 2));
}
