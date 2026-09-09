import { mergeConfig } from 'vite';
import appConfig from '../../vite.config';

// Used only by the Playwright dev server. The normal app server/build does not
// expose fixture modules, and the fixture document is intercepted by Playwright.
export default mergeConfig(appConfig, {
	server: { fs: { allow: ['tests/fixtures'] } }
});
