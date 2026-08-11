import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailCheck, ParkingCircle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Smart Hospital Parking" },
      {
        name: "description",
        content:
          "Sign in or create an account to manage your hospital parking profile and bookings.",
      },
      { property: "og:title", content: "Sign in — Smart Hospital Parking" },
      {
        property: "og:description",
        content: "Access your hospital parking profile, vehicle details and spot bookings.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(72),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/profile", replace: true });
    });
  }, [navigate]);

  const signInWithProvider = async (provider: "google" | "apple") => {
    setOauthBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not sign in");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/profile", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setOauthBusy(null);
    }
  };

  const resendVerification = async () => {
    const parsedEmail = z.string().trim().email().safeParse(email);
    if (!parsedEmail.success) {
      toast.error("Enter the email address you signed up with");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsedEmail.data,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Verification email sent to ${parsedEmail.data}`);
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedEmail = z.string().trim().email().safeParse(email);
    if (!parsedEmail.success) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetSent(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName ?? "" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
        navigate({ to: "/profile", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          if (/confirm/i.test(error.message)) setNeedsVerification(true);
          throw error;
        }
        navigate({ to: "/profile", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ParkingCircle className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Smart Hospital Parking</h1>
            <p className="text-sm text-muted-foreground">Al Noor Medical Center</p>
          </div>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          {checkEmail ? (
            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to {email}. Confirm it, then sign in.
              </p>
              <p className="text-sm font-medium text-amber-600">Status: not verified yet</p>
              <Button variant="secondary" onClick={resendVerification} disabled={busy}>
                <MailCheck /> Resend verification email
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCheckEmail(false);
                  setMode("login");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : mode === "forgot" ? (
            <>
              <h2 className="text-lg font-semibold">Reset your password</h2>
              {resetSent ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    If an account exists for {email}, we&apos;ve sent a password reset link. Open it
                    to choose a new password.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetSent(false);
                      setMode("login");
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send you a secure link to set a new password.
                  </p>
                  <form className="mt-5 space-y-4" onSubmit={sendReset}>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={255}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      className="w-full"
                      disabled={busy}
                    >
                      {busy ? "Sending…" : "Send reset link"}
                    </Button>
                  </form>
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setMode("login")}
                    >
                      Back to sign in
                    </button>
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">
                {mode === "login" ? "Sign in" : "Create your account"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Access your profile and parking bookings."
                  : "Save your vehicle details and track your bookings."}
              </p>

              <div className="mt-5 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => signInWithProvider("google")}
                  disabled={oauthBusy !== null}
                >
                  <GoogleMark />
                  {oauthBusy === "google" ? "Connecting…" : "Continue with Google"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => signInWithProvider("apple")}
                  disabled={oauthBusy !== null}
                >
                  <AppleMark />
                  {oauthBusy === "apple" ? "Connecting…" : "Continue with Apple"}
                </Button>
              </div>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  or use email
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <form className="mt-5 space-y-4" onSubmit={submit}>
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      maxLength={100}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Layla Ahmed"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
                </Button>
              </form>

              {mode === "login" && (
                <button
                  type="button"
                  className="mt-3 w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setResetSent(false);
                    setMode("forgot");
                  }}
                >
                  Forgot your password?
                </button>
              )}

              {needsVerification && (
                <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-center">
                  <p className="text-sm font-medium text-amber-600">Email not verified</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirm your email address before signing in.
                  </p>
                  <Button
                    className="mt-3"
                    variant="secondary"
                    onClick={resendVerification}
                    disabled={busy}
                  >
                    <MailCheck /> Resend verification email
                  </Button>
                </div>
              )}

              <p className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "login" ? "New here?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to the garage map
          </Link>
        </p>
      </div>
    </div>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.94a9 9 0 0 0 0 8.1l3.03-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.95l3.03 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 384 512" aria-hidden="true" className="size-4 fill-current">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
