"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, supabasePublicConfigured } from "@/lib/supabase/client";

function authErrorMessage(code: string | null, description: string | null): string | null {
  if (!code && !description) return null;
  if (code === "otp_expired" || /expired|invalid/i.test(description ?? "")) {
    return "That confirmation link is invalid or has expired. Request a new one from signup, then click the newest email.";
  }
  if (code === "access_denied") {
    return description?.replace(/\+/g, " ") || "Access denied. Try signing in again.";
  }
  if (code === "auth") {
    return "Email confirmation failed. Request a new confirmation email and try again.";
  }
  return description?.replace(/\+/g, " ") || "Sign-in error. Please try again.";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const banner = useMemo(() => {
    const confirmed = params.get("confirmed");
    if (confirmed === "1") {
      return {
        type: "success" as const,
        text: "Email confirmed. Sign in with your password to continue.",
      };
    }
    const error = authErrorMessage(
      params.get("error_code") ?? params.get("error"),
      params.get("error_description"),
    );
    if (error) return { type: "error" as const, text: error };
    return null;
  }, [params]);

  if (!supabasePublicConfigured()) {
    return (
      <div className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Setup required</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
          Authentication needs <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Configure these environment variables,
          apply database migrations, then return here. No demo or fake data is substituted.
        </p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      router.push(params.get("next") || "/app");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-md border border-[var(--color-border)] bg-white p-6"
    >
      <h1 className="font-[family-name:var(--font-display)] text-2xl">Sign in</h1>

      {banner ? (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-3 text-sm ${
            banner.type === "success"
              ? "border-[var(--color-praise)] bg-[color-mix(in_srgb,var(--color-praise)_8%,white)]"
              : "border-[var(--color-pain)] bg-[color-mix(in_srgb,var(--color-pain)_6%,white)]"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-praise)]" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-pain)]" />
          )}
          <p>{banner.text}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {message ? <p className="text-sm text-[var(--color-pain)]">{message}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-[var(--color-ink-muted)]">
        No account?{" "}
        <Link href="/signup" className="text-[var(--color-action)]">
          Create one
        </Link>
      </p>
      {(banner?.type === "error" || /confirm|expired/i.test(message ?? "")) && (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Need a new confirmation link?{" "}
          <Link href="/signup" className="text-[var(--color-action)]">
            Go to signup and resend
          </Link>
          .
        </p>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="hero-atmosphere flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8">
        <BrandMark className="text-3xl font-semibold" />
      </Link>
      <div className="w-full max-w-md">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
