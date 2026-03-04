"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Plan = "free" | "pro" | null; // null = not loaded yet

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setPlan("free"); return; }
      setEmail(session.user.email ?? null);

      const res = await fetch("/api/user/plan", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const { plan } = await res.json();
        setPlan(plan);
      } else {
        setPlan("free");
      }
    });
  }, []);

  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 40px", height: 60,
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      position: "sticky", top: 0, background: "rgba(10,10,10,0.85)",
      backdropFilter: "blur(12px)", zIndex: 100, fontFamily: font,
    }}>
      <Link href="/" style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", color: "#fff", textDecoration: "none" }}>
        Overlink
      </Link>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {!email ? (
          // Signed out
          <>
            <Link href="/login" style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, textDecoration: "none" }}>Sign in</Link>
            <Link href="/login" style={{
              background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 600,
              padding: "6px 14px", borderRadius: 7, textDecoration: "none",
            }}>Get started</Link>
          </>
        ) : plan === "pro" ? (
          // Signed in — Pro
          <>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{email}</span>
            <span style={{
              background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700,
              padding: "3px 10px", borderRadius: 99,
            }}>Pro</span>
            <button
              onClick={async () => { await createClient().auth.signOut(); window.location.reload(); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}
            >
              Sign out
            </button>
          </>
        ) : (
          // Signed in — Free
          <>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{email}</span>
            <Link href="/login" style={{
              background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)",
              color: "#60a5fa", fontSize: 13, fontWeight: 600,
              padding: "6px 14px", borderRadius: 7, textDecoration: "none",
            }}>Upgrade to Pro</Link>
            <button
              onClick={async () => { await createClient().auth.signOut(); window.location.reload(); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
