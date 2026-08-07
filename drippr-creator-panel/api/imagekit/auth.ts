import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import {
  requireUser,
  errorResponse,
  ConfigError,
} from "../_lib/firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Check ImageKit config FIRST so a missing key gives a clear message
    const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || "").trim();

    if (!privateKey) {
      throw new ConfigError(
        "IMAGEKIT_PRIVATE_KEY is not set in the environment. Add it in " +
          "Vercel -> Settings -> Environment Variables and redeploy.",
      );
    }

    if (!privateKey.startsWith("private_")) {
      throw new ConfigError(
        'IMAGEKIT_PRIVATE_KEY looks wrong — it should start with "private_". ' +
          "Make sure you did not paste the public key by mistake.",
      );
    }

    // 2. Verify the caller is a signed-in user
    await requireUser(req);

    // 3. Generate the signed upload token
    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 2400; // 40 minutes
    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return res.status(200).json({ token, signature, expire });
  } catch (e) {
    const { status, body } = errorResponse(e);
    // Log the full error so it shows up in Vercel function logs
    console.error("[imagekit/auth]", body.code, body.error);
    return res.status(status).json(body);
  }
}
