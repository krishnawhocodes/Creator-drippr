export type VerificationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected";

export interface CreatorProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  createdAt: number;
  updatedAt: number;

  // Verification
  verificationStatus: VerificationStatus;
  verificationSubmittedAt?: number;
  verificationReviewedAt?: number;
  verificationReviewedBy?: string;
  verificationRejectionReason?: string;

  // Platform details
  platform: string;
  profileLink: string;
  contentNiche: string;
  followerCount: string;

  // ID proof
  idProofType: string;
  idProofNumber: string;
  idProofFileUrl?: string;

  // Affiliate
  affiliateCode?: string;
  affiliateCodeGeneratedAt?: number;

  // Profile
  avatarUrl?: string;
  bio?: string;
  city?: string;
  state?: string;
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
  /** Field → new value pairs the creator wants applied */
  changes: Record<string, string>;
  /** Snapshot of the current values, for side-by-side comparison */
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
