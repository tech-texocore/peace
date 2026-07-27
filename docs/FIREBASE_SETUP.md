# Firebase setup (free / Spark plan)

Auth for both the storefront (customer login at cart) and `/admin` (Super Admin +
Admin) runs on **Firebase Authentication** — free, no billing.

## Status (project: `peace-texocore`, display name "Peace") — ✅ DONE & verified

- ✅ Project created via CLI, pinned in `.firebaserc`.
- ✅ Web app created; config written to `peace-web/.env.local`.
- ✅ Backend service account set (`FIREBASE_PROJECT_ID` / `CLIENT_EMAIL` / `PRIVATE_KEY`); Admin SDK initialises on boot.
- ✅ **Email/Password enabled** — verified: `admin@peace.com` and `superadmin@peace.com` both sign in and their role claims pass backend auth.
- ℹ️ Google sign-in optional (not required for admin or checkout).

Everything below is the original one-time setup guide, kept for reference / re-provisioning.

Console links:
- Sign-in methods: https://console.firebase.google.com/project/peace-texocore/authentication/providers
- Service account: https://console.firebase.google.com/project/peace-texocore/settings/serviceaccounts/adminsdk

## 1. Create the project (browser — TEXOCORE Google account)

1. https://console.firebase.google.com → sign in with the **TEXOCORE** account.
2. **Add project** → name `peace` → you can disable Analytics → Create. (Spark/free plan.)

## 2. Enable sign-in methods

**Authentication → Get started → Sign-in method**
- Enable **Email/Password**.
- (Optional) Enable **Google**.

## 3. Web app config (for peace-web)

**Project settings (gear) → General → Your apps → Web `</>`** → register app →
copy the `firebaseConfig` values into `peace-web/.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=peace-xxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=peace-xxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=peace-xxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 4. Service account (for peace-backend)

**Project settings → Service accounts → Generate new private key** → downloads a JSON.
Copy three values into `peace-backend/.env` (keep the `\n` in the private key):

```
FIREBASE_PROJECT_ID=peace-xxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@peace-xxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"
```

## 5. Create the first Super Admin (bootstrap)

With the backend running and `SETUP_SECRET` set in `peace-backend/.env`:

```
curl -X POST http://localhost:4000/api/bootstrap/super-admin \
  -H "x-setup-secret: <SETUP_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@texocore.com","password":"<strong-pass>","name":"Super Admin"}'
```

This creates the Firebase user + `SUPER_ADMIN` role claims, the default store, its
seeded roles, and the initial site config. You can now log in at `/admin`.

## Notes
- Free-tier only: Email/Password + Google + Admin SDK custom claims. No Identity
  Platform multi-tenancy, no Firebase phone/SMS (customer SMS uses MSG91), no Blaze.
- Tenancy is handled in our own database (`storeId`), not Firebase.
