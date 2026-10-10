"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, supabasePublicConfigured } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setMessage(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
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
        {message ? <p className="text-sm text-[var(--color-ink-muted)]">{message}</p> : null}
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
