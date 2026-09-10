import { expect, test, type Page } from '@playwright/test';
import { expectContactRows } from './helpers/contact-layout.mjs';

const methods = ['telegram', 'email', 'whatsapp'] as const;
type Method = (typeof methods)[number];
const savedValues: Record<Method, string> = {
	telegram: 'layout_fixture',
	email: 'layout-fixture@example.com',
	whatsapp: '+436601112222'
};

async function openAccountFixture(page: Page, method: Method) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	// This document exists only in the browser interception. The actual account
	// component is compiled by the same Vite/SvelteKit server as the application.
	await page.route('**/__account-fixture__?*', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: `<!doctype html><html lang="he" dir="rtl"><head>
				<meta name="viewport" content="width=device-width,initial-scale=1">
				</head><body><main id="account-test-root"></main>
				<script type="module" src="/tests/fixtures/account-entry.ts"></script></body></html>`
		})
	);
	await page.goto(`/__account-fixture__?method=${method}`);
	await expect(page.locator('select[name="method"]')).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	await expect(page.locator('input[name="value"]')).toHaveValue(savedValues[method]);
	return errors;
}

for (const width of [320, 360, 390, 430]) {
	for (const scale of [1, 1.5, 2]) {
		for (const method of methods) {
			test(`${method} contact rows align at ${width}px with ${scale * 100}% text`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 1000 });
				const errors = await openAccountFixture(page, method);
				const grid = page.locator('select[name="method"]').locator('..');
				const baseline = await grid
					.locator('select')
					.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
				// Increase text metrics without changing viewport size or scaling the controls.
				await grid.evaluate((element, factor) => {
					const nodes = [element, ...element.querySelectorAll<HTMLElement>('*')];
					const sizes = nodes.map((node) => parseFloat(getComputedStyle(node).fontSize));
					nodes.forEach((node, index) => {
						node.style.fontSize = `${sizes[index] * factor}px`;
					});
				}, scale);
				expect(
					await grid
						.locator('select')
						.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
				).toBeCloseTo(baseline * scale, 2);
				await expectContactRows(page);
				await grid.screenshot({
					path: `output/playwright/account-contact-${method}-${width}-${scale * 100}.png`
				});
				expect(errors).toEqual([]);
			});
		}
	}
}

for (const saved of methods) {
	test(`switching contact methods preserves separate drafts from saved ${saved}`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 1000 });
		const errors = await openAccountFixture(page, saved);
		const select = page.locator('select[name="method"]');
		const input = page.locator('input[name="value"]');
		const drafts: Record<Method, string> = {
			telegram: '@telegram_draft',
			email: 'email-draft@example.com',
			whatsapp: '+43 660 4444444'
		};
		for (const method of methods) {
			await select.selectOption(method);
			await expect(input).toHaveValue(method === saved ? savedValues[saved] : '');
			await expect(input).toHaveAttribute(
				'type',
				method === 'email' ? 'email' : method === 'whatsapp' ? 'tel' : 'text'
			);
			await input.fill(drafts[method]);
		}
		for (const method of methods) {
			await select.selectOption(method);
			await expect(input).toHaveValue(drafts[method]);
			await input.fill('');
		}
		for (const method of methods) {
			await select.selectOption(method);
			await expect(input).toHaveValue('');
		}
		expect(errors).toEqual([]);
	});
}

test.describe('desktop account contact rows', () => {
	test.use({ isMobile: false, hasTouch: false });
	test('shares label/control rows at desktop width', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1000 });
		const errors = await openAccountFixture(page, 'telegram');
		await expectContactRows(page);
		await page
			.locator('.surface')
			.first()
			.screenshot({ path: 'output/playwright/account-contact-desktop.png' });
		expect(errors).toEqual([]);
	});
});
