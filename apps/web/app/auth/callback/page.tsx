"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      setError(`${errorParam}: ${errorDescription ?? "unknown error"}`);
      return;
    }

    if (code) {
      // PKCE flow: exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setError(error.message);
        else window.location.href = "/";
      });
    } else {
      // Implicit flow: supabase-js auto-processes the hash fragment (#access_token=...)
      // Listen for the resulting SIGNED_IN event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          window.location.href = "/";
        } else if (event === "INITIAL_SESSION" && !session) {
          subscription.unsubscribe();
          setError("No session returned. Check Supabase Auth flow type setting (should be PKCE).");
        }
      });
    }
  }, []);

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#0a0a0a", color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        gap: 16, padding: "0 24px", textAlign: "center",
      }}>
        <span style={{ color: "#f87171", fontSize: 14 }}>Sign-in failed: {error}</span>
        <a href="/login" style={{ color: "#60a5fa", fontSize: 14 }}>Back to login</a>
      </div>
    );
  }

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
