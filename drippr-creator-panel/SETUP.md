# Drippr Creator Panel — Setup

## 1. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:5174

---

## 2. Firebase Console — required steps

### a) Enable Email/Password auth
Authentication → Sign-in method → **Email/Password** → Enable → Save

### b) Create the admin user
Authentication → Users → **Add user**

- Email: `sachinwhocodes@gmail.com`
- Password: `bahubali5`

### c) Publish Firestore rules  ← **THIS IS REQUIRED**
Firestore Database → **Rules** tab → paste the entire contents of
`firestore.rules` from this project → **Publish**

Without this the admin panel will show "Missing or insufficient permissions".

> The rules identify admins by **email**. To add more admins, edit the list
> inside `firestore.rules` **and** `src/lib/admin.ts`.

### d) Create the Firestore indexes (if prompted)
Firestore may ask you to create composite indexes the first time you open
Payments or the Review Queue. Click the link in the browser console and
Firebase creates them for you.

---

## 3. ImageKit (for ID proof uploads)

Get your URL endpoint from https://imagekit.io/dashboard — it looks like
`https://ik.imagekit.io/abc123`.

Set it in `.env`:

```
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/abc123
```

Note: ID proof upload requires the `/api/imagekit/auth` serverless function,
so it only works once deployed to Vercel (or with `vercel dev` locally).

---

## 4. Vercel deployment

Add every variable from `.env` to
**Project → Settings → Environment Variables**.

`FIREBASE_SERVICE_ACCOUNT_KEY` must be pasted as a **single line** of JSON.

Then deploy:

```bash
vercel --prod
```

---

## Data model (Firestore collections)

| Collection | Purpose | Created when |
|---|---|---|
| `creators` | One doc per creator, keyed by Firebase UID. Contains profile, verification status, and `affiliateCode`. | First registration |
| `affiliateCodes` | Uniqueness index. **Doc ID is the code itself**, so duplicates are impossible. Contains `creatorUid`. | First creator approved |
| `changeRequests` | Profile change requests from verified creators, awaiting admin approval. | First change request submitted |
| `supportTickets` | Support messages from creators, with admin replies. | First support message sent |
| `payments` | Payout records (admin-written). | First payout recorded |

### ⚠️ Why you may not see all collections yet

**Firestore creates collections lazily.** A collection only appears in the
console once it contains at least one document. Empty collections do not
exist as far as Firestore is concerned — this is normal behaviour, not a bug.

So `affiliateCodes`, `changeRequests`, `supportTickets` and `payments` will
be missing until the corresponding action happens for the first time.

### Backfilling older creator documents

Creators who registered **before** the latest update won't have the newer
fields (`affiliateCode`, `bio`, `city`, `state`, etc.). Existing documents
are never rewritten automatically.

To patch them all at once:

```bash
npm run backfill
```

This:
- adds any missing fields to every creator document (with safe defaults)
- never overwrites existing values
- rebuilds the `affiliateCodes` index from any codes already assigned
- is safe to run as many times as you like

Alternatively, for a single document you can just click **+ Add field** in
the Firebase console and add `affiliateCode` as an empty string.

---

## Verification → affiliate code flow

1. Creator registers → doc created in `creators` with
   `verificationStatus: "pending"` and `affiliateCode: ""`.
2. Creator fills the Verification form (platform, profile link, niche,
   follower count, ID type, ID number, ID file upload) → status becomes
   `"submitted"`.
3. Creator appears in **Admin → Verify Creators**.
4. Admin opens the creator, clicks **Approve & Assign Code**. A unique code
   is auto-generated (uniqueness checked live against `affiliateCodes` and
   `creators`). Admin can edit it; availability is re-checked as they type.
5. On approve:
   - Code is written to `affiliateCodes/{CODE}` (guarantees uniqueness)
   - Creator doc updated: `verificationStatus: "approved"`, `affiliateCode`,
     `affiliateCodeGeneratedAt`, `verificationReviewedBy`
6. Creator immediately sees the code on their Dashboard, Verification page,
   and in the sidebar.

Rejection sets `verificationStatus: "rejected"` with a reason shown to the
creator, who can then re-submit.

---

## Admin panel sections

| Route | Page |
|---|---|
| `/admin` | Dashboard — KPIs, signup chart, status donut, action queues |
| `/admin/verify` | Verify Creators — submitted applications |
| `/admin/review` | Review Queue — profile change requests with before/after diff |
| `/admin/creators` | Creators — full searchable list, CSV export |
| `/admin/creator/:uid` | Creator detail — full profile + approve/reject |
| `/admin/support` | Support — tickets with reply/close |
| `/admin/settings` | Admin settings — account, system stats, password |

Admins also get an **Admin Panel** link in the creator sidebar and in the
avatar dropdown, plus a **Creator View** link to switch back.
