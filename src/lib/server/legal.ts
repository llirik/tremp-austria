import { error, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeNext } from '../domain';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal';

export async function hasCurrentLegalAcceptance(supabase: SupabaseClient): Promise<boolean> {
	const result = await supabase.rpc('has_current_legal_acceptance');
	if (result.error) error(503, 'לא הצלחנו לבדוק את אישור התנאים. נסו שוב בעוד רגע.');
	return result.data === true;
}

/** Call after requireUser; the database separately enforces this on protected writes. */
export async function requireLegalAcceptance(supabase: SupabaseClient, next: string) {
	if (!(await hasCurrentLegalAcceptance(supabase))) {
		redirect(303, `/account?legal=required&next=${encodeURIComponent(safeNext(next))}`);
	}
}

/** An unchecked box never records acceptance, including for direct HTTP submissions. */
export async function acceptLegalDocuments(supabase: SupabaseClient, form: FormData): Promise<string | null> {
	if (form.get('accept_legal') !== 'yes') {
		return 'כדי להמשיך, יש לאשר את תנאי השימוש ואת קריאת מדיניות הפרטיות.';
	}
	// Do not silently accept a newer version if a form was opened before an update.
	if (form.get('terms_version') !== TERMS_VERSION || form.get('privacy_version') !== PRIVACY_VERSION) {
		return 'המסמכים עודכנו מאז פתיחת העמוד. רעננו את העמוד וקראו את הנוסח העדכני לפני האישור.';
	}
	const result = await supabase.rpc('accept_legal_documents', {
		p_terms_version: TERMS_VERSION,
		p_privacy_version: PRIVACY_VERSION
	});
	return result.error ? 'לא הצלחנו לשמור את האישור. נסו שוב בעוד רגע.' : null;
}
