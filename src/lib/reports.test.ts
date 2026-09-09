import { describe, expect, it } from 'vitest';
import { parseReport, reportReasons } from './reports';

describe('listing report input', () => {
	it.each(Object.keys(reportReasons))(
		'accepts the supported reason %s without extra data',
		(reason) => {
			const form = new FormData();
			form.set('reason', reason);
			expect(parseReport(form)).toEqual({ reason, explanation: null });
		}
	);
	it('keeps only the stated reason and trimmed explanation', () => {
		const form = new FormData();
		form.set('reason', 'personal_information');
		form.set('explanation', '  פרטים אישיים מופיעים בהערה  ');
		form.set('reporter_id', 'another-user');
		form.set('status', 'resolved');
		expect(parseReport(form)).toEqual({
			reason: 'personal_information',
			explanation: 'פרטים אישיים מופיעים בהערה'
		});
	});
	it('rejects unknown reasons, oversized explanations and control characters', () => {
		for (const [reason, explanation] of [
			['unknown', ''],
			['__proto__', ''],
			['spam', 'א'.repeat(501)],
			['spam', 'text\u0000']
		]) {
			const form = new FormData();
			form.set('reason', reason);
			form.set('explanation', explanation);
			expect(parseReport(form)).toHaveProperty('error');
		}
	});
});
