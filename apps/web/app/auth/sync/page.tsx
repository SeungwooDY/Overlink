"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthSync() {
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
          .replace("https://", "")
          .split(".")[0];
        const key = `sb-${projectRef}-auth-token`;
        localStorage.setItem(key, JSON.stringify(session));
      }
      window.location.href = "/";
    });
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#0a0a0a", color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      gap: 16,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.1)",
        borderTopColor: "#3b82f6",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Signing you in…</span>
    </div>
  );
}
