"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TYPE_COLORS, SYSTEM_FONT } from "@/lib/constants";

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

const NAV_ITEMS = [
  { href: "/dashboard/links",    label: "Links",     type: "url" },
  { href: "/dashboard/qrcodes",  label: "QR Codes",  type: "qr_code" },
  { href: "/dashboard/emails",   label: "Emails",    type: "email" },
  { href: "/dashboard/phones",   label: "Phones",    type: "phone" },
  { href: "/dashboard/events",   label: "Events",    type: "event" },
  { href: "/dashboard/contacts", label: "Contacts",  type: "contact" },
];

// Separated so useSearchParams() is inside a Suspense boundary (Next.js requirement)
function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setToken(session.access_token);
    });
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/folders", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setFolders(Array.isArray(data) ? data : []));
    fetch("/api/dashboard/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data && typeof data === "object") setStats(data); });
  }, [token]);

  async function createFolder() {
    if (!newFolderName.trim() || !token) return;
    setCreatingFolder(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    if (res.ok) {
      const folder = await res.json();
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
    }
    setCreatingFolder(false);
  }

  const navLink = (href: string, label: string) => {
    const active = href === "/dashboard"
      ? pathname === "/dashboard" && !searchParams.get("folder")
      : pathname === href;
    return (
      <Link key={href} href={href} style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 10px", borderRadius: 7,
        color: active ? "#fff" : "rgba(255,255,255,0.5)",
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        textDecoration: "none", fontSize: 14, fontWeight: active ? 500 : 400,
        transition: "background 0.15s, color 0.15s",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "rgba(255,255,255,0.6)",
          opacity: active ? 1 : 0.3,
          flexShrink: 0,
          transition: "opacity 0.15s",
        }} />
        {label}
      </Link>
    );
  };

  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column",
      padding: "20px 12px", gap: 4, overflowY: "auto",
    }}>
      <Link href="/" style={{
        fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em",
        color: "#fff", textDecoration: "none", padding: "0 10px", marginBottom: 16, display: "block",
      }}>
        Overlink
      </Link>

      {navLink("/dashboard", "All Meetings")}

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px", marginBottom: 2 }}>
        Saved Items
      </div>
      {NAV_ITEMS.map(({ href, label, type }) => {
        const active = pathname === href;
        const color = TYPE_COLORS[type];
        const count = stats[type];
        return (
          <Link key={href} href={href} style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "7px 10px", borderRadius: 7,
            color: active ? "#fff" : "rgba(255,255,255,0.5)",
            background: active ? `${color}1a` : "transparent",
            textDecoration: "none", fontSize: 14, fontWeight: active ? 500 : 400,
            transition: "background 0.15s, color 0.15s",
            boxShadow: active ? `inset 0 0 0 1px ${color}30` : "none",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: color,
              opacity: active ? 1 : 0.35,
              flexShrink: 0,
              boxShadow: active ? `0 0 6px ${color}` : "none",
              transition: "opacity 0.15s, box-shadow 0.15s",
            }} />
            <span style={{ flex: 1 }}>{label}</span>
            {count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: active ? color : "rgba(255,255,255,0.2)",
                transition: "color 0.15s",
              }}>
                {count}
              </span>
            )}
          </Link>
        );
      })}

      {folders.length > 0 && (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px", marginBottom: 2 }}>
            Folders
          </div>
          {folders.map((f) => {
            const href = `/dashboard?folder=${f.id}`;
            const active = pathname === "/dashboard" && searchParams.get("folder") === f.id;
            return (
              <Link key={f.id} href={href} style={{
                display: "block", padding: "6px 10px 6px 20px", borderRadius: 6,
                color: active ? "#fff" : "rgba(255,255,255,0.5)",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                textDecoration: "none", fontSize: 13,
              }}>
                {f.name}
              </Link>
            );
          })}
        </>
      )}

      <div style={{ marginTop: 8, display: "flex", gap: 6, padding: "0 4px" }}>
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createFolder()}
          placeholder="New folder…"
          style={{
            flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, color: "#fff", fontSize: 12, padding: "4px 8px", outline: "none",
          }}
        />
        <button
          onClick={createFolder}
          disabled={creatingFolder || !newFolderName.trim()}
          style={{
            background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)",
            color: "#60a5fa", borderRadius: 6, fontSize: 12, padding: "4px 8px", cursor: "pointer",
          }}
        >+</button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: SYSTEM_FONT, background: "#0a0a0a", color: "#fff" }}>
      <Suspense fallback={
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.07)",
          padding: "20px 12px",
        }} />
      }>
        <Sidebar />
      </Suspense>
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
        {children}
      </div>
    </div>
  );
}
