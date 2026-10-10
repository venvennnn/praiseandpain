"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, supabasePublicConfigured } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (!supabasePublicConfigured()) {
    return (
      <div className="hero-atmosphere flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-md border border-[var(--color-border)] bg-white p-6">
          <BrandMark className="mb-4 text-2xl font-semibold" />
          <p className="text-sm text-[var(--color-ink-muted)]">
            Signup requires Supabase Auth credentials. Set public Supabase environment
            variables to enable registration. Live data is never fabricated.
          </p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResent(false);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setSubmittedEmail(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!submittedEmail) return;
    setResending(true);
    setError(null);
    setResent(false);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (resendError) {
        setError(resendError.message);
        return;
      }
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend email");
    } finally {
      setResending(false);
    }
  }

  if (submittedEmail) {
    return (
      <div className="hero-atmosphere flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="mb-8">
          <BrandMark className="text-3xl font-semibold" />
        </Link>
        <div className="w-full max-w-md space-y-5 rounded-md border border-[var(--color-border)] bg-white p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-8 w-8 shrink-0 text-[var(--color-praise)]"
              aria-hidden
            />
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
                Account created — check your email
              </h1>
              <p className="mt-2 text-sm text-[var(--color-ink)]">
                We sent a confirmation link to{" "}
                <span className="font-semibold">{submittedEmail}</span>.
              </p>
            </div>
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--color-ink-muted)]">
            <li>Open that email (check spam if you do not see it).</li>
            <li>Click <strong>Confirm your email</strong>.</li>
            <li>You will return here, then sign in with your password.</li>
          </ol>

          {resent ? (
            <div className="flex items-center gap-2 rounded-md border border-[var(--color-praise)] bg-[color-mix(in_srgb,var(--color-praise)_8%,white)] px-3 py-2 text-sm text-[var(--color-ink)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-praise)]" aria-hidden />
              New confirmation email sent. Use the newest link.
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--color-pain)]">{error}</p> : null}

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={resending}
              onClick={resendConfirmation}
            >
              {resending ? "Sending…" : "Resend confirmation email"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-atmosphere flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8">
        <BrandMark className="text-3xl font-semibold" />
      </Link>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-md border border-[var(--color-border)] bg-white p-6"
      >
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Create account</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-[var(--color-pain)]">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Already registered?{" "}
          <Link href="/login" className="text-[var(--color-action)]">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
