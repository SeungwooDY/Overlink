"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SavedItem {
  id: string;
  type: string;
  data: Record<string, string>;
  created_at: string;
}

interface Meeting {
  id: string;
  title: string;
  folder_id: string | null;
  folder_name?: string | null;
  created_at: string;
}

const TAB_LABELS: Record<string, string> = {
  url: "Links",
  qr_code: "QR Codes",
  email: "Emails",
  phone: "Phones",
  event: "Events",
  contact: "Contacts",
};

const TYPE_COLORS: Record<string, string> = {
  url: "#60a5fa",
  qr_code: "#34d399",
  email: "#c084fc",
  phone: "#fb923c",
  event: "#fbbf24",
  contact: "#22d3ee",
};

const TAB_ORDER = ["url", "qr_code", "email", "phone", "event", "contact"];

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/meetings`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`/api/meetings/${id}/items`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([meetings, itemsData]) => {
      const m = Array.isArray(meetings) ? meetings.find((x: Meeting) => x.id === id) : null;
      setMeeting(m ?? null);
      setTitleInput(m?.title ?? "");
      const arr = Array.isArray(itemsData) ? itemsData : [];
      setItems(arr);
      // Set default tab to first type present
      const firstType = TAB_ORDER.find((t) => arr.some((i: SavedItem) => i.type === t));
      if (firstType) setActiveTab(firstType);
    });
  }, [token, id]);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  async function saveTitle() {
    if (!token || !meeting || !titleInput.trim()) { setEditingTitle(false); return; }
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: titleInput.trim() }),
    });
    if (res.ok) setMeeting((prev) => prev ? { ...prev, title: titleInput.trim() } : prev);
    setEditingTitle(false);
  }

  async function deleteItem(itemId: string) {
    if (!token) return;
    const res = await fetch(`/api/meetings/${id}/items/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function buildGcalUrl(data: Record<string, string>): string {
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

  function downloadVCard(data: Record<string, string>) {
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

  const availableTabs = TAB_ORDER.filter((t) => items.some((i) => i.type === t));
  const tabItems = items.filter((i) => i.type === activeTab);
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  if (!meeting) {
    return <div style={{ fontFamily: font, color: "rgba(255,255,255,0.4)", paddingTop: 60, textAlign: "center" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: font, maxWidth: 800 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16, display: "flex", gap: 6, alignItems: "center" }}>
        <Link href="/dashboard" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Dashboard</Link>
        {meeting.folder_name && (
          <>
            <span>/</span>
            <Link href={`/dashboard?folder=${meeting.folder_id}`} style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>{meeting.folder_name}</Link>
          </>
        )}
        <span>/</span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>{meeting.title}</span>
      </div>

      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            onBlur={saveTitle}
            style={{
              fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6, color: "#fff", padding: "2px 8px", outline: "none",
              width: "100%",
            }}
          />
        ) : (
          <h1
            style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", cursor: "pointer" }}
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
          >
            {meeting.title}
          </h1>
        )}
      </div>

      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>
        {new Date(meeting.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        {" · "}
        {items.length} item{items.length !== 1 ? "s" : ""}
      </div>

      {availableTabs.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 60 }}>No saved items yet</div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
            {availableTabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 14px",
                  color: activeTab === t ? "#fff" : "rgba(255,255,255,0.45)",
                  borderBottom: activeTab === t ? `2px solid ${TYPE_COLORS[t]}` : "2px solid transparent",
                  fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
                }}
              >
                {TAB_LABELS[t]} ({items.filter((i) => i.type === t).length})
              </button>
            ))}
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tabItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {(item.type === "url" || item.type === "qr_code") && (
                    <a
                      href={/^https?:\/\//i.test(item.data.value ?? "") ? item.data.value : `https://${item.data.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: TYPE_COLORS[item.type], wordBreak: "break-all", fontSize: 14 }}
                    >
                      {item.data.value}
                    </a>
                  )}
                  {item.type === "email" && (
                    <a href={`mailto:${item.data.value}`} style={{ color: TYPE_COLORS.email, fontSize: 14 }}>{item.data.value}</a>
                  )}
                  {item.type === "phone" && (
                    <a href={`tel:${item.data.value}`} style={{ color: TYPE_COLORS.phone, fontSize: 14 }}>{item.data.value}</a>
                  )}
                  {item.type === "event" && (
                    <div>
                      <div style={{ color: TYPE_COLORS.event, fontWeight: 600, fontSize: 14 }}>{item.data.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                        {[item.data.date, item.data.time, item.data.location ? `@ ${item.data.location}` : ""].filter(Boolean).join(" · ")}
                      </div>
                      {item.data.description && (
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{item.data.description}</div>
                      )}
                      <a
                        href={buildGcalUrl(item.data)}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-block", marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.18)", padding: "1px 6px", borderRadius: 4, textDecoration: "none" }}
                      >Add to Calendar</a>
                    </div>
                  )}
                  {item.type === "contact" && (
                    <div>
                      <div style={{ color: TYPE_COLORS.contact, fontWeight: 600, fontSize: 14 }}>{item.data.name ?? "(contact)"}</div>
                      {(item.data.role || item.data.company) && (
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 1 }}>
                          {[item.data.role, item.data.company].filter(Boolean).join(" @ ")}
                        </div>
                      )}
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                        {[item.data.email, item.data.phone].filter(Boolean).join(" · ")}
                      </div>
                      <button
                        onClick={() => downloadVCard(item.data)}
                        style={{ background: "none", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.45)", fontSize: 11, padding: "1px 6px", borderRadius: 4, cursor: "pointer", marginTop: 6 }}
                      >Download vCard</button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  title="Remove"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "rgba(255,80,80,0.8)")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                >×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
