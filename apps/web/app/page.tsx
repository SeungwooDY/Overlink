import Link from "next/link";
import NavBar from "./components/NavBar";
import HeroCTA from "./components/HeroCTA";

// ── Decorative demo panel (mimics the extension overlay) ─────────────────────

function DemoPanel() {
  return (
    <div
      style={{
        background: "rgba(15,15,15,0.88)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "10px 14px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
        lineHeight: 1.6,
        width: 260,
        boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
        userSelect: "none",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        Overlink
      </div>

      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Links</div>
      <a style={{ display: "block", color: "#60a5fa", textDecoration: "none", wordBreak: "break-all" }}>figma.com/file/prototype-v2</a>
      <a style={{ display: "block", color: "#60a5fa", textDecoration: "none", wordBreak: "break-all" }}>docs.google.com/presentation/d/1xZ</a>

      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", margin: "6px 0 3px" }}>QR Codes</div>
      <a style={{ display: "block", color: "#34d399", textDecoration: "none" }}>https://calendly.com/sarah-lee</a>

      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", margin: "6px 0 3px" }}>Events</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ color: "#fbbf24", flex: 1 }}>Q2 Review — Apr 10 2:30 PM – 3:30 PM</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, border: "1px solid rgba(255,255,255,0.18)", padding: "1px 5px", borderRadius: 4 }}>Add</span>
      </div>

      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", margin: "6px 0 3px" }}>Contacts</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ color: "#22d3ee" }}>Sarah Lee · VP Eng @ Acme</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>sarah@acme.com · +1 415 555 0192</div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, border: "1px solid rgba(255,255,255,0.18)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>Save</span>
      </div>
    </div>
  );
}

// ── Mock meeting frame ────────────────────────────────────────────────────────

function MeetingMockup() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 560 }}>
      {/* Fake screen share slide */}
      <div style={{
        background: "#1e1e2e",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "32px 36px",
        fontFamily: "monospace",
        color: "#cdd6f4",
        fontSize: 14,
        lineHeight: 2,
        boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
      }}>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Screen share — Q2 Planning</div>
        <div>Resources for today&apos;s meeting:</div>
        <div style={{ color: "#60a5fa" }}>→ figma.com/file/prototype-v2</div>
        <div style={{ color: "#60a5fa" }}>→ docs.google.com/presentation/d/1xZ</div>
        <div style={{ marginTop: 8 }}>Q2 Review: <span style={{ color: "#fbbf24" }}>April 10th, 2:30–3:30 PM</span></div>
        <div>Contact: <span style={{ color: "#22d3ee" }}>sarah@acme.com</span></div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, background: "#fff", borderRadius: 4,
            display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: 4,
          }}>
            {Array.from({ length: 49 }).map((_, i) => (
              <div key={i} style={{ background: [0,1,2,7,14,21,28,35,42,43,44,6,13,20,27,34,41,48,8,10,12,36,38,40,24].includes(i) ? "#000" : "#fff", borderRadius: 1 }} />
            ))}
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Scan to book a call</span>
        </div>
      </div>

      {/* Floating overlay panel */}
      <div style={{ position: "absolute", top: 16, right: -20, zIndex: 10 }}>
        <DemoPanel />
      </div>
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", background: "rgba(59,130,246,0.15)",
        border: "1px solid rgba(59,130,246,0.35)", color: "#60a5fa",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, color: "#fff", marginBottom: 2 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

// ── Feature pill ──────────────────────────────────────────────────────────────

function Feature({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "16px 20px",
    }}>
      <div style={{ color, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  return (
    <main style={{ background: "#0a0a0a", color: "#fff", fontFamily: font, minHeight: "100vh" }}>

      <NavBar />

      {/* Hero */}
      <section style={{ padding: "96px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 340px", minWidth: 280 }}>
            <div style={{
              display: "inline-block", background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa",
              fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
              marginBottom: 20, letterSpacing: "0.04em",
            }}>
              Chrome Extension
            </div>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 20 }}>
              Every link in your<br />
              <span style={{ color: "#60a5fa" }}>screen share</span>,<br />
              instantly clickable.
            </h1>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 17, lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
              Overlink reads URLs, QR codes, emails, and calendar events directly from your Google Meet screen share — no copy-pasting, no pausing the meeting.
            </p>
            <HeroCTA />
          </div>

          {/* Demo mockup */}
          <div style={{ flex: "1 1 400px", display: "flex", justifyContent: "center", paddingRight: 40 }}>
            <MeetingMockup />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "80px 40px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>How it works</h2>
          <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 40, fontSize: 15 }}>Zero setup. Just install and join a meeting.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <Step n="1" title="Install the extension" desc="Add Overlink to Chrome in one click. No account required to get started." />
            <Step n="2" title="Join a Google Meet" desc="Overlink automatically activates when a screen share is detected in your meeting." />
            <Step n="3" title="Links appear instantly" desc="A floating panel shows every URL, QR code, email, and phone number visible on the shared screen — all clickable." />
            <Step n="4" title="Pro: smart extraction" desc="With a Pro account, Overlink uses AI to detect calendar events and contacts, letting you add them directly to Google Calendar or save as a contact." />
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "80px 40px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>What gets detected</h2>
          <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 40, fontSize: 15 }}>Everything that&apos;s visible on screen, structured and actionable.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <Feature color="#60a5fa" label="URLs" desc="Plain links, with or without https. Opens in a new tab instantly." />
            <Feature color="#34d399" label="QR Codes" desc="Decoded in real time from the video frame, even through WebRTC compression." />
            <Feature color="#c084fc" label="Emails" desc="Click to open your mail client with the address pre-filled." />
            <Feature color="#fb923c" label="Phone numbers" desc="International formats detected and formatted. Tap to call." />
            <Feature color="#fbbf24" label="Events (Pro)" desc="Meeting titles, dates, and times extracted and added to Google Calendar in one click." />
            <Feature color="#22d3ee" label="Contacts (Pro)" desc="Names, roles, emails, and phone numbers saved as a .vcf contact file." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "80px 40px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Pricing</h2>
          <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 40, fontSize: 15 }}>Free forever for the essentials. Pro for the full experience.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Free */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "28px 24px",
            }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Free</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>$0</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>No account needed</div>
              {["URL detection", "QR code scanning", "Email detection", "Phone number detection", "Floating overlay panel"].map(f => (
                <div key={f} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  <span style={{ color: "#34d399" }}>✓</span> {f}
                </div>
              ))}
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", marginTop: 20, textAlign: "center",
                  padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 14, fontWeight: 600,
                }}
              >
                Add to Chrome
              </a>
            </div>

            {/* Pro */}
            <div style={{
              background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 12, padding: "28px 24px", position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -12, right: 16,
                background: "#3b82f6", color: "#fff", fontSize: 11, fontWeight: 700,
                padding: "3px 10px", borderRadius: 99,
              }}>POPULAR</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Pro</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>$5<span style={{ fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>/mo</span></div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>Everything in Free, plus:</div>
              {["AI event extraction", "Google Calendar integration", "AI contact extraction", "Save contacts as .vcf", "Web app dashboard (coming soon)", "Up to 1,000 AI extractions/mo"].map(f => (
                <div key={f} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                  <span style={{ color: "#60a5fa" }}>✓</span> {f}
                </div>
              ))}
              <Link href="/login" style={{
                display: "block", marginTop: 20, textAlign: "center",
                padding: "10px", borderRadius: 8, background: "#3b82f6",
                color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
              }}>
                Get Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Overlink</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>Sign in</Link>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>Create account</Link>
        </div>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>© 2026 Overlink. All rights reserved.</span>
      </footer>

    </main>
  );
}
