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

function captureFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
  const w = Math.floor(video.videoWidth * scale);
  const h = Math.floor(video.videoHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, w, h);
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

function positionOverlay(video: HTMLVideoElement): void {
  if (!overlayEl) return;
  const r = video.getBoundingClientRect();
  overlayEl.style.top = `${r.top + 10}px`;
  overlayEl.style.left = `${r.left + 10}px`;
}

function updateOverlay(video: HTMLVideoElement, urls: string[], qrCodes: string[] = []): void {
  if (urls.length === 0 && qrCodes.length === 0) {
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
    ].join(";");

    // Stop clicks on the panel from bubbling to Meet's video tile.
    div.addEventListener("click", (e) => e.stopPropagation());

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

  function appendLink(payload: string, sectionColor: string): void {
    const href = /^https?:\/\//i.test(payload) ? payload : `https://${payload}`;
    const a = document.createElement("a");
    a.href = href;
    a.textContent = payload;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.cssText = `display:block;color:${sectionColor};text-decoration:none;word-break:break-all;`;
    a.addEventListener("mouseover", () => (a.style.textDecoration = "underline"));
    a.addEventListener("mouseout", () => (a.style.textDecoration = "none"));
    overlayEl!.appendChild(a);
  }

  if (urls.length > 0) {
    if (qrCodes.length > 0) {
      const sectionLabel = document.createElement("div");
      sectionLabel.style.cssText =
        "color:rgba(255,255,255,0.3);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin:4px 0 2px;";
      sectionLabel.textContent = "Links";
      overlayEl.appendChild(sectionLabel);
    }
    for (const url of urls) appendLink(url, "#60a5fa");
  }

  if (qrCodes.length > 0) {
    const sectionLabel = document.createElement("div");
    sectionLabel.style.cssText =
      "color:rgba(255,255,255,0.3);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin:4px 0 2px;";
    sectionLabel.textContent = "QR Codes";
    overlayEl.appendChild(sectionLabel);
    for (const code of qrCodes) appendLink(code, "#34d399");
  }

  positionOverlay(video);
}

function removeOverlay(): void {
  overlayEl?.remove();
  overlayEl = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  overlayVideo = null;
}

// ── 5. Main pipeline ──────────────────────────────────────────────────────────

let ocrRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

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
    })) as { urls: string[]; qrCodes: string[]; elapsed: number; error?: string };

    if (response?.error) {
      console.error(`${LOG} OCR error:`, response.error);
      return;
    }

    console.log(`${LOG} ══ Result (${response.elapsed.toFixed(0)} ms) ══`);
    console.log(`${LOG}   URLs found: ${response.urls.length}`);
    response.urls.forEach((u, i) => console.log(`${LOG}   [${i + 1}] ${u}`));
    console.log(`${LOG}   QR codes found: ${response.qrCodes.length}`);
    response.qrCodes.forEach((q, i) => console.log(`${LOG}   [QR ${i + 1}] ${q}`));

    updateOverlay(video, response.urls, response.qrCodes);
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
