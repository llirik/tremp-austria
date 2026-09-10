import { defineConfig } from '@playwright/test';

const baseURL = process.env.TEST_BASE_URL;
if (!baseURL || !['http:', 'https:'].includes(new URL(baseURL).protocol)) {
	throw new Error('Set TEST_BASE_URL to the deployed application URL.');
}

// Reuse the existing native-date and text-reflow checks against the real host.
// Account fixture documents are intentionally excluded: those are local-only.
export default defineConfig({
	testDir: './tests',
	testMatch: '**/mobile-filters.spec.ts',
	fullyParallel: true,
	workers: 2,
	reporter: 'list',
	outputDir: 'test-results/hosted-mobile',
	use: { baseURL: new URL(baseURL).origin, trace: 'retain-on-failure' },
	projects: [{ name: 'hosted-mobile-filters', use: { isMobile: true, hasTouch: true } }]
});
