"use client";

import Link from "next/link";
import { useSavedItems } from "@/lib/hooks/useSavedItems";
import { buildGcalUrl } from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/constants";

export default function EventsPage() {
  const { items, loading } = useSavedItems("event");

  return (
    <div style={{ fontFamily: SYSTEM_FONT, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Events</h1>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 60, fontSize: 14 }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 60 }}>
          No events saved yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                padding: "14px 16px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fbbf24", fontWeight: 600, fontSize: 15 }}>
                  {item.data.title ?? "(event)"}
                </div>
                {(item.data.date || item.data.time) && (
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 3 }}>
                    {[item.data.date, item.data.time, item.data.end_time ? `– ${item.data.end_time}` : null]
                      .filter(Boolean).join(" ")}
                    {item.data.timezone ? ` (${item.data.timezone})` : ""}
                  </div>
                )}
                {item.data.location && (
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
                    {item.data.location}
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <Link
                    href={`/dashboard/meetings/${item.meeting_id}`}
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
                  >
                    from: {item.meeting_title}
                  </Link>
                </div>
              </div>
              <a
                href={buildGcalUrl(item.data)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.45)", fontSize: 12, padding: "4px 10px",
                  borderRadius: 6, cursor: "pointer", flexShrink: 0, textDecoration: "none",
                  display: "inline-block",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#fbbf24")}
                onMouseOut={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
              >
                Add to Calendar
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
