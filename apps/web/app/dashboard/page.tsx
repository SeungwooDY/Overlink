"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Meeting {
  id: string;
  title: string;
  meet_room_code: string | null;
  created_at: string;
  folder_id: string | null;
  folder_name: string | null;
  item_count: number;
  item_types: string[];
}

interface SearchResult {
  type: "meeting" | "item";
  id: string;
  label: string;
  meeting_title: string | null;
  meeting_id: string | null;
  created_at: string;
  item_type?: string;
}

const TYPE_COLORS: Record<string, string> = {
  url: "#60a5fa",
  qr_code: "#34d399",
  email: "#c084fc",
  phone: "#fb923c",
  event: "#fbbf24",
  contact: "#22d3ee",
};

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get folder from query string
  const [folderId, setFolderId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setFolderId(new URLSearchParams(window.location.search).get("folder"));
    }
  }, []);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/meetings", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setMeetings(Array.isArray(data) ? data : []));
  }, [token]);

  useEffect(() => {
    if (!q.trim() || !token) {
      setSearchResults(null);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : [];
      setSearchResults(Array.isArray(data) ? data : []);
      setSearching(false);
    }, 300);
  }, [q, token]);

  const displayed = folderId
    ? meetings.filter((m) => m.folder_id === folderId)
    : meetings;

  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  return (
    <div style={{ fontFamily: font, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>
        {folderId ? meetings.find((m) => m.folder_id === folderId)?.folder_name ?? "Folder" : "All Meetings"}
      </h1>

      {/* Search */}
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search meetings and saved items…"
        style={{
          width: "100%", boxSizing: "border-box",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, color: "#fff", fontSize: 14, padding: "10px 14px",
          outline: "none", marginBottom: 24,
        }}
      />

      {/* Search results */}
      {searchResults !== null && (
        <div style={{ marginBottom: 32 }}>
          {searching ? (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Searching…</div>
          ) : searchResults.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No results for &quot;{q}&quot;</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searchResults.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.type === "meeting" ? `/dashboard/meetings/${r.id}` : `/dashboard/meetings/${r.meeting_id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    textDecoration: "none", color: "#fff",
                  }}
                >
                  <span style={{
                    fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                    color: r.type === "meeting" ? "rgba(255,255,255,0.4)" : TYPE_COLORS[r.item_type ?? "url"],
                    minWidth: 50,
                  }}>
                    {r.type === "meeting" ? "Meeting" : r.item_type}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, wordBreak: "break-all" }}>{r.label}</span>
                  {r.type === "item" && r.meeting_title && (
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{r.meeting_title}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meeting cards */}
      {searchResults === null && (
        displayed.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 15, marginTop: 60, textAlign: "center" }}>
            No meetings yet — save items from the extension to get started
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {displayed.map((m) => (
              <Link
                key={m.id}
                href={`/dashboard/meetings/${m.id}`}
                style={{
                  display: "block", textDecoration: "none",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "16px 18px",
                  transition: "border-color 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              >
                <div style={{ fontWeight: 600, fontSize: 15, color: "#fff", marginBottom: 6, wordBreak: "break-word" }}>{m.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
                  {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {m.folder_name && (
                    <span style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 99,
                      background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)",
                    }}>{m.folder_name}</span>
                  )}
                  {m.item_types.map((t) => (
                    <span key={t} style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 99,
                      background: `${TYPE_COLORS[t]}20`, color: TYPE_COLORS[t],
                    }}>{t}</span>
                  ))}
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                    {m.item_count} item{m.item_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
