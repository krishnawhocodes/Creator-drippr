import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAnalytics } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingBag,
  IndianRupee,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import type { AffiliateAnalytics } from "@/types";

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AffiliateAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.affiliateCode) return;
    setLoadingAnalytics(true);
    fetchAnalytics(profile.affiliateCode)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setLoadingAnalytics(false));
  }, [profile?.affiliateCode]);

  function copyCode() {
    if (!profile?.affiliateCode) return;
    navigator.clipboard.writeText(profile.affiliateCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    submitted: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {profile?.fullName?.split(" ")[0] || "Creator"}
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your creator account.
        </p>
      </div>

      {/* Status banner */}
      {profile && profile.verificationStatus !== "approved" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-900">
                  {profile.verificationStatus === "pending"
                    ? "Complete your verification to get started"
                    : profile.verificationStatus === "submitted"
                      ? "Verification under review"
                      : "Verification was rejected"}
                </p>
                {profile.verificationStatus === "rejected" &&
                  profile.verificationRejectionReason && (
                    <p className="text-sm text-yellow-700">
                      Reason: {profile.verificationRejectionReason}
                    </p>
                  )}
              </div>
            </div>
            {profile.verificationStatus === "pending" && (
              <Button size="sm" onClick={() => navigate("/verification")}>
                Verify Now <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Affiliate code card */}
      {profile?.affiliateCode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Affiliate Code</CardTitle>
            <CardDescription>
              Share this code with your audience. You earn on every order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="rounded-lg bg-zinc-900 px-4 py-2 text-lg font-bold tracking-widest text-white">
                {profile.affiliateCode}
              </code>
              <Button variant="outline" size="icon" onClick={copyCode}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  className={
                    statusColor[profile?.verificationStatus || "pending"]
                  }
                >
                  {profile?.verificationStatus || "pending"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                {loadingAnalytics ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">
                    {analytics?.totalOrders ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <IndianRupee className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                {loadingAnalytics ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold">
                    {formatCurrency(analytics?.totalRevenue ?? 0)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
