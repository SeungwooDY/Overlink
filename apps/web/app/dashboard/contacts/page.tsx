"use client";

import Link from "next/link";
import { useSavedItems } from "@/lib/hooks/useSavedItems";
import { downloadVCard } from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/constants";

export default function ContactsPage() {
  const { items: contacts, loading } = useSavedItems("contact");

  return (
    <div style={{ fontFamily: SYSTEM_FONT, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Contacts</h1>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 60, fontSize: 14 }}>
          Loading…
        </div>
      ) : contacts.length === 0 ? (
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
