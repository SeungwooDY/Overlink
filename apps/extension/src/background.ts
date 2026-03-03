/**
 * Overlink — Background Service Worker
 *
 * Responsibilities:
 *   - Create and maintain the offscreen document (OCR processor)
 *   - Route RUN_OCR requests from content scripts → offscreen document
 *   - Route results back to the calling content script
 */

const LOG = "[Overlink Background]";
const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");
const OCR_TIMEOUT_MS = 60_000; // lang data CDN download can be slow on first run

console.log(`${LOG} Service worker started.`);

self.addEventListener("install", () => {
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

// ── Offscreen document lifecycle ──────────────────────────────────────────────

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [OFFSCREEN_URL],
  });

  if (contexts.length > 0) {
    console.log(`${LOG} Offscreen document already exists.`);
    return;
  }

  console.log(`${LOG} Creating offscreen document…`);
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification:
      "Run tesseract.js OCR in a Web Worker free from the page's Trusted Types CSP",
  });
  console.log(`${LOG} Offscreen document created.`);
}

// ── Relay to offscreen with timeout + lastError check ────────────────────────

function sendToOffscreen(imageDataUrl: string): Promise<{ urls: string[]; elapsed: number; error?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Offscreen did not respond within ${OCR_TIMEOUT_MS / 1000}s`)),
      OCR_TIMEOUT_MS
    );

    console.log(`${LOG} Sending PERFORM_OCR to offscreen…`);
    chrome.runtime.sendMessage(
      { type: "PERFORM_OCR", imageDataUrl },
      (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log(`${LOG} Got response from offscreen:`, response);
          resolve(response);
        }
      }
    );
  });
}

// ── Message routing ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "RUN_OCR") return false;

  console.log(`${LOG} RUN_OCR received from content script.`);

  ensureOffscreenDocument()
    .then(() => sendToOffscreen(message.imageDataUrl))
    .then(sendResponse)
    .catch((err) => {
      console.error(`${LOG} OCR relay failed:`, err);
      sendResponse({ urls: [], elapsed: 0, error: String(err) });
    });

  return true; // keep channel open for async response
});
