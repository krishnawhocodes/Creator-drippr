import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Diagnostic endpoint — visit /api/health in a browser.
 *
 * Reports which environment variables are present and well-formed WITHOUT
 * ever revealing their values. Use this to work out why an API route is
 * returning 500.
 */

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

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

function checkServiceAccount(): Check {
  const name = "FIREBASE_SERVICE_ACCOUNT_KEY";
  const raw = process.env[name];

  if (!raw || !raw.trim()) {
    return { name, ok: false, detail: "MISSING — not set in this environment" };
  }

  if (raw.includes("\n") && !raw.includes("\\n")) {
    return {
      name,
      ok: false,
      detail:
        "contains real line breaks — must be a SINGLE LINE of JSON in Vercel",
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      name,
      ok: false,
      detail: `not valid JSON (${e instanceof Error ? e.message : "parse error"})`,
    };
  }

  const missing = ["project_id", "client_email", "private_key"].filter(
    (f) => !parsed[f],
  );
  if (missing.length) {
    return {
      name,
      ok: false,
      detail: `valid JSON but missing field(s): ${missing.join(", ")}`,
    };
  }

  const pk = String(parsed.private_key);
  if (!pk.includes("BEGIN PRIVATE KEY")) {
    return {
      name,
      ok: false,
      detail: "private_key is malformed (no BEGIN PRIVATE KEY header)",
    };
  }

  return {
    name,
    ok: true,
    detail: `valid — project_id: ${parsed.project_id}`,
  };
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Check[] = [
    checkServiceAccount(),
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
    hint: allOk
      ? "All server environment variables look correct."
      : "Fix the failing checks in Vercel -> Settings -> Environment Variables, then REDEPLOY (env changes need a fresh deploy).",
  });
}
