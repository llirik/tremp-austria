import { expect, test } from '@playwright/test';

test('Hebrew public board, filters, detail and contact authentication', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('html')).toHaveAttribute('lang', 'he');
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	await expect(page.getByRole('heading', { name: 'אותה הדרך. נוסעים יחד.' })).toBeVisible();
	await expect(page.locator('.ride-card').first()).toBeVisible();
	const all = await page.locator('.ride-card').count();
	await page.getByLabel('סינון לפי כיוון').selectOption('bts_to_vienna');
	await expect.poll(() => page.locator('.ride-card').count()).toBeLessThan(all);
	await page.getByLabel('סינון לפי כיוון').selectOption('all');
	await page.getByRole('button', { name: 'מחפש טרמפ', exact: true }).click();
	await expect(page.locator('.ride-card')).toHaveCount(2);
	await page.getByRole('button', { name: 'כל הנסיעות', exact: true }).click();
	await page.locator('.ride-card-body').first().click();
	await expect(page).toHaveURL(/\/ride\/[0-9a-f-]+$/);
	await expect(page.getByRole('link', { name: /WhatsApp|וואטסאפ/ }).first()).toHaveAttribute(
		'href',
		/^https:\/\/wa.me\//
	);
	await expect(page.getByText(/לוח לדוגמה|נסיעה לדוגמה|להמחשה/).first()).toBeVisible();
	await page.goto('/new');
	await expect(page).toHaveURL(/\/login\?next=/);
	expect(errors).toEqual([]);
});

test('legal pages, invalid links and responsive page bounds', async ({ page }, testInfo) => {
	for (const route of ['/', '/about', '/privacy', '/terms', '/impressum', '/login']) {
		await page.goto(route);
		await expect(page.locator('main')).toBeVisible();
		for (const legalRoute of ['/about', '/privacy', '/terms', '/impressum']) {
			await expect(page.locator(`footer a[href="${legalRoute}"]`)).toBeVisible();
		}
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	}
	await page.goto('/ride/not-a-uuid');
	await expect(page.locator('body')).not.toContainText('Internal Error');
	await page.goto('/');
	await page.screenshot({
		path: `output/playwright/board-${testInfo.project.name}.png`,
		fullPage: false
	});
});

test('public browsing loads no third-party tracking or optional cookies', async ({ page }) => {
	const requests: string[] = [];
	page.on('request', (request) => requests.push(request.url()));
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const origin = new URL(page.url()).origin;
	expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
	expect(
		requests.filter((url) => /\/_vercel\/(insights|speed-insights)|gtag|analytics|pixel/i.test(url))
	).toEqual([]);
	expect(await page.context().cookies()).toEqual([]);
});
