import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  listChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
} from "@/lib/adminDb";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import type { ChangeRequest } from "@/types";

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  phone: "Phone",
  platform: "Platform",
  profileLink: "Profile Link",
  contentNiche: "Content Niche",
  followerCount: "Follower Count",
  idProofType: "ID Proof Type",
  idProofNumber: "ID Proof Number",
  bio: "Bio",
  city: "City",
  state: "State",
};

type Tab = "pending" | "approved" | "rejected";

export default function ReviewQueue() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<ChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRequests(await listChangeRequests());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(req: ChangeRequest) {
    setBusyId(req.id);
    try {
      await approveChangeRequest(req, user?.email || "admin");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectChangeRequest(
        rejectTarget.id,
        rejectReason.trim(),
        user?.email || "admin",
      );
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejection failed.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = requests.filter((r) => r.status === tab);
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
        <p className="text-sm text-gray-500">
          Profile change requests submitted by creators.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({counts.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({counts.rejected})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-gray-100 p-4">
              <ClipboardCheck className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-lg font-semibold">
              No {tab} requests
            </p>
            <p className="max-w-sm text-sm text-gray-500">
              {tab === "pending"
                ? "When creators request changes to their verified profile, they'll appear here for approval."
                : `There are no ${tab} change requests.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => (
            <Card key={req.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">
                    {req.creatorName}
                  </CardTitle>
                  <p className="truncate text-sm text-gray-500">
                    {req.creatorEmail} · {formatDate(req.createdAt)}
                  </p>
                </div>
                <Badge
                  className={
                    req.status === "pending"
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      : req.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : "bg-red-100 text-red-800 hover:bg-red-100"
                  }
                >
                  {req.status}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4">
                {req.reason && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Reason
                    </p>
                    <p className="mt-1 text-gray-700">{req.reason}</p>
                  </div>
                )}

                {/* Diff table */}
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <span>Current</span>
                    <span />
                    <span>Requested</span>
                  </div>
                  {Object.entries(req.changes).map(([field, newVal]) => (
                    <div
                      key={field}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">
                          {FIELD_LABELS[field] || field}
                        </p>
                        <p className="truncate text-gray-500 line-through">
                          {req.previous?.[field] || "—"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">
                          {FIELD_LABELS[field] || field}
                        </p>
                        <p className="truncate font-medium text-emerald-700">
                          {newVal || "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {req.status === "rejected" && req.rejectionReason && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Rejected: {req.rejectionReason}
                    </AlertDescription>
                  </Alert>
                )}

                {req.status === "pending" && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectTarget(req);
                        setRejectReason("");
                      }}
                      disabled={busyId === req.id}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(req)}
                      disabled={busyId === req.id}
                    >
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                      {busyId === req.id ? "Applying…" : "Approve & Apply"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Change Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to the creator)</Label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The new profile link doesn't match the platform selected…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!busyId}
            >
              {busyId ? "Rejecting…" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
