/**
 * Overlink — Background Service Worker
 *
 * Responsibilities:
 *   - Create and maintain the offscreen document (OCR processor)
 *   - Route RUN_OCR requests from content scripts → offscreen document
 *   - Store auth token forwarded from auth-bridge content script
 *   - Proxy RUN_EXTRACT to the web app /api/extract endpoint
 *   - Open Stripe checkout tab on OPEN_CHECKOUT
 */

const LOG = "[Overlink Background]";
const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");
const OCR_TIMEOUT_MS = 60_000; // lang data CDN download can be slow on first run
const API_BASE = "http://localhost:3000";

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

// ── Auth token helpers ────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const { authToken } = await chrome.storage.sync.get("authToken");
  return authToken ?? null;
}

// ── Message routing ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "RUN_OCR") {
    console.log(`${LOG} RUN_OCR received from content script.`);

    ensureOffscreenDocument()
      .then(() => sendToOffscreen(message.imageDataUrl))
      .then(sendResponse)
      .catch((err) => {
        console.error(`${LOG} OCR relay failed:`, err);
        sendResponse({ urls: [], elapsed: 0, error: String(err) });
      });

    return true; // keep channel open for async response
  }

  if (message.type === "SET_AUTH_TOKEN") {
    const token: string | null = message.token;
    const email: string | null = message.email ?? null;
    console.log(`${LOG} SET_AUTH_TOKEN: ${token ? "storing" : "removing"}`);
    if (token) {
      chrome.storage.sync.set({ authToken: token, userEmail: email ?? "" });
    } else {
      chrome.storage.sync.remove(["authToken", "userEmail", "userPlan"]);
    }
    return false;
  }

  if (message.type === "RUN_EXTRACT") {
    console.log(`${LOG} RUN_EXTRACT received.`);

    getAuthToken()
      .then(async (token) => {
        if (!token) {
          sendResponse({ error: "Not authenticated" });
          return;
        }
        const res = await fetch(`${API_BASE}/api/extract`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: message.text }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          sendResponse({ error: body.error ?? `HTTP ${res.status}` });
          return;
        }
        const data = await res.json();
        sendResponse(data);
      })
      .catch((err) => {
        console.error(`${LOG} RUN_EXTRACT failed:`, err);
        sendResponse({ error: String(err) });
      });

    return true;
  }

  if (message.type === "OPEN_CHECKOUT") {
    console.log(`${LOG} OPEN_CHECKOUT received.`);

    getAuthToken()
      .then(async (token) => {
        if (!token) {
          chrome.tabs.create({ url: `${API_BASE}/login` });
          sendResponse({ ok: false, error: "Not authenticated" });
          return;
        }
        const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { url } = await res.json();
          if (url) chrome.tabs.create({ url });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: `HTTP ${res.status}` });
        }
      })
      .catch((err) => {
        console.error(`${LOG} OPEN_CHECKOUT failed:`, err);
        sendResponse({ ok: false, error: String(err) });
      });

    return true;
  }

  if (message.type === "OPEN_LOGIN") {
    chrome.tabs.create({ url: `${API_BASE}/login` });
    return false;
  }

  return false;
});
