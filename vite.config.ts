import cloudflare from '@sveltejs/adapter-cloudflare';
import vercel from '@sveltejs/adapter-vercel';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Vercel remains production. Cloudflare must be selected explicitly by its build script.
const buildTarget = process.env.BUILD_TARGET ?? 'vercel';
if (buildTarget !== 'vercel' && buildTarget !== 'cloudflare') {
	throw new Error(`Unsupported BUILD_TARGET: ${buildTarget}. Use vercel or cloudflare.`);
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter:
				buildTarget === 'cloudflare'
					? cloudflare()
					: vercel({ runtime: 'nodejs24.x', regions: ['fra1'] })
		})
	]
});
