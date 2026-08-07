import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadCredentials } from "./_lib/firebaseAdmin.js";

/**
 * Diagnostic endpoint — visit /api/health in a browser.
 *
 * Reports which environment variables are present and well-formed WITHOUT
 * ever revealing their values.
 */

type Check = { name: string; ok: boolean; detail: string };

function checkPresent(name: string, expectedPrefix?: string): Check {
  const raw = (process.env[name] || "").trim();

  if (!raw) {
    return { name, ok: false, detail: "MISSING — not set in this environment" };
  }
  if (expectedPrefix && !raw.startsWith(expectedPrefix)) {
    return {
      name,
      ok: false,
      detail: `set (${raw.length} chars) but does not start with "${expectedPrefix}"`,
    };
  }
  return { name, ok: true, detail: `set (${raw.length} chars)` };
}

function checkFirebaseCredentials(): Check {
  const name = "Firebase Admin credentials";
  try {
    const creds = loadCredentials();
    return {
      name,
      ok: true,
      detail: `valid via ${creds.source} — project: ${creds.projectId}, account: ${creds.clientEmail}`,
    };
  } catch (e) {
    return {
      name,
      ok: false,
      detail: e instanceof Error ? e.message : "unknown error",
    };
  }
}

function whichVarsAreSet(): Record<string, boolean> {
  return {
    FIREBASE_SERVICE_ACCOUNT_BASE64:
      !!(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim(),
    FIREBASE_SERVICE_ACCOUNT_KEY:
      !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "").trim(),
    FIREBASE_PROJECT_ID: !!(process.env.FIREBASE_PROJECT_ID || "").trim(),
    FIREBASE_CLIENT_EMAIL: !!(process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    FIREBASE_PRIVATE_KEY: !!(process.env.FIREBASE_PRIVATE_KEY || "").trim(),
  };
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Check[] = [
    checkFirebaseCredentials(),
    checkPresent("IMAGEKIT_PRIVATE_KEY", "private_"),
    checkPresent("ADMIN_UIDS"),
    checkPresent("SHOPIFY_STORE_DOMAIN"),
    checkPresent("SHOPIFY_ADMIN_ACCESS_TOKEN", "shpat_"),
  ];

  const allOk = checks.every((c) => c.ok);

  return res.status(allOk ? 200 : 500).json({
    status: allOk ? "ok" : "misconfigured",
    node: process.version,
    checks,
    firebaseVarsPresent: whichVarsAreSet(),
    hint: allOk
      ? "All server environment variables look correct."
      : "Fix the failing checks in Vercel -> Settings -> Environment Variables, " +
        "then REDEPLOY. For Firebase, the most reliable option is " +
        "FIREBASE_SERVICE_ACCOUNT_BASE64 — see SETUP.md.",
  });
}
