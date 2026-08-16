// The extracted decision from the replace-e2e-with-unit-tests recipe:
// a pure function both the demo app and the unit tests import.
export function checkoutTotal(items, user) {
	const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
	const discount = user.member && subtotal > 5000 ? subtotal * 0.05 : 0;
	const shipping = subtotal >= 3000 || subtotal === 0 ? 0 : 500;
	return Math.round(subtotal - discount + shipping);
}
