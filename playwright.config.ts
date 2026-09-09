import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	testMatch: '**/*.spec.ts',
	fullyParallel: true,
	reporter: 'list',
	outputDir: 'test-results',
	use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
	webServer: {
		command: 'pnpm dev --host 127.0.0.1 --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: false,
		env: {
			PUBLIC_DEMO_MODE: 'true',
			PUBLIC_SUPABASE_URL: '',
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
			PUBLIC_SITE_URL: 'http://127.0.0.1:4173'
		}
	},
	projects: [
		{ name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } },
		{ name: 'mobile-430', use: { viewport: { width: 430, height: 932 } } },
		{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }
	]
});
