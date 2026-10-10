import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorCode) {
    const params = new URLSearchParams({
      error: errorCode,
      ...(errorDescription ? { error_description: errorDescription } : {}),
      ...(searchParams.get("error_code")
        ? { error_code: searchParams.get("error_code")! }
        : {}),
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fresh email confirmations land users on sign-in with a clear success state.
      if (next === "/app") {
        return NextResponse.redirect(`${origin}/login?confirmed=1`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=auth&error_description=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
