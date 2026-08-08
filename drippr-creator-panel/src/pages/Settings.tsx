import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { createChangeRequest, createSupportTicket } from "@/lib/adminDb";
import {
  getPlatforms,
  validatePlatforms,
  normaliseLink,
} from "@/lib/platforms";
import { calculateCompletion } from "@/lib/profileCompletion";
import PlatformsEditor from "@/components/PlatformsEditor";
import { CompletionRing } from "@/components/AvatarRing";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import PasswordStrength, {
  passwordPassesAll,
} from "@/components/PasswordStrength";
import {
  Info,
  KeyRound,
  User,
  LifeBuoy,
  CheckCircle,
  Circle,
  ShieldCheck,
} from "lucide-react";
import type { CreatorPlatform } from "@/types";

/**
 * Once a creator is verified, changes to these fields must be approved by
 * an admin — they affect identity and payouts.
 */
const APPROVAL_REQUIRED = [
  "fullName",
  "phone",
  "platforms",
  "contentNiche",
] as const;

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  phone: "Phone",
  platforms: "Social Platforms",
  contentNiche: "Content Niche",
  bio: "Bio",
  city: "City",
  state: "State",
};

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const isVerified = profile?.verificationStatus === "approved";

  const [form, setForm] = useState({
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    contentNiche: profile?.contentNiche || "",
    bio: profile?.bio || "",
    city: profile?.city || "",
    state: profile?.state || "",
  });
  const [platforms, setPlatforms] = useState<CreatorPlatform[]>(() =>
    getPlatforms(profile),
  );
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>(
    {},
  );

  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");

  const [ticket, setTicket] = useState({ subject: "", message: "" });
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketErr, setTicketErr] = useState("");

  const completion = useMemo(() => calculateCompletion(profile), [profile]);

  function set(key: keyof typeof form) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  const platformsChanged = useMemo(() => {
    const original = getPlatforms(profile);
    return JSON.stringify(original) !== JSON.stringify(platforms);
  }, [platforms, profile]);

  /** Scalar fields the creator has modified. */
  function getDirtyFields(): Record<string, string> {
    const dirty: Record<string, string> = {};
    Object.entries(form).forEach(([k, v]) => {
      const original =
        ((profile as unknown as Record<string, string>)?.[k] as string) || "";
      if (v !== original) dirty[k] = v;
    });
    return dirty;
  }

  const dirty = getDirtyFields();
  const dirtyKeys = [
    ...Object.keys(dirty),
    ...(platformsChanged ? ["platforms"] : []),
  ];
  const needsApproval = isVerified
    ? dirtyKeys.filter((k) =>
        (APPROVAL_REQUIRED as readonly string[]).includes(k),
      )
    : [];

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setSaveErr("");
    setSaveMsg("");

    if (!dirtyKeys.length) {
      setSaveMsg("No changes to save.");
      return;
    }

    // Validate platforms whenever they've been touched
    if (platformsChanged) {
      const errs = validatePlatforms(platforms);
      setPlatformErrors(errs);
      if (Object.keys(errs).length) {
        setSaveErr("Please fix the errors in your platform entries.");
        return;
      }
      if (!platforms.length) {
        setSaveErr("You must have at least one social platform.");
        return;
      }
    }

    if (needsApproval.length && !changeReason.trim()) {
      setSaveErr("Please provide a reason for the requested changes.");
      return;
    }

    setSaving(true);

    try {
      const cleanedPlatforms = platforms.map((p) => ({
        ...p,
        platform: p.platform.trim(),
        handle: p.handle.trim(),
        profileLink: normaliseLink(p.profileLink),
        followerCount: p.followerCount.trim(),
      }));

      if (needsApproval.length) {
        // Build the change request payload
        const changes: Record<string, string> = {};
        const previous: Record<string, string> = {};

        needsApproval.forEach((k) => {
          if (k === "platforms") {
            changes.platforms = JSON.stringify(cleanedPlatforms);
            previous.platforms = JSON.stringify(getPlatforms(profile));
          } else {
            changes[k] = dirty[k];
            previous[k] =
              ((profile as unknown as Record<string, string>)[k] as string) ||
              "";
          }
        });

        await createChangeRequest({
          creatorUid: user.uid,
          creatorName: profile.fullName,
          creatorEmail: profile.email,
          changes,
          previous,
          reason: changeReason.trim(),
        });

        // Fields that don't need approval can be saved right away
        const freeDirty = Object.fromEntries(
          Object.entries(dirty).filter(
            ([k]) => !(APPROVAL_REQUIRED as readonly string[]).includes(k),
          ),
        );

        if (Object.keys(freeDirty).length) {
          await updateDoc(doc(db, "creators", user.uid), {
            ...freeDirty,
            profileCompletion: calculateCompletion({
              ...profile,
              ...freeDirty,
            }).percent,
            updatedAt: Date.now(),
          });
        }

        setChangeReason("");
        setSaveMsg(
          `Change request submitted for ${needsApproval
            .map((f) => FIELD_LABELS[f] || f)
            .join(", ")}. An admin will review it shortly.`,
        );
      } else {
        // Not verified yet, or nothing sensitive changed — save directly
        const payload: Record<string, unknown> = { ...dirty };

        if (platformsChanged) {
          payload.platforms = cleanedPlatforms;
          const primary = cleanedPlatforms[0];
          payload.platform = primary?.platform || "";
          payload.profileLink = primary?.profileLink || "";
          payload.followerCount = primary?.followerCount || "";
        }

        payload.profileCompletion = calculateCompletion({
          ...profile,
          ...payload,
        }).percent;
        payload.updatedAt = Date.now();

        await updateDoc(doc(db, "creators", user.uid), payload);
        setSaveMsg("Profile updated successfully.");
      }

      await refreshProfile();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (!passwordPassesAll(pwForm.newPw)) {
      setPwError("New password does not meet all requirements.");
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      const cu = auth.currentUser;
      if (!cu?.email) throw new Error("Not signed in.");
      const cred = EmailAuthProvider.credential(cu.email, pwForm.current);
      await reauthenticateWithCredential(cu, cred);
      await updatePassword(cu, pwForm.newPw);
      setPwForm({ current: "", newPw: "", confirm: "" });
      setPwSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password change failed.";
      setPwError(
        msg.includes("wrong-password") || msg.includes("invalid-credential")
          ? "Current password is incorrect."
          : msg,
      );
    } finally {
      setPwSaving(false);
    }
  }

  async function sendTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setTicketErr("");
    setTicketSent(false);
    setTicketSending(true);
    try {
      await createSupportTicket({
        creatorUid: user.uid,
        creatorName: profile.fullName,
        creatorEmail: profile.email,
        subject: ticket.subject.trim(),
        message: ticket.message.trim(),
      });
      setTicket({ subject: "", message: "" });
      setTicketSent(true);
    } catch (err) {
      setTicketErr(
        err instanceof Error ? err.message : "Failed to send message.",
      );
    } finally {
      setTicketSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your profile, security, and support requests.
        </p>
      </div>

      {/* Profile completion */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 py-6">
          <CompletionRing percent={completion.percent} size={110} />
          <div className="min-w-[220px] flex-1">
            <h3 className="font-semibold">Profile Completion</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {completion.missing.length === 0
                ? "Your profile is fully complete. Nice work."
                : `${completion.missing.length} item${
                    completion.missing.length !== 1 ? "s" : ""
                  } left to complete.`}
            </p>

            {completion.missing.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {completion.missing.slice(0, 4).map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <Circle className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                    {item.label}
                    <span className="ml-auto text-xs text-gray-400">
                      +{item.weight}%
                    </span>
                  </li>
                ))}
                {completion.missing.length > 4 && (
                  <li className="text-xs text-gray-400">
                    +{completion.missing.length - 4} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Profile Information
          </CardTitle>
          {isVerified && (
            <CardDescription className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
              Your account is verified. Changes to your name, phone, platforms,
              or niche need admin approval.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-5">
            {saveErr && (
              <Alert variant="destructive">
                <AlertDescription>{saveErr}</AlertDescription>
              </Alert>
            )}
            {saveMsg && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription>{saveMsg}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldInput
                id="fullName"
                label="Full Name"
                value={form.fullName}
                onChange={set("fullName")}
                approval={isVerified}
              />
              <FieldInput
                id="phone"
                label="Phone"
                value={form.phone}
                onChange={set("phone")}
                approval={isVerified}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="contentNiche">Content Niche</Label>
                {isVerified && <ApprovalBadge />}
              </div>
              <Textarea
                id="contentNiche"
                rows={2}
                value={form.contentNiche}
                onChange={set("contentNiche")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                value={form.bio}
                onChange={set("bio")}
                placeholder="Tell us about yourself…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldInput
                id="city"
                label="City"
                value={form.city}
                onChange={set("city")}
              />
              <FieldInput
                id="state"
                label="State"
                value={form.state}
                onChange={set("state")}
              />
            </div>

            <Separator />

            {/* Platforms */}
            <div>
              {isVerified && (
                <div className="mb-3 flex items-center gap-2">
                  <ApprovalBadge />
                  <span className="text-xs text-gray-500">
                    Platform changes are reviewed before going live
                  </span>
                </div>
              )}
              <PlatformsEditor
                platforms={platforms}
                onChange={setPlatforms}
                errors={platformErrors}
                disabled={saving}
                showVerifiedBadges
              />
            </div>

            {/* Reason required for approval-gated changes */}
            {needsApproval.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-900">
                    You're changing{" "}
                    <strong>
                      {needsApproval
                        .map((f) => FIELD_LABELS[f] || f)
                        .join(", ")}
                    </strong>
                    . These require admin approval before taking effect.
                  </p>
                </div>
                <Label htmlFor="reason" className="text-amber-900">
                  Reason for change *
                </Label>
                <Textarea
                  id="reason"
                  rows={2}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. I rebranded my Instagram handle and added a YouTube channel…"
                  className="bg-white"
                />
              </div>
            )}

            <Button type="submit" disabled={saving || !dirtyKeys.length}>
              {saving
                ? "Saving…"
                : needsApproval.length > 0
                  ? "Submit for Approval"
                  : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            {pwError && (
              <Alert variant="destructive">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}
            {pwSuccess && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <AlertDescription>
                  Password changed successfully.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="curPw">Current Password</Label>
              <Input
                id="curPw"
                type="password"
                value={pwForm.current}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, current: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPw">New Password</Label>
              <Input
                id="newPw"
                type="password"
                value={pwForm.newPw}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, newPw: e.target.value }))
                }
                required
              />
              <PasswordStrength password={pwForm.newPw} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confPw">Confirm New Password</Label>
              <Input
                id="confPw"
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, confirm: e.target.value }))
                }
                required
              />
            </div>

            <Button
              type="submit"
              disabled={pwSaving || !passwordPassesAll(pwForm.newPw)}
            >
              {pwSaving ? "Changing…" : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Support */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4" /> Contact Support
          </CardTitle>
          <CardDescription>
            Have a question? Send a message to the Drippr team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendTicket} className="space-y-4">
            {ticketErr && (
              <Alert variant="destructive">
                <AlertDescription>{ticketErr}</AlertDescription>
              </Alert>
            )}
            {ticketSent && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription>
                  Message sent. Our team will get back to you soon.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={ticket.subject}
                onChange={(e) =>
                  setTicket((t) => ({ ...t, subject: e.target.value }))
                }
                placeholder="What do you need help with?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                rows={4}
                value={ticket.message}
                onChange={(e) =>
                  setTicket((t) => ({ ...t, message: e.target.value }))
                }
                placeholder="Describe your issue in detail…"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={
                ticketSending ||
                !ticket.subject.trim() ||
                !ticket.message.trim()
              }
            >
              {ticketSending ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={user?.email || "—"} />
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">Status</span>
            <Badge variant="secondary">
              {profile?.verificationStatus || "pending"}
            </Badge>
          </div>
          {profile?.affiliateCode && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Affiliate Code</span>
              <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold">
                {profile.affiliateCode}
              </code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalBadge() {
  return (
    <Badge
      variant="secondary"
      className="h-4 px-1.5 py-0 text-[10px] font-normal"
    >
      needs approval
    </Badge>
  );
}

function FieldInput({
  id,
  label,
  value,
  onChange,
  approval,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  approval?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {approval && <ApprovalBadge />}
      </div>
      <Input id={id} value={value} onChange={onChange} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex-shrink-0 text-gray-500">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
