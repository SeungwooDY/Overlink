"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LinkItem {
  id: string;
  type: "url" | "qr_code";
  data: { value?: string };
  created_at: string;
  meeting_id: string;
  meeting_title?: string;
}

export default function LinksPage() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/meetings", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(async (meetings) => {
        if (!Array.isArray(meetings)) return;
        const allLinks: LinkItem[] = [];
        await Promise.all(
          meetings.map(async (m: { id: string; title: string }) => {
            const r = await fetch(`/api/meetings/${m.id}/items`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const items = await r.json();
            for (const item of items) {
              if (item.type === "url" || item.type === "qr_code") {
                allLinks.push({ ...item, meeting_title: m.title });
              }
            }
          })
        );
        allLinks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setLinks(allLinks);
      });
  }, [token]);

  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  return (
    <div style={{ fontFamily: font, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Links</h1>

      {links.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 60 }}>
          No links saved yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map((item) => {
            const color = item.type === "qr_code" ? "#34d399" : "#60a5fa";
            const href = /^https?:\/\//i.test(item.data.value ?? "") ? item.data.value : `https://${item.data.value}`;
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
                  color, minWidth: 40, opacity: 0.8,
                }}>
                  {item.type === "qr_code" ? "QR" : "URL"}
                </span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color, flex: 1, wordBreak: "break-all", fontSize: 14, textDecoration: "none" }}
                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  {item.data.value}
                </a>
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
