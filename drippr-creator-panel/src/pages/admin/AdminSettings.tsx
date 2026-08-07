import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ADMIN_EMAILS } from "@/lib/admin";
import { listCreators } from "@/lib/adminDb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import PasswordStrength, {
  passwordPassesAll,
} from "@/components/PasswordStrength";
import { ShieldAlert, Database, KeyRound, CheckCircle } from "lucide-react";

export default function AdminSettings() {
  const { user } = useAuth();

  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const [stats, setStats] = useState({ creators: 0, codes: 0 });

  useEffect(() => {
    listCreators()
      .then((all) =>
        setStats({
          creators: all.length,
          codes: all.filter((c) => c.affiliateCode).length,
        }),
      )
      .catch(() => {});
  }, []);

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
      const currentUser = auth.currentUser;
      if (!currentUser?.email) throw new Error("Not signed in.");

      const cred = EmailAuthProvider.credential(
        currentUser.email,
        pwForm.current,
      );
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, pwForm.newPw);

      setPwForm({ current: "", newPw: "", confirm: "" });
      setPwSuccess(true);
    } catch (err: unknown) {
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your admin account and review system configuration.
        </p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            Admin Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Signed in as" value={user?.email || "—"} />
          <Row label="User ID" value={user?.uid || "—"} mono />
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">Role</span>
            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
              Administrator
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* System overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-blue-600" />
            System Overview
          </CardTitle>
          <CardDescription>
            Live counts from your Firestore database.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Total Creators
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.creators}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Affiliate Codes Issued
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.codes}</p>
          </div>
        </CardContent>
      </Card>

      {/* Authorized admins */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Authorized Admins</CardTitle>
          <CardDescription>
            Configured in <code className="text-xs">src/lib/admin.ts</code> and
            the <code className="text-xs">ADMIN_UIDS</code> env var.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ADMIN_EMAILS.map((email) => (
            <div
              key={email}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="truncate font-medium">{email}</span>
              {email === user?.email && (
                <Badge variant="secondary" className="ml-auto flex-shrink-0">
                  You
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Change Password
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
              <Label htmlFor="cur">Current Password</Label>
              <Input
                id="cur"
                type="password"
                value={pwForm.current}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, current: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
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
              <Label htmlFor="conf">Confirm New Password</Label>
              <Input
                id="conf"
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
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex-shrink-0 text-gray-500">{label}</span>
      <span className={`truncate font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
