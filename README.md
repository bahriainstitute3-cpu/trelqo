# Trelqo

A real, working shopping app: React + Vite frontend, Firebase (Auth + Firestore) backend.
No mock data — everything you see is read from and written to your Firestore project.

## What's built (Phase 1 + seller features — working end to end)

**Customer app**
- Sign up / login / logout / forgot password (Firebase Auth email+password)
- **Continue with Google** login (any Google account)
- Home page: categories, featured products, new arrivals — all from Firestore
- Category browsing, sorting (price low/high)
- Search (client-side filter across name/brand/category)
- Product details: multiple images, price, sale price, stock, description, specs
- **Ratings & reviews**: star rating + comment, shown on the product page with the average
- **In-app messaging**: a message icon on every product card and detail page opens a real-time chat with that product's seller (`bahriainstitute3@gmail.com` by default)
- Add to Cart button directly on product cards and the detail page
- Cart (persisted in localStorage), quantity controls, stock-aware
- Checkout: delivery address, payment method selection, order summary
- Orders: placing an order **decrements real stock in a Firestore transaction**
- Order tracking timeline, order history, order detail page

**Add Product (seller-only, `/sell`)**
- Only visible in the navbar, and only accessible, to whichever Google
  account matches `SELLER_EMAIL` in `src/lib/allowedEmails.js`
- Upload multiple real images (Firebase Storage, not just URLs)
- Fields: name, description, price, discount %, stock, owner Gmail (auto-filled)
- New products immediately show in Home "new arrivals" and in search

**Super Admin panel** (`/admin`, role-gated separately from the seller feature)
- Dashboard, full product/category CRUD, order management — see below

**Security**
- `firestore.rules`: customers can only read/write their own user doc, orders,
  and reviews; only the seller email or an admin can write products; chat
  messages are locked to the two participants
- `storage.rules`: only the seller email can upload to `/products/`
- Admins are created via a server-side script (Admin SDK) — can't be granted from the browser

## Configuring who can sell / who can sign up

Two places, keep them in sync:
- `src/lib/allowedEmails.js` — `ALLOWED_EMAILS` (who can sign up with email/password) and `SELLER_EMAIL` (who sees "Add Product")
- `firestore.rules` — the `isSeller()` function, and `storage.rules`

Google sign-in is open to any Google account by design (so customers can log
in and shop); only the `SELLER_EMAIL` account gets the Add Product permission.

## What's *not* built yet (honest scope)

Coupons, discounts/flash sales, banners, delivery zones, granular admin
roles/permissions, push notifications, wishlist, multiple saved addresses,
audit log, CSV/PDF export. See **Roadmap** below.

## Setup

```bash
npm install
cp .env.example .env
# fill in your Firebase project's web config in .env
npm run dev
```

### Firebase project setup
1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Sign-in method → Email/Password** AND **Google**
3. Create a **Firestore Database** (production mode)
4. Enable **Storage** (for product image uploads)
5. Copy your web app config into `.env`
6. Deploy `firestore.rules` and `storage.rules` (Console → Firestore/Storage → Rules → paste → Publish)

### Creating your first Super Admin
Client-side signup always creates `role: "customer"` — this is intentional,
so nobody can just sign up and grant themselves admin. To create the first
admin:

```bash
# 1. Firebase Console → Project Settings → Service Accounts →
#    Generate new private key → save as scripts/serviceAccountKey.json
npm install firebase-admin
node scripts/setAdmin.js you@example.com
```

That user can now log in and will see the **Admin** link in the navbar.

## Firestore schema

```
users/{uid}          { name, email, phone, role: customer|admin|super_admin, blocked, createdAt }
categories/{id}       { name, active, order, createdAt }
products/{id}         { name, sku, barcode, brand, categoryId, categoryName, description,
                         specifications, price, salePrice, stock, lowStockThreshold,
                         images[], featured, status: active|inactive, createdAt, updatedAt }
orders/{id}            { orderNumber, userId, items[], address{}, paymentMethod, paymentStatus,
                         subtotal, deliveryCharge, discount, total, status, statusHistory[],
                         createdAt, updatedAt }
```

## Roadmap (suggested build order for Phase 2+)

1. **Wishlist** — small `wishlists/{userId}` doc, straightforward add
2. **Multiple addresses** — `users/{uid}/addresses` subcollection
3. **Coupons & discounts** — `coupons/{code}`, apply at checkout, validate
   min order / usage limits in the same transaction as `placeOrder`
4. **Banners** — `banners/{id}`, render on Home, admin CRUD (same pattern as categories)
5. **Reviews** — `reviews/{id}`, gate creation on "did this user buy this product"
6. **Notifications** — start with in-app (`notifications/{userId}/items`),
   add push (FCM) once in-app works — you've already done this for Bahria Academy
7. **Admin roles/permissions** — extend `users.role` to a `permissions[]` array,
   check specific permissions in rules and in the admin UI
8. **Analytics/reports + CSV export** — aggregate from `orders`, add a
   `papaparse`-based CSV export button
9. **Audit log** — write an `adminActivityLogs` doc alongside each admin
   write (wrap the existing `update*`/`create*`/`delete*` functions)

Given the size of what's left, I'd recommend continuing this in **Claude
Code** rather than chat — it's much better suited to iterating across many
files in an evolving codebase like this one.

## Tech stack
- React 18 + React Router 6 + Vite
- Firebase Auth + Firestore (no backend server needed)
- Plain CSS with design tokens in `src/styles/index.css` (no framework)
