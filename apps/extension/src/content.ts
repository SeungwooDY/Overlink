/**
 * Overlink — Content Script (Phase 1)
 *
 * Responsibilities:
 *   1. Detect the screen-share <video> element in Google Meet
 *   2. Capture frames at a throttled interval
 *   3. Skip OCR when the frame hasn't changed (perceptual hash)
 *   4. Send the frame to the background service worker for OCR
 *   5. Log extracted URLs
 *
 * No OCR runs here — avoids Google Meet's Trusted Types CSP entirely.
 */

const LOG = "[Overlink]";
const POLL_INTERVAL_MS = 5_000;
const FRAME_MAX_WIDTH = 800;

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

  // Sort by rendered CSS area — the screen-share tile is always the largest
  // element on the page; webcam tiles are smaller regardless of stream resolution.
  candidates.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return rb.width * rb.height - ra.width * ra.height;
  });

  const pick = candidates[0];
  const r = pick.getBoundingClientRect();

  // Require the selected tile to occupy at least 30% of the viewport width.
  // Screen-share tiles in spotlight/presentation mode are always large; webcam
  // strip thumbnails and self-view previews are much smaller. This also handles
  // the case where one video has zero rendered area (hidden/off-screen) which
  // would otherwise cause a dominance ratio of infinity and fall through.
  if (r.width < window.innerWidth * 0.3) {
    console.log(
      `${LOG} Largest video rendered at ${Math.round(r.width)}px — below 30% viewport threshold, skipping OCR.`
    );
    return null;
  }
  console.log(
    `${LOG} Video: ${pick.videoWidth}×${pick.videoHeight} rendered ${Math.round(r.width)}×${Math.round(r.height)} (${candidates.length} candidate${candidates.length !== 1 ? "s" : ""})`
  );
  return pick;
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

// ── 3. Perceptual hash (change detection) ────────────────────────────────────

function frameHash(canvas: HTMLCanvasElement): string {
  const W = 16,
    H = 9;
  const thumb = document.createElement("canvas");
  thumb.width = W;
  thumb.height = H;
  const ctx = thumb.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  let hash = "";
  for (let i = 0; i < W * H; i++) {
    const luma = Math.round(
      (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 16
    );
    hash += luma.toString(16);
  }
  return hash;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

let lastHash = "";
let ocrRunning = false;

async function runPipeline(): Promise<void> {
  if (ocrRunning) return;

  const video = findScreenShareVideo();
  if (!video) return;

  const canvas = captureFrame(video);
  if (!canvas) return;

  const hash = frameHash(canvas);
  if (hash === lastHash) {
    console.log(`${LOG} Frame unchanged — skipping OCR.`);
    return;
  }
  lastHash = hash;
  ocrRunning = true;

  try {
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    console.log(`${LOG} Sending frame for OCR (${Math.round(imageDataUrl.length / 1024)} KB)…`);

    const response = (await chrome.runtime.sendMessage({
      type: "RUN_OCR",
      imageDataUrl,
    })) as { urls: string[]; elapsed: number; error?: string };

    if (response?.error) {
      console.error(`${LOG} OCR error:`, response.error);
      return;
    }

    console.log(`${LOG} ══ Result (${response.elapsed.toFixed(0)} ms) ══`);
    console.log(`${LOG}   URLs found: ${response.urls.length}`);
    response.urls.forEach((u, i) => console.log(`${LOG}   [${i + 1}] ${u}`));
  } catch (err) {
    console.error(`${LOG} sendMessage failed:`, err);
  } finally {
    ocrRunning = false;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  console.log(`${LOG} Phase 1 loaded. Waiting for Meet to initialise…`);
  await new Promise<void>((r) => setTimeout(r, 3_000));

  console.log(`${LOG} Polling every ${POLL_INTERVAL_MS / 1000} s.`);
  setInterval(runPipeline, POLL_INTERVAL_MS);
  runPipeline();
}

boot();
