"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Handle OAuth callback client-side so the plain supabase-js client
// (which uses localStorage) performs the PKCE code exchange itself.
// It stored the code_verifier in localStorage during signInWithOAuth,
// so exchangeCodeForSession reads it from there — no server cookie
// bridging needed, and the session lands directly in localStorage.
export default function AuthCallbackPage() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      createClient()
        .auth.exchangeCodeForSession(code)
        .then(() => { window.location.href = "/"; })
        .catch(() => { window.location.href = "/login"; });
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#0a0a0a", color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      gap: 16,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
