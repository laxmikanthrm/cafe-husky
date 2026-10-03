// Unit tests for the total + discount logic, the Observer, and the placeOrder contract.
// Uses Node's built-in test runner, so there is nothing to install.   Run:  npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const { MENU } = require("../app");
const { Cart } = require("../app");
const { calculateTotals } = require("../app");
const { getDiscount, registerDiscount, PercentDiscount } = require("../app");
const { placeOrder, resetOrderNumbers } = require("../app");

// helper: build a cart like  cartWith(["coffee", 2], ["pizza", 1])  (prices: coffee $3.00, pizza $11.00)
const cartWith = (...pairs) => { const c = new Cart(MENU); pairs.forEach(([id, q]) => c.setQuantity(id, q)); return c; };
const totalsOf = (cart) => calculateTotals(cart.lines(), getDiscount(cart.discountId));

// ---------- totals + discounts ----------
test("no discount: total is the plain sum of price x quantity", () => {
  const t = totalsOf(cartWith(["coffee", 2], ["pizza", 1]));        // 2 x 300 + 1 x 1100
  assert.deepEqual(t, { subtotalCents: 1700, discountCents: 0, totalCents: 1700 });
});

test("Student takes 10% off and Staff takes 15% off", () => {
  const student = cartWith(["coffee", 2], ["pizza", 1]); student.setDiscount("student");
  const staff = cartWith(["coffee", 2], ["pizza", 1]);   staff.setDiscount("staff");
  assert.equal(totalsOf(student).totalCents, 1530);                 // 1700 - 170
  assert.equal(totalsOf(staff).totalCents, 1445);                   // 1700 - 255
});

test("Happy Hour: the second (cheaper) drink of each pair is free; food is never free", () => {
  const two = cartWith(["coffee", 2], ["pizza", 1]); two.setDiscount("happyHour");
  assert.equal(totalsOf(two).discountCents, 300);                   // one coffee free
  const three = cartWith(["coffee", 1], ["iced", 2]); three.setDiscount("happyHour");
  assert.equal(totalsOf(three).discountCents, 400);                 // drinks 400,400,300 -> 2nd one free
  const foodOnly = cartWith(["pizza", 2]); foodOnly.setDiscount("happyHour");
  assert.equal(totalsOf(foodOnly).discountCents, 0);
});

test("Strategy pattern: a new discount works without editing any old code", () => {
  registerDiscount(new PercentDiscount("vip", "VIP (50% off)", 50)); // only NEW code
  const c = cartWith(["coffee", 2]); c.setDiscount("vip");
  assert.equal(totalsOf(c).totalCents, 300);
});

test("an unknown discount id falls back to no discount", () => {
  const c = cartWith(["coffee", 1]); c.setDiscount("does-not-exist");
  assert.equal(totalsOf(c).totalCents, 300);
});

// ---------- Observer pattern ----------
test("Observer: every cart change notifies subscribers, and unsubscribe stops it", () => {
  const c = new Cart(MENU); let calls = 0;
  const stop = c.subscribe(() => calls++);
  c.add("coffee"); c.setQuantity("coffee", 3); c.setDiscount("staff"); c.remove("coffee");
  assert.equal(calls, 4);
  stop(); c.add("chai");
  assert.equal(calls, 4);
});

test("Observer: the total updates by itself when the cart changes", () => {
  const c = new Cart(MENU); let latest = null;
  c.subscribe((cart) => { latest = totalsOf(cart).totalCents; });   // a "total view"
  c.add("coffee"); assert.equal(latest, 300);
  c.add("coffee"); assert.equal(latest, 600);
  c.setDiscount("student"); assert.equal(latest, 540);
});

// ---------- placeOrder contract ----------
test("placeOrder: EMPTY_CART", () => {
  const r = placeOrder(new Cart(MENU));
  assert.equal(r.ok, false); assert.equal(r.error.code, "EMPTY_CART");
});

test("placeOrder: INVALID_QUANTITY for 0, 11 and 2.5", () => {
  for (const q of [0, 11, 2.5]) {
    const r = placeOrder(cartWith(["coffee", q]));
    assert.equal(r.error.code, "INVALID_QUANTITY", `quantity ${q}`);
    assert.equal(r.error.itemId, "coffee");
  }
});

test("placeOrder: OUT_OF_STOCK", () => {
  const r = placeOrder(cartWith(["tiramisu", 1]));
  assert.equal(r.error.code, "OUT_OF_STOCK"); assert.equal(r.error.itemId, "tiramisu");
});

test("placeOrder: success returns an order number and a summary; numbers go up", () => {
  resetOrderNumbers();
  const c = cartWith(["coffee", 2], ["pizza", 1]); c.setDiscount("student");
  const r = placeOrder(c);
  assert.equal(r.ok, true);
  assert.equal(r.orderNumber, "BH-1001");
  assert.equal(r.totalCents, 1530);
  assert.equal(r.discountLabel, "Student (10% off)");
  assert.deepEqual(r.lines[0], { name: "Coffee", quantity: 2, unitPriceCents: 300, lineTotalCents: 600 });
  assert.equal(placeOrder(c).orderNumber, "BH-1002");
  assert.equal(c.lines().length, 2, "placeOrder must not change the cart");
});

// ---------- extra edge cases ----------
test("Happy Hour with 4 drinks frees 2 of them", () => {
  const c = cartWith(["coffee", 2], ["iced", 2]); c.setDiscount("happyHour");   // 400,400,300,300 -> free: 400 + 300
  assert.equal(totalsOf(c).discountCents, 700);
});

test("a discount can never push the total below $0 (Math.min guard in pricing.js)", () => {
  registerDiscount({ id: "huge", label: "Huge", calculate: () => 999999 });     // a silly strategy
  const c = cartWith(["coffee", 1]); c.setDiscount("huge");
  assert.equal(totalsOf(c).totalCents, 0);
});

test("a silly quantity does not freeze the pricing maths (safeQty), and placeOrder still rejects it", () => {
  const c = cartWith(["coffee", 1e9]); c.setDiscount("happyHour");
  assert.ok(Number.isFinite(totalsOf(c).totalCents));                            // returned quickly
  assert.equal(placeOrder(c).error.code, "INVALID_QUANTITY");
});

test("Cart: quantityOf, add (+1), and remove", () => {
  const c = new Cart(MENU);
  assert.equal(c.quantityOf("coffee"), 0);
  c.add("coffee"); c.add("coffee");
  assert.equal(c.quantityOf("coffee"), 2);
  c.remove("coffee");
  assert.equal(c.lines().length, 0);
  c.add("not-on-the-menu");                                                      // ignored, no crash
  assert.equal(c.lines().length, 0);
});

test("placeOrder: the checks run in order (EMPTY, then QUANTITY, then STOCK)", () => {
  // a sold-out item WITH a bad quantity -> INVALID_QUANTITY wins
  assert.equal(placeOrder(cartWith(["tiramisu", 0])).error.code, "INVALID_QUANTITY");
});

test("quantity 1 and 10 are accepted (the edges of the allowed range)", () => {
  assert.equal(placeOrder(cartWith(["coffee", 1])).ok, true);
  assert.equal(placeOrder(cartWith(["coffee", 10])).ok, true);
});
