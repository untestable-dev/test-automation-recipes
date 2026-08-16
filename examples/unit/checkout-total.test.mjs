// From the recipe: ten E2E variants become a table-driven unit test.
// Run: node --test unit/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTotal } from '../shared/checkout-total.mjs';

const shirt = (price) => [{ name: 'Shirt', price, qty: 1 }];

const cases = [
	// member discount only strictly over 5000
	{ items: shirt(5001), member: true, total: 4751 }, // 5001 * 0.95 = 4750.95 → 4751
	{ items: shirt(5000), member: true, total: 5000 },
	{ items: shirt(4999), member: true, total: 4999 },
	{ items: shirt(5001), member: false, total: 5001 },
	// shipping: 500 under 3000, free at 3000
	{ items: shirt(2999), member: false, total: 3499 },
	{ items: shirt(3000), member: false, total: 3000 },
	// empty cart
	{ items: [], member: true, total: 0 },
	// quantities aggregate into the subtotal
	{ items: [{ name: 'Shirt', price: 2600, qty: 2 }, { name: 'Socks', price: 400, qty: 1 }], member: false, total: 5600 },
];

for (const c of cases) {
	test(`total(${JSON.stringify(c.items.map((i) => i.price + '×' + i.qty))}, member=${c.member}) = ${c.total}`, () => {
		assert.equal(checkoutTotal(c.items, { member: c.member }), c.total);
	});
}
