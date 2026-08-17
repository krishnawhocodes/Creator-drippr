import { useState, useRef, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { getImageKitAuth } from "@/lib/api";
import { useKeyboardAwareScroll } from "@/lib/useBodyScrollLock";
import {
  getPlatforms,
  validatePlatforms,
  newPlatform,
  normaliseLink,
  totalFollowers,
  formatFollowerCount,
} from "@/lib/platforms";
import { calculateCompletion } from "@/lib/profileCompletion";
import PlatformsEditor, { PlatformsList } from "@/components/PlatformsEditor";
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
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
  Users,
} from "lucide-react";
import type { CreatorPlatform } from "@/types";

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

  useKeyboardAwareScroll();

  const [platforms, setPlatforms] = useState<CreatorPlatform[]>(() => {
    const existing = getPlatforms(profile);
    return existing.length ? existing : [newPlatform()];
  });

  const [form, setForm] = useState({
    contentNiche: profile?.contentNiche || "",
    idProofType: profile?.idProofType || "",
    idProofNumber: profile?.idProofNumber || "",
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>(
    {},
  );
  const [success, setSuccess] = useState(false);

  const completion = useMemo(
    () => calculateCompletion(profile),
    [profile],
  );

  function set(key: keyof typeof form) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    };
  }

  async function uploadToImageKit(file: File): Promise<string> {
    const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error(
        "VITE_IMAGEKIT_PUBLIC_KEY is not set. Add it in Vercel and redeploy.",
      );
    }

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
        /* non-JSON */
      }
      throw new Error(`ImageKit upload failed: ${detail}`);
    }

    const data = await res.json();
    if (!data?.url) throw new Error("ImageKit did not return a file URL.");
    return data.url as string;
  }

  /** Re-upload path for creators whose file upload failed earlier. */
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

  /** Full validation — every field is mandatory. */
  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!form.contentNiche.trim()) {
      errs.contentNiche = "Content niche is required.";
    } else if (form.contentNiche.trim().length < 3) {
      errs.contentNiche = "Please describe your niche in a little more detail.";
    }

    if (!form.idProofType.trim()) {
      errs.idProofType = "Select an ID proof type.";
    }

    if (!form.idProofNumber.trim()) {
      errs.idProofNumber = "ID proof number is required.";
    } else if (form.idProofNumber.trim().length < 6) {
      errs.idProofNumber = "That ID number looks too short.";
    }

    // Document is mandatory unless one is already on file
    if (!uploadedFile && !profile?.idProofFileUrl) {
      errs.idProofFile = "Please upload your ID document.";
    }

    const pErrs = validatePlatforms(platforms);
    if (!platforms.length) {
      errs.platforms = "Add at least one social platform.";
    } else if (Object.keys(pErrs).length) {
      errs.platforms = "Please fix the errors in your platform entries.";
    }

    setFieldErrors(errs);
    setPlatformErrors(pErrs);

    return Object.keys(errs).length === 0 && Object.keys(pErrs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");

    if (!validate()) {
      setError("Please complete all required fields before submitting.");
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
          uploadWarning =
            uploadErr instanceof Error
              ? uploadErr.message
              : "File upload failed.";
        } finally {
          setUploading(false);
        }
      }

      const cleanedPlatforms = platforms.map((p) => ({
        ...p,
        platform: p.platform.trim(),
        handle: p.handle.trim(),
        profileLink: normaliseLink(p.profileLink),
        followerCount: p.followerCount.trim(),
      }));

      const primary = cleanedPlatforms[0];

      const payload = {
        ...form,
        contentNiche: form.contentNiche.trim(),
        idProofNumber: form.idProofNumber.trim(),
        platforms: cleanedPlatforms,
        // Keep legacy fields in sync for backward compatibility
        platform: primary?.platform || "",
        profileLink: primary?.profileLink || "",
        followerCount: primary?.followerCount || "",
        idProofFileUrl,
        verificationStatus: "submitted" as const,
        verificationSubmittedAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nextCompletion = calculateCompletion({
        ...profile,
        ...payload,
      }).percent;

      await updateDoc(doc(db, "creators", user.uid), {
        ...payload,
        profileCompletion: nextCompletion,
      });

      await refreshProfile();

      if (uploadWarning) {
        setError(
          `Your details were submitted, but the document upload failed: ${uploadWarning} ` +
            `You can re-upload it below.`,
        );
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  const savedPlatforms = getPlatforms(profile);
  const reach = totalFollowers(savedPlatforms);

  // ── Approved ──
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
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Your Platforms</CardTitle>
            {reach > 0 && (
              <Badge variant="secondary" className="gap-1.5">
                <Users className="h-3 w-3" />
                {formatFollowerCount(reach)} reach
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <PlatformsList platforms={savedPlatforms} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submitted Details</CardTitle>
            <CardDescription>
              To change any of these, go to Settings — updates require admin
              approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <ReadOnly label="Content Niche" value={profile.contentNiche} />
            <ReadOnly label="ID Type" value={profile.idProofType} />
            <ReadOnly label="ID Number" value={profile.idProofNumber} />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                ID Document
              </p>
              {profile.idProofFileUrl ? (
                <a
                  href={profile.idProofFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" /> View file
                </a>
              ) : (
                <p className="mt-0.5 font-medium text-amber-600">Not uploaded</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Submitted, awaiting review ──
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              Platforms Submitted ({savedPlatforms.length})
            </CardTitle>
            {reach > 0 && (
              <Badge variant="secondary" className="gap-1.5">
                <Users className="h-3 w-3" />
                {formatFollowerCount(reach)} reach
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <PlatformsList platforms={savedPlatforms} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submitted Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
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
                  <FileText className="h-3.5 w-3.5" /> View file
                </a>
              ) : (
                <p className="mt-0.5 font-medium text-amber-600">Not uploaded</p>
              )}
            </div>
          </CardContent>
        </Card>

        {documentMissing && (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                ID Document Missing
              </CardTitle>
              <CardDescription className="text-amber-800">
                Your details were saved, but the document upload didn't
                complete. Upload it here — no need to redo the form.
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

  // ── Form (pending / rejected) ──
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Creator Verification
        </h1>
        <p className="text-sm text-gray-500">
          Complete your profile to get verified and receive your affiliate code.
        </p>
      </div>

      {/* Completion nudge */}
      <Card className="border-0 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium">
              Profile {completion.percent}% complete
            </p>
            <p className="text-xs text-white/60">
              {completion.missing.length} item
              {completion.missing.length !== 1 ? "s" : ""} remaining
            </p>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {profile?.verificationStatus === "rejected" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Your previous submission was rejected.
            {profile.verificationRejectionReason && (
              <> Reason: {profile.verificationRejectionReason}</>
            )}{" "}
            Please correct the details and submit again.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Verification Details</CardTitle>
          <CardDescription>
            All fields marked with * are required.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Platforms */}
            <div>
              <PlatformsEditor
                platforms={platforms}
                onChange={(next) => {
                  setPlatforms(next);
                  setFieldErrors((p) => ({ ...p, platforms: "" }));
                }}
                errors={platformErrors}
                disabled={submitting}
              />
              {fieldErrors.platforms && (
                <p className="mt-2 text-sm text-red-600">
                  {fieldErrors.platforms}
                </p>
              )}
            </div>

            <Separator />

            {/* Content niche */}
            <div className="space-y-2">
              <Label htmlFor="contentNiche">Content Niche *</Label>
              <Textarea
                id="contentNiche"
                value={form.contentNiche}
                onChange={set("contentNiche")}
                placeholder="Fashion, lifestyle, streetwear…"
                rows={2}
                disabled={submitting}
                className={fieldErrors.contentNiche ? "border-red-400" : ""}
              />
              {fieldErrors.contentNiche && (
                <p className="text-sm text-red-600">
                  {fieldErrors.contentNiche}
                </p>
              )}
            </div>

            <Separator />

            {/* ID proof */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Identity Verification
              </Label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="idProofType">ID Proof Type *</Label>
                  <Select
                    value={form.idProofType}
                    onValueChange={(v) => {
                      setForm((p) => ({ ...p, idProofType: v }));
                      setFieldErrors((p) => ({ ...p, idProofType: "" }));
                    }}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      className={fieldErrors.idProofType ? "border-red-400" : ""}
                    >
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
                  {fieldErrors.idProofType && (
                    <p className="text-sm text-red-600">
                      {fieldErrors.idProofType}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idProofNumber">ID Number *</Label>
                  <Input
                    id="idProofNumber"
                    value={form.idProofNumber}
                    onChange={set("idProofNumber")}
                    placeholder="Enter document number"
                    disabled={submitting}
                    className={
                      fieldErrors.idProofNumber ? "border-red-400" : ""
                    }
                  />
                  {fieldErrors.idProofNumber && (
                    <p className="text-sm text-red-600">
                      {fieldErrors.idProofNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Upload */}
              <div className="space-y-2">
                <Label>Upload ID Proof (Image or PDF) *</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    setUploadedFile(e.target.files?.[0] || null);
                    setFieldErrors((p) => ({ ...p, idProofFile: "" }));
                  }}
                />
                <div
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors hover:bg-gray-50 ${
                    fieldErrors.idProofFile
                      ? "border-red-400 bg-red-50/40"
                      : ""
                  }`}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadedFile ? (
                    <>
                      <FileText className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                      <span className="truncate text-sm font-medium">
                        {uploadedFile.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="ml-auto flex-shrink-0"
                      >
                        Selected
                      </Badge>
                    </>
                  ) : profile?.idProofFileUrl ? (
                    <>
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                      <span className="text-sm">
                        Document already on file — click to replace
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        Click to upload your ID document
                      </span>
                    </>
                  )}
                </div>
                {fieldErrors.idProofFile && (
                  <p className="text-sm text-red-600">
                    {fieldErrors.idProofFile}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
            >
              {uploading
                ? "Uploading document…"
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
