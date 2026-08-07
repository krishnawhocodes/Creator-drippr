import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PasswordStrength, {
  passwordPassesAll,
} from "@/components/PasswordStrength";
import type { CreatorProfile } from "@/types";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!passwordPassesAll(form.password)) {
      setError("Password does not meet all requirements.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      );

      const profile: CreatorProfile = {
        uid: cred.user.uid,
        email: form.email.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        verificationStatus: "pending",
        platform: "",
        profileLink: "",
        contentNiche: "",
        followerCount: "",
        idProofType: "",
        idProofNumber: "",
        idProofFileUrl: "",
        affiliateCode: "",
        bio: "",
        city: "",
        state: "",
      };

      await setDoc(doc(db, "creators", cred.user.uid), profile);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      if (msg.includes("email-already-in-use")) {
        setError("This email is already registered.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Join <span className="tracking-tight">Drippr</span> as a Creator
          </CardTitle>
          <CardDescription>
            Create your account to start earning with your influence.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="Create a strong password"
                required
              />
              <PasswordStrength password={form.password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Repeat password"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !passwordPassesAll(form.password)}
            >
              {loading ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
