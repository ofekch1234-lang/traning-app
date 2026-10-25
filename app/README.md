# NextRep native apps (iOS + Android)

The web app at the repo root is the single source of truth. This folder only wraps it with
[Capacitor](https://capacitorjs.com) so it can ship to the App Store and Google Play.

- `scripts/copy-web.js` copies the web files into `www/` and swaps the Supabase CDN script for a local copy.
- `npm run sync` = copy + `cap sync` (run after every web change you want in the next app build).
- Native-only behaviour in `index.html` is behind `IS_NATIVE` (search for it). On the website it is all off.

| | |
|---|---|
| Bundle ID / package | `il.co.nextrep.app` |
| Store name | NextRep: אימון ותזונה |
| SKU | `nextrep-ios` |
| Orientation | portrait, iPhone only (no iPad) |

## What runs differently inside the app
- **Notifications**: local notifications on the device (rest timer, test notification). Web push is off.
  Server-sent reminders (daily nudges) still need APNs/FCM: next step, see checklist.
- **Purchases**: only through the store (RevenueCat). Grow is never shown in the app.
- **Links**: terms/privacy/external links open in an in-app browser; WhatsApp/mail open their apps.
- **Android back button**: closes a sheet → back to Home → minimizes.
- **Status bar** follows light/dark theme. No service worker (the app ships its own files).

## Business model (decided 2026-10-23)
- **Days 1–7:** full premium, no card (server trial, as today).
- **Day 7 → locked:** read-only. The user can view existing history (workouts, meals, weight) but cannot log
  anything new or use AI, menu, coach. Paywall on every open. A workout in progress may be finished (grace).
- **Intro offer (updated 2026-10-25): open for the whole free week, ends with the trial; the last 24 h show a live countdown
  (home card + paywall), local notifications 24 h / 3 h / 1 h before. Built in `offerWin()` in index.html.**
- **Original note, lock-time offer, 24 h real countdown (server timestamp, can't be reset):**
  monthly first month ₪9.90 then ₪29.90, **or** yearly first year ₪149.90 then ₪179.90 (highlighted, "save 58%").
- **Second chance, once:** 7 days after the lock, push + email: the same offer again for 24 h. Never again after that.
- **Regular prices:** ₪29.90/month, ₪179.90/year.
- **Store products (one subscription group "NextRep Premium"):**
  - `premium_monthly` ₪29.90, `premium_yearly` ₪179.90: regular, no intro offer.
  - `premium_monthly_offer` ₪29.90 + Introductory Offer "Pay up front, 1 month, ₪9.90".
  - `premium_yearly_offer` ₪179.90 + Introductory Offer "Pay up front, 1 year, ₪149.90".
  - Why separate offer products: the store applies an intro offer automatically to every eligible buyer, so the
    discount can only "expire" if the discounted products are shown only inside the 24 h windows.
  - RevenueCat offerings: `default` (regular two) and `lock_offer` (the two *_offer products).
- **Later option, card up front:** add a 7-day free-trial intro offer to the products, turn the server trial off.
  Config + a small code change, no rebuild of the model.
- Approved paywall design: `design/lock-paywall.png` (mockup source `design/lock-paywall.html`).
- To build at launch: server-side lock (RLS: writes only when premium), read-only UI, offer windows
  (`offer_until` per user, set at lock and at day 14), offering switch.

## Launch checklist
1. Apple: Bundle ID `il.co.nextrep.app` (Push Notifications + Sign In with Apple), app in App Store Connect.
2. App Store Connect → Subscriptions: group "NextRep Premium" with the 4 products above.
   Google Play Console: same product IDs (base plans + offers).
3. RevenueCat: project, iOS + Android apps, entitlement **`premium`**, offering `default` with
   `$rc_monthly` + `$rc_annual`. Webhook URL → `https://dmeougthlruspxwyvrnc.supabase.co/functions/v1/revenuecat`
   with an Authorization value.
4. Supabase: run `supabase/migrations/store_subs.sql`, set secrets `RC_SECRET_KEY` + `RC_WEBHOOK_AUTH`,
   deploy `revenuecat` (verify_jwt=false) and the updated `coach`.
5. `index.html`: fill `RC_KEYS` (public SDK keys), and at launch `STORE_URL` + `STORE_ONLY=true`.
6. iOS signing: distribution certificate + App Store provisioning profile (or App Store Connect API key)
   as GitHub secrets, then add a signed archive + TestFlight upload job to `.github/workflows/native.yml`.
7. Android signing: upload keystore as GitHub secrets, add `bundleRelease` job, upload the .aab to Play Console.
8. Store listing: screenshots, description, privacy labels, account-deletion info, review notes + demo account.
