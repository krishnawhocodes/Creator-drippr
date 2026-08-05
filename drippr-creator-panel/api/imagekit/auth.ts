import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({ credential: cert(serviceAccount) });
}

const adminAuth = getAuth();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: "ImageKit not configured" });
    }

    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 2400; // 40 min
    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return res.json({ token, signature, expire });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth error";
    return res.status(401).json({ error: message });
  }
}
