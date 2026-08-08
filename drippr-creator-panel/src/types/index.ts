export type VerificationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected";

/** A single social platform profile belonging to a creator. */
export interface CreatorPlatform {
  /** Stable client-generated id so React lists and diffs stay stable. */
  id: string;
  platform: string;      // Instagram, YouTube, ...
  handle: string;        // @username
  profileLink: string;
  followerCount: string; // free text: "16K", "1.2M"
  /** Admins can verify each platform independently. */
  verified?: boolean;
  verifiedAt?: number;
  verifiedBy?: string;
}

export interface CreatorProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  createdAt: number;
  updatedAt: number;

  // ── Verification ──
  verificationStatus: VerificationStatus;
  verificationSubmittedAt?: number;
  verificationReviewedAt?: number;
  verificationReviewedBy?: string;
  verificationRejectionReason?: string;

  // ── Platforms (multiple) ──
  platforms: CreatorPlatform[];

  /**
   * Legacy single-platform fields. Kept so older documents keep working
   * and so existing queries don't break. New code should read `platforms`.
   */
  platform?: string;
  profileLink?: string;
  followerCount?: string;

  contentNiche: string;

  // ── ID proof ──
  idProofType: string;
  idProofNumber: string;
  idProofFileUrl?: string;

  // ── Affiliate ──
  affiliateCode?: string;
  affiliateCodeGeneratedAt?: number;

  // ── Profile ──
  avatarUrl?: string;
  bio?: string;
  city?: string;
  state?: string;

  /** Cached completion percentage (recomputed on save). */
  profileCompletion?: number;
}

export interface AffiliateCodeIndex {
  code: string;
  creatorUid: string;
  createdAt: number;
  createdBy: string;
}

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  creatorUid: string;
  creatorName: string;
  creatorEmail: string;
  /**
   * Field → new value. Values are strings; complex fields such as
   * `platforms` are stored as JSON strings and rendered specially.
   */
  changes: Record<string, string>;
  /** Snapshot of the previous values, for side-by-side comparison. */
  previous: Record<string, string>;
  reason: string;
  status: ChangeRequestStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  rejectionReason?: string;
}

export type TicketStatus = "open" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  creatorUid: string;
  creatorName: string;
  creatorEmail: string;
  subject: string;
  message: string;
  status: TicketStatus;
  createdAt: number;
  adminReply?: string;
  respondedAt?: number;
  respondedBy?: string;
  closedAt?: number;
}

export interface AffiliateOrder {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  totalPrice: string;
  currencyCode: string;
  customerName: string;
  itemCount: number;
  financialStatus: string;
  fulfillmentStatus: string;
}

export interface AffiliateAnalytics {
  totalOrders: number;
  totalRevenue: number;
  currencyCode: string;
  orders: AffiliateOrder[];
}

export interface PaymentRecord {
  id: string;
  creatorUid: string;
  creatorName?: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  method: string;
  reference: string;
  createdAt: number;
  completedAt?: number;
  note?: string;
}
