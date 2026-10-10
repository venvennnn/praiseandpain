"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Supabase sometimes returns expired confirmation links to the Site URL
 * with hash fragments (#error=...). Capture those and send users to /login
 * with a readable query string.
 */
export function AuthErrorRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return;
    const hashParams = new URLSearchParams(hash);
    const error = hashParams.get("error") ?? hashParams.get("error_code");
    if (!error) return;

    const params = new URLSearchParams();
    for (const key of ["error", "error_code", "error_description"]) {
      const value = hashParams.get(key);
      if (value) params.set(key, value);
    }
    router.replace(`/login?${params.toString()}`);
  }, [router]);

  return null;
}
