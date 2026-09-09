export const reportReasons = {
	spam: 'ספאם',
	scam: 'הונאה או התחזות',
	personal_information: 'חשיפת מידע אישי',
	illegal_activity: 'פעילות בלתי חוקית',
	harassment: 'הטרדה',
	other: 'אחר'
} as const;

export type ReportReason = keyof typeof reportReasons;

export function parseReport(
	form: FormData
): { reason: ReportReason; explanation: string | null } | { error: string } {
	const reason = form.get('reason');
	const rawExplanation = form.get('explanation');
	if (typeof reason !== 'string' || !Object.hasOwn(reportReasons, reason))
		return { error: 'בחרו את הסיבה לדיווח.' };
	if (rawExplanation !== null && typeof rawExplanation !== 'string')
		return { error: 'אפשר לצרף הסבר קצר בטקסט בלבד.' };
	const explanation = (rawExplanation || '').trim();
	if (explanation.length > 500) return { error: 'ההסבר יכול להכיל עד 500 תווים.' };
	if (
		[...explanation].some((character) => {
			const code = character.charCodeAt(0);
			return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
		})
	)
		return { error: 'יש להסיר תווים מיוחדים שאינם נתמכים מההסבר.' };
	return { reason: reason as ReportReason, explanation: explanation || null };
}
