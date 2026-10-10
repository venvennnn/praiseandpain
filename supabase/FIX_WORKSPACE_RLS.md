# Fix: “new row violates row-level security policy for table workspaces”

Run this **now** in Supabase → **SQL Editor** → New query → paste the full contents of:

`supabase/migrations/20261010090000_fix_workspace_rls.sql`

Then click **Run**.

After it succeeds, go back to onboarding and click **Continue** again.

## What was wrong

Creating a workspace did `insert().select()`. RLS allowed the insert for the owner, but the follow-up **select** required membership that did not exist yet — so Postgres reported an RLS violation on `workspaces`.
