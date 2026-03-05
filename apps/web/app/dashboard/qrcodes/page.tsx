"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface QRItem {
  id: string;
  data: { value?: string };
  created_at: string;
  meeting_id: string;
  meeting_title?: string;
}

export default function QRCodesPage() {
  const [items, setItems] = useState<QRItem[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/meetings", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(async (meetings) => {
        if (!Array.isArray(meetings)) { setLoading(false); return; }
        const all: QRItem[] = [];
        await Promise.all(
          meetings.map(async (m: { id: string; title: string }) => {
            const r = await fetch(`/api/meetings/${m.id}/items`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const itemsData = await r.json();
            for (const item of itemsData) {
              if (item.type === "qr_code") all.push({ ...item, meeting_title: m.title });
            }
          })
        );
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(all);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  return (
    <div style={{ fontFamily: font, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>QR Codes</h1>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 60, fontSize: 14 }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 60 }}>
          No QR codes saved yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => {
            const val = item.data.value ?? "";
            const isUrl = /^https?:\/\//i.test(val);
            return (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span style={{
                  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                  color: "#34d399", minWidth: 24, opacity: 0.8,
                }}>QR</span>
                {isUrl ? (
                  <a
                    href={val}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#34d399", flex: 1, wordBreak: "break-all", fontSize: 14, textDecoration: "none" }}
                    onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                  >
                    {val}
                  </a>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.8)", flex: 1, wordBreak: "break-all", fontSize: 14 }}>{val}</span>
                )}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <Link
                    href={`/dashboard/meetings/${item.meeting_id}`}
                    style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
                  >
                    {item.meeting_title}
                  </Link>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                    {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
