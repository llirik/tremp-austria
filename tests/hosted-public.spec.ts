import { expect, test } from '@playwright/test';

const legalPaths = ['/about', '/privacy', '/terms', '/impressum'];
const operatorDetails = [
	'Kirill Vodopianov',
	'Kaiserstraße 63',
	'6370 Reith bei Kitzbühel',
	'Austria',
	'tremp.austria@gmail.com'
];

// Read-only production checks: no account fixtures, form submissions or external
// links are used. Keep them separate from the local demo and authenticated suite.
for (const path of ['/', ...legalPaths, '/login', '/account']) {
	test(`anonymous ${path} loads securely without tracking`, async ({
		page,
		context,
		baseURL
	}, testInfo) => {
		if (!baseURL) throw new Error('The hosted smoke suite requires a base URL');
		const origin = new URL(baseURL).origin;
		const thirdPartyRequests: string[] = [];
		const failedResponses: string[] = [];
		const runtimeErrors: string[] = [];
		page.on('request', (request) => {
			const url = new URL(request.url());
			if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
				thirdPartyRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
			}
		});
		page.on('response', (response) => {
			if (response.status() >= 400) {
				failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
			}
		});
		page.on('pageerror', (error) => runtimeErrors.push(error.name));

		const response = await page.goto(path);
		if (!response) throw new Error('Navigation returned no HTTP response');
		expect(response.status()).toBe(200);
		await page.waitForLoadState('networkidle');
		const finalUrl = new URL(page.url());
		expect(finalUrl.origin).toBe(origin);
		expect(finalUrl.protocol).toBe('https:');
		expect(finalUrl.pathname).toBe(path === '/account' ? '/login' : path);
		expect(response.headers()['cache-control']).toMatch(/\bno-store\b/);
		const security = await response.securityDetails();
		expect(security?.protocol).toMatch(/^TLS/);
		await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
		await expect(page.locator('main')).toBeVisible();
		expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(20);
		for (const legalPath of legalPaths) {
			await expect(page.locator(`footer a[href="${legalPath}"]`)).toBeVisible();
		}
		if (path === '/impressum' || path === '/privacy') {
			for (const detail of operatorDetails)
				await expect(page.locator('main')).toContainText(detail);
		}
		if (path === '/login' || path === '/account') {
			await expect(page.getByRole('button', { name: /Google/ })).toBeEnabled();
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			page.viewportSize()?.width ?? 0
		);
		expect(thirdPartyRequests, 'Anonymous browsing must not load third-party resources').toEqual(
			[]
		);
		// Current anonymous browsing sets no cookies at all; Google sign-in is a
		// separate explicit action, verified by the authenticated production QA.
		expect(await context.cookies(), 'Anonymous browsing must not set optional cookies').toEqual([]);
		expect(failedResponses).toEqual([]);
		expect(runtimeErrors).toEqual([]);
		await testInfo.attach('public-smoke-evidence', {
			body: JSON.stringify({
				path,
				finalUrl: page.url(),
				status: response.status(),
				tls: security?.protocol,
				resolverOverride: false
			}),
			contentType: 'application/json'
		});
	});
}
