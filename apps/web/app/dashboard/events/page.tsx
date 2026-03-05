"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface EventItem {
  id: string;
  data: {
    title?: string;
    date?: string;
    time?: string;
    end_time?: string;
    timezone?: string;
    location?: string;
    description?: string;
  };
  created_at: string;
  meeting_id: string;
  meeting_title?: string;
}

function buildGcalUrl(data: EventItem["data"]): string {
  function parseTimeTo24h(t: string): { hh: string; mm: string } {
    const ampm = t.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)/i);
    if (ampm) {
      let h = parseInt(ampm[1]);
      const m = parseInt(ampm[2] || "0");
      if (/pm/i.test(ampm[3]) && h !== 12) h += 12;
      if (/am/i.test(ampm[3]) && h === 12) h = 0;
      return { hh: String(h).padStart(2, "0"), mm: String(m).padStart(2, "0") };
    }
    const parts = t.split(":");
    return { hh: parts[0].padStart(2, "0"), mm: (parts[1] ?? "00").slice(0, 2).padStart(2, "0") };
  }

  let datesParam = "";
  if (data.date) {
    const d = data.date.replace(/-/g, "");
    if (data.time) {
      const { hh, mm } = parseTimeTo24h(data.time);
      let endHH: string, endMM: string;
      if (data.end_time) {
        const parsed = parseTimeTo24h(data.end_time);
        endHH = parsed.hh; endMM = parsed.mm;
      } else {
        endHH = String((parseInt(hh) + 1) % 24).padStart(2, "0");
        endMM = mm;
      }
      datesParam = `${d}T${hh}${mm}00/${d}T${endHH}${endMM}00`;
    } else {
      datesParam = `${d}/${d}`;
    }
  }

  const p = new URLSearchParams({ action: "TEMPLATE" });
  if (data.title) p.set("text", data.title);
  if (datesParam) p.set("dates", datesParam);
  if (data.description) p.set("details", data.description);
  if (data.location) p.set("location", data.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
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
        const all: EventItem[] = [];
        await Promise.all(
          meetings.map(async (m: { id: string; title: string }) => {
            const r = await fetch(`/api/meetings/${m.id}/items`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const itemsData = await r.json();
            for (const item of itemsData) {
              if (item.type === "event") all.push({ ...item, meeting_title: m.title });
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
