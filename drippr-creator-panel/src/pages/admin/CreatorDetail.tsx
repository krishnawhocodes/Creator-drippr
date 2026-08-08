import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import {
  getPlatforms,
  totalFollowers,
  formatFollowerCount,
} from "@/lib/platforms";
import { calculateCompletion } from "@/lib/profileCompletion";
import { PlatformsList } from "@/components/PlatformsEditor";
import {
  getCreator,
  approveCreator,
  rejectCreator,
  isAffiliateCodeAvailable,
  generateUniqueAffiliateCode,
} from "@/lib/adminDb";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  FileText,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Users,
} from "lucide-react";
import type { CreatorProfile } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  submitted: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
};

export default function CreatorDetail() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  // Approve flow
  const [showApprove, setShowApprove] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  // Reject flow
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  async function load() {
    if (!uid) return;
    setLoading(true);
    try {
      const c = await getCreator(uid);
      setCreator(c);
      setError(c ? "" : "Creator not found.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load creator.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Debounced uniqueness check as the admin types
  useEffect(() => {
    if (!showApprove) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await isAffiliateCodeAvailable(trimmed, uid);
        setAvailable(ok);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [code, showApprove, uid]);

  async function openApprove() {
    setShowApprove(true);
    setError("");
    setGenerating(true);
    try {
      const generated = await generateUniqueAffiliateCode(
        creator?.fullName || "DRIP",
      );
      setCode(generated);
    } catch {
      setCode("");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate() {
    setGenerating(true);
    setAvailable(null);
    try {
      setCode(await generateUniqueAffiliateCode(creator?.fullName || "DRIP"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!uid || !code.trim()) return;
    setApproving(true);
    setError("");
    try {
      await approveCreator(uid, code.trim(), user?.email || "admin");
      setShowApprove(false);
      setSuccess(
        `Creator approved. Affiliate code ${code.trim().toUpperCase()} assigned and saved to Firestore.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!uid) return;
    setRejecting(true);
    setError("");
    try {
      await rejectCreator(uid, rejectReason.trim(), user?.email || "admin");
      setShowReject(false);
      setRejectReason("");
      setSuccess("Verification rejected. The creator has been notified in-app.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejection failed.");
    } finally {
      setRejecting(false);
    }
  }

  function copyCode() {
    if (!creator?.affiliateCode) return;
    navigator.clipboard.writeText(creator.affiliateCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/creators")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Creator not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const canDecide =
    creator.verificationStatus === "submitted" ||
    creator.verificationStatus === "rejected";

  const platforms = getPlatforms(creator);
  const reach = totalFollowers(platforms);
  const completion = calculateCompletion(creator);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/creators")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {creator.fullName || "Unnamed Creator"}
          </h1>
          <p className="truncate text-sm text-gray-500">{creator.email}</p>
        </div>
        <Badge className={STATUS_STYLE[creator.verificationStatus]}>
          {creator.verificationStatus}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Affiliate code (once approved) */}
      {creator.affiliateCode && (
        <Card className="border-0 bg-gradient-to-br from-zinc-900 to-zinc-700 text-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/50">
                Assigned Affiliate Code
              </p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-[0.2em]">
                {creator.affiliateCode}
              </p>
              {creator.affiliateCodeGeneratedAt && (
                <p className="mt-1 text-xs text-white/50">
                  Assigned {formatDate(creator.affiliateCodeGeneratedAt)}
                  {creator.verificationReviewedBy
                    ? ` by ${creator.verificationReviewedBy}`
                    : ""}
                </p>
              )}
            </div>
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
          </CardContent>
        </Card>
      )}

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full Name" value={creator.fullName} />
          <Field label="Email" value={creator.email} />
          <Field label="Phone" value={creator.phone} />
          <Field label="Content Niche" value={creator.contentNiche} />
          <Field label="City" value={creator.city} />
          <Field label="State" value={creator.state} />
          <Field label="Joined" value={formatDate(creator.createdAt)} />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Profile Completion
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              <span className="text-sm font-semibold">
                {completion.percent}%
              </span>
            </div>
          </div>
          {creator.bio && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Bio
              </p>
              <p className="mt-0.5 text-sm">{creator.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platforms */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">
              Social Platforms ({platforms.length})
            </CardTitle>
            <CardDescription>
              Open each link to confirm it belongs to this creator.
            </CardDescription>
          </div>
          {reach > 0 && (
            <Badge variant="secondary" className="flex-shrink-0 gap-1.5">
              <Users className="h-3 w-3" />
              {formatFollowerCount(reach)} reach
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <PlatformsList platforms={platforms} />
        </CardContent>
      </Card>

      {/* ID Proof */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identity Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="ID Type" value={creator.idProofType} />
            <Field label="ID Number" value={creator.idProofNumber} mono />
            <Field
              label="Submitted"
              value={
                creator.verificationSubmittedAt
                  ? formatDate(creator.verificationSubmittedAt)
                  : "—"
              }
            />
          </div>

          {creator.idProofFileUrl ? (
            <a
              href={creator.idProofFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" />
              View Uploaded Document
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </a>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No ID document was uploaded by this creator.
              </AlertDescription>
            </Alert>
          )}

          {creator.verificationStatus === "rejected" &&
            creator.verificationRejectionReason && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Rejected: {creator.verificationRejectionReason}
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
      </Card>

      {/* Decision */}
      {canDecide && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verification Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Approving will generate a unique affiliate code, save it to
              Firestore, and make it immediately visible on the creator's
              dashboard.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openApprove}>
                <CheckCircle className="mr-1.5 h-4 w-4" /> Approve & Assign Code
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReject(true)}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {creator.verificationStatus === "pending" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This creator hasn't submitted their verification details yet.
          </AlertDescription>
        </Alert>
      )}

      {/* Approve dialog */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {creator.fullName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              A unique code has been generated. You can edit it — uniqueness is
              checked automatically.
            </p>

            <div className="space-y-2">
              <Label>Affiliate Code</Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  placeholder="e.g. KRISH4B2C"
                  className="font-mono text-base uppercase tracking-wider"
                  maxLength={20}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={regenerate}
                  disabled={generating}
                  title="Generate a new code"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Live availability feedback */}
              <div className="min-h-[20px] text-sm">
                {checking ? (
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking
                    availability…
                  </span>
                ) : available === true ? (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" /> Code is available
                  </span>
                ) : available === false ? (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <XCircle className="h-3.5 w-3.5" /> Already in use — pick
                    another
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={
                approving || !code.trim() || available === false || checking
              }
            >
              {approving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Approving…
                </>
              ) : (
                "Approve & Assign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to the creator)</Label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The uploaded ID document is blurry and unreadable…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? "Rejecting…" : "Reject Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p
        className={`mt-0.5 break-words font-medium ${mono ? "font-mono" : ""} ${
          !value ? "text-gray-400" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
