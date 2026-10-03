// Unit tests for the login portal, payment choices, placeOrder + payment, and cart saving. Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const { MENU } = require("../app");
const { Cart } = require("../app");
const { AuthService } = require("../app");
const { validatePayment } = require("../app");
const { placeOrder } = require("../app");
const { listDiscounts } = require("../app");

// A fake localStorage, so the tests don't need a browser
const fakeStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, dump: () => JSON.stringify(m) }; };
const cartWith = (...pairs) => { const c = new Cart(MENU); pairs.forEach(([id, q]) => c.setQuantity(id, q)); return c; };

// ---------- login portal ----------
test("create account, then sign in with the same details", () => {
  const auth = new AuthService(fakeStorage());
  const made = auth.register("Sam Lee", "sam@college.edu", "secret1");
  assert.equal(made.ok, true); assert.equal(auth.currentUser().name, "Sam Lee");
  auth.logout(); assert.equal(auth.currentUser(), null);
  assert.equal(auth.login("sam@college.edu", "secret1").ok, true);
});
test("register rejects a bad name, bad email, short password and a repeated email", () => {
  const auth = new AuthService(fakeStorage());
  assert.equal(auth.register("", "a@b.co", "secret1").error.code, "INVALID_NAME");
  assert.equal(auth.register("A", "nope", "secret1").error.code, "INVALID_EMAIL");
  assert.equal(auth.register("A", "a@b.co", "123").error.code, "WEAK_PASSWORD");
  auth.register("A", "a@b.co", "secret1");
  assert.equal(auth.register("B", "A@B.co", "secret1").error.code, "EMAIL_TAKEN");   // emails are case-insensitive
});
test("sign in: wrong password fails; the demo account works by short username", () => {
  const auth = new AuthService(fakeStorage());
  assert.equal(auth.login("tom", "wrong").error.code, "WRONG_CREDENTIALS");
  assert.equal(auth.login("tom", "husky123").user.name, "Tom Baker");
});
test("guest sign-in works without an account and is marked as a guest", () => {
  const auth = new AuthService(fakeStorage());
  const g = auth.loginAsGuest();
  assert.equal(g.ok, true); assert.equal(auth.currentUser().isGuest, true);
});
test("passwords are never stored as plain text", () => {
  const store = fakeStorage(); new AuthService(store).register("Sam", "sam@college.edu", "mysecretpw");
  assert.ok(!store.dump().includes("mysecretpw"));
});

// ---------- payment ----------
test("pay at store needs no details; an unknown method is rejected", () => {
  assert.equal(validatePayment({ method: "store" }).ok, true);
  assert.equal(validatePayment({ method: "bitcoin" }).ok, false);
});
test("card: a valid test card passes and only the last 4 digits are returned", () => {
  const r = validatePayment({ method: "card", number: "4242 4242 4242 4242", exp: "12/30", cvc: "123" }, new Date("2026-10-01"));
  assert.equal(r.ok, true); assert.equal(r.last4, "4242"); assert.ok(!JSON.stringify(r).includes("4242 4242"));
});
test("card: bad number, expired date and bad CVC are each rejected with the right field", () => {
  const now = new Date("2026-10-01"), good = { method: "card", number: "4242424242424242", exp: "12/30", cvc: "123" };
  assert.equal(validatePayment({ ...good, number: "4242424242424241" }, now).field, "number");   // fails the Luhn check
  assert.equal(validatePayment({ ...good, exp: "09/26" }, now).field, "exp");                    // expired last month
  assert.equal(validatePayment({ ...good, exp: "13/30" }, now).field, "exp");                    // month 13 doesn't exist
  assert.equal(validatePayment({ ...good, cvc: "12" }, now).field, "cvc");
});

// ---------- placeOrder with payment ----------
test("placeOrder + card: success shows the payment method and last 4 only", () => {
  const r = placeOrder(cartWith(["coffee", 1]), { method: "card", number: "4242424242424242", exp: "12/39", cvc: "123" });
  assert.equal(r.ok, true); assert.equal(r.paymentMethod, "card"); assert.equal(r.cardLast4, "4242");
});
test("placeOrder + bad card: INVALID_PAYMENT, but cart errors still come first", () => {
  const bad = { method: "card", number: "1", exp: "", cvc: "" };
  assert.equal(placeOrder(cartWith(["coffee", 1]), bad).error.code, "INVALID_PAYMENT");
  assert.equal(placeOrder(cartWith(["coffee", 0]), bad).error.code, "INVALID_QUANTITY");
});
test("placeOrder + pay at store works, and placeOrder(cart) with no payment still works", () => {
  assert.equal(placeOrder(cartWith(["chai", 2]), { method: "store" }).paymentMethod, "store");
  assert.equal(placeOrder(cartWith(["chai", 2])).paymentMethod, null);
});

// ---------- cart saved between pages + deals ----------
test("cart snapshot/restore: the cart and chosen discount survive a page change", () => {
  const a = cartWith(["coffee", 2], ["pizza", 1]); a.setDiscount("student");
  const saved = JSON.parse(JSON.stringify(a.snapshot()));          // what localStorage would hold
  const b = new Cart(MENU); b.restore(saved);
  assert.equal(b.quantityOf("coffee"), 2); assert.equal(b.discountId, "student");
});
test("restore ignores items that are not on the menu, and bad data", () => {
  const c = new Cart(MENU); c.restore({ quantities: [["ghost", 3], ["coffee", 1]], discountId: "staff" }); c.restore(null);
  assert.equal(c.lines().length, 1);
});
test("every discount has a description (the Deals page is built from them)", () => {
  assert.ok(listDiscounts().every((d) => typeof d.description === "string" && d.description.length > 0));
});

// ---------- African food on the menu ----------
test("menu has African dishes, each with a name, price and stock flag, in a known section", () => {
  const { CATEGORIES } = require("../app");
  const african = MENU.filter((m) => m.category === "African");
  assert.ok(african.length >= 4);
  for (const m of MENU) {
    assert.ok(m.name && Number.isInteger(m.priceCents) && typeof m.inStock === "boolean", m.id);
    assert.ok(CATEGORIES.some(([id]) => id === m.category), `${m.id} has an unknown category`);
  }
  const c = new Cart(MENU); c.setQuantity("jollof", 2); c.setQuantity("bissap", 1);
  assert.equal(placeOrder(c).totalCents, 2600);          // 2 x $11.00 + $4.00
});
