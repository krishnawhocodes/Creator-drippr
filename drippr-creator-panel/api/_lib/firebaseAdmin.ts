/**
 * Lazy, fail-loud Firebase Admin initialiser.
 *
 * Credentials are loaded using the first strategy that works:
 *
 *   1. Separate vars  — FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 *                       FIREBASE_PRIVATE_KEY        (most reliable)
 *   2. Base64         — FIREBASE_SERVICE_ACCOUNT_BASE64  (paste-safe)
 *   3. Raw JSON       — FIREBASE_SERVICE_ACCOUNT_KEY     (fragile)
 *
 * Strategy 3 is fragile because copying JSON through chat apps, docs or
 * some dashboards silently replaces straight quotes with typographic
 * quotes and can inject zero-width characters. We sanitise for those, but
 * strategies 1 and 2 avoid the problem entirely.
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

export interface Credentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: string;
}

/**
 * Removes the invisible / look-alike characters that break JSON.parse:
 *  - UTF-8 BOM
 *  - zero-width space, joiner, non-joiner, no-break space
 *  - typographic (“smart”) double and single quotes
 *  - non-breaking space
 */
export function sanitize(input: string): string {
  return input
    .replace(/^﻿/, "")               // BOM
    .replace(/[​-‍⁠]/g, "") // zero-width chars
    .replace(/ /g, " ")              // non-breaking space
    .replace(/[“”„‟″]/g, '"') // smart double quotes
    .replace(/[‘’‚‛′]/g, "'") // smart single quotes
    .trim();
}

/** Strips a single layer of wrapping quotes, if present. */
function unwrapQuotes(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** Normalises a PEM private key regardless of how newlines were stored. */
function normalisePrivateKey(key: string): string {
  let k = unwrapQuotes(sanitize(key));

  // Literal backslash-n -> real newline
  k = k.replace(/\\n/g, "\n");
  // Windows line endings
  k = k.replace(/\r\n/g, "\n");

  return k;
}

function validate(creds: Credentials): Credentials {
  if (!creds.projectId) {
    throw new ConfigError(
      `[${creds.source}] project_id is missing from the credentials.`,
    );
  }
  if (!creds.clientEmail) {
    throw new ConfigError(
      `[${creds.source}] client_email is missing from the credentials.`,
    );
  }
  if (!creds.privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new ConfigError(
      `[${creds.source}] private_key is malformed — it must contain the ` +
        `"-----BEGIN PRIVATE KEY-----" header.`,
    );
  }
  return creds;
}

// ── Strategy 1: separate environment variables ───────────────────────
function fromSeparateVars(): Credentials | null {
  const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || "";

  if (!projectId && !clientEmail && !privateKeyRaw) return null;

  return validate({
    projectId: unwrapQuotes(projectId),
    clientEmail: unwrapQuotes(clientEmail),
    privateKey: normalisePrivateKey(privateKeyRaw),
    source: "separate vars",
  });
}

// ── Strategy 2: base64-encoded service account ───────────────────────
function fromBase64(): Credentials | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim();
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(unwrapQuotes(raw), "base64").toString("utf8");
  } catch {
    throw new ConfigError(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 could not be base64-decoded.",
    );
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(sanitize(decoded));
  } catch (e) {
    throw new ConfigError(
      `FIREBASE_SERVICE_ACCOUNT_BASE64 decoded but the result is not valid ` +
        `JSON (${e instanceof Error ? e.message : "parse error"}).`,
    );
  }

  return validate({
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: normalisePrivateKey(parsed.private_key || ""),
    source: "base64",
  });
}

// ── Strategy 3: raw JSON ─────────────────────────────────────────────
function fromJson(): Credentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim()) return null;

  const cleaned = unwrapQuotes(sanitize(raw));

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Show the offending characters so the cause is obvious
    const preview = cleaned.slice(0, 12);
    const codes = Array.from(preview)
      .map((c) => `${JSON.stringify(c)}=U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`)
      .join(" ");

    throw new ConfigError(
      `FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON ` +
        `(${e instanceof Error ? e.message : "parse error"}). ` +
        `First characters: ${codes}. ` +
        `Typographic quotes (U+201C/U+201D) or hidden characters are the ` +
        `usual cause. Use FIREBASE_SERVICE_ACCOUNT_BASE64 instead — it is ` +
        `immune to this. See SETUP.md.`,
    );
  }

  return validate({
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: normalisePrivateKey(parsed.private_key || ""),
    source: "raw JSON",
  });
}

export function loadCredentials(): Credentials {
  const errors: string[] = [];

  for (const strategy of [fromSeparateVars, fromBase64, fromJson]) {
    try {
      const creds = strategy();
      if (creds) return creds;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (errors.length) {
    throw new ConfigError(errors.join(" | "));
  }

  throw new ConfigError(
    "No Firebase credentials found. Set ONE of: " +
      "FIREBASE_SERVICE_ACCOUNT_BASE64 (recommended), " +
      "FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, " +
      "or FIREBASE_SERVICE_ACCOUNT_KEY. Then redeploy.",
  );
}

export function getAdminApp(): App {
  if (app) return app;

  const existing = getApps();
  if (existing.length) {
    app = existing[0];
    return app;
  }

  const creds = loadCredentials();

  try {
    app = initializeApp({
      credential: cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey,
      }),
    });
  } catch (e) {
    throw new ConfigError(
      `Firebase Admin failed to initialise using ${creds.source}: ${
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
