import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	let user: { display_name: string } | null = null;
	if (locals.user && locals.supabase) {
		const { data } = await locals.supabase.from('profiles').select('display_name').eq('id', locals.user.id).maybeSingle();
		user = { display_name: data?.display_name || 'החשבון שלי' };
	}
	// Never serialize the Auth user/session, email, or UUID into public page data.
	return { user, configured: locals.configured, demo: locals.demo };
};
