import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AuthErrorRedirect } from "@/app/auth-error-redirect";

const praiseRows = [
  { name: "Easy to get started", share: 34 },
  { name: "Clean and intuitive design", share: 22 },
  { name: "Helps me stay organized", share: 18 },
];

const painRows = [
  { name: "Checkout keeps failing", share: 28 },
  { name: "App crashes on launch", share: 21 },
  { name: "Can't sync across devices", share: 16 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-app)]">
      <AuthErrorRedirect />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <BrandMark className="text-2xl font-semibold tracking-tight" />
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how" className="hidden text-[var(--color-ink-muted)] sm:inline">
            How it works
          </a>
          <a href="#sample" className="hidden text-[var(--color-ink-muted)] sm:inline">
            Sample report
          </a>
          <Link href="/login" className="font-medium text-[var(--color-ink)]">
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <section className="mx-auto max-w-3xl pt-10 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] font-semibold tracking-tight text-[var(--color-ink)] md:text-6xl">
            Know what they <span className="text-[var(--color-praise)]">love</span>.
            <br />
            Fix what they <span className="text-[var(--color-pain)]">don’t</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-ink-muted)]">
            Turn scattered reviews into clear priorities — with the evidence behind every insight.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link href="/signup">Analyze your product</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="rounded-full bg-white px-6">
              <a href="#sample">Explore sample report</a>
            </Button>
          </div>
          <p className="mt-8 text-xs font-semibold tracking-[0.16em] text-[var(--color-ink-muted)] uppercase">
            Analyze reviews from
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--color-ink)]">
            {["Google Maps", "App Store", "Google Play", "YouTube"].map((source) => (
              <span key={source} className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1">
                {source}
              </span>
            ))}
          </div>
        </section>

        <section id="sample" className="report-card mt-14 p-6 md:p-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-ink-muted)] uppercase">
            Illustrative sample
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-semibold">
              The feedback, made useful.
            </h2>
            <span className="rounded-full bg-[var(--color-praise-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-praise)]">
              Sample · Last 30 days
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            This card is a picture of the report layout. Your workspace only fills these rows from reviews that were actually collected.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ThemePanel title="Praise worth protecting" tone="praise" rows={praiseRows} />
            <ThemePanel title="Pain worth fixing" tone="pain" rows={painRows} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-2xl bg-[var(--color-praise-soft)] p-4 text-sm">
              <p className="text-[var(--color-ink)]">
                “I signed up in minutes and it just worked. Super easy to get started.”
              </p>
              <p className="mt-3 text-xs text-[var(--color-ink-muted)]">Google Play · sample quote</p>
            </article>
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-highlight)] p-4">
              <p className="text-xs font-semibold tracking-wide text-[var(--color-action)] uppercase">Next move</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl">Investigate checkout failures</p>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Recurring across recent reviews, tied to the quotes that say so.
              </p>
            </article>
          </div>
        </section>

        <section id="how" className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            ["01", "Connect a source", "Bring in reviews from Google Maps, App Store, Google Play, and YouTube."],
            ["02", "Understand the patterns", "We group feedback into specific praise and pain, with the share of mentions and the wording behind them."],
            ["03", "Choose your next move", "See where you lead a competitor, where you trail, and which issue to handle first."],
          ].map(([step, title, body]) => (
            <article key={step}>
              <p className="text-sm font-semibold text-[var(--color-action)]">{step}</p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function ThemePanel({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "praise" | "pain";
  rows: Array<{ name: string; share: number }>;
}) {
  const soft = tone === "praise" ? "bg-[var(--color-praise-soft)]" : "bg-[var(--color-pain-soft)]";
  const ink = tone === "praise" ? "text-[var(--color-praise)]" : "text-[var(--color-pain)]";
  const bar = tone === "praise" ? "bg-[var(--color-praise)]" : "bg-[var(--color-pain)]";
  return (
    <div className={`rounded-2xl p-4 ${soft}`}>
      <h3 className={`text-sm font-semibold ${ink}`}>{title}</h3>
      <ol className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <li key={row.name}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className={`mr-2 font-semibold ${ink}`}>{index + 1}</span>
                {row.name}
              </span>
              <span className="text-[var(--color-ink-muted)]">{row.share}%</span>
            </div>
            <div className="share-bar mt-1 bg-white/80">
              <span className={bar} style={{ width: `${row.share}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
