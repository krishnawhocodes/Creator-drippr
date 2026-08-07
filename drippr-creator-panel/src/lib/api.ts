import { auth } from "./firebase";

async function authedFetch(url: string, opts: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();

  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body?.error || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Shopify analytics for an affiliate code.
 * Requires the serverless function to be deployed (needs the Shopify
 * admin token, which must stay server-side). Returns empty analytics
 * rather than throwing when the API isn't reachable, so the dashboard
 * still renders in local dev.
 */
export async function fetchAnalytics(affiliateCode: string) {
  try {
    return await authedFetch(
      `/api/analytics/shopify?code=${encodeURIComponent(affiliateCode)}`,
    );
  } catch {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      currencyCode: "INR",
      orders: [],
    };
  }
}

/** Signed upload credentials for ImageKit. */
export async function getImageKitAuth(): Promise<{
  token: string;
  signature: string;
  expire: number;
}> {
  return authedFetch("/api/imagekit/auth");
}

/**
 * Server configuration diagnostics.
 * Visit /api/health directly in a browser for the same information.
 */
export async function checkServerHealth() {
  const res = await fetch("/api/health");
  return res.json();
}
