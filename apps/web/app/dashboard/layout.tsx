"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setToken(session.access_token);
    });
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/folders", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setFolders(Array.isArray(data) ? data : []));
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

  const searchParams = useSearchParams();
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  const navLink = (href: string, label: string) => {
    // "All Meetings" is active only when on /dashboard with no folder param
    const active = href === "/dashboard"
      ? pathname === "/dashboard" && !searchParams.get("folder")
      : pathname === href;
    return (
      <Link
        key={href}
        href={href}
        style={{
          display: "block",
          padding: "6px 10px",
          borderRadius: 6,
          color: active ? "#fff" : "rgba(255,255,255,0.5)",
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: active ? 500 : 400,
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: font, background: "#0a0a0a", color: "#fff" }}>
      {/* Sidebar */}
      <div style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        gap: 4,
        overflowY: "auto",
      }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#fff", textDecoration: "none", padding: "0 10px", marginBottom: 16, display: "block" }}>
          Overlink
        </Link>

        {navLink("/dashboard", "All Meetings")}
        {navLink("/dashboard/contacts", "Contacts")}
        {navLink("/dashboard/links", "Links")}

        {/* Folders section */}
        {folders.length > 0 && (
          <>
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px", marginBottom: 2 }}>Folders</div>
            {folders.map((f) => {
              const href = `/dashboard?folder=${f.id}`;
              const active = pathname === "/dashboard" && searchParams.get("folder") === f.id;
              return (
                <Link key={f.id} href={href} style={{
                  display: "block",
                  padding: "6px 10px 6px 20px",
                  borderRadius: 6,
                  color: active ? "#fff" : "rgba(255,255,255,0.5)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  textDecoration: "none",
                  fontSize: 13,
                }}>
                  {f.name}
                </Link>
              );
            })}
          </>
        )}

        {/* New folder input */}
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

      {/* Main */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
        {children}
      </div>
    </div>
  );
}
