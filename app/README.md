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
- **Day 7 → locked:** the app becomes read-only: the user can view their existing history (workouts, meals, weight)
  but cannot log anything new or use AI, menu, coach. Paywall shows on every open.
- **Lock-time offer, 24 h real countdown:** monthly with the store intro offer, first month ₪9.90, then ₪29.90/month.
  After 24 h the offer disappears for good; regular prices only.
- **Regular prices:** ₪29.90/month, ₪179.90/year.
- Store setup: `premium_monthly` ₪29.90 + Introductory Offer "Pay up front, 1 month, ₪9.90";
  `premium_yearly` ₪179.90 (no intro offer).
- To build at launch: server-side lock (RLS: writes only when premium), read-only UI, 24 h offer timer
  (server timestamp of lock, so it can't be reset), offering switch in RevenueCat (`lock_offer` vs `default`).

## Launch checklist
1. Apple: Bundle ID `il.co.nextrep.app` (Push Notifications + Sign In with Apple), app in App Store Connect.
2. App Store Connect → Subscriptions: group "NextRep Premium", products `premium_monthly` (₪29.90) and
   `premium_yearly` (₪179.90). Google Play Console: same two product IDs.
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
