import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { getImageKitAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";

const PLATFORMS = [
  "Instagram",
  "YouTube",
  "Twitter / X",
  "LinkedIn",
  "Snapchat",
  "Facebook",
  "Other",
];

const ID_PROOF_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Voter ID",
  "Driving License",
];

export default function Verification() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    platform: profile?.platform || "",
    profileLink: profile?.profileLink || "",
    contentNiche: profile?.contentNiche || "",
    followerCount: profile?.followerCount || "",
    idProofType: profile?.idProofType || "",
    idProofNumber: profile?.idProofNumber || "",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function uploadToImageKit(file: File): Promise<string> {
    const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error(
        "VITE_IMAGEKIT_PUBLIC_KEY is not set. Add it in Vercel and redeploy.",
      );
    }

    // Get signed credentials from our serverless function
    const { token, signature, expire } = await getImageKitAuth();

    const fd = new FormData();
    fd.append("file", file);
    fd.append("publicKey", publicKey);
    fd.append("signature", signature);
    fd.append("expire", String(expire));
    fd.append("token", token);
    fd.append("fileName", file.name);
    fd.append("folder", "/creator-id-proofs");
    fd.append("useUniqueFileName", "true");

    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body?.message || detail;
      } catch {
        /* non-JSON response */
      }
      throw new Error(`ImageKit upload failed: ${detail}`);
    }

    const data = await res.json();
    if (!data?.url) throw new Error("ImageKit did not return a file URL.");
    return data.url as string;
  }

  /**
   * Uploads only the ID document, for creators whose form was already
   * submitted but whose file upload failed at the time.
   */
  async function handleDocumentOnlyUpload() {
    if (!user || !uploadedFile) return;
    setError("");
    setUploading(true);

    try {
      const url = await uploadToImageKit(uploadedFile);

      await updateDoc(doc(db, "creators", user.uid), {
        idProofFileUrl: url,
        updatedAt: Date.now(),
      });

      await refreshProfile();
      setUploadedFile(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");

    if (
      !form.platform ||
      !form.profileLink ||
      !form.contentNiche ||
      !form.followerCount ||
      !form.idProofType ||
      !form.idProofNumber
    ) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);

    try {
      let idProofFileUrl = profile?.idProofFileUrl || "";
      let uploadWarning = "";

      if (uploadedFile) {
        setUploading(true);
        try {
          idProofFileUrl = await uploadToImageKit(uploadedFile);
        } catch (uploadErr) {
          // Don't block the whole verification on an upload failure —
          // submit the text details and flag the upload issue.
          uploadWarning =
            uploadErr instanceof Error
              ? uploadErr.message
              : "File upload failed.";
        } finally {
          setUploading(false);
        }
      }

      await updateDoc(doc(db, "creators", user.uid), {
        ...form,
        idProofFileUrl,
        verificationStatus: "submitted",
        verificationSubmittedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await refreshProfile();

      if (uploadWarning) {
        setError(
          `Your details were submitted, but the document upload failed: ${uploadWarning} ` +
            `Please re-upload once this is resolved.`,
        );
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  // Already approved
  if (profile?.verificationStatus === "approved") {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-start gap-4 py-8">
            <CheckCircle className="h-10 w-10 flex-shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">
                You're Verified
              </h2>
              <p className="mt-1 text-sm text-emerald-700">
                Your creator account has been approved by the Drippr team.
              </p>
            </div>
          </CardContent>
        </Card>

        {profile.affiliateCode && (
          <Card className="border-0 bg-gradient-to-br from-zinc-900 to-zinc-700 text-white">
            <CardContent className="py-7 text-center">
              <p className="text-xs uppercase tracking-widest text-white/50">
                Your Affiliate Code
              </p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em]">
                {profile.affiliateCode}
              </p>
              <p className="mt-3 text-sm text-white/60">
                Share this code with your audience — every order using it counts
                toward your earnings.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submitted Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <ReadOnly label="Platform" value={profile.platform} />
            <ReadOnly label="Followers" value={profile.followerCount} />
            <ReadOnly label="Content Niche" value={profile.contentNiche} />
            <ReadOnly label="ID Type" value={profile.idProofType} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted, awaiting review
  if (profile?.verificationStatus === "submitted" || success) {
    const documentMissing = !profile?.idProofFileUrl;

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-4 py-8">
            <Clock className="h-10 w-10 flex-shrink-0 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900">
                Verification Submitted
              </h2>
              <p className="mt-1 text-sm text-blue-700">
                Your details are under review. You'll be notified once your
                account is approved.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submitted details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submitted Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <ReadOnly label="Platform" value={profile?.platform} />
            <ReadOnly label="Followers" value={profile?.followerCount} />
            <ReadOnly label="Content Niche" value={profile?.contentNiche} />
            <ReadOnly label="ID Type" value={profile?.idProofType} />
            <ReadOnly label="ID Number" value={profile?.idProofNumber} />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                ID Document
              </p>
              {profile?.idProofFileUrl ? (
                <a
                  href={profile.idProofFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" /> View uploaded file
                </a>
              ) : (
                <p className="mt-0.5 font-medium text-amber-600">
                  Not uploaded
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Re-upload path when the document never made it */}
        {documentMissing && (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                ID Document Missing
              </CardTitle>
              <CardDescription className="text-amber-800">
                Your details were saved, but the document upload didn't
                complete. Please upload it here — no need to redo the form.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
              />

              <div
                className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-amber-300 bg-white p-4 hover:bg-amber-50"
                onClick={() => fileRef.current?.click()}
              >
                {uploadedFile ? (
                  <>
                    <FileText className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                    <span className="truncate text-sm font-medium">
                      {uploadedFile.name}
                    </span>
                    <Badge variant="secondary" className="ml-auto flex-shrink-0">
                      Ready
                    </Badge>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 flex-shrink-0 text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Click to select your ID document (image or PDF)
                    </span>
                  </>
                )}
              </div>

              <Button
                onClick={handleDocumentOnlyUpload}
                disabled={!uploadedFile || uploading}
                className="w-full"
              >
                {uploading ? "Uploading…" : "Upload Document"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creator Verification</h1>
        <p className="text-muted-foreground">
          Complete your profile to get verified and receive your affiliate code.
        </p>
      </div>

      {profile?.verificationStatus === "rejected" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Your previous submission was rejected.
            {profile.verificationRejectionReason && (
              <> Reason: {profile.verificationRejectionReason}</>
            )}
            {" "}Please re-submit with corrected information.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Verification Details</CardTitle>
          <CardDescription>
            All fields are required for verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Platform */}
            <div className="space-y-2">
              <Label>Primary Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, platform: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profile link */}
            <div className="space-y-2">
              <Label htmlFor="profileLink">Profile Link</Label>
              <Input
                id="profileLink"
                value={form.profileLink}
                onChange={set("profileLink")}
                placeholder="https://instagram.com/yourhandle"
              />
            </div>

            {/* Content niche */}
            <div className="space-y-2">
              <Label htmlFor="contentNiche">Content Niche</Label>
              <Textarea
                id="contentNiche"
                value={form.contentNiche}
                onChange={set("contentNiche")}
                placeholder="Fashion, lifestyle, streetwear..."
                rows={2}
              />
            </div>

            {/* Follower count */}
            <div className="space-y-2">
              <Label htmlFor="followerCount">Follower Count</Label>
              <Input
                id="followerCount"
                value={form.followerCount}
                onChange={set("followerCount")}
                placeholder="e.g. 15K, 120K, 1.2M"
              />
            </div>

            {/* ID Proof */}
            <div className="space-y-2">
              <Label>ID Proof Type</Label>
              <Select
                value={form.idProofType}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, idProofType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_PROOF_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idProofNumber">ID Number</Label>
              <Input
                id="idProofNumber"
                value={form.idProofNumber}
                onChange={set("idProofNumber")}
                placeholder="Enter document number"
              />
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Upload ID Proof (Image or PDF)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
              />
              <div
                className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 hover:bg-muted/50"
                onClick={() => fileRef.current?.click()}
              >
                {uploadedFile ? (
                  <>
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">
                      {uploadedFile.name}
                    </span>
                    <Badge variant="secondary">Selected</Badge>
                  </>
                ) : profile?.idProofFileUrl ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">
                      Previously uploaded file on record
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload your ID document
                    </span>
                  </>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {uploading
                ? "Uploading file…"
                : submitting
                  ? "Submitting…"
                  : "Submit for Verification"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className={`mt-0.5 font-medium ${!value ? "text-gray-400" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}
