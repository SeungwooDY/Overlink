// ── Google Calendar URL builder ───────────────────────────────────────────────

interface EventData {
  title?: string;
  date?: string;
  time?: string;
  end_time?: string;
  description?: string;
  location?: string;
}

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

export function buildGcalUrl(data: EventData): string {
  let datesParam = "";
  if (data.date) {
    const d = data.date.replace(/-/g, "");
    if (data.time) {
      const { hh, mm } = parseTimeTo24h(data.time);
      let endHH: string, endMM: string;
      if (data.end_time) {
        const parsed = parseTimeTo24h(data.end_time);
        endHH = parsed.hh;
        endMM = parsed.mm;
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

// ── vCard download ─────────────────────────────────────────────────────────────

interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
}

export function downloadVCard(data: ContactData): void {
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    data.name ? `FN:${data.name}` : "",
    data.email ? `EMAIL:${data.email}` : "",
    data.phone ? `TEL:${data.phone}` : "",
    data.company ? `ORG:${data.company}` : "",
    data.role ? `TITLE:${data.role}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
  const blob = new Blob([vcf], { type: "text/vcard" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${data.name ?? "contact"}.vcf`;
  a.click();
  URL.revokeObjectURL(a.href);
}
