export type VerificationStatus = "pending" | "submitted" | "approved" | "rejected";

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
  verificationRejectionReason?: string;

  // Platform details
  platform: string;           // Instagram, YouTube, etc.
  profileLink: string;
  contentNiche: string;
  followerCount: string;

  // ID proof
  idProofType: string;        // Aadhaar, PAN, Passport, etc.
  idProofNumber: string;
  idProofFileUrl?: string;    // ImageKit URL for uploaded file

  // Affiliate
  affiliateCode?: string;
  affiliateCodeGeneratedAt?: number;

  // Profile
  avatarUrl?: string;
  bio?: string;
  city?: string;
  state?: string;
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
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  method: string;
  reference: string;
  createdAt: number;
  completedAt?: number;
  note?: string;
}
