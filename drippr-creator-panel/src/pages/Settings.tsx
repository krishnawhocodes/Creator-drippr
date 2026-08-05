import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
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
import PasswordStrength, {
  passwordPassesAll,
} from "@/components/PasswordStrength";

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();

  // Profile form
  const [profileForm, setProfileForm] = useState({
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    bio: profile?.bio || "",
    city: profile?.city || "",
    state: profile?.state || "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password form
  const [pwForm, setPwForm] = useState({
    current: "",
    newPw: "",
    confirm: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileError("");
    setProfileSuccess(false);
    setProfileSaving(true);

    try {
      await updateDoc(doc(db, "creators", user.uid), {
        ...profileForm,
        updatedAt: Date.now(),
      });
      await refreshProfile();
      setProfileSuccess(true);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (!passwordPassesAll(pwForm.newPw)) {
      setPwError("New password does not meet requirements.");
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error("Not signed in.");

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
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setPwError("Current password is incorrect.");
      } else {
        setPwError(msg);
      }
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and account settings.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            {profileError && (
              <Alert variant="destructive">
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}
            {profileSuccess && (
              <Alert>
                <AlertDescription>Profile updated.</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profileForm.fullName}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profileForm.bio}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, bio: e.target.value }))
                }
                rows={3}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={profileForm.city}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, city: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={profileForm.state}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, state: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            {pwError && (
              <Alert variant="destructive">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}
            {pwSuccess && (
              <Alert>
                <AlertDescription>Password changed successfully.</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPw">Current Password</Label>
              <Input
                id="currentPw"
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
              <Label htmlFor="confirmPw">Confirm New Password</Label>
              <Input
                id="confirmPw"
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

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Email: <span className="font-medium text-foreground">{user?.email}</span>
          </p>
          <p>
            UID: <span className="font-mono text-xs">{user?.uid}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
