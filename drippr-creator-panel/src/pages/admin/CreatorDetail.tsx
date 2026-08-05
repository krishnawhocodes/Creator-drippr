import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchCreatorDetail,
  approveCreator,
  rejectCreator,
  checkAffiliateCodeUnique,
} from "@/lib/api";
import { generateAffiliateCode, formatDate } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  FileText,
} from "lucide-react";
import type { CreatorProfile } from "@/types";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function CreatorDetail() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Approve dialog
  const [showApprove, setShowApprove] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const [approving, setApproving] = useState(false);

  // Reject dialog
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetchCreatorDetail(uid)
      .then((data) => setCreator(data.creator))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [uid]);

  function handleGenerateCode() {
    if (!creator) return;
    const code = generateAffiliateCode(creator.fullName);
    setAffiliateCode(code);
    setCodeAvailable(null);
  }

  async function handleCheckCode() {
    if (!affiliateCode.trim()) return;
    setCodeChecking(true);
    try {
      const data = await checkAffiliateCodeUnique(affiliateCode.trim().toUpperCase());
      setCodeAvailable(data.available);
    } catch {
      setCodeAvailable(null);
    } finally {
      setCodeChecking(false);
    }
  }

  async function handleApprove() {
    if (!uid || !affiliateCode.trim()) return;
    setApproving(true);
    try {
      await approveCreator(uid, affiliateCode.trim().toUpperCase());
      // Reload
      const data = await fetchCreatorDetail(uid);
      setCreator(data.creator);
      setShowApprove(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!uid) return;
    setRejecting(true);
    try {
      await rejectCreator(uid, rejectReason.trim());
      const data = await fetchCreatorDetail(uid);
      setCreator(data.creator);
      setShowReject(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-destructive">Creator not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{creator.fullName}</h1>
          <p className="text-sm text-muted-foreground">{creator.email}</p>
        </div>
        <Badge className={statusColor[creator.verificationStatus]}>
          {creator.verificationStatus}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground">Phone</Label>
            <p className="font-medium">{creator.phone || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Joined</Label>
            <p className="font-medium">{formatDate(creator.createdAt)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Platform</Label>
            <p className="font-medium">{creator.platform || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Profile Link</Label>
            {creator.profileLink ? (
              <a
                href={creator.profileLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-primary hover:underline"
              >
                View Profile <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p>—</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Content Niche</Label>
            <p className="font-medium">{creator.contentNiche || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Follower Count</Label>
            <p className="font-medium">{creator.followerCount || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* ID Proof */}
      <Card>
        <CardHeader>
          <CardTitle>ID Proof</CardTitle>
          <CardDescription>Submitted identity verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">ID Type</Label>
              <p className="font-medium">{creator.idProofType || "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">ID Number</Label>
              <p className="font-mono font-medium">
                {creator.idProofNumber || "—"}
              </p>
            </div>
          </div>
          {creator.idProofFileUrl && (
            <a
              href={creator.idProofFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <FileText className="h-4 w-4" />
              View Uploaded Document
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardContent>
      </Card>

      {/* Affiliate code */}
      {creator.affiliateCode && (
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Code</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="rounded-lg bg-zinc-900 px-4 py-2 text-lg font-bold tracking-widest text-white">
              {creator.affiliateCode}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {creator.verificationStatus === "submitted" && (
        <Card>
          <CardHeader>
            <CardTitle>Review Actions</CardTitle>
            <CardDescription>
              Approve or reject this creator's verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={() => { setShowApprove(true); handleGenerateCode(); }}>
              <CheckCircle className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowReject(true)}
            >
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Creator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign a unique affiliate code for{" "}
              <strong>{creator.fullName}</strong>.
            </p>

            <div className="space-y-2">
              <Label>Affiliate Code</Label>
              <div className="flex gap-2">
                <Input
                  value={affiliateCode}
                  onChange={(e) => {
                    setAffiliateCode(e.target.value.toUpperCase());
                    setCodeAvailable(null);
                  }}
                  placeholder="e.g. DRIP4K"
                  className="font-mono uppercase"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleGenerateCode}
                  title="Generate random code"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckCode}
              disabled={!affiliateCode.trim() || codeChecking}
            >
              {codeChecking ? "Checking…" : "Check Uniqueness"}
            </Button>

            {codeAvailable === true && (
              <p className="text-sm text-green-600">
                ✓ Code is available.
              </p>
            )}
            {codeAvailable === false && (
              <p className="text-sm text-red-600">
                ✗ Code already in use. Try another.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprove(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approving || !affiliateCode.trim() || codeAvailable === false}
            >
              {approving ? "Approving…" : "Approve & Assign Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejecting{" "}
              <strong>{creator.fullName}</strong>'s verification.
            </p>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. ID proof image is unclear…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
