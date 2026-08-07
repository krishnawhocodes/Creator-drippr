/**
 * Lazy, fail-loud Firebase Admin initialiser.
 *
 * Initialising at module scope means a missing/invalid service-account key
 * crashes the whole function with an opaque 500 before the handler runs.
 * Doing it inside a function lets us return a descriptive error instead.
 */

import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function parseServiceAccount(): Record<string, string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw || !raw.trim()) {
    throw new ConfigError(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Add it in Vercel -> Settings -> " +
        "Environment Variables as a SINGLE LINE of JSON, then redeploy.",
    );
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. It must be the entire " +
        "service-account file on ONE line (no line breaks). Common cause: " +
        "pasting the pretty-printed JSON straight from Firebase.",
    );
  }

  for (const field of ["project_id", "client_email", "private_key"]) {
    if (!parsed[field]) {
      throw new ConfigError(
        `FIREBASE_SERVICE_ACCOUNT_KEY is missing the "${field}" field. ` +
          "Re-download the key from Firebase Console -> Project Settings -> " +
          "Service Accounts -> Generate new private key.",
      );
    }
  }

  // Vercel sometimes stores \n as a literal backslash-n. Normalise it.
  if (parsed.private_key.includes("\\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }

  if (!parsed.private_key.includes("BEGIN PRIVATE KEY")) {
    throw new ConfigError(
      "The private_key inside FIREBASE_SERVICE_ACCOUNT_KEY looks malformed " +
        "(missing the BEGIN PRIVATE KEY header).",
    );
  }

  return parsed;
}

export function getAdminApp(): App {
  if (app) return app;

  const existing = getApps();
  if (existing.length) {
    app = existing[0];
    return app;
  }

  const serviceAccount = parseServiceAccount();

  try {
    app = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
  } catch (e) {
    throw new ConfigError(
      `Firebase Admin failed to initialise: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  return app;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** Verifies the Bearer token on a request and returns the caller's identity. */
export async function requireUser(req: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ uid: string; email: string | undefined }> {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value || !value.startsWith("Bearer ")) {
    const err = new Error("Missing or malformed Authorization header.");
    err.name = "UnauthorizedError";
    throw err;
  }

  const token = value.slice("Bearer ".length).trim();

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (e) {
    if (e instanceof ConfigError) throw e;
    const err = new Error(
      `Invalid or expired session token: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    err.name = "UnauthorizedError";
    throw err;
  }
}

/** Maps an error to an HTTP status + JSON body. */
export function errorResponse(e: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (e instanceof ConfigError) {
    return { status: 500, body: { error: e.message, code: "CONFIG_ERROR" } };
  }
  if (e instanceof Error && e.name === "UnauthorizedError") {
    return { status: 401, body: { error: e.message, code: "UNAUTHORIZED" } };
  }
  return {
    status: 500,
    body: {
      error: e instanceof Error ? e.message : "Unexpected server error.",
      code: "INTERNAL",
    },
  };
}
