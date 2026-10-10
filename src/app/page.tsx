import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AuthErrorRedirect } from "@/app/auth-error-redirect";

export default function HomePage() {
  return (
    <div className="min-h-screen hero-atmosphere">
      <AuthErrorRedirect />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <BrandMark className="text-2xl font-semibold tracking-tight" />
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-action)]"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-20 pt-8">
        <div className="absolute inset-x-6 top-10 h-px origin-left bg-[var(--color-border)] animate-rule" />
        <p className="animate-rise text-sm font-medium tracking-[0.18em] text-[var(--color-ink-muted)] uppercase">
          Feedback intelligence
        </p>
        <h1 className="animate-rise mt-5 max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-[1.05] font-semibold tracking-tight text-[var(--color-ink)] md:text-7xl">
          <span className="text-[var(--color-praise)]">Praise</span>
          <span className="text-[var(--color-ink-muted)]"> & </span>
          <span className="text-[var(--color-pain)]">Pain</span>
        </h1>
        <p className="animate-rise-delay mt-6 max-w-xl text-xl text-[var(--color-ink)] md:text-2xl">
          Their feedback. Your next move.
        </p>
        <p className="animate-rise-delay mt-4 max-w-lg text-base text-[var(--color-ink-muted)]">
          Know what they love. Fix what they don’t. Pull real Maps, App Store, Play, and
          YouTube feedback, classify praise and complaints with evidence, and turn them into
          owned next moves.
        </p>
        <div className="animate-rise-delay mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Start with your product</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
        <div
          className="pointer-events-none absolute right-6 bottom-16 hidden h-40 w-40 rounded-full md:block"
          style={{
            background:
              "conic-gradient(from 180deg, rgba(21,128,61,0.28), transparent 40%, rgba(220,38,38,0.24), transparent 75%)",
            animation: "pulse-soft 4.5s ease-in-out infinite",
          }}
          aria-hidden
        />
      </main>
    </div>
  );
}
