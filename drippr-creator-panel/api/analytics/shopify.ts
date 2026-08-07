import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, adminDb, errorResponse } from "../_lib/firebaseAdmin.js";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

interface ShopifyOrder {
  id: number | string;
  name: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  customer?: { first_name?: string; last_name?: string };
  line_items?: { quantity: number }[];
  discount_codes?: { code: string }[];
}

const EMPTY = {
  totalOrders: 0,
  totalRevenue: 0,
  currencyCode: "INR",
  orders: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const caller = await requireUser(req);

    const code = String(req.query.code || "").toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ error: "code parameter is required" });
    }

    // Confirm the caller actually owns this affiliate code
    const snap = await adminDb().collection("creators").doc(caller.uid).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Creator profile not found" });
    }

    const ownCode = String(snap.data()?.affiliateCode || "").toUpperCase();
    if (ownCode !== code) {
      return res
        .status(403)
        .json({ error: "This affiliate code does not belong to you" });
    }

    const domain = (process.env.SHOPIFY_STORE_DOMAIN || "").trim();
    const accessToken = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();

    // Not configured yet — return empty analytics rather than an error so the
    // dashboard still renders cleanly.
    if (!domain || !accessToken) {
      console.warn("[analytics/shopify] Shopify env vars not configured");
      return res.status(200).json(EMPTY);
    }

    const url =
      `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json` +
      `?status=any&limit=250&fields=id,name,created_at,total_price,currency,` +
      `financial_status,fulfillment_status,customer,line_items,discount_codes`;

    const shopifyRes = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!shopifyRes.ok) {
      const text = await shopifyRes.text().catch(() => "");
      console.error(
        "[analytics/shopify] Shopify API error",
        shopifyRes.status,
        text.slice(0, 300),
      );
      return res.status(200).json(EMPTY);
    }

    const data = (await shopifyRes.json()) as { orders?: ShopifyOrder[] };
    const all = data.orders || [];

    const matched = all.filter((o) =>
      (o.discount_codes || []).some(
        (dc) => String(dc.code || "").toUpperCase() === code,
      ),
    );

    const totalRevenue = matched.reduce(
      (sum, o) => sum + parseFloat(o.total_price || "0"),
      0,
    );

    const orders = matched.map((o) => ({
      orderId: String(o.id),
      orderNumber: String(o.name || "").replace("#", ""),
      createdAt: o.created_at,
      totalPrice: o.total_price,
      currencyCode: o.currency || "INR",
      customerName:
        [o.customer?.first_name, o.customer?.last_name]
          .filter(Boolean)
          .join(" ") || "Guest",
      itemCount: (o.line_items || []).reduce((s, li) => s + (li.quantity || 0), 0),
      financialStatus: o.financial_status || "unknown",
      fulfillmentStatus: o.fulfillment_status || "unfulfilled",
    }));

    return res.status(200).json({
      totalOrders: matched.length,
      totalRevenue,
      currencyCode: orders[0]?.currencyCode || "INR",
      orders,
    });
  } catch (e) {
    const { status, body } = errorResponse(e);
    console.error("[analytics/shopify]", body.code, body.error);
    return res.status(status).json(body);
  }
}
