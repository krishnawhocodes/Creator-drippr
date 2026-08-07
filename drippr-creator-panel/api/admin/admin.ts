import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, adminDb, errorResponse } from "../_lib/firebaseAdmin.js";

/**
 * Optional server-side admin gateway.
 *
 * The panel primarily talks to Firestore directly (secured by
 * firestore.rules), so this endpoint is not required for the app to work.
 * It's kept for server-side operations you may want to add later.
 */

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_EMAILS = ["sachinwhocodes@gmail.com"];

function assertAdmin(caller: { uid: string; email?: string }) {
  const byUid = ADMIN_UIDS.includes(caller.uid);
  const byEmail = !!caller.email && ADMIN_EMAILS.includes(caller.email.toLowerCase());

  if (!byUid && !byEmail) {
    const err = new Error("You do not have administrator access.");
    err.name = "UnauthorizedError";
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = String(req.query.action || "");

  try {
    const caller = await requireUser(req);

    if (action === "checkAdmin") {
      const isAdmin =
        ADMIN_UIDS.includes(caller.uid) ||
        (!!caller.email && ADMIN_EMAILS.includes(caller.email.toLowerCase()));
      return res.status(200).json({ isAdmin });
    }

    assertAdmin(caller);
    const db = adminDb();

    switch (action) {
      case "listCreators": {
        const snap = await db
          .collection("creators")
          .orderBy("createdAt", "desc")
          .get();
        return res
          .status(200)
          .json({ creators: snap.docs.map((d) => ({ ...d.data(), uid: d.id })) });
      }

      case "getCreator": {
        const { uid } = req.body as { uid?: string };
        if (!uid) return res.status(400).json({ error: "uid is required" });
        const doc = await db.collection("creators").doc(uid).get();
        if (!doc.exists)
          return res.status(404).json({ error: "Creator not found" });
        return res.status(200).json({ creator: { ...doc.data(), uid: doc.id } });
      }

      case "checkAffiliateCode": {
        const { code } = req.body as { code?: string };
        if (!code) return res.status(400).json({ error: "code is required" });
        const normalized = code.trim().toUpperCase();

        const indexDoc = await db
          .collection("affiliateCodes")
          .doc(normalized)
          .get();
        return res.status(200).json({ available: !indexDoc.exists });
      }

      case "approveCreator": {
        const { uid, affiliateCode } = req.body as {
          uid?: string;
          affiliateCode?: string;
        };
        if (!uid || !affiliateCode) {
          return res
            .status(400)
            .json({ error: "uid and affiliateCode are required" });
        }

        const normalized = affiliateCode.trim().toUpperCase();
        const indexRef = db.collection("affiliateCodes").doc(normalized);

        // Transaction guarantees the code can't be double-assigned
        await db.runTransaction(async (tx) => {
          const existing = await tx.get(indexRef);
          if (existing.exists && existing.data()?.creatorUid !== uid) {
            throw new Error(`Affiliate code "${normalized}" is already in use.`);
          }

          const now = Date.now();

          tx.set(indexRef, {
            code: normalized,
            creatorUid: uid,
            createdAt: now,
            createdBy: caller.email || caller.uid,
          });

          tx.update(db.collection("creators").doc(uid), {
            verificationStatus: "approved",
            affiliateCode: normalized,
            affiliateCodeGeneratedAt: now,
            verificationReviewedAt: now,
            verificationReviewedBy: caller.email || caller.uid,
            verificationRejectionReason: "",
            updatedAt: now,
          });
        });

        return res.status(200).json({ success: true, affiliateCode: normalized });
      }

      case "rejectCreator": {
        const { uid, reason } = req.body as { uid?: string; reason?: string };
        if (!uid) return res.status(400).json({ error: "uid is required" });

        await db.collection("creators").doc(uid).update({
          verificationStatus: "rejected",
          verificationRejectionReason: reason || "",
          verificationReviewedAt: Date.now(),
          verificationReviewedBy: caller.email || caller.uid,
          updatedAt: Date.now(),
        });

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    const { status, body } = errorResponse(e);
    console.error("[admin]", action, body.code, body.error);
    return res.status(status).json(body);
  }
}
