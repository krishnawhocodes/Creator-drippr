import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({ credential: cert(serviceAccount) });
}

const adminAuth = getAuth();
const db = getFirestore();

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";

interface ShopifyOrder {
  id: string;
  name: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: { first_name?: string; last_name?: string };
  line_items?: { quantity: number }[];
  discount_codes?: { code: string }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);

    // Get the affiliate code from query
    const code = (req.query.code as string || "").toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "code parameter required" });
    }

    // Verify creator owns this code
    const creatorDoc = await db.collection("creators").doc(decoded.uid).get();
    if (!creatorDoc.exists) {
      return res.status(404).json({ error: "Creator not found" });
    }
    const creatorData = creatorDoc.data();
    if (creatorData?.affiliateCode?.toUpperCase() !== code) {
      return res.status(403).json({ error: "Code mismatch" });
    }

    // Query Shopify orders with this discount code
    if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
      return res.json({
        totalOrders: 0,
        totalRevenue: 0,
        currencyCode: "INR",
        orders: [],
      });
    }

    // Use REST API to fetch orders filtered by discount code
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=250`;
    const shopifyRes = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!shopifyRes.ok) {
      return res.status(502).json({ error: "Shopify API error" });
    }

    const shopifyData = await shopifyRes.json();
    const allOrders: ShopifyOrder[] = shopifyData.orders || [];

    // Filter orders that used this discount code
    const matched = allOrders.filter((o) =>
      o.discount_codes?.some(
        (dc) => dc.code.toUpperCase() === code,
      ),
    );

    const totalRevenue = matched.reduce(
      (sum, o) => sum + parseFloat(o.total_price || "0"),
      0,
    );

    const orders = matched.map((o) => ({
      orderId: o.id,
      orderNumber: o.name.replace("#", ""),
      createdAt: o.created_at,
      totalPrice: o.total_price,
      currencyCode: o.currency || "INR",
      customerName: [o.customer?.first_name, o.customer?.last_name]
        .filter(Boolean)
        .join(" ") || "Guest",
      itemCount: o.line_items?.reduce((s, li) => s + li.quantity, 0) || 0,
      financialStatus: o.financial_status || "unknown",
      fulfillmentStatus: o.fulfillment_status || "unfulfilled",
    }));

    return res.json({
      totalOrders: matched.length,
      totalRevenue,
      currencyCode: "INR",
      orders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: message });
  }
}
