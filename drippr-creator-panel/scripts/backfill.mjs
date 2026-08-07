/**
 * Backfill script — adds any missing fields to existing creator documents
 * and rebuilds the affiliateCodes uniqueness index.
 *
 * Safe to run multiple times. It only fills in missing fields; it never
 * overwrites data that already exists.
 *
 * Usage:
 *   node scripts/backfill.mjs
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in .env (single-line JSON).
 */

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Load .env manually (no dotenv dependency needed) ──
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error(
      "Could not read .env — make sure it exists in the project root.",
    );
    process.exit(1);
  }
}

loadEnv();

const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!rawKey) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is missing from .env");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawKey);
} catch {
  console.error(
    "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.\n" +
      "It must be on a SINGLE LINE in .env.",
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Every field a creator document should have, with its default
const DEFAULTS = {
  affiliateCode: "",
  affiliateCodeGeneratedAt: null,
  verificationStatus: "pending",
  verificationSubmittedAt: null,
  verificationReviewedAt: null,
  verificationReviewedBy: "",
  verificationRejectionReason: "",
  platform: "",
  profileLink: "",
  contentNiche: "",
  followerCount: "",
  idProofType: "",
  idProofNumber: "",
  idProofFileUrl: "",
  bio: "",
  city: "",
  state: "",
  phone: "",
  avatarUrl: "",
};

async function run() {
  console.log("Reading creators collection…\n");

  const snap = await db.collection("creators").get();

  if (snap.empty) {
    console.log("No creator documents found. Nothing to backfill.");
    return;
  }

  let patched = 0;
  let indexed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const patch = {};

    for (const [field, defaultValue] of Object.entries(DEFAULTS)) {
      if (data[field] === undefined) {
        patch[field] = defaultValue;
      }
    }

    // Ensure the uid field matches the document id
    if (data.uid !== docSnap.id) patch.uid = docSnap.id;

    if (Object.keys(patch).length > 0) {
      await docSnap.ref.update(patch);
      patched++;
      console.log(
        `✓ ${data.email || docSnap.id} — added: ${Object.keys(patch).join(", ")}`,
      );
    } else {
      console.log(`· ${data.email || docSnap.id} — already complete`);
    }

    // Rebuild the affiliate code index for any creator that has a code
    const code = (data.affiliateCode || "").trim().toUpperCase();
    if (code) {
      const indexRef = db.collection("affiliateCodes").doc(code);
      const existing = await indexRef.get();
      if (!existing.exists) {
        await indexRef.set({
          code,
          creatorUid: docSnap.id,
          createdAt: data.affiliateCodeGeneratedAt || Date.now(),
          createdBy: data.verificationReviewedBy || "backfill",
        });
        indexed++;
        console.log(`  ↳ indexed affiliate code ${code}`);
      }
    }
  }

  console.log(
    `\nDone. ${patched} document(s) patched, ${indexed} affiliate code(s) indexed.`,
  );
  console.log(
    "\nNote: the affiliateCodes / changeRequests / supportTickets / payments\n" +
      "collections only appear in the Firebase console once they contain at\n" +
      "least one document. They are created automatically on first use.",
  );
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nBackfill failed:", e.message);
    process.exit(1);
  });
