import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { createChangeRequest, createSupportTicket } from "@/lib/adminDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import PasswordStrength, {
  passwordPassesAll,
} from "@/components/PasswordStrength";
import { Info, KeyRound, User, LifeBuoy, CheckCircle } from "lucide-react";

/** Fields that require admin approval once the creator is verified */
const LOCKED_FIELDS = ["fullName", "platform", "profileLink", "followerCount"];

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  phone: "Phone",
  platform: "Platform",
  profileLink: "Profile Link",
  followerCount: "Follower Count",
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
    platform: profile?.platform || "",
    profileLink: profile?.profileLink || "",
    followerCount: profile?.followerCount || "",
    bio: profile?.bio || "",
    city: profile?.city || "",
    state: profile?.state || "",
  });
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

  function set(key: string) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  /** Fields the creator has actually modified */
  function getDirtyFields(): Record<string, string> {
    const dirty: Record<string, string> = {};
    Object.entries(form).forEach(([k, v]) => {
      const original = (profile as unknown as Record<string, string>)?.[k] || "";
      if (v !== original) dirty[k] = v;
    });
    return dirty;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setSaveErr("");
    setSaveMsg("");

    const dirty = getDirtyFields();
    if (!Object.keys(dirty).length) {
      setSaveMsg("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const lockedDirty = Object.keys(dirty).filter((k) =>
        LOCKED_FIELDS.includes(k),
      );

      // Verified creators need approval for locked fields
      if (isVerified && lockedDirty.length > 0) {
        const previous: Record<string, string> = {};
        const changes: Record<string, string> = {};
        lockedDirty.forEach((k) => {
          previous[k] =
            (profile as unknown as Record<string, string>)[k] || "";
          changes[k] = dirty[k];
        });

        await createChangeRequest({
          creatorUid: user.uid,
          creatorName: profile.fullName,
          creatorEmail: profile.email,
          changes,
          previous,
          reason: changeReason.trim(),
        });

        // Free fields can still be saved immediately
        const freeDirty = Object.fromEntries(
          Object.entries(dirty).filter(([k]) => !LOCKED_FIELDS.includes(k)),
        );
        if (Object.keys(freeDirty).length) {
          await updateDoc(doc(db, "creators", user.uid), {
            ...freeDirty,
            updatedAt: Date.now(),
          });
        }

        setChangeReason("");
        setSaveMsg(
          `Change request submitted for ${lockedDirty
            .map((f) => FIELD_LABELS[f] || f)
            .join(", ")}. An admin will review it shortly.`,
        );
      } else {
        await updateDoc(doc(db, "creators", user.uid), {
          ...dirty,
          updatedAt: Date.now(),
        });
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

  const dirtyLocked = Object.keys(getDirtyFields()).filter((k) =>
    LOCKED_FIELDS.includes(k),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your profile, security, and support requests.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Profile Information
          </CardTitle>
          {isVerified && (
            <CardDescription>
              Some fields require admin approval since your account is verified.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
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
                locked={isVerified}
              />
              <FieldInput
                id="phone"
                label="Phone"
                value={form.phone}
                onChange={set("phone")}
              />
              <FieldInput
                id="platform"
                label="Platform"
                value={form.platform}
                onChange={set("platform")}
                locked={isVerified}
              />
              <FieldInput
                id="followerCount"
                label="Follower Count"
                value={form.followerCount}
                onChange={set("followerCount")}
                locked={isVerified}
              />
            </div>

            <FieldInput
              id="profileLink"
              label="Profile Link"
              value={form.profileLink}
              onChange={set("profileLink")}
              locked={isVerified}
            />

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

            {/* Reason required when requesting locked-field changes */}
            {isVerified && dirtyLocked.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-900">
                    You're changing{" "}
                    <strong>
                      {dirtyLocked
                        .map((f) => FIELD_LABELS[f] || f)
                        .join(", ")}
                    </strong>
                    . These need admin approval.
                  </p>
                </div>
                <Label htmlFor="reason" className="text-amber-900">
                  Reason for change
                </Label>
                <Textarea
                  id="reason"
                  rows={2}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. I rebranded my Instagram handle…"
                  className="bg-white"
                />
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : isVerified && dirtyLocked.length > 0
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
                <AlertDescription>Password changed successfully.</AlertDescription>
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
                ticketSending || !ticket.subject.trim() || !ticket.message.trim()
              }
            >
              {ticketSending ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">Email</span>
            <span className="truncate font-medium">{user?.email}</span>
          </div>
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

function FieldInput({
  id,
  label,
  value,
  onChange,
  locked,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  locked?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {locked && (
          <Badge
            variant="secondary"
            className="h-4 px-1.5 py-0 text-[10px] font-normal"
          >
            needs approval
          </Badge>
        )}
      </div>
      <Input id={id} value={value} onChange={onChange} />
    </div>
  );
}
