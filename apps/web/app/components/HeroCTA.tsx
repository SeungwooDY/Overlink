"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function HeroCTA() {
  const { email, plan, token } = useAuth();

  async function handleUpgrade() {
    if (!token) { window.location.href = "/login"; return; }
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <a
        href="https://chrome.google.com/webstore"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: "#3b82f6", color: "#fff", fontWeight: 700,
          padding: "12px 24px", borderRadius: 9, textDecoration: "none", fontSize: 15,
        }}
      >
        Add to Chrome — it&apos;s free
      </a>

      {/* Hold space while loading to avoid layout shift */}
      {plan === null ? (
        <div style={{ width: 120, height: 50 }} />
      ) : !email ? (
        <Link href="/login" style={{
          background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.12)",
          fontWeight: 600, padding: "12px 24px", borderRadius: 9, textDecoration: "none", fontSize: 15,
        }}>
          Sign in
        </Link>
      ) : plan === "pro" ? (
        <span style={{
          display: "flex", alignItems: "center", gap: 8,
          color: "rgba(255,255,255,0.5)", fontSize: 14, padding: "12px 0",
        }}>
          <span style={{ background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Pro</span>
          {email}
        </span>
      ) : (
        <button
          onClick={handleUpgrade}
          style={{
            background: "rgba(59,130,246,0.15)", color: "#60a5fa",
            border: "1px solid rgba(59,130,246,0.4)",
            fontWeight: 600, padding: "12px 24px", borderRadius: 9, fontSize: 15, cursor: "pointer",
          }}
        >
          Upgrade to Pro — $5/mo
        </button>
      )}
    </div>
  );
}
