import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ locale: 'en-GB' });

interface NativeNode {
	nodeId: number;
	nodeName: string;
	nodeValue: string;
	attributes?: string[];
	children?: NativeNode[];
	shadowRoots?: NativeNode[];
}

function descendants(node: NativeNode): NativeNode[] {
	return [node, ...[...(node.children ?? []), ...(node.shadowRoots ?? [])].flatMap(descendants)];
}

async function expectNativeDateToFit(page: Page, input: Locator) {
	await expect(input).toHaveAttribute('type', 'date');
	await expect(input).toHaveAttribute('dir', 'ltr');
	await expect(input).toHaveCSS('direction', 'ltr');
	await expect(input).toHaveCSS('unicode-bidi', 'isolate');
	const parent = input.locator('..');
	await expect(parent).toHaveCSS('direction', 'rtl');
	const parentBounds = (await parent.boundingBox())!;
	const inputBounds = (await input.boundingBox())!;
	expect(inputBounds.x).toBeGreaterThanOrEqual(parentBounds.x);
	expect(inputBounds.x + inputBounds.width).toBeLessThanOrEqual(
		parentBounds.x + parentBounds.width
	);
	expect(inputBounds.y).toBeGreaterThanOrEqual(parentBounds.y);
	expect(inputBounds.y + inputBounds.height).toBeLessThanOrEqual(
		parentBounds.y + parentBounds.height
	);
	expect(inputBounds.width).toBeGreaterThanOrEqual(44);
	expect(inputBounds.height).toBeGreaterThanOrEqual(44);
	await expect(input).toHaveValue('2026-10-09');

	// A native date input can report scrollWidth === clientWidth while its internal
	// editor clips the year. Inspect Chromium's user-agent shadow DOM to measure the
	// actual displayed digits and separators against that editor's clipping box.
	const session = await page.context().newCDPSession(page);
	try {
		const { root } = (await session.send('DOM.getDocument', { depth: -1, pierce: true })) as {
			root: NativeNode;
		};
		const id = await input.getAttribute('id');
		const nativeInput = descendants(root).find(
			(node) =>
				node.nodeName === 'INPUT' &&
				node.attributes?.some(
					(value, index) => index % 2 === 0 && value === 'id' && node.attributes?.[index + 1] === id
				)
		)!;
		expect(nativeInput).toBeDefined();
		const editor = descendants(nativeInput).find((node) =>
			node.attributes?.includes('-webkit-datetime-edit')
		)!;
		expect(editor).toBeDefined();
		const picker = descendants(nativeInput).find((node) =>
			node.attributes?.includes('-webkit-calendar-picker-indicator')
		)!;
		expect(picker).toBeDefined();
		const textNodes = descendants(editor).filter((node) => node.nodeName === '#text');
		// Native field order can follow the OS locale despite Playwright's en-GB locale.
		// Verify each semantic field and every displayed glyph without forcing its order.
		for (const [field, expected] of [
			['day', '09'],
			['month', '10'],
			['year', '2026']
		]) {
			const fields = descendants(editor).filter((node) =>
				node.attributes?.includes(`-webkit-datetime-edit-${field}-field`)
			);
			expect(fields, `native ${field} field`).toHaveLength(1);
			expect(
				descendants(fields[0])
					.filter((node) => node.nodeName === '#text')
					.map((node) => node.nodeValue),
				`native ${field} value`
			).toEqual([expected]);
		}
		expect(textNodes.map((node) => node.nodeValue).sort()).toEqual(['/', '/', '09', '10', '2026']);

		async function box(node: NativeNode, edge: 'content' | 'border' = 'border') {
			const { model } = (await session.send('DOM.getBoxModel', { nodeId: node.nodeId })) as {
				model: { content: number[]; border: number[] };
			};
			const x = model[edge].filter((_, index) => index % 2 === 0);
			const y = model[edge].filter((_, index) => index % 2 === 1);
			return {
				left: Math.min(...x),
				right: Math.max(...x),
				top: Math.min(...y),
				bottom: Math.max(...y)
			};
		}
		const [editorBox, inputBox, pickerBox, ...textBoxes] = await Promise.all([
			box(editor, 'content'),
			box(nativeInput, 'content'),
			box(picker),
			...textNodes.map((node) => box(node))
		]);
		expect(pickerBox.right - pickerBox.left, 'native picker width').toBeGreaterThan(0);
		expect(pickerBox.bottom - pickerBox.top, 'native picker height').toBeGreaterThan(0);
		expect(pickerBox.left).toBeGreaterThanOrEqual(inputBox.left - 0.5);
		expect(pickerBox.right).toBeLessThanOrEqual(inputBox.right + 0.5);
		expect(pickerBox.top).toBeGreaterThanOrEqual(inputBox.top - 0.5);
		expect(pickerBox.bottom).toBeLessThanOrEqual(inputBox.bottom + 0.5);
		for (const [index, textBox] of textBoxes.entries()) {
			const label = `native date ${textNodes[index].nodeValue}`;
			expect(textBox.right - textBox.left, `${label}: rendered width`).toBeGreaterThan(0);
			for (const container of [editorBox, inputBox]) {
				expect(textBox.left, `${label}: unclipped left`).toBeGreaterThanOrEqual(
					container.left - 0.5
				);
				expect(textBox.right, `${label}: unclipped right`).toBeLessThanOrEqual(
					container.right + 0.5
				);
				expect(textBox.top, `${label}: unclipped top`).toBeGreaterThanOrEqual(container.top - 0.5);
				expect(textBox.bottom, `${label}: unclipped bottom`).toBeLessThanOrEqual(
					container.bottom + 0.5
				);
			}
			if (index > 0) {
				expect(textBox.left, `${label}: left-to-right order`).toBeGreaterThanOrEqual(
					textBoxes[index - 1].right - 0.5
				);
			}
		}
	} finally {
		await session.detach();
	}
}

async function expectControlsToFit(container: Locator, controls: Locator) {
	const bounds = await container.boundingBox();
	expect(bounds).not.toBeNull();
	const measurements = await controls.evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			const textRects = [];
			while (walker.nextNode()) {
				if (!walker.currentNode.textContent?.trim()) continue;
				const range = document.createRange();
				range.selectNodeContents(walker.currentNode);
				textRects.push(...Array.from(range.getClientRects(), (line) => line.toJSON()));
			}
			return {
				label: element.textContent?.trim(),
				rect: rect.toJSON(),
				clientWidth: element.clientWidth,
				scrollWidth: element.scrollWidth,
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
				overflow: getComputedStyle(element).overflowX,
				textRects
			};
		})
	);
	for (const control of measurements) {
		const label = control.label ?? 'control';
		expect(control.rect.left, `${label}: left edge`).toBeGreaterThanOrEqual(bounds!.x - 1);
		expect(control.rect.right, `${label}: right edge`).toBeLessThanOrEqual(
			bounds!.x + bounds!.width + 1
		);
		expect(control.rect.top, `${label}: top edge`).toBeGreaterThanOrEqual(bounds!.y - 1);
		expect(control.rect.bottom, `${label}: bottom edge`).toBeLessThanOrEqual(
			bounds!.y + bounds!.height + 1
		);
		expect(control.rect.width, `${label}: touch width`).toBeGreaterThanOrEqual(44);
		expect(control.rect.height, `${label}: touch height`).toBeGreaterThanOrEqual(44);
		expect(control.scrollWidth, `${label}: unclipped width`).toBeLessThanOrEqual(
			control.clientWidth + 1
		);
		expect(control.scrollHeight, `${label}: unclipped height`).toBeLessThanOrEqual(
			control.clientHeight + 1
		);
		expect(['hidden', 'clip'], `${label}: overflow is not hidden`).not.toContain(control.overflow);
		for (const line of control.textRects) {
			expect(line.left, `${label}: visible text left`).toBeGreaterThanOrEqual(
				control.rect.left - 1
			);
			expect(line.right, `${label}: visible text right`).toBeLessThanOrEqual(
				control.rect.right + 1
			);
			expect(line.top, `${label}: visible text top`).toBeGreaterThanOrEqual(control.rect.top - 1);
			expect(line.bottom, `${label}: visible text bottom`).toBeLessThanOrEqual(
				control.rect.bottom + 1
			);
		}
	}
	return measurements;
}

for (const width of [320, 360, 390, 430]) {
	for (const textScale of [1, 1.5, 2]) {
		test(`mobile filters fit ${width}px with ${textScale * 100}% text`, async ({ page }) => {
			await page.setViewportSize({ width, height: 932 });
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			await page.evaluate(() => document.fonts.ready);
			const toolbar = page.locator('.board-toolbar');
			const tabs = toolbar.locator('.filter-tab');
			await expect(tabs).toHaveCount(4);
			const baseline = await tabs
				.first()
				.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
			const dateInput = toolbar.getByLabel('סינון לפי תאריך');
			const dateFont = await dateInput.evaluate((element) =>
				parseFloat(getComputedStyle(element).fontSize)
			);

			// Stress text metrics at a fixed CSS viewport, not page zoom or deviceScaleFactor.
			// Android/Samsung font boosting varies by device; this is deterministic reflow coverage,
			// not a claim to emulate its OS/browser text-scaling implementation exactly.
			await toolbar.evaluate((element, scale) => {
				const nodes = [element, ...element.querySelectorAll<HTMLElement>('*')].filter(
					(node): node is HTMLElement => node instanceof HTMLElement
				);
				const sizes = nodes.map((node) => parseFloat(getComputedStyle(node).fontSize));
				nodes.forEach((node, index) => {
					node.style.fontSize = `${sizes[index] * scale}px`;
				});
			}, textScale);
			const enlarged = await tabs
				.first()
				.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
			expect(enlarged).toBeCloseTo(baseline * textScale, 2);
			expect(
				await dateInput.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
			).toBeCloseTo(dateFont * textScale, 2);
			expect(page.viewportSize()!.width).toBe(width);
			await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
			await expect(toolbar.locator('.filters-row')).toHaveCSS('direction', 'rtl');
			await dateInput.fill('2026-10-09');
			await expectNativeDateToFit(page, dateInput);
			await page.screenshot({
				path: `output/playwright/mobile-filters-${width}-${textScale * 100}.png`,
				fullPage: true
			});
			await dateInput.fill('');

			const toolbarBounds = await toolbar.boundingBox();
			expect(toolbarBounds!.x).toBeGreaterThanOrEqual(0);
			expect(toolbarBounds!.x + toolbarBounds!.width).toBeLessThanOrEqual(width);
			for (const selector of ['.filters-row', '.filter-tabs', '.date-shortcuts']) {
				const group = toolbar.locator(selector);
				const groupBounds = await group.boundingBox();
				expect(groupBounds!.x).toBeGreaterThanOrEqual(toolbarBounds!.x);
				expect(groupBounds!.x + groupBounds!.width).toBeLessThanOrEqual(
					toolbarBounds!.x + toolbarBounds!.width
				);
				expect(['hidden', 'clip']).not.toContain(
					await group.evaluate((element) => getComputedStyle(element).overflowX)
				);
			}
			await expectControlsToFit(
				toolbar.locator('.filters-row'),
				toolbar.locator('.filter-control')
			);
			const tabBounds = await expectControlsToFit(toolbar.locator('.filter-tabs'), tabs);
			expect(await page.evaluate(() => window.innerWidth)).toBe(width);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
				width
			);
			await expectControlsToFit(
				toolbar.locator('.date-shortcuts'),
				toolbar.locator('.date-shortcuts button')
			);
			const [first, second, third, fourth] = tabBounds.map((tab) => tab.rect);
			for (const rect of [second, third, fourth]) expect(rect.width).toBeCloseTo(first.width, 0);
			expect(first.top).toBeCloseTo(second.top, 0);
			expect(third.top).toBeCloseTo(fourth.top, 0);
			expect(third.top).toBeGreaterThanOrEqual(first.bottom);
			expect(first.left).toBeGreaterThan(second.left);
			expect(third.left).toBeGreaterThan(fourth.left);
			const alignment = await tabs.evaluateAll((elements) =>
				elements.map((element) => ({
					button: element.getBoundingClientRect().toJSON(),
					icon: element.querySelector('svg')!.getBoundingClientRect().toJSON(),
					label: element.querySelector('.filter-tab-label')!.getBoundingClientRect().toJSON()
				}))
			);
			for (const { button, icon, label } of alignment) {
				expect(icon.width).toBeGreaterThan(0);
				expect(icon.height).toBeGreaterThan(0);
				expect(icon.left).toBeGreaterThanOrEqual(button.left);
				expect(icon.right).toBeLessThanOrEqual(button.right);
				expect(icon.top).toBeGreaterThanOrEqual(button.top);
				expect(icon.bottom).toBeLessThanOrEqual(button.bottom);
				const buttonCenter = button.left + button.width / 2;
				if (icon.bottom <= label.top) {
					// Narrow controls may move the icon above the label to preserve readable words.
					expect(icon.left + icon.width / 2).toBeCloseTo(buttonCenter, 0);
					expect(label.left + label.width / 2).toBeCloseTo(buttonCenter, 0);
				} else {
					expect(icon.right <= label.left || label.right <= icon.left).toBe(true);
					expect(icon.top + icon.height / 2).toBeCloseTo(label.top + label.height / 2, 0);
					const groupLeft = Math.min(icon.left, label.left);
					const groupRight = Math.max(icon.right, label.right);
					expect((groupLeft + groupRight) / 2).toBeCloseTo(buttonCenter, 0);
				}
			}
			await expect(tabs.first()).toHaveClass(/active/);
			const originalCount = await page.locator('.ride-card').count();
			await toolbar.getByRole('button', { name: 'מחפש טרמפ', exact: true }).click();
			await expect(toolbar.getByRole('button', { name: 'מחפש טרמפ', exact: true })).toHaveClass(
				/active/
			);
			await expect(toolbar.getByRole('button', { name: 'מחפש טרמפ', exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(tabs.first()).toHaveAttribute('aria-pressed', 'false');
			await expectControlsToFit(toolbar.locator('.filter-tabs'), tabs);
			await toolbar.getByRole('button', { name: 'כל הנסיעות', exact: true }).click();
			await expect(page.locator('.ride-card')).toHaveCount(originalCount);
			await toolbar
				.locator('.date-shortcuts')
				.getByRole('button', { name: 'מחר', exact: true })
				.click();
			await expect(
				toolbar.locator('.date-shortcuts').getByRole('button', { name: 'מחר', exact: true })
			).toHaveClass(/active/);
			await expectControlsToFit(
				toolbar.locator('.date-shortcuts'),
				toolbar.locator('.date-shortcuts button')
			);
		});
	}
}
