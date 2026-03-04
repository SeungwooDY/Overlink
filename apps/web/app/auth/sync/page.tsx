"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// After Google OAuth, the session lives in cookies (set by the server callback).
// This client page reads the session from Supabase and writes the access token
// to localStorage so the extension auth-bridge can pick it up.
export default function AuthSync() {
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        // Supabase JS stores the session under this key automatically,
        // but after a server-side code exchange it may not be in localStorage yet.
        // Writing it explicitly ensures the auth-bridge finds it.
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
          .replace("https://", "")
          .split(".")[0];
        const key = `sb-${projectRef}-auth-token`;
        localStorage.setItem(key, JSON.stringify(session));
      }
      window.location.href = "/";
    });
  }, []);

  return null;
}
