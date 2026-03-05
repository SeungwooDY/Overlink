"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PhoneItem {
  id: string;
  data: { value?: string };
  created_at: string;
  meeting_id: string;
  meeting_title?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{
        background: "none", border: "1px solid rgba(255,255,255,0.12)",
        color: copied ? "#34d399" : "rgba(255,255,255,0.35)", fontSize: 11,
        padding: "3px 8px", borderRadius: 5, cursor: "pointer", flexShrink: 0,
        transition: "color 0.15s",
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function PhonesPage() {
  const [items, setItems] = useState<PhoneItem[]>([]);
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
        const all: PhoneItem[] = [];
        await Promise.all(
          meetings.map(async (m: { id: string; title: string }) => {
            const r = await fetch(`/api/meetings/${m.id}/items`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const itemsData = await r.json();
            for (const item of itemsData) {
              if (item.type === "phone") all.push({ ...item, meeting_title: m.title });
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
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Phones</h1>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 60, fontSize: 14 }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 60 }}>
          No phone numbers saved yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <a
                href={`tel:${item.data.value}`}
                style={{ color: "#fb923c", flex: 1, fontSize: 14, textDecoration: "none" }}
                onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {item.data.value}
              </a>
              <CopyButton text={item.data.value ?? ""} />
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
          ))}
        </div>
      )}
    </div>
  );
}
