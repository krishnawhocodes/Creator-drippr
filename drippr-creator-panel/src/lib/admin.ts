/**
 * Admin detection.
 *
 * Admins are identified by email (primary, always works) and optionally
 * by UID via the VITE_ADMIN_UIDS env var.
 *
 * NOTE: This is only for showing/hiding UI. All real authorization is
 * enforced server-side in api/admin/admin.ts using ADMIN_UIDS.
 */

export const ADMIN_EMAILS = [
  "sachinwhocodes@gmail.com",
];

const ADMIN_UIDS: string[] = (import.meta.env.VITE_ADMIN_UIDS || "")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);

export function isAdminUser(
  user: { uid?: string | null; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;

  const email = (user.email || "").trim().toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) return true;

  const uid = user.uid || "";
  if (uid && ADMIN_UIDS.includes(uid)) return true;

  return false;
}
