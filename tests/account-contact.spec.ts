import { expect, test, type Page } from '@playwright/test';

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

async function expectContactRows(page: Page) {
	const select = page.locator('select[name="method"]');
	const input = page.locator('input[name="value"]');
	const selectId = await select.getAttribute('id');
	const inputId = await input.getAttribute('id');
	expect(selectId).toBeTruthy();
	expect(inputId).toBeTruthy();
	const methodLabel = page.locator(`label[for="${selectId}"]`);
	const valueLabel = page.locator(`label[for="${inputId}"]`);
	await expect(methodLabel).toHaveCount(1);
	await expect(valueLabel).toHaveCount(1);
	await expect(select).toHaveAccessibleName(await methodLabel.innerText());
	await expect(input).toHaveAccessibleName(await valueLabel.innerText());
	await expect(input).toHaveAttribute('dir', 'ltr');
	await expect(input).toHaveCSS('direction', 'ltr');
	await expect(select).toHaveCSS('direction', 'rtl');
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

	const geometry = await select.evaluate((element) => {
		const grid = element.parentElement!;
		const control = grid.querySelector<HTMLInputElement>('input[name="value"]')!;
		const labels = [element, control].map((node) =>
			grid.querySelector<HTMLLabelElement>(`label[for="${node.id}"]`)
		);
		return {
			display: getComputedStyle(grid).display,
			direction: getComputedStyle(grid).direction,
			sharedParent:
				control.parentElement === grid && labels.every((label) => label?.parentElement === grid),
			grid: grid.getBoundingClientRect().toJSON(),
			controls: [element, control].map((node) => node.getBoundingClientRect().toJSON()),
			labels: labels.map((node) => {
				const range = document.createRange();
				range.selectNodeContents(node!);
				return {
					rect: node!.getBoundingClientRect().toJSON(),
					text: Array.from(range.getClientRects(), (line) => line.toJSON()),
					overflow: getComputedStyle(node!).overflowX
				};
			})
		};
	});
	expect(geometry.sharedParent, 'labels and controls share one layout grid').toBe(true);
	expect(geometry.display).toBe('grid');
	expect(geometry.direction).toBe('rtl');
	const [methodControl, valueControl] = geometry.controls;
	const [methodText, valueText] = geometry.labels;
	expect(methodControl.top).toBeCloseTo(valueControl.top, 1);
	expect(methodControl.height).toBeCloseTo(valueControl.height, 1);
	expect(methodControl.width).toBeCloseTo(valueControl.width, 1);
	expect(methodText.rect.top).toBeCloseTo(valueText.rect.top, 1);
	expect(methodText.rect.height).toBeCloseTo(valueText.rect.height, 1);
	expect(methodControl.top).toBeGreaterThan(methodText.rect.bottom);
	expect(valueControl.top).toBeGreaterThan(valueText.rect.bottom);
	expect(methodControl.left).toBeGreaterThan(valueControl.left);
	for (const control of geometry.controls) {
		expect(control.height).toBeGreaterThanOrEqual(44);
		expect(control.width).toBeGreaterThanOrEqual(44);
	}
	for (const rect of [...geometry.controls, ...geometry.labels.map((label) => label.rect)]) {
		expect(rect.left).toBeGreaterThanOrEqual(geometry.grid.left - 0.5);
		expect(rect.right).toBeLessThanOrEqual(geometry.grid.right + 0.5);
		expect(rect.top).toBeGreaterThanOrEqual(geometry.grid.top - 0.5);
		expect(rect.bottom).toBeLessThanOrEqual(geometry.grid.bottom + 0.5);
	}
	for (const { rect, text, overflow } of geometry.labels) {
		expect(['hidden', 'clip']).not.toContain(overflow);
		for (const line of text) {
			expect(line.left).toBeGreaterThanOrEqual(rect.left - 0.5);
			expect(line.right).toBeLessThanOrEqual(rect.right + 0.5);
			expect(line.top).toBeGreaterThanOrEqual(rect.top - 0.5);
			expect(line.bottom).toBeLessThanOrEqual(rect.bottom + 0.5);
		}
	}
	const viewport = page.viewportSize()!;
	expect(geometry.grid.left).toBeGreaterThanOrEqual(0);
	expect(geometry.grid.right).toBeLessThanOrEqual(viewport.width);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		viewport.width
	);
	return select.locator('..');
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
