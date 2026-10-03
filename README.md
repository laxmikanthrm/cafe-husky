# Blue Husky College Cafe

A classic school-cafe website in plain HTML + CSS + JavaScript. **All the JavaScript is in one file: `app.js`.**
Separate pages: **Home · Menu · Deals · Checkout · Sign in**. The menu includes **African dishes** (Jollof Rice, Suya, Doro Wat with Injera, Bobotie, Bissap, Ethiopian Coffee, Puff-Puff).

## How to run the app
Keep all the files in one folder and **double-click `index.html`**. No install, no server.
You'll be asked to **sign in**, **create an account**, or **continue as a guest** first. Demo account: `tom` / `husky123`.
```
index.html  menu.html  deals.html  checkout.html  login.html  style.css  app.js
```

## How to run the tests
Needs [Node.js](https://nodejs.org) 18+ (nothing to install):
```
npm test        # or:  node --test
```
Expected: every test passes (`# fail 0`).

## What each page does
| Page | What it does |
|---|---|
| `login.html` | Sign in · Create account (with confirm password) · Continue as guest. Every other page sends you here first. |
| `index.html` Home | chalkboard banner, "Taste of Africa" dishes, student favourites, how it works |
| `menu.html` | 15 dishes, each with name, price, description and *In stock / Out of stock*; filter by African, Indian, Italian, Drinks, Desserts; sticky cart bar |
| `deals.html` | Student 10%, Staff 15%, Happy Hour (2nd drink free) — **Use this deal** applies it |
| `checkout.html` | cart (add / remove / change quantity), discount, live total + summary, payment (💳 card or 🏪 pay at store), place order |
The same navigation bar is on every page, with a cart counter that updates itself.

> Demo-only accounts: saved in the browser; the password scrambling is not real security. Card payment is simulated; only the last 4 digits are kept.
> Signing in carries from page to page even when the files are opened straight from a folder: `app.js` also keeps the session and cart in the browser tab (`window.name`), because some browsers give every file its own storage.

## Contract: `placeOrder(cart, payment?)` (app.js, section 6)
| | |
|---|---|
| **Takes** | `cart` (`cart.lines()` → `[{item, quantity}]`, `cart.discountId`); optional `payment` `{method:"store"}` or `{method:"card", number, exp, cvc}` |
| **Success** | `{ ok:true, orderNumber, lines, discountLabel, subtotalCents, discountCents, totalCents, paymentMethod, cardLast4 }` |
| **Failure** | `{ ok:false, error:{ code, message, itemId? } }` |
| `EMPTY_CART` | the cart has no items |
| `INVALID_QUANTITY` | a quantity is not a whole number from 1 to 10 |
| `OUT_OF_STOCK` | an item has `inStock: false` (Tiramisu, on purpose) |
| `INVALID_PAYMENT` | (extra) card details are wrong |
Checked in that order; never throws; never changes the cart. The Checkout page shows a message for every code.

## Design ideas (all in `app.js`)
| Idea | Where |
|---|---|
| **Strategy pattern** | section 2 — `NoDiscount`, `PercentDiscount`, `HappyHourDiscount`, all with `calculate(lines)` |
| **Observer pattern** | section 4 `cart.subscribe()`; section 9 — cart list, total, summary, header counter, menu cart bar, deal buttons and auto-save all subscribe |
| **SOLID – Single Responsibility** | `Cart` stores, `calculateTotals` adds up, `validatePayment` checks payment, `AuthService` does accounts |
| **SOLID – Open/Closed** | new discount = new class + `registerDiscount()`; it appears in the drop-down and on the Deals page by itself |
| **SOLID – Dependency Inversion** | `new Cart(menu)`, `new AuthService(storage)`, `calculateTotals(lines, anyDiscount)` |

`app.js` sections: 1 Menu · 2 Discounts · 3 Pricing · 4 Cart · 5 Payment · 6 placeOrder · 7 Accounts · 8 Exports for tests · 9 The pages

## Team and who did what
Teams are 2–4 people. **Fill this in with your real names.**
| Name | What they did |
|---|---|
| _Member 1_ | _e.g. sections 1, 4 — menu (incl. African dishes) and cart (Observer)_ |
| _Member 2_ | _e.g. sections 2, 3 + tests — discounts (Strategy), pricing_ |
| _Member 3_ | _e.g. sections 5, 6 — payment and the placeOrder contract_ |
| _Member 4_ | _e.g. section 7, 9 + HTML/CSS — sign-in, pages, styling_ |

### Everyone commits to the same repository
```
git clone <your-team-repo-url>   # once
git pull                         # before you start
git add <your files>
git commit -m "Add African dishes to the menu"
git push
```
Small, frequent commits with clear messages — the commit history is part of the marking.
