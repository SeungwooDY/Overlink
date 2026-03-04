/**
 * Overlink — Content Script
 *
 * Responsibilities:
 *   1. Detect the screen-share <video> element in Google Meet
 *   2. Capture frames at a throttled interval
 *   3. Skip OCR when the frame hasn't changed (perceptual hash)
 *   4. Send the frame to the background service worker for OCR
 *   5. Render a floating overlay panel with clickable detected URLs
 *
 * No OCR runs here — avoids Google Meet's Trusted Types CSP entirely.
 */

const LOG = "[Overlink]";
const DEFAULT_POLL_MS = 5_000;
const FRAME_MAX_WIDTH = 1920;
const DOMINANCE_RATIO = 3;        // Layer 2: top video must be 3× area of second
const MIN_INTRINSIC_WIDTH = 1280; // Layer 3: minimum screen-res width
const MIN_RENDERED_PX = 200;      // sanity: skip hidden / collapsed video elements

// ── 1. Video detection ────────────────────────────────────────────────────────

function findScreenShareVideo(): HTMLVideoElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video")
  ).filter(
    (v) =>
      v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      v.videoWidth > 0 &&
      v.videoHeight > 0 &&
      !v.paused &&
      !v.ended
  );

  if (candidates.length === 0) return null;

  // Layer 1: contentHint — "detail" / "text" = screen capture; "motion" / "" = webcam
  for (const v of candidates) {
    const hint = (v.srcObject as MediaStream | null)
      ?.getVideoTracks()[0]?.contentHint;
    if (hint === "detail" || hint === "text") {
      console.log(`${LOG} Screen share detected via contentHint="${hint}" (${v.videoWidth}×${v.videoHeight})`);
      return v;
    }
  }

  // Layer 2: dominance ratio — screen share tile rendered >> webcam thumbnails
  const sorted = [...candidates].sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return rb.width * rb.height - ra.width * ra.height;
  });

  const pick = sorted[0];
  const rPick = pick.getBoundingClientRect();

  if (rPick.width < MIN_RENDERED_PX) {
    console.log(`${LOG} Largest video too small (${Math.round(rPick.width)}px), skipping.`);
    return null;
  }

  if (sorted.length >= 2) {
    const rSecond = sorted[1].getBoundingClientRect();
    const pickArea = rPick.width * rPick.height;
    const secondArea = rSecond.width * rSecond.height;
    const ratio = secondArea > 0 ? pickArea / secondArea : Infinity;

    if (ratio >= DOMINANCE_RATIO) {
      console.log(
        `${LOG} Screen share via dominance ratio (${ratio.toFixed(1)}×): ` +
        `${pick.videoWidth}×${pick.videoHeight} rendered ${Math.round(rPick.width)}×${Math.round(rPick.height)}`
      );
      return pick;
    }

    console.log(`${LOG} No dominant video (ratio ${ratio.toFixed(1)}× < ${DOMINANCE_RATIO}×), skipping OCR.`);
    return null;
  }

  // Layer 3: single video — require screen-level intrinsic resolution
  if (pick.videoWidth >= MIN_INTRINSIC_WIDTH) {
    console.log(`${LOG} Single video at ${pick.videoWidth}×${pick.videoHeight}, treating as screen share.`);
    return pick;
  }

  console.log(`${LOG} Single video ${pick.videoWidth}×${pick.videoHeight} below intrinsic resolution floor, skipping.`);
  return null;
}

// ── 2. Frame capture + downscaling ───────────────────────────────────────────

// White padding around the frame gives Tesseract and jsQR context for content
// that sits at the very edge of the video tile.
const FRAME_PADDING = 32;

function captureFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
  const w = Math.floor(video.videoWidth * scale);
  const h = Math.floor(video.videoHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w + FRAME_PADDING * 2;
  canvas.height = h + FRAME_PADDING * 2;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    // White background for the padding area.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Contrast boost counters WebRTC compression softening small text edges.
    ctx.filter = "contrast(1.4)";
    ctx.drawImage(video, FRAME_PADDING, FRAME_PADDING, w, h);
    ctx.filter = "none";
    ctx.getImageData(0, 0, 1, 1); // throws SecurityError if cross-origin
    console.log(`${LOG} Frame captured: ${w}×${h} (scale ${scale.toFixed(2)})`);
    return canvas;
  } catch (err) {
    console.error(
      `${LOG} ⛔ Canvas tainted — pixel access blocked.\n` +
        "Screen-share video is cross-origin. Phase 1 hard gate hit.",
      err
    );
    return null;
  }
}


// ── 4. Overlay ────────────────────────────────────────────────────────────────

let overlayEl: HTMLDivElement | null = null;
let overlayVideo: HTMLVideoElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let userMovedOverlay = false;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

function positionOverlay(video: HTMLVideoElement): void {
  if (!overlayEl || userMovedOverlay) return;
  const r = video.getBoundingClientRect();
  overlayEl.style.top = `${r.top + 10}px`;
  overlayEl.style.left = `${r.left + 10}px`;
}

interface CalendarEvent {
  title?: string;
  date?: string;
  time?: string;
  end_time?: string;
  timezone?: string;
  location?: string;
  description?: string;
}

interface Contact {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
}

function updateOverlay(
  video: HTMLVideoElement,
  urls: string[],
  qrCodes: string[] = [],
  emails: string[] = [],
  phones: string[] = [],
  events: CalendarEvent[] = [],
  contacts: Contact[] = []
): void {
  if (
    urls.length === 0 &&
    qrCodes.length === 0 &&
    emails.length === 0 &&
    phones.length === 0 &&
    events.length === 0 &&
    contacts.length === 0
  ) {
    removeOverlay();
    return;
  }

  // If the video element changed (e.g. Meet rebuilt the tile), reset.
  if (overlayVideo && overlayVideo !== video) {
    removeOverlay();
  }

  // Create the panel on first use.
  if (!overlayEl) {
    const div = document.createElement("div");
    div.setAttribute("data-overlink", "1");
    div.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "background:rgba(15,15,15,0.88)",
      "backdrop-filter:blur(8px)",
      "-webkit-backdrop-filter:blur(8px)",
      "border:1px solid rgba(255,255,255,0.12)",
      "border-radius:10px",
      "padding:8px 12px",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "font-size:13px",
      "line-height:1.6",
      "max-width:300px",
      "box-shadow:0 4px 24px rgba(0,0,0,0.5)",
      "pointer-events:auto",
      "user-select:none",
      "cursor:move",
    ].join(";");

    // Stop clicks on the panel from bubbling to Meet's video tile.
    div.addEventListener("click", (e) => e.stopPropagation());

    // Drag to reposition — skip if the user clicked a link.
    div.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).tagName === "A") return;
      isDragging = true;
      const rect = div.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.body.appendChild(div);
    overlayEl = div;
    overlayVideo = video;

    // Reposition immediately when the video element resizes.
    resizeObserver = new ResizeObserver(() => positionOverlay(video));
    resizeObserver.observe(video);
  }

  // Rebuild link list.
  overlayEl.innerHTML = "";

  const header = document.createElement("div");
  header.style.cssText =
    "color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;";
  header.textContent = "Overlink";
  overlayEl.appendChild(header);

  const sectionLabelCss =
    "color:rgba(255,255,255,0.3);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin:4px 0 2px;";
  const totalSections = [urls, qrCodes, emails, phones, events, contacts].filter((a) => a.length > 0).length;

  function appendSectionLabel(text: string): void {
    if (totalSections <= 1) return; // no label needed when only one section
    const el = document.createElement("div");
    el.style.cssText = sectionLabelCss;
    el.textContent = text;
    overlayEl!.appendChild(el);
  }

  function appendLink(payload: string, color: string): void {
    const href = /^https?:\/\//i.test(payload) ? payload : `https://${payload}`;
    const a = document.createElement("a");
    a.href = href;
    a.textContent = payload;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.cssText = `display:block;color:${color};text-decoration:none;word-break:break-all;`;
    a.addEventListener("mouseover", () => (a.style.textDecoration = "underline"));
    a.addEventListener("mouseout", () => (a.style.textDecoration = "none"));
    overlayEl!.appendChild(a);
  }

  function appendEntityRow(label: string, href: string, actionText: string, color: string): void {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:1px 0;";

    const span = document.createElement("span");
    span.textContent = label;
    span.style.cssText = `color:${color};word-break:break-all;flex:1;min-width:0;`;

    const btn = document.createElement("a");
    btn.href = href;
    btn.textContent = actionText;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.style.cssText =
      "color:rgba(255,255,255,0.45);font-size:10px;text-transform:uppercase;letter-spacing:0.05em;" +
      "text-decoration:none;white-space:nowrap;border:1px solid rgba(255,255,255,0.18);" +
      "padding:1px 5px;border-radius:4px;flex-shrink:0;";
    btn.addEventListener("mouseover", () => (btn.style.color = "rgba(255,255,255,0.85)"));
    btn.addEventListener("mouseout", () => (btn.style.color = "rgba(255,255,255,0.45)"));

    row.appendChild(span);
    row.appendChild(btn);
    overlayEl!.appendChild(row);
  }

  if (urls.length > 0) {
    appendSectionLabel("Links");
    for (const url of urls) appendLink(url, "#60a5fa");
  }

  if (qrCodes.length > 0) {
    appendSectionLabel("QR Codes");
    for (const code of qrCodes) appendLink(code, "#34d399");
  }

  if (emails.length > 0) {
    appendSectionLabel("Emails");
    for (const email of emails) appendEntityRow(email, `mailto:${email}`, "Compose", "#c084fc");
  }

  if (phones.length > 0) {
    appendSectionLabel("Phones");
    for (const phone of phones) appendEntityRow(phone, `tel:${phone.replace(/\s/g, "")}`, "Call", "#fb923c");
  }

  if (events.length > 0) {
    appendSectionLabel("Events");
    for (const ev of events) {
      const timeRange = ev.time
        ? ev.end_time ? `${ev.time} – ${ev.end_time}` : ev.time
        : "";
      const label = [ev.title, [ev.date, timeRange].filter(Boolean).join(" "), ev.location ? `@ ${ev.location}` : ""].filter(Boolean).join(" — ");

      // Parse time string (handles "9:00 AM", "14:30", "3pm", etc.) → "HH MM SS"
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

      // Build start/end datetime strings for Google Calendar (YYYYMMDDTHHMMSS)
      let datesParam = "";
      if (ev.date) {
        const d = ev.date.replace(/-/g, "");
        if (ev.time) {
          const { hh, mm } = parseTimeTo24h(ev.time);
          let endHH: string, endMM: string;
          if (ev.end_time) {
            const parsed = parseTimeTo24h(ev.end_time);
            endHH = parsed.hh;
            endMM = parsed.mm;
          } else {
            endHH = String((parseInt(hh) + 1) % 24).padStart(2, "0");
            endMM = mm;
          }
          datesParam = `${d}T${hh}${mm}00/${d}T${endHH}${endMM}00`;
        } else {
          // All-day event
          datesParam = `${d}/${d}`;
        }
      }

      const gcalParams = new URLSearchParams({ action: "TEMPLATE" });
      if (ev.title) gcalParams.set("text", ev.title);
      if (datesParam) gcalParams.set("dates", datesParam);
      if (ev.description) gcalParams.set("details", ev.description);
      if (ev.location) gcalParams.set("location", ev.location);
      const gcalUrl = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`;
      appendEntityRow(label || "(event)", gcalUrl, "Add", "#fbbf24");
    }
  }

  if (contacts.length > 0) {
    appendSectionLabel("Contacts");
    for (const c of contacts) {
      const label = [c.name, c.role && c.company ? `${c.role} @ ${c.company}` : c.company ?? c.role].filter(Boolean).join(" · ");
      const subLabel = [c.email, c.phone].filter(Boolean).join(" · ");

      // vCard download button — inline handler
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin:1px 0;";

      const textWrap = document.createElement("div");
      textWrap.style.cssText = "flex:1;min-width:0;";

      const span = document.createElement("span");
      span.textContent = label || "(contact)";
      span.style.cssText = "display:block;color:#22d3ee;word-break:break-all;";
      textWrap.appendChild(span);

      if (subLabel) {
        const sub = document.createElement("span");
        sub.textContent = subLabel;
        sub.style.cssText = "display:block;color:rgba(255,255,255,0.35);font-size:11px;word-break:break-all;";
        textWrap.appendChild(sub);
      }

      const btn = document.createElement("button");
      btn.textContent = "Save";
      btn.style.cssText =
        "color:rgba(255,255,255,0.45);font-size:10px;text-transform:uppercase;letter-spacing:0.05em;" +
        "background:none;border:1px solid rgba(255,255,255,0.18);padding:1px 5px;border-radius:4px;" +
        "cursor:pointer;white-space:nowrap;flex-shrink:0;";
      btn.addEventListener("mouseover", () => (btn.style.color = "rgba(255,255,255,0.85)"));
      btn.addEventListener("mouseout", () => (btn.style.color = "rgba(255,255,255,0.45)"));
      btn.addEventListener("click", () => {
        const vcf = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          c.name ? `FN:${c.name}` : "",
          c.email ? `EMAIL:${c.email}` : "",
          c.phone ? `TEL:${c.phone}` : "",
          c.company ? `ORG:${c.company}` : "",
          c.role ? `TITLE:${c.role}` : "",
          "END:VCARD",
        ]
          .filter(Boolean)
          .join("\n");
        const blob = new Blob([vcf], { type: "text/vcard" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${c.name ?? "contact"}.vcf`;
        a.click();
        URL.revokeObjectURL(a.href);
      });

      row.appendChild(textWrap);
      row.appendChild(btn);
      overlayEl!.appendChild(row);
    }
  }

  positionOverlay(video);
}

function removeOverlay(): void {
  overlayEl?.remove();
  overlayEl = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  overlayVideo = null;
  userMovedOverlay = false;
  lastEvents = [];
  lastContacts = [];
  prevOcrText = "";
}

// ── 5. Main pipeline ──────────────────────────────────────────────────────────

let ocrRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let prevOcrText = "";
let lastExtractTime = 0;
const EXTRACT_COOLDOWN_MS = 10_000;
let lastEvents: CalendarEvent[] = [];
let lastContacts: Contact[] = [];

function startPolling(ms: number): void {
  if (intervalId !== null) clearInterval(intervalId);
  console.log(`${LOG} Polling every ${ms / 1000} s.`);
  intervalId = setInterval(runPipeline, ms);
  runPipeline();
}

async function runPipeline(): Promise<void> {
  if (ocrRunning) return;

  const video = findScreenShareVideo();
  if (!video) {
    removeOverlay();
    return;
  }

  const canvas = captureFrame(video);
  if (!canvas) return;

  ocrRunning = true;

  try {
    const imageDataUrl = canvas.toDataURL("image/png");
    console.log(`${LOG} Sending frame for OCR (${Math.round(imageDataUrl.length / 1024)} KB)…`);

    const response = (await chrome.runtime.sendMessage({
      type: "RUN_OCR",
      imageDataUrl,
    })) as { urls: string[]; qrCodes: string[]; emails: string[]; phones: string[]; text: string; elapsed: number; error?: string };

    if (response?.error) {
      console.error(`${LOG} OCR error:`, response.error);
      return;
    }

    console.log(`${LOG} ══ Result (${response.elapsed.toFixed(0)} ms) ══`);
    console.log(`${LOG}   URLs: ${response.urls.length}, QR: ${response.qrCodes.length}, Emails: ${response.emails.length}, Phones: ${response.phones.length}`);

    const ocrText: string = response.text ?? "";

    const now = Date.now();
    if (
      ocrText &&
      ocrText !== prevOcrText &&
      now - lastExtractTime > EXTRACT_COOLDOWN_MS
    ) {
      prevOcrText = ocrText;
      lastExtractTime = now;

      const { authToken } = await chrome.storage.sync.get("authToken");
      if (authToken) {
        console.log(`${LOG} Sending RUN_EXTRACT…`);
        try {
          const extracted = (await chrome.runtime.sendMessage({
            type: "RUN_EXTRACT",
            text: ocrText,
          })) as { events?: CalendarEvent[]; contacts?: Contact[]; error?: string };

          if (extracted?.error) {
            console.warn(`${LOG} Extract error: ${extracted.error}`);
          } else {
            lastEvents = extracted?.events ?? [];
            lastContacts = extracted?.contacts ?? [];
            console.log(`${LOG} Extracted: ${lastEvents.length} events, ${lastContacts.length} contacts`);
          }
        } catch (err) {
          console.warn(`${LOG} RUN_EXTRACT sendMessage failed:`, err);
        }
      }
    }

    updateOverlay(video, response.urls, response.qrCodes, response.emails, response.phones, lastEvents, lastContacts);
  } catch (err) {
    console.error(`${LOG} sendMessage failed:`, err);
  } finally {
    ocrRunning = false;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  console.log(`${LOG} Loaded. Waiting for Meet to initialise…`);
  await new Promise<void>((r) => setTimeout(r, 3_000));

  // Reposition overlay whenever the viewport resizes.
  window.addEventListener("resize", () => {
    if (overlayVideo) positionOverlay(overlayVideo);
  });

  // Drag move/release — document-level so the cursor can leave the panel.
  document.addEventListener("mousemove", (e) => {
    if (!isDragging || !overlayEl) return;
    overlayEl.style.left = `${e.clientX - dragOffsetX}px`;
    overlayEl.style.top = `${e.clientY - dragOffsetY}px`;
    userMovedOverlay = true;
  });
  document.addEventListener("mouseup", () => { isDragging = false; });

  // Read saved poll interval (falls back to default if never set).
  const { pollInterval = DEFAULT_POLL_MS } =
    await chrome.storage.sync.get("pollInterval");
  startPolling(pollInterval);

  // React to changes made in the popup without reloading the page.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.pollInterval) {
      startPolling(changes.pollInterval.newValue);
    }
  });
}

boot();
