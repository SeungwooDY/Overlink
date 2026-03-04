"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GetProButton() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  async function handleClick() {
    if (!token) { window.location.href = "/login"; return; }
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: "block", width: "100%", marginTop: 20, textAlign: "center",
        padding: "10px", borderRadius: 8, background: "#3b82f6",
        color: "#fff", fontSize: 14, fontWeight: 700,
        border: "none", cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Redirecting…" : token ? "Get Pro" : "Sign in to get Pro"}
    </button>
  );
}
