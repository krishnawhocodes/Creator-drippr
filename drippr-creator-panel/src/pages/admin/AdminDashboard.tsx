import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listCreators,
  listChangeRequests,
  listSupportTickets,
} from "@/lib/adminDb";
import { formatDate } from "@/lib/utils";
import { AreaChart, DonutChart } from "@/components/Charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  ShieldCheck,
  Clock,
  ClipboardList,
  LifeBuoy,
  ArrowRight,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import type { CreatorProfile, ChangeRequest, SupportTicket } from "@/types";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      listCreators(),
      listChangeRequests().catch(() => [] as ChangeRequest[]),
      listSupportTickets().catch(() => [] as SupportTicket[]),
    ])
      .then(([c, r, t]) => {
        setCreators(c);
        setRequests(r);
        setTickets(t);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load admin data.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    return {
      total: creators.length,
      approved: creators.filter((c) => c.verificationStatus === "approved")
        .length,
      submitted: creators.filter((c) => c.verificationStatus === "submitted")
        .length,
      pending: creators.filter((c) => c.verificationStatus === "pending").length,
      rejected: creators.filter((c) => c.verificationStatus === "rejected")
        .length,
      openRequests: requests.filter((r) => r.status === "pending").length,
      openTickets: tickets.filter((t) => t.status === "open").length,
    };
  }, [creators, requests, tickets]);

  // Signups over the last 30 days
  const signupSeries = useMemo(() => {
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

    creators.forEach((c) => {
      const diff = Math.floor(
        (today.getTime() - c.createdAt) / (1000 * 60 * 60 * 24),
      );
      const idx = days - 1 - diff;
      if (idx >= 0 && idx < days) buckets[idx].value += 1;
    });

    return buckets;
  }, [creators]);

  const pendingReview = creators
    .filter((c) => c.verificationStatus === "submitted")
    .slice(0, 5);

  const recentSignups = [...creators]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of creators, verifications, and support.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <span className="mt-1 block text-xs">
              If this is a permissions error, publish the Firestore rules from{" "}
              <code className="rounded bg-black/10 px-1">firestore.rules</code>.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat
          icon={<Users className="h-5 w-5" />}
          label="Total Creators"
          value={loading ? null : counts.total}
          accent="bg-blue-50 text-blue-600"
        />
        <AdminStat
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Verified"
          value={loading ? null : counts.approved}
          accent="bg-emerald-50 text-emerald-600"
        />
        <AdminStat
          icon={<Clock className="h-5 w-5" />}
          label="Awaiting Review"
          value={loading ? null : counts.submitted}
          accent="bg-amber-50 text-amber-600"
          onClick={() => navigate("/admin/verify")}
        />
        <AdminStat
          icon={<ClipboardList className="h-5 w-5" />}
          label="Change Requests"
          value={loading ? null : counts.openRequests}
          accent="bg-purple-50 text-purple-600"
          onClick={() => navigate("/admin/review")}
        />
      </div>

      {/* Action banners */}
      {!loading && (counts.submitted > 0 || counts.openRequests > 0 || counts.openTickets > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {counts.submitted > 0 && (
            <ActionCard
              icon={<ShieldCheck className="h-4 w-4" />}
              count={counts.submitted}
              label="verification(s) waiting"
              onClick={() => navigate("/admin/verify")}
            />
          )}
          {counts.openRequests > 0 && (
            <ActionCard
              icon={<ClipboardList className="h-4 w-4" />}
              count={counts.openRequests}
              label="change request(s)"
              onClick={() => navigate("/admin/review")}
            />
          )}
          {counts.openTickets > 0 && (
            <ActionCard
              icon={<LifeBuoy className="h-4 w-4" />}
              count={counts.openTickets}
              label="open support ticket(s)"
              onClick={() => navigate("/admin/support")}
            />
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Creator Signups — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <AreaChart data={signupSeries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Verification Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (
              <DonutChart
                centerValue={counts.total}
                centerLabel="creators"
                segments={[
                  { label: "Approved", value: counts.approved, color: "#10b981" },
                  { label: "Submitted", value: counts.submitted, color: "#3b82f6" },
                  { label: "Pending", value: counts.pending, color: "#f59e0b" },
                  { label: "Rejected", value: counts.rejected, color: "#ef4444" },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Awaiting Verification</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/verify")}
            >
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : !pendingReview.length ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nothing waiting for review. 🎉
              </p>
            ) : (
              <div className="divide-y">
                {pendingReview.map((c) => (
                  <button
                    key={c.uid}
                    onClick={() => navigate(`/admin/creator/${c.uid}`)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.fullName}</p>
                      <p className="truncate text-xs text-gray-500">
                        {c.platform || "—"} · {c.followerCount || "—"} followers
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      Review
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Signups</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/creators")}
            >
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : !recentSignups.length ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No creators yet.
              </p>
            ) : (
              <div className="divide-y">
                {recentSignups.map((c) => (
                  <button
                    key={c.uid}
                    onClick={() => navigate(`/admin/creator/${c.uid}`)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-full bg-gray-100 p-1.5">
                        <UserPlus className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.fullName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {c.email}
                        </p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {formatDate(c.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminStat({
  icon,
  label,
  value,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`rounded-xl p-2.5 ${accent}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </p>
          {value === null ? (
            <Skeleton className="mt-1 h-7 w-12" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  icon,
  count,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100"
    >
      <div className="rounded-lg bg-amber-200/60 p-2 text-amber-800">
        {icon}
      </div>
      <p className="text-sm text-amber-900">
        <span className="font-bold">{count}</span> {label}
      </p>
      <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-amber-700" />
    </button>
  );
}
