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
  PlusCircle,
  MinusCircle,
  PencilLine,
} from "lucide-react";
import type { ChangeRequest, CreatorPlatform } from "@/types";

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  phone: "Phone",
  platforms: "Social Platforms",
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

function safeParsePlatforms(json?: string): CreatorPlatform[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Side-by-side comparison of a creator's platform list. */
function PlatformDiff({
  before,
  after,
}: {
  before?: string;
  after: string;
}) {
  const oldList = safeParsePlatforms(before);
  const newList = safeParsePlatforms(after);

  const oldById = new Map(oldList.map((p) => [p.id, p]));
  const newById = new Map(newList.map((p) => [p.id, p]));

  const added = newList.filter((p) => !oldById.has(p.id));
  const removed = oldList.filter((p) => !newById.has(p.id));
  const modified = newList.filter((p) => {
    const prev = oldById.get(p.id);
    return prev && JSON.stringify(prev) !== JSON.stringify(p);
  });

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Social Platforms
        </span>
        <div className="flex gap-1.5">
          {added.length > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              +{added.length} added
            </Badge>
          )}
          {modified.length > 0 && (
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              {modified.length} edited
            </Badge>
          )}
          {removed.length > 0 && (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
              −{removed.length} removed
            </Badge>
          )}
        </div>
      </div>

      <div className="divide-y">
        {added.map((p) => (
          <PlatformRow key={`a-${p.id}`} p={p} kind="added" />
        ))}
        {modified.map((p) => (
          <PlatformRow
            key={`m-${p.id}`}
            p={p}
            prev={oldById.get(p.id)}
            kind="modified"
          />
        ))}
        {removed.map((p) => (
          <PlatformRow key={`r-${p.id}`} p={p} kind="removed" />
        ))}
        {!added.length && !modified.length && !removed.length && (
          <p className="px-4 py-3 text-sm text-gray-500">
            No structural changes detected.
          </p>
        )}
      </div>
    </div>
  );
}

function PlatformRow({
  p,
  prev,
  kind,
}: {
  p: CreatorPlatform;
  prev?: CreatorPlatform;
  kind: "added" | "removed" | "modified";
}) {
  const style =
    kind === "added"
      ? "bg-emerald-50/60"
      : kind === "removed"
        ? "bg-red-50/60"
        : "bg-blue-50/40";

  const icon =
    kind === "added" ? (
      <PlusCircle className="h-4 w-4 text-emerald-600" />
    ) : kind === "removed" ? (
      <MinusCircle className="h-4 w-4 text-red-600" />
    ) : (
      <PencilLine className="h-4 w-4 text-blue-600" />
    );

  return (
    <div className={`px-4 py-3 text-sm ${style}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {p.platform}
            {p.handle && (
              <span className="ml-1.5 font-normal text-gray-600">
                {p.handle}
              </span>
            )}
          </p>

          {kind === "modified" && prev ? (
            <div className="mt-1.5 space-y-1 text-xs">
              {(["handle", "profileLink", "followerCount"] as const).map(
                (f) =>
                  prev[f] !== p[f] ? (
                    <div key={f} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-gray-400">{f}:</span>
                      <span className="text-gray-500 line-through">
                        {prev[f] || "—"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <span className="font-medium text-emerald-700">
                        {p[f] || "—"}
                      </span>
                    </div>
                  ) : null,
              )}
            </div>
          ) : (
            <>
              {p.profileLink && (
                <a
                  href={p.profileLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block break-all text-xs text-blue-600 hover:underline"
                >
                  {p.profileLink}
                </a>
              )}
              <p className="mt-0.5 text-xs text-gray-500">
                {p.followerCount || "—"} followers
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

                {/* Diff */}
                <div className="space-y-3">
                  {Object.entries(req.changes).map(([field, newVal]) =>
                    field === "platforms" ? (
                      <PlatformDiff
                        key={field}
                        before={req.previous?.[field]}
                        after={newVal}
                      />
                    ) : (
                      <div
                        key={field}
                        className="overflow-hidden rounded-lg border"
                      >
                        <div className="border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                          {FIELD_LABELS[field] || field}
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 text-sm">
                          <p className="min-w-0 break-words text-gray-500 line-through">
                            {req.previous?.[field] || "—"}
                          </p>
                          <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <p className="min-w-0 break-words font-medium text-emerald-700">
                            {newVal || "—"}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
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
