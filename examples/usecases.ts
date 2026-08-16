// The product's testable surface — owned like code, reviewed like code.
// (measure-use-case-coverage recipe)
export const USECASES = {
	'checkout.journey': 'Customer completes a checkout',
	'checkout.member.discount': 'Member discount applies at checkout',
	'quality.flaky-free': 'Staged rendering does not break add-to-cart',
	'auth.password-reset': 'User resets a forgotten password', // intentionally uncovered
} as const;
export type UseCaseId = keyof typeof USECASES;
