// =====================================================================
// app.js — ALL the JavaScript for Blue Husky College Cafe, in ONE file.
//
// HOW THIS FILE IS ORGANISED (top to bottom)
//   1. MENU         the data: name, price, in stock
//   2. DISCOUNTS    STRATEGY pattern: one class per discount rule, all with the same calculate(lines)
//   3. PRICING      subtotal / discount / total
//   4. CART         OBSERVER pattern: cart.subscribe(fn) -> fn runs after every change
//   5. PAYMENT      "enter card" or "pay at store"
//   6. placeOrder   the CONTRACT and its error codes
//   7. ACCOUNTS     sign in / create account / continue as guest
//   8. EXPORTS      lets the unit tests (Node) use sections 1–7
//   9. THE PAGES    runs only in a browser. Every page (Home, Menu, Deals, Checkout, Sign in) loads this same file;
//                   <body data-page="menu"> tells it which page it is on.
//
// SOLID principles used (search this file for "SOLID"):
//   S  Single Responsibility – every class/function has one job (Cart stores, calculateTotals adds up,
//      each discount class does one rule, validatePayment only checks payments, AuthService only does accounts)
//   O  Open/Closed           – a NEW discount = a new class + registerDiscount(); no old code is edited
//   D  Dependency Inversion  – Cart is GIVEN its menu, AuthService is GIVEN its storage,
//      calculateTotals accepts ANY discount object that has calculate()
// =====================================================================
"use strict";

// =====================================================================
// 1. MENU — prices are in CENTS (whole numbers). USED FOR: avoiding decimal bugs like 0.1 + 0.2 = 0.30000000000000004
// =====================================================================
const MENU = [
  // id (used by the code) · emoji · name (shown) · category (menu section) · price in cents · inStock · type (Happy Hour counts drinks) · desc
  // ---- 🌍 African ----
  { id: "jollof",   emoji: "🍚", name: "Jollof Rice",             category: "African",  priceCents: 1100, inStock: true,  type: "food",  desc: "Smoky tomato rice with peppers and spices. (Nigeria & Ghana)" },
  { id: "suya",     emoji: "🍢", name: "Suya Beef Skewers",       category: "African",  priceCents: 1000, inStock: true,  type: "food",  desc: "Grilled beef with a spicy peanut suya rub, onions and tomato. (Nigeria)" },
  { id: "dorowat",  emoji: "🍲", name: "Doro Wat with Injera",    category: "African",  priceCents: 1300, inStock: true,  type: "food",  desc: "Slow-cooked spicy chicken stew served on soft injera bread. (Ethiopia)" },
  { id: "bobotie",  emoji: "🥘", name: "Bobotie",                 category: "African",  priceCents: 1200, inStock: true,  type: "food",  desc: "Spiced baked mince with a golden egg topping and yellow rice. (South Africa)" },
  // ---- 🍛 Indian ----
  { id: "biryani",  emoji: "🍛", name: "Chicken Biryani",         category: "Indian",   priceCents: 1200, inStock: true,  type: "food",  desc: "Fragrant basmati rice layered with spiced chicken." },
  // ---- 🍕 Italian ----
  { id: "pizza",    emoji: "🍕", name: "Margherita Pizza",        category: "Italian",  priceCents: 1100, inStock: true,  type: "food",  desc: "Tomato, mozzarella and fresh basil." },
  { id: "garlic",   emoji: "🥖", name: "Garlic Bread",            category: "Italian",  priceCents: 400,  inStock: true,  type: "food",  desc: "Warm, buttery and golden." },
  // ---- ☕ Drinks ----
  { id: "coffee",   emoji: "☕", name: "Coffee",                  category: "Drinks",   priceCents: 300,  inStock: true,  type: "drink", desc: "Fresh brewed house coffee." },
  { id: "iced",     emoji: "🧊", name: "Iced Coffee",             category: "Drinks",   priceCents: 400,  inStock: true,  type: "drink", desc: "Chilled coffee over ice." },
  { id: "chai",     emoji: "🫖", name: "Masala Chai",             category: "Drinks",   priceCents: 300,  inStock: true,  type: "drink", desc: "Spiced milk tea, brewed strong." },
  { id: "lemonade", emoji: "🍋", name: "Fresh Lemonade",          category: "Drinks",   priceCents: 400,  inStock: true,  type: "drink", desc: "Squeezed to order." },
  { id: "bissap",   emoji: "🌺", name: "Bissap (Hibiscus Drink)", category: "Drinks",   priceCents: 400,  inStock: true,  type: "drink", desc: "Chilled hibiscus flower drink with a hint of mint. (Senegal)" },
  { id: "ethcoffee",emoji: "☕", name: "Ethiopian Coffee",        category: "Drinks",   priceCents: 350,  inStock: true,  type: "drink", desc: "Bold coffee from the birthplace of coffee. (Ethiopia)" },
  // ---- 🍰 Desserts ----
  { id: "puffpuff", emoji: "🍩", name: "Puff-Puff",               category: "Desserts", priceCents: 500,  inStock: true,  type: "food",  desc: "Sweet, fluffy fried dough balls. (West Africa)" },
  { id: "tiramisu", emoji: "🍰", name: "Tiramisu",                category: "Desserts", priceCents: 600,  inStock: false, type: "food",  desc: "Coffee-soaked layers with mascarpone." },   // sold out ON PURPOSE to show OUT_OF_STOCK
];
// The menu sections, in the order they are shown. USED FOR: the filter buttons and headings on the Menu page.
const CATEGORIES = [["African", "🌍 African"], ["Indian", "🍛 Indian"], ["Italian", "🍕 Italian"], ["Drinks", "☕ Drinks"], ["Desserts", "🍰 Desserts"]];
const formatMoney = (cents) => "$" + (cents / 100).toFixed(2);       // 1530 -> "$15.30"

// =====================================================================
// 2. DISCOUNTS — STRATEGY PATTERN
//    Every discount has the same shape (interface):  { id, label, description, calculate(lines) -> cents off }
//    lines = the cart as a list: [{ item, quantity }, ...]
//    The rest of the app never asks WHICH discount it is; it just calls calculate().
//    SOLID S: each class = one rule.  SOLID O: add a class + registerDiscount(), nothing old changes.
// =====================================================================
// safeQty: while someone types "abc" or "99999999" the total must not crash or freeze, so pricing uses a safe
// whole number 0..1000. (Whether the quantity is ALLOWED is decided by placeOrder, not here.)
const safeQty = (line) => Math.min(Math.max(0, Math.trunc(Number(line.quantity)) || 0), 1000);
const subtotalOf = (lines) => lines.reduce((sum, l) => sum + l.item.priceCents * safeQty(l), 0);   // reduce = add up a list

class NoDiscount {
  constructor() { this.id = "none"; this.label = "None"; this.description = "Regular prices."; }
  calculate() { return 0; }
}
class PercentDiscount {                     // one class, used for Student (10%) AND Staff (15%)
  constructor(id, label, percent, description = "") { this.id = id; this.label = label; this.percent = percent; this.description = description; }
  calculate(lines) { return Math.round(subtotalOf(lines) * this.percent / 100); }   // Math.round -> whole cents
}
class HappyHourDiscount {                   // second drink free
  constructor() {
    this.id = "happyHour"; this.label = "Happy Hour (2nd drink free)";
    this.description = "Buy one drink and the second drink is free (the cheaper one of each pair). Food is not included.";
  }
  calculate(lines) {
    const prices = [];                      // one entry per drink: 2 coffees + 1 iced -> [300, 300, 400]
    for (const l of lines) if (l.item.type === "drink") for (let i = 0; i < safeQty(l); i++) prices.push(l.item.priceCents);
    prices.sort((a, b) => b - a);           // dearest first, so the CHEAPER drink of each pair is the free one
    let free = 0;
    for (let i = 1; i < prices.length; i += 2) free += prices[i];   // every 2nd drink
    return free;
  }
}
// The registry: id -> discount. USED FOR: building the drop-down and the Deals screen, and finding a discount by id.
const DISCOUNTS = {};
const registerDiscount = (strategy) => { DISCOUNTS[strategy.id] = strategy; };
[new NoDiscount(),
 new PercentDiscount("student", "Student (10% off)", 10, "10% off your whole order. Just show your student ID at pickup."),
 new PercentDiscount("staff", "Staff (15% off)", 15, "15% off your whole order for college and cafe staff."),
 new HappyHourDiscount()].forEach(registerDiscount);
const getDiscount = (id) => DISCOUNTS[id] || DISCOUNTS.none;        // unknown id -> safely "no discount"
const listDiscounts = () => Object.values(DISCOUNTS);

// =====================================================================
// 3. PRICING — arithmetic only (SOLID S). Takes ANY discount with calculate() (SOLID D).
// =====================================================================
function calculateTotals(lines, discount) {
  const subtotalCents = subtotalOf(lines);
  const discountCents = Math.min(discount.calculate(lines), subtotalCents);   // never below $0
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

// =====================================================================
// 4. CART — OBSERVER PATTERN
//    The cart is the "subject". Views call cart.subscribe(fn) once; after EVERY change the cart calls fn(cart).
//    USED FOR: the total, summary, cart counter and auto-save update themselves - nobody has to remember to refresh.
//    SOLID S: stores items + notifies (no maths, no HTML).  SOLID D: the menu is passed in (new Cart(menu)).
// =====================================================================
class Cart {
  constructor(menu) {
    this.menu = menu;
    this.quantities = new Map();            // Map: itemId -> quantity, e.g. "coffee" -> 2
    this.discountId = "none";
    this.listeners = [];                    // the observer functions
  }
  subscribe(listener) {                     // returns a function that unsubscribes
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }
  _notify() { this.listeners.forEach((listener) => listener(this)); }
  _known(itemId) { return this.menu.some((m) => m.id === itemId); }

  add(itemId) { if (!this._known(itemId)) return; this.quantities.set(itemId, this.quantityOf(itemId) + 1); this._notify(); }
  setQuantity(itemId, quantity) {           // stored as typed (even 0 or 11): placeOrder() decides if it is allowed
    if (!this._known(itemId)) return;
    const n = Number(quantity);
    this.quantities.set(itemId, Number.isFinite(n) ? n : 0);
    this._notify();
  }
  remove(itemId) { this.quantities.delete(itemId); this._notify(); }
  setDiscount(discountId) { this.discountId = discountId; this._notify(); }
  clear() { this.quantities.clear(); this._notify(); }

  quantityOf(itemId) { return this.quantities.get(itemId) || 0; }
  lines() { return [...this.quantities].map(([id, quantity]) => ({ item: this.menu.find((m) => m.id === id), quantity })); }

  // Saving: USED FOR: the cart is still there after you refresh the page
  snapshot() { return { quantities: [...this.quantities], discountId: this.discountId }; }
  restore(snap) {
    if (!snap || !Array.isArray(snap.quantities)) return;
    for (const [id, q] of snap.quantities) if (this._known(id)) this.quantities.set(id, Number(q) || 0);
    this.discountId = snap.discountId || "none";
    this._notify();
  }
}

// =====================================================================
// 5. PAYMENT — "card" or "store" (pay at the counter). SOLID S: only validates.
//    School project: a real shop sends cards to a payment company. We only ever keep the LAST 4 digits.
// =====================================================================
// Luhn checksum: the maths every real card number obeys. USED FOR: catching typos and fake numbers.
const luhnOk = (digits) => [...digits].reverse()
  .reduce((sum, ch, i) => { let d = +ch; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } return sum + d; }, 0) % 10 === 0;

function validatePayment(payment, now = new Date()) {   // `now` is a parameter so tests can pick the date
  const fail = (field, message) => ({ ok: false, field, message });
  if (!payment || !["card", "store"].includes(payment.method)) return fail("method", "Please choose how you want to pay.");
  if (payment.method === "store") return { ok: true, method: "store" };

  const digits = String(payment.number || "").replace(/\D/g, "");          // digits only
  if (digits.length < 13 || digits.length > 19 || !luhnOk(digits))
    return fail("number", "That card number doesn't look right. (Test card: 4242 4242 4242 4242)");
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(payment.exp || "").trim());
  const month = m ? +m[1] : 0, year = m ? 2000 + +m[2] : 0;
  const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  if (!m || month < 1 || month > 12 || expired) return fail("exp", "Enter a card expiry in the future, like 12/30.");
  if (!/^\d{3,4}$/.test(String(payment.cvc || ""))) return fail("cvc", "The security code (CVC) is 3 or 4 digits.");
  return { ok: true, method: "card", last4: digits.slice(-4) };
}

// =====================================================================
// 6. placeOrder(cart, payment?)  —  CONTRACT
//   TAKES:   cart    - a Cart:  cart.lines() -> [{ item, quantity }]  and  cart.discountId
//            payment - OPTIONAL: { method: "store" } or { method: "card", number, exp, cvc }
//   SUCCESS: { ok: true, orderNumber: "BH-1001", lines: [{ name, quantity, unitPriceCents, lineTotalCents }],
//              discountLabel, subtotalCents, discountCents, totalCents, paymentMethod, cardLast4 }
//   FAILURE: { ok: false, error: { code, message, itemId? } }
//   ERROR CODES (checked in this order, the first problem wins):
//     EMPTY_CART        the cart has no items
//     INVALID_QUANTITY  a quantity is not a whole number from 1 to 10   (itemId = that item)
//     OUT_OF_STOCK      an item has inStock = false                      (itemId = that item)
//     INVALID_PAYMENT   (extra) a payment was given but is not valid
//   It never throws and never changes the cart. The page shows a message for every code.
// =====================================================================
let nextOrderNumber = 1001;
function placeOrder(cart, payment) {
  const fail = (code, message, itemId) => ({ ok: false, error: { code, message, itemId } });
  const lines = cart.lines();
  if (lines.length === 0) return fail("EMPTY_CART", "Your cart is empty.");

  const badQty = lines.find((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 10);
  if (badQty) return fail("INVALID_QUANTITY", `Quantity for ${badQty.item.name} must be a whole number from 1 to 10.`, badQty.item.id);

  const soldOut = lines.find((l) => !l.item.inStock);
  if (soldOut) return fail("OUT_OF_STOCK", `${soldOut.item.name} is out of stock.`, soldOut.item.id);

  let paid = null;
  if (payment !== undefined) {
    paid = validatePayment(payment);
    if (!paid.ok) return fail("INVALID_PAYMENT", paid.message);
  }

  const discount = getDiscount(cart.discountId);      // STRATEGY: we don't care which one it is
  return {
    ok: true,
    orderNumber: "BH-" + nextOrderNumber++,
    lines: lines.map((l) => ({ name: l.item.name, quantity: l.quantity, unitPriceCents: l.item.priceCents, lineTotalCents: l.item.priceCents * l.quantity })),
    discountLabel: discount.label,
    ...calculateTotals(lines, discount),             // adds subtotalCents, discountCents, totalCents
    paymentMethod: paid ? paid.method : null,
    cardLast4: paid && paid.last4 ? paid.last4 : null,
  };
}
const resetOrderNumbers = () => { nextOrderNumber = 1001; };   // tests only

// =====================================================================
// 7. ACCOUNTS — sign in / create account / guest.  SOLID S: accounts only.  SOLID D: storage is passed in.
//    !! DEMO ONLY: accounts are saved in this browser, and this password "hash" is NOT real security.
//       A real website checks passwords on a server (bcrypt/argon2).
// =====================================================================
const hashPassword = (password, salt) => {          // scrambles the password so it isn't stored as plain text
  let h = 5381;
  for (const ch of salt + ":" + password) h = (((h << 5) + h) + ch.charCodeAt(0)) >>> 0;
  return h.toString(16);
};
class AuthService {
  constructor(storage) {                            // storage = anything with getItem / setItem / removeItem
    this.storage = storage;
    if (!this.storage.getItem("cafe_users")) {      // two ready-made demo accounts, password husky123
      const users = {};
      for (const [name, email] of [["Tom Baker", "tom@college.edu"], ["Anna Lopez", "anna@college.edu"]]) users[email] = { name, hash: hashPassword("husky123", email) };
      this._saveUsers(users);
    }
  }
  _users() { try { return JSON.parse(this.storage.getItem("cafe_users") || "{}"); } catch { return {}; } }
  _saveUsers(users) { this.storage.setItem("cafe_users", JSON.stringify(users)); }
  _start(user) { this.storage.setItem("cafe_session", JSON.stringify(user)); return { ok: true, user }; }
  _fail(code, message) { return { ok: false, error: { code, message } }; }

  // Errors: INVALID_NAME, INVALID_EMAIL, WEAK_PASSWORD, EMAIL_TAKEN
  register(name, email, password) {
    name = String(name || "").trim(); email = String(email || "").trim().toLowerCase();
    if (!name) return this._fail("INVALID_NAME", "Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return this._fail("INVALID_EMAIL", "Enter a valid email address.");
    if (String(password || "").length < 6) return this._fail("WEAK_PASSWORD", "Password must be at least 6 characters.");
    const users = this._users();
    if (users[email]) return this._fail("EMAIL_TAKEN", "An account with that email already exists. Try signing in.");
    users[email] = { name, hash: hashPassword(password, email) };
    this._saveUsers(users);
    return this._start({ name, email, isGuest: false });    // signed in straight away
  }
  // Accepts the full email or just the part before @ ("tom"). Error: WRONG_CREDENTIALS
  login(emailOrUsername, password) {
    const users = this._users();
    let email = String(emailOrUsername || "").trim().toLowerCase();
    if (!email.includes("@")) email = Object.keys(users).find((k) => k.startsWith(email + "@")) || email;
    const user = users[email];
    if (!user || user.hash !== hashPassword(String(password || ""), email)) return this._fail("WRONG_CREDENTIALS", "Wrong email or password.");
    return this._start({ name: user.name, email, isGuest: false });
  }
  loginAsGuest() { return this._start({ name: "Guest", isGuest: true }); }
  logout() { this.storage.removeItem("cafe_session"); }
  currentUser() { try { return JSON.parse(this.storage.getItem("cafe_session") || "null"); } catch { return null; } }
}

// =====================================================================
// 8. EXPORTS — USED FOR: `npm test` runs in Node, where `module` exists. In the browser this line does nothing.
// =====================================================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = { MENU, CATEGORIES, formatMoney, NoDiscount, PercentDiscount, HappyHourDiscount, registerDiscount, getDiscount, listDiscounts,
    safeQty, subtotalOf, calculateTotals, Cart, luhnOk, validatePayment, placeOrder, resetOrderNumbers, AuthService, hashPassword };
}

// =====================================================================
// 9. THE PAGES (browser only). Every page loads this same app.js.
//    <body data-page="menu"> says which page this is, so only the right parts run.
// =====================================================================

// ---- 9a. STORAGE that follows you from page to page ----
// localStorage normally does this. But when the .html files are opened straight from a folder, some browsers
// (Firefox, preview windows) give EVERY page its own separate storage -> you would be "signed out" on the next page.
// window.name is kept by the browser TAB while you move between pages, so we ALSO keep the two things every page needs
// there: who is signed in (cafe_session) and the cart (cafe_cart). Accounts stay in localStorage only.
function makeStorage() {
  let local = null;
  try { localStorage.setItem("_t", "1"); localStorage.removeItem("_t"); local = localStorage; } catch { /* blocked: use memory */ }
  const memory = {};
  const TAB_KEYS = ["cafe_session", "cafe_cart"];
  let tab = {};
  try { const t = JSON.parse(window.name || "{}"); if (t && typeof t === "object") tab = t; } catch { tab = {}; }
  const saveTab = () => { try { window.name = JSON.stringify(tab); } catch { /* ignore */ } };
  return {
    getItem(k) {
      if (TAB_KEYS.includes(k) && k in tab) return tab[k];                 // newest value for this tab wins
      return local ? local.getItem(k) : (k in memory ? memory[k] : null);
    },
    setItem(k, v) {
      v = String(v);
      if (TAB_KEYS.includes(k)) { tab[k] = v; saveTab(); }
      if (local) { try { local.setItem(k, v); } catch { memory[k] = v; } } else memory[k] = v;
    },
    removeItem(k) {
      if (TAB_KEYS.includes(k)) { delete tab[k]; saveTab(); }
      if (local) local.removeItem(k); else delete memory[k];
    },
  };
}

if (typeof document !== "undefined") startApp();

function startApp() {
  const $ = (id) => document.getElementById(id);           // find an element by id (null if this page doesn't have it)
  const page = document.body.dataset.page || "home";       // "home", "menu", "deals", "checkout" or "login"
  // esc: makes typed text safe inside HTML (a name like "<script>" can't run). USED FOR: security.
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function toast(message) {                                 // small pop-up at the bottom of the screen
    const t = $("toast"); if (!t) return;
    t.textContent = message; t.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  const storage = makeStorage();
  const auth = new AuthService(storage);
  const cart = new Cart(MENU);
  try { cart.restore(JSON.parse(storage.getItem("cafe_cart") || "null")); } catch { /* bad saved data -> empty cart */ }
  cart.subscribe((c) => storage.setItem("cafe_cart", JSON.stringify(c.snapshot())));   // OBSERVER: auto-save on every change
  const watch = (view) => { cart.subscribe(view); view(cart); };   // OBSERVER helper: subscribe AND draw once now

  // ---- 9b. SIGN-IN FIRST: every page except the sign-in page asks you to sign in (or continue as guest) ----
  const here = location.pathname.split("/").pop() || "index.html";
  if (page !== "login" && !auth.currentUser()) {
    location.replace("login.html?next=" + encodeURIComponent(here));   // `next` = come back here afterwards
    return;
  }
  const user = auth.currentUser();

  // ---- 9c. HEADER (same on every page): highlight this page's link, show who is signed in, cart counter ----
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === page));
  if ($("account")) $("account").innerHTML = user
    ? `<span class="who">👤 ${user.isGuest ? "Guest" : esc(user.name)}</span><button class="btn btn-small btn-outline" id="logoutBtn">Sign out</button>`
    : `<a class="btn btn-small" href="login.html">Sign in</a>`;
  const countItems = (c) => c.lines().reduce((n, l) => n + (Number(l.quantity) || 0), 0);
  watch((c) => { if ($("cartCount")) $("cartCount").textContent = countItems(c); });  // OBSERVER: counter updates itself

  // ---- 9d. MENU CARDS (Home + Menu). data-add="jollof" tells the click handler WHICH item. ----
  const card = (m) => `
    <article class="card${m.category === "African" ? " african" : ""}${m.inStock ? "" : " sold-out"}">
      <div class="emoji" aria-hidden="true">${m.emoji}</div>
      <h3>${m.name}</h3>
      <p class="desc">${m.desc}</p>
      <div class="row-between">
        <span class="price">${formatMoney(m.priceCents)}</span>
        <span class="tag${m.inStock ? "" : " out"}">${m.inStock ? "In stock" : "Out of stock"}</span>
      </div>
      <button class="btn btn-block" data-add="${m.id}">Add to cart</button>
    </article>`;
  const grid = (items) => `<div class="grid">${items.map(card).join("")}</div>`;

  if ($("africanList")) $("africanList").innerHTML = grid(MENU.filter((m) => m.category === "African"));
  if ($("featured")) $("featured").innerHTML = grid(MENU.filter((m) => ["biryani", "pizza", "bissap", "puffpuff"].includes(m.id)));

  let category = "All";                                     // Menu page filter
  function renderMenu() {
    $("chips").innerHTML = [["All", "All"], ...CATEGORIES].map(([id, label]) =>
      `<button class="chip${id === category ? " active" : ""}" data-cat="${id}">${label}</button>`).join("");
    const shown = category === "All" ? CATEGORIES : CATEGORIES.filter(([id]) => id === category);
    $("menuList").innerHTML = shown.map(([id, label]) => `<h2 class="cat-title">${label}</h2>` + grid(MENU.filter((m) => m.category === id))).join("");
  }
  if ($("menuList")) renderMenu();

  // Sticky bar at the bottom of the Menu page: "🛒 3 items · $17.00  [Go to checkout]"  (OBSERVER)
  if ($("cartBar")) watch((c) => {
    const n = countItems(c), total = calculateTotals(c.lines(), getDiscount(c.discountId)).totalCents;
    $("cartBar").innerHTML = n
      ? `<span>🛒 <b>${n}</b> item${n === 1 ? "" : "s"} · <b>${formatMoney(total)}</b></span><a class="btn" href="checkout.html">Go to checkout →</a>`
      : `<span>Your cart is empty. Tap <b>Add to cart</b> on anything you like.</span>`;
  });

  // ---- 9e. DEALS page: built from the discount STRATEGIES, so a new discount class = a new deal card ----
  if ($("dealList")) watch((c) => {
    $("dealList").innerHTML = `<div class="grid">` + listDiscounts().filter((d) => d.id !== "none").map((d) => `
      <article class="card deal"><div class="emoji" aria-hidden="true">🎟️</div><h3>${d.label}</h3><p class="desc">${d.description}</p>
        <button class="btn btn-block" data-deal="${d.id}">${c.discountId === d.id ? "✓ Applied" : "Use this deal"}</button></article>`).join("") + `</div>`;
  });

  // ---- 9f. CHECKOUT page: cart, discount, total, payment, place order ----
  const HELP = {                                            // the page handles EVERY error code from the contract
    EMPTY_CART: "Add at least one item from the menu.",
    INVALID_QUANTITY: "Change it to a whole number from 1 to 10.",
    OUT_OF_STOCK: "Remove the sold-out item, then try again.",
    INVALID_PAYMENT: "Check your card details, or choose Pay at store.",
  };
  const showCardBoxes = () => { if ($("cardFields")) $("cardFields").classList.toggle("hidden", !$("payCard").checked); };

  if (page === "checkout") {
    $("discountSelect").innerHTML = listDiscounts().map((d) => `<option value="${d.id}">${d.label}</option>`).join("");
    // OBSERVERS: each redraws its own part when the cart changes
    watch((c) => {                                          // the cart lines
      const lines = c.lines();
      $("cartList").innerHTML = lines.length ? lines.map((l) => `
        <div class="line" data-row="${l.item.id}">
          <span class="name">${l.item.emoji} ${l.item.name}
            <span class="sub">${formatMoney(l.item.priceCents)} each${l.item.inStock ? "" : ' · <span class="tag out">Out of stock</span>'}</span></span>
          <span class="qty">
            <button class="btn btn-small" data-dec="${l.item.id}" aria-label="Fewer ${l.item.name}">−</button>
            <input type="number" min="1" max="10" step="1" data-qty="${l.item.id}" value="${l.quantity}" aria-label="Quantity of ${l.item.name}">
            <button class="btn btn-small" data-inc="${l.item.id}" aria-label="More ${l.item.name}">+</button>
            <button class="btn btn-small btn-danger" data-remove="${l.item.id}" aria-label="Remove ${l.item.name}">✕</button>
          </span>
        </div>`).join("") : `<p class="muted">Your cart is empty. <a href="menu.html">Browse the menu →</a></p>`;
    });
    watch((c) => {                                          // the totals
      const t = calculateTotals(c.lines(), getDiscount(c.discountId));
      $("totalView").innerHTML = `
        <div><span>Subtotal</span><span>${formatMoney(t.subtotalCents)}</span></div>
        <div><span>Discount</span><span>${t.discountCents ? "−" : ""}${formatMoney(t.discountCents)}</span></div>
        <div class="grand"><span>Total</span><span>${formatMoney(t.totalCents)}</span></div>`;
    });
    watch((c) => {                                          // the summary (+ keep the drop-down in step with the Deals page)
      const lines = c.lines();
      $("summaryView").textContent = lines.length
        ? lines.map((l) => `${l.quantity} × ${l.item.name}`).join(", ") + ` · Discount: ${getDiscount(c.discountId).label}`
        : "Nothing in your order yet.";
      $("discountSelect").value = c.discountId;
    });
    watch(() => { $("errorBox").classList.add("hidden"); $("receipt").classList.add("hidden"); });   // old messages are stale now
    showCardBoxes();
  }
  function showError(err) {
    $("errorBox").textContent = `⚠️ ${err.message} ${HELP[err.code] || ""}`;
    $("errorBox").classList.remove("hidden"); $("receipt").classList.add("hidden");
    const row = err.itemId && document.querySelector(`[data-row="${err.itemId}"]`);
    if (row) row.classList.add("bad");                      // highlight the line that caused it
  }
  function showReceipt(r) {
    const paid = r.paymentMethod === "card" ? `Paid by card ending ${r.cardLast4}` : "Pay at the counter when you collect your order";
    $("receipt").innerHTML = `<b>✅ Order ${r.orderNumber} placed!</b>${user ? ` for ${esc(user.name)}` : ""}<br>` +
      r.lines.map((l) => `${l.quantity} × ${l.name} — ${formatMoney(l.lineTotalCents)}`).join("<br>") +
      `<br>Discount (${r.discountLabel}): ${r.discountCents ? "−" : ""}${formatMoney(r.discountCents)}` +
      `<br><b>Total: ${formatMoney(r.totalCents)}</b><br>${paid}<br><a href="menu.html">Order something else →</a>`;
    $("receipt").classList.remove("hidden");
  }
  function submitOrder() {
    const payment = $("payCard").checked
      ? { method: "card", number: $("cardNum").value, exp: $("cardExp").value, cvc: $("cardCvc").value }
      : { method: "store" };
    const result = placeOrder(cart, payment);               // the contract: {ok:true,...} or {ok:false,error}
    if (!result.ok) return showError(result.error);
    cart.clear();                                           // empty the cart FIRST (hides old messages)...
    showReceipt(result);                                    // ...THEN show the receipt so it stays visible
  }

  // ---- 9g. SIGN-IN page: Sign in / Create account / Guest ----
  const ALLOWED_NEXT = ["index.html", "menu.html", "deals.html", "checkout.html"];   // only our own pages (safety)
  const next = new URLSearchParams(location.search).get("next");
  const goNext = () => { location.href = ALLOWED_NEXT.includes(next) ? next : "menu.html"; };
  function showTab(name) {
    for (const t of ["signin", "signup", "guest"]) $("panel-" + t).classList.toggle("hidden", t !== name);
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  }
  if (page === "login") {
    if (ALLOWED_NEXT.includes(next)) $("loginNote").textContent = "👋 Please sign in, create an account, or continue as a guest to use the cafe.";
    if (user) $("loginStatus").innerHTML = `✅ You are signed in as <b>${user.isGuest ? "a guest" : esc(user.name)}</b>. <a href="menu.html">Go to the menu →</a>`;
  }

  // ---- 9h. EVENTS: one listener per event type for the whole page ("event delegation") ----
  // USED FOR: lists are redrawn all the time, so their buttons are new each time; delegation still catches the clicks.
  document.addEventListener("click", (e) => {
    const t = e.target.closest ? (e.target.closest("button, [data-add]") || e.target) : e.target;   // a click on text inside a button counts
    const d = t.dataset || {};
    if (d.add) { cart.add(d.add); toast(`Added ${MENU.find((m) => m.id === d.add).name} 🛒`); }
    else if (d.inc) cart.add(d.inc);
    else if (d.dec) cart.setQuantity(d.dec, Math.max(1, cart.quantityOf(d.dec) - 1));   // "−" stops at 1; ✕ removes
    else if (d.remove) cart.remove(d.remove);
    else if (d.cat) { category = d.cat; renderMenu(); }
    else if (d.deal) { cart.setDiscount(d.deal); $("dealMsg").innerHTML = `✅ <b>${getDiscount(d.deal).label}</b> will be applied. <a href="checkout.html">Go to checkout →</a>`; }
    else if (d.tab) showTab(d.tab);
    else if (t.id === "guestBtn") { auth.loginAsGuest(); goNext(); }
    else if (t.id === "logoutBtn") { auth.logout(); location.href = "login.html"; }
    else if (t.id === "placeBtn") submitOrder();
  });
  document.addEventListener("submit", (e) => {             // the login forms (pressing Enter submits too)
    e.preventDefault();                                     // stop the browser reloading the page
    if (e.target.id === "signinForm") {
      const r = auth.login($("siEmail").value, $("siPassword").value);
      if (!r.ok) { $("siMsg").textContent = "⚠️ " + r.error.message; return; }
      goNext();
    }
    if (e.target.id === "signupForm") {
      if ($("suPassword").value !== $("suConfirm").value) { $("suMsg").textContent = "⚠️ The two passwords don't match."; return; }
      const r = auth.register($("suName").value, $("suEmail").value, $("suPassword").value);
      if (!r.ok) { $("suMsg").textContent = "⚠️ " + r.error.message; return; }
      goNext();
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "pay") showCardBoxes();
    if (t.id === "discountSelect") cart.setDiscount(t.value);
    if (t.dataset && t.dataset.qty) cart.setQuantity(t.dataset.qty, t.value);
  });
  document.addEventListener("input", (e) => {              // tidy card boxes while typing: "4242 4242 ..." and "12/30"
    const t = e.target;
    if (t.id === "cardNum") t.value = t.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
    if (t.id === "cardExp") t.value = t.value.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");
  });
}
