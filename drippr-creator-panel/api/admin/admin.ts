import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Firebase Admin init ──

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({ credential: cert(serviceAccount) });
}

const adminAuth = getAuth();
const db = getFirestore();

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);

// ── Helpers ──

async function verifyAdmin(req: VercelRequest): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.split("Bearer ")[1];
  const decoded = await adminAuth.verifyIdToken(token);
  if (!ADMIN_UIDS.includes(decoded.uid)) throw new Error("Forbidden");
  return decoded.uid;
}

async function verifyUser(req: VercelRequest): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.split("Bearer ")[1];
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

// ── Handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.query.action as string;

  try {
    switch (action) {
      // ── Check admin ──
      case "checkAdmin": {
        const uid = await verifyUser(req);
        return res.json({ isAdmin: ADMIN_UIDS.includes(uid) });
      }

      // ── List all creators ──
      case "listCreators": {
        await verifyAdmin(req);
        const snap = await db.collection("creators").orderBy("createdAt", "desc").get();
        const creators = snap.docs.map((d) => d.data());
        return res.json({ creators });
      }

      // ── Get single creator ──
      case "getCreator": {
        await verifyAdmin(req);
        const { uid } = req.body as { uid: string };
        if (!uid) return res.status(400).json({ error: "uid required" });
        const doc = await db.collection("creators").doc(uid).get();
        if (!doc.exists) return res.status(404).json({ error: "Not found" });
        return res.json({ creator: doc.data() });
      }

      // ── Check affiliate code uniqueness ──
      case "checkAffiliateCode": {
        await verifyAdmin(req);
        const { code } = req.body as { code: string };
        if (!code) return res.status(400).json({ error: "code required" });
        const snap = await db
          .collection("creators")
          .where("affiliateCode", "==", code.toUpperCase())
          .limit(1)
          .get();
        return res.json({ available: snap.empty });
      }

      // ── Approve creator ──
      case "approveCreator": {
        await verifyAdmin(req);
        const { uid, affiliateCode } = req.body as {
          uid: string;
          affiliateCode: string;
        };
        if (!uid || !affiliateCode) {
          return res.status(400).json({ error: "uid and affiliateCode required" });
        }

        // Check uniqueness one more time
        const existing = await db
          .collection("creators")
          .where("affiliateCode", "==", affiliateCode.toUpperCase())
          .limit(1)
          .get();
        if (!existing.empty) {
          const existingDoc = existing.docs[0];
          if (existingDoc.id !== uid) {
            return res.status(409).json({ error: "Affiliate code already in use" });
          }
        }

        await db.collection("creators").doc(uid).update({
          verificationStatus: "approved",
          affiliateCode: affiliateCode.toUpperCase(),
          affiliateCodeGeneratedAt: Date.now(),
          verificationReviewedAt: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return res.json({ success: true });
      }

      // ── Reject creator ──
      case "rejectCreator": {
        await verifyAdmin(req);
        const { uid, reason } = req.body as { uid: string; reason: string };
        if (!uid) return res.status(400).json({ error: "uid required" });

        await db.collection("creators").doc(uid).update({
          verificationStatus: "rejected",
          verificationRejectionReason: reason || "",
          verificationReviewedAt: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return res.status(status).json({ error: message });
  }
}
