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

// Resolve credentials the same way the API functions do:
// base64 → separate vars → raw JSON
function loadServiceAccount() {
  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim();
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT_BASE64 could not be decoded:", e.message);
      process.exit(1);
    }
  }

  const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, ""),
    };
  }

  const rawKey = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "").trim();
  if (rawKey) {
    try {
      return JSON.parse(rawKey);
    } catch (e) {
      console.error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:",
        e.message,
        "\nUse FIREBASE_SERVICE_ACCOUNT_BASE64 instead — it is paste-safe.",
      );
      process.exit(1);
    }
  }

  console.error(
    "No Firebase credentials found in .env.\n" +
      "Set FIREBASE_SERVICE_ACCOUNT_BASE64 (recommended).",
  );
  process.exit(1);
}

const serviceAccount = loadServiceAccount();

initializeApp({
  credential: cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: String(serviceAccount.private_key).replace(/\\n/g, "\n"),
  }),
});
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
