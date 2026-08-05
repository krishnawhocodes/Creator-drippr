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
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

// ── Admin API ──

export async function adminAction(action: string, body: Record<string, unknown> = {}) {
  return authedFetch(`/api/admin/admin?action=${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAllCreators() {
  return adminAction("listCreators");
}

export async function fetchCreatorDetail(uid: string) {
  return adminAction("getCreator", { uid });
}

export async function approveCreator(uid: string, affiliateCode: string) {
  return adminAction("approveCreator", { uid, affiliateCode });
}

export async function rejectCreator(uid: string, reason: string) {
  return adminAction("rejectCreator", { uid, reason });
}

export async function checkAffiliateCodeUnique(code: string) {
  return adminAction("checkAffiliateCode", { code });
}

export async function isAdmin(): Promise<boolean> {
  try {
    const data = await adminAction("checkAdmin");
    return data?.isAdmin === true;
  } catch {
    return false;
  }
}

// ── Analytics ──

export async function fetchAnalytics(affiliateCode: string) {
  return authedFetch(`/api/analytics/shopify?code=${encodeURIComponent(affiliateCode)}`);
}

// ── ImageKit Auth ──

export async function getImageKitAuth() {
  return authedFetch("/api/imagekit/auth");
}
