import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAnalytics } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  calculateCompletion,
  completionLabel,
} from "@/lib/profileCompletion";
import { AreaChart, DonutChart } from "@/components/Charts";
import { CompletionRing } from "@/components/AvatarRing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TrendingUp,
  Share2,
  Clock,
  Sparkles,
  Package,
  Circle,
} from "lucide-react";
import type { AffiliateAnalytics } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  submitted: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AffiliateAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.affiliateCode) return;
    setLoading(true);
    fetchAnalytics(profile.affiliateCode)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, [profile?.affiliateCode]);

  // Build a 30-day revenue series from the orders
  const revenueSeries = useMemo(() => {
    const days = 30;
    const today = new Date();
    const buckets: { label: string; value: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({
        label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: 0,
      });
    }

    (analytics?.orders || []).forEach((o) => {
      const od = new Date(o.createdAt);
      const diff = Math.floor(
        (today.getTime() - od.getTime()) / (1000 * 60 * 60 * 24),
      );
      const idx = days - 1 - diff;
      if (idx >= 0 && idx < days) {
        buckets[idx].value += parseFloat(o.totalPrice || "0");
      }
    });

    return buckets;
  }, [analytics]);

  const completion = useMemo(() => calculateCompletion(profile), [profile]);

  const avgOrderValue =
    analytics && analytics.totalOrders > 0
      ? analytics.totalRevenue / analytics.totalOrders
      : 0;

  const recentOrders = (analytics?.orders || []).slice(0, 5);

  const firstName = profile?.fullName?.split(" ")[0] || "Creator";
  const status = profile?.verificationStatus || "pending";
  const isApproved = status === "approved";

  function copyCode() {
    if (!profile?.affiliateCode) return;
    navigator.clipboard.writeText(profile.affiliateCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareCode() {
    if (!profile?.affiliateCode) return;
    const text = `Shop at Drippr and use my code ${profile.affiliateCode} at checkout!`;
    if (navigator.share) {
      navigator.share({ title: "Drippr", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-gray-500">
            Here's how your creator account is performing.
          </p>
        </div>
        <Badge className={STATUS_STYLE[status]}>
          {status === "approved"
            ? "Verified Creator"
            : status === "submitted"
              ? "Under Review"
              : status === "rejected"
                ? "Verification Rejected"
                : "Not Verified"}
        </Badge>
      </div>

      {/* Verification prompt */}
      {!isApproved && (
        <Card className="overflow-hidden border-0 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/10 p-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {status === "pending"
                    ? "Get verified to unlock earnings"
                    : status === "submitted"
                      ? "Your application is under review"
                      : "Your verification was rejected"}
                </h3>
                <p className="mt-0.5 max-w-lg text-sm text-white/70">
                  {status === "pending"
                    ? "Complete your profile and submit ID proof. Once approved you'll receive your unique affiliate code."
                    : status === "submitted"
                      ? "Our team is reviewing your details. You'll receive your affiliate code as soon as you're approved."
                      : profile?.verificationRejectionReason ||
                        "Please review your details and submit again."}
                </p>
              </div>
            </div>
            {status !== "submitted" && (
              <Button
                onClick={() => navigate("/verification")}
                className="bg-white text-zinc-900 hover:bg-white/90"
              >
                {status === "rejected" ? "Re-submit" : "Verify Now"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Affiliate code */}
      {profile?.affiliateCode && (
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-6 py-6">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50">
                <Sparkles className="h-3.5 w-3.5" />
                Your Affiliate Code
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tracking-[0.2em]">
                {profile.affiliateCode}
              </div>
              <p className="mt-1.5 text-sm text-white/60">
                Share this at checkout — every order counts toward your earnings.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={copyCode}
                className="bg-white/10 text-white hover:bg-white/20"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy
                  </>
                )}
              </Button>
              <Button
                onClick={shareCode}
                className="bg-white text-zinc-900 hover:bg-white/90"
              >
                <Share2 className="mr-1.5 h-4 w-4" /> Share
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile completion */}
      {completion.percent < 100 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 py-6">
            <CompletionRing percent={completion.percent} size={104} />
            <div className="min-w-[220px] flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Complete your profile</h3>
                <Badge variant="secondary" className="text-xs">
                  {completionLabel(completion.percent)}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                Finish these to strengthen your creator profile.
              </p>

              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {completion.missing.slice(0, 4).map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <Circle className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
                      +{item.weight}%
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => navigate("/verification")}>
                  Complete verification
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/settings")}
                >
                  Edit profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Total Orders"
          value={loading ? null : String(analytics?.totalOrders ?? 0)}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<IndianRupee className="h-5 w-5" />}
          label="Total Revenue"
          value={
            loading ? null : formatCurrency(analytics?.totalRevenue ?? 0)
          }
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg Order Value"
          value={loading ? null : formatCurrency(avgOrderValue)}
          accent="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Items Sold"
          value={
            loading
              ? null
              : String(
                  (analytics?.orders || []).reduce(
                    (s, o) => s + (o.itemCount || 0),
                    0,
                  ),
                )
          }
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <AreaChart data={revenueSeries} valuePrefix="₹" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (
              <DonutChart
                centerValue={analytics?.totalOrders ?? 0}
                centerLabel="orders"
                segments={[
                  {
                    label: "Paid",
                    value: (analytics?.orders || []).filter(
                      (o) => o.financialStatus === "paid",
                    ).length,
                    color: "#10b981",
                  },
                  {
                    label: "Pending",
                    value: (analytics?.orders || []).filter(
                      (o) => o.financialStatus === "pending",
                    ).length,
                    color: "#f59e0b",
                  },
                  {
                    label: "Other",
                    value: (analytics?.orders || []).filter(
                      (o) =>
                        o.financialStatus !== "paid" &&
                        o.financialStatus !== "pending",
                    ).length,
                    color: "#94a3b8",
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/analytics")}
          >
            View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !recentOrders.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="rounded-full bg-gray-100 p-3">
                <Clock className="h-5 w-5 text-gray-400" />
              </div>
              <p className="font-medium text-gray-700">No orders yet</p>
              <p className="max-w-sm text-sm text-gray-500">
                {profile?.affiliateCode
                  ? "Share your affiliate code with your audience to start earning."
                  : "Once you're verified you'll receive a code to share with your audience."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentOrders.map((o) => (
                <div
                  key={o.orderId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      #{o.orderNumber}{" "}
                      <span className="font-normal text-gray-500">
                        · {o.customerName}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(o.createdAt)} · {o.itemCount} item
                      {o.itemCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {o.financialStatus}
                    </Badge>
                    <span className="font-semibold">
                      {formatCurrency(
                        parseFloat(o.totalPrice),
                        o.currencyCode,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`rounded-xl p-2.5 ${accent}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </p>
          {value === null ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="truncate text-2xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
