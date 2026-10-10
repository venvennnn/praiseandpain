import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { listWorkspacesForUser } from "@/server/repositories/workspaces";
import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function AppIndexPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <BrandMark className="text-3xl font-semibold" />
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl">
          Environment not ready
        </h1>
        <p className="mt-4 text-[var(--color-ink-muted)]">
          Praise & Pain needs Supabase credentials and migrations before workspaces can be
          created. See <code>docs/SETUP.md</code>. No fabricated data is shown.
        </p>
        <Button asChild className="mt-6" variant="secondary">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await listWorkspacesForUser(supabase, user.id);
  if (!memberships.length) redirect("/onboarding");

  const first = memberships[0].workspace as { id: string };
  redirect(`/w/${first.id}/overview`);
}
