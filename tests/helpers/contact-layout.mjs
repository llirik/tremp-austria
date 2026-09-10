import { expect } from '@playwright/test';

/** @param {import('@playwright/test').Page} page */
export async function expectContactRows(page) {
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
		const grid = element.parentElement;
		if (!grid) throw new Error('Contact method has no layout container');
		const control = grid.querySelector('input[name="value"]');
		if (!control) throw new Error('Contact value control is missing');
		const labels = [element, control].map((node) => {
			const label = grid.querySelector(`label[for="${node.id}"]`);
			if (!label) throw new Error('Contact control has no associated label');
			return label;
		});
		return {
			display: getComputedStyle(grid).display,
			direction: getComputedStyle(grid).direction,
			sharedParent:
				control.parentElement === grid && labels.every((label) => label?.parentElement === grid),
			grid: grid.getBoundingClientRect().toJSON(),
			controls: [element, control].map((node) => node.getBoundingClientRect().toJSON()),
			labels: labels.map((node) => {
				const range = document.createRange();
				range.selectNodeContents(node);
				return {
					rect: node.getBoundingClientRect().toJSON(),
					text: Array.from(range.getClientRects(), (line) => line.toJSON()),
					overflow: getComputedStyle(node).overflowX
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
	const viewport = page.viewportSize();
	if (!viewport) throw new Error('Contact layout check needs a fixed viewport');
	expect(geometry.grid.left).toBeGreaterThanOrEqual(0);
	expect(geometry.grid.right).toBeLessThanOrEqual(viewport.width);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		viewport.width
	);
	return select.locator('..');
}
