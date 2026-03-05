"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ContactItem {
  id: string;
  data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
  };
  created_at: string;
  meeting_id: string;
  meeting_title?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
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
        const allContacts: ContactItem[] = [];
        await Promise.all(
          meetings.map(async (m: { id: string; title: string }) => {
            const r = await fetch(`/api/meetings/${m.id}/items`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const items = await r.json();
            for (const item of items) {
              if (item.type === "contact") {
                allContacts.push({ ...item, meeting_title: m.title });
              }
            }
          })
        );
        allContacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setContacts(allContacts);
      });
  }, [token]);

  function downloadVCard(data: ContactItem["data"]) {
    const vcf = [
      "BEGIN:VCARD", "VERSION:3.0",
      data.name ? `FN:${data.name}` : "",
      data.email ? `EMAIL:${data.email}` : "",
      data.phone ? `TEL:${data.phone}` : "",
      data.company ? `ORG:${data.company}` : "",
      data.role ? `TITLE:${data.role}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");
    const blob = new Blob([vcf], { type: "text/vcard" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.name ?? "contact"}.vcf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  return (
    <div style={{ fontFamily: font, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Contacts</h1>

      {contacts.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 60 }}>
          No contacts saved yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contacts.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                padding: "14px 16px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#22d3ee", fontWeight: 600, fontSize: 15 }}>{c.data.name ?? "(contact)"}</div>
                {(c.data.role || c.data.company) && (
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>
                    {[c.data.role, c.data.company].filter(Boolean).join(" @ ")}
                  </div>
                )}
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
                  {[c.data.email, c.data.phone].filter(Boolean).join(" · ")}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Link
                    href={`/dashboard/meetings/${c.meeting_id}`}
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
                  >
                    from: {c.meeting_title}
                  </Link>
                </div>
              </div>
              <button
                onClick={() => downloadVCard(c.data)}
                style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.45)", fontSize: 12, padding: "4px 10px",
                  borderRadius: 6, cursor: "pointer", flexShrink: 0,
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#22d3ee")}
                onMouseOut={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
              >
                Download vCard
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
