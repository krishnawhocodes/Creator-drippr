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
import { Upload, CheckCircle, Clock, XCircle, FileText } from "lucide-react";

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
    const { token, signature, expire } = await getImageKitAuth();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("publicKey", import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY);
    fd.append("signature", signature);
    fd.append("expire", String(expire));
    fd.append("token", token);
    fd.append("fileName", file.name);
    fd.append("folder", "/creator-id-proofs");

    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) throw new Error("File upload failed");
    const data = await res.json();
    return data.url;
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

      if (uploadedFile) {
        setUploading(true);
        idProofFileUrl = await uploadToImageKit(uploadedFile);
        setUploading(false);
      }

      await updateDoc(doc(db, "creators", user.uid), {
        ...form,
        idProofFileUrl,
        verificationStatus: "submitted",
        verificationSubmittedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await refreshProfile();
      setSuccess(true);
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
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-4 py-8">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-green-900">
                You're Verified!
              </h2>
              <p className="text-sm text-green-700">
                Your creator account has been approved. Your affiliate code is{" "}
                <strong>{profile.affiliateCode}</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted, awaiting review
  if (
    profile?.verificationStatus === "submitted" ||
    success
  ) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center gap-4 py-8">
            <Clock className="h-10 w-10 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900">
                Verification Submitted
              </h2>
              <p className="text-sm text-blue-700">
                Your details are under review. You'll be notified once your
                account is approved.
              </p>
            </div>
          </CardContent>
        </Card>
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
