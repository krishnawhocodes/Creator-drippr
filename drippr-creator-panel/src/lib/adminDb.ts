/**
 * Admin data layer — direct Firestore access.
 *
 * Works in local dev and in production without requiring the serverless
 * functions to be deployed. Authorization is enforced by Firestore rules
 * (see firestore.rules) which grant admins read/write on all collections.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  updateDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  CreatorProfile,
  ChangeRequest,
  SupportTicket,
  PaymentRecord,
} from "@/types";

// ── Creators ──

export async function listCreators(): Promise<CreatorProfile[]> {
  const snap = await getDocs(
    query(collection(db, "creators"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ ...(d.data() as CreatorProfile), uid: d.id }));
}

export async function getCreator(uid: string): Promise<CreatorProfile | null> {
  const snap = await getDoc(doc(db, "creators", uid));
  if (!snap.exists()) return null;
  return { ...(snap.data() as CreatorProfile), uid: snap.id };
}

// ── Affiliate codes ──

/**
 * Checks whether an affiliate code is free.
 * Reads the `affiliateCodes` index collection (doc id = the code) so the
 * check is a single fast document read and is guaranteed unique.
 */
export async function isAffiliateCodeAvailable(
  code: string,
  ignoreUid?: string,
): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;

  // 1. Check the dedicated index collection
  const indexSnap = await getDoc(doc(db, "affiliateCodes", normalized));
  if (indexSnap.exists()) {
    const owner = indexSnap.data()?.creatorUid;
    if (!ignoreUid || owner !== ignoreUid) return false;
  }

  // 2. Belt-and-braces: also scan creators in case the index is out of sync
  const creatorSnap = await getDocs(
    query(
      collection(db, "creators"),
      where("affiliateCode", "==", normalized),
      fsLimit(1),
    ),
  );
  if (!creatorSnap.empty) {
    const found = creatorSnap.docs[0];
    if (!ignoreUid || found.id !== ignoreUid) return false;
  }

  return true;
}

/** Generates a unique affiliate code, retrying until one is free. */
export async function generateUniqueAffiliateCode(
  fullName: string,
): Promise<string> {
  const base = (fullName || "DRIP")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6) || "DRIP";

  for (let attempt = 0; attempt < 25; attempt++) {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidate = `${base}${rand}`;
    if (await isAffiliateCodeAvailable(candidate)) return candidate;
  }

  // Fallback — timestamp suffix is effectively collision-proof
  return `${base}${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

// ── Verification actions ──

export async function approveCreator(
  uid: string,
  affiliateCode: string,
  reviewerEmail: string,
): Promise<void> {
  const normalized = affiliateCode.trim().toUpperCase();

  const available = await isAffiliateCodeAvailable(normalized, uid);
  if (!available) {
    throw new Error(
      `Affiliate code "${normalized}" is already in use. Please choose another.`,
    );
  }

  const now = Date.now();

  // Write the code into the uniqueness index first
  await setDoc(doc(db, "affiliateCodes", normalized), {
    code: normalized,
    creatorUid: uid,
    createdAt: now,
    createdBy: reviewerEmail,
  });

  // Then update the creator record
  await updateDoc(doc(db, "creators", uid), {
    verificationStatus: "approved",
    affiliateCode: normalized,
    affiliateCodeGeneratedAt: now,
    verificationReviewedAt: now,
    verificationReviewedBy: reviewerEmail,
    verificationRejectionReason: "",
    updatedAt: now,
  });
}

export async function rejectCreator(
  uid: string,
  reason: string,
  reviewerEmail: string,
): Promise<void> {
  await updateDoc(doc(db, "creators", uid), {
    verificationStatus: "rejected",
    verificationRejectionReason: reason || "",
    verificationReviewedAt: Date.now(),
    verificationReviewedBy: reviewerEmail,
    updatedAt: Date.now(),
  });
}

// ── Change requests ──

export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const snap = await getDocs(
    query(collection(db, "changeRequests"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ ...(d.data() as ChangeRequest), id: d.id }));
}

export async function createChangeRequest(
  req: Omit<ChangeRequest, "id" | "createdAt" | "status">,
): Promise<void> {
  await addDoc(collection(db, "changeRequests"), {
    ...req,
    status: "pending",
    createdAt: Date.now(),
  });
}

export async function approveChangeRequest(
  request: ChangeRequest,
  reviewerEmail: string,
): Promise<void> {
  // Build the patch, deserialising any JSON-encoded complex fields
  const patch: Record<string, unknown> = {};

  Object.entries(request.changes).forEach(([field, value]) => {
    if (field === "platforms") {
      try {
        const parsed = JSON.parse(value);
        patch.platforms = parsed;

        // Keep the legacy single-platform fields in sync
        const primary = Array.isArray(parsed) ? parsed[0] : null;
        patch.platform = primary?.platform || "";
        patch.profileLink = primary?.profileLink || "";
        patch.followerCount = primary?.followerCount || "";
      } catch {
        // Malformed payload — skip rather than corrupt the record
      }
    } else {
      patch[field] = value;
    }
  });

  patch.updatedAt = Date.now();

  await updateDoc(doc(db, "creators", request.creatorUid), patch);

  await updateDoc(doc(db, "changeRequests", request.id), {
    status: "approved",
    reviewedAt: Date.now(),
    reviewedBy: reviewerEmail,
  });
}

export async function rejectChangeRequest(
  requestId: string,
  reason: string,
  reviewerEmail: string,
): Promise<void> {
  await updateDoc(doc(db, "changeRequests", requestId), {
    status: "rejected",
    rejectionReason: reason,
    reviewedAt: Date.now(),
    reviewedBy: reviewerEmail,
  });
}

// ── Support tickets ──

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const snap = await getDocs(
    query(collection(db, "supportTickets"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ ...(d.data() as SupportTicket), id: d.id }));
}

export async function createSupportTicket(
  ticket: Omit<SupportTicket, "id" | "createdAt" | "status">,
): Promise<void> {
  await addDoc(collection(db, "supportTickets"), {
    ...ticket,
    status: "open",
    createdAt: Date.now(),
  });
}

export async function replyToTicket(
  ticketId: string,
  reply: string,
  responderEmail: string,
): Promise<void> {
  await updateDoc(doc(db, "supportTickets", ticketId), {
    adminReply: reply,
    status: "resolved",
    respondedAt: Date.now(),
    respondedBy: responderEmail,
  });
}

export async function closeTicket(ticketId: string): Promise<void> {
  await updateDoc(doc(db, "supportTickets", ticketId), {
    status: "closed",
    closedAt: Date.now(),
  });
}

// ── Payments ──

export async function listAllPayments(): Promise<PaymentRecord[]> {
  const snap = await getDocs(
    query(collection(db, "payments"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ ...(d.data() as PaymentRecord), id: d.id }));
}

export { serverTimestamp };
