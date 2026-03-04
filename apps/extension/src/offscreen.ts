/**
 * Overlink — Offscreen Document
 *
 * Runs entirely inside the extension's own origin (chrome-extension://).
 * No Trusted Types CSP from meet.google.com applies here.
 *
 * Responsibilities:
 *   - Own the long-lived tesseract.js Worker
 *   - Receive PERFORM_OCR messages from the background service worker
 *   - Return extracted URLs + timing back via sendResponse
 */

import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import jsQR from "jsqr";
import { findPhoneNumbersInText } from "libphonenumber-js/min";

const LOG = "[Overlink Offscreen]";

// ── Entity extraction ─────────────────────────────────────────────────────────

// (?<![a-zA-Z0-9@]) on the bare-domain alternative prevents matching substrings
// of larger tokens — e.g. "mail.com" or "ail.com" inside "user@gmail.com".
const URL_PATTERN =
  /(?:https?:\/\/[^\s<>"{}|\\^[\]`]+|www\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+[^\s<>"{}|\\^[\]`]*|(?<![a-zA-Z0-9@])[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:com|org|edu)(?:\/[^\s<>"{}|\\^[\]`]*)?)/gi;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractURLs(text: string): string[] {
  const raw = text.match(URL_PATTERN) ?? [];
  return [...new Set(raw.map((u) => u.replace(/[.,;:!?)\]}>]+$/, "")))];
}

function extractEmails(text: string): string[] {
  const raw = text.match(EMAIL_PATTERN) ?? [];
  return [...new Set(raw)];
}

// libphonenumber-js handles all international formats and free-form text.
// "US" default country parses unqualified numbers like XXX-XXX-XXXX as US numbers;
// numbers with an explicit country code ("+44 ...") are always parsed correctly.
// formatInternational() produces a canonical display string (e.g. "+1 555 123 4567").
function extractPhones(text: string): string[] {
  const found = findPhoneNumbersInText(text, "US");
  return [...new Set(
    found
      .filter((p) => p.number.nationalNumber.length >= 10)
      .map((p) => p.number.formatInternational())
  )];
}

// Remove bare domain URLs (e.g. "mail.com") that are the domain half of an
// email address. Two sources of email domains are checked:
//   1. Fully parsed emails ("user@mail.com" → "mail.com")
//   2. "@domain.tld" fragments in raw text — catches cases where OCR garbled
//      the local part so the full email regex never matched.
// URLs with a path, scheme, or www prefix are kept regardless.
function deduplicateUrlsAgainstEmails(urls: string[], emails: string[], rawText: string): string[] {
  const emailDomains = new Set(
    emails.map((e) => e.split("@")[1]?.toLowerCase()).filter(Boolean)
  );
  const fragments = rawText.match(/@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g) ?? [];
  fragments.forEach((f) => emailDomains.add(f.slice(1).toLowerCase()));

  return urls.filter((u) => {
    const lower = u.toLowerCase();
    if (lower.startsWith("http") || lower.startsWith("www.") || lower.includes("/")) return true;
    return !emailDomains.has(lower);
  });
}

// ── Singleton OCR worker — kept alive for the lifetime of this document ───────

let worker: TesseractWorker | null = null;
let workerInitPromise: Promise<TesseractWorker> | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (worker) return worker;
  // Prevent multiple concurrent createWorker calls
  if (workerInitPromise) return workerInitPromise;

  console.log(`${LOG} Initialising OCR worker…`);
  workerInitPromise = createWorker("eng", 1, {
    workerPath: chrome.runtime.getURL("worker.min.js"),
    corePath: chrome.runtime.getURL("tesseract-core-simd-lstm.wasm.js"),
    // Disable blob wrapper — blob workers can't importScripts from
    // chrome-extension:// URLs. Direct Worker creation bypasses this.
    workerBlobURL: false,
    langPath: chrome.runtime.getURL("lang/"),
    cacheMethod: "none", // lang data is already local, no need to cache in IndexedDB
    logger: (m) => {
      console.log(`${LOG} Worker init:`, m.status, m.progress ?? "");
    },
  }).then(async (w) => {
    // user_defined_dpi: screen captures are 96 DPI, not the 300 DPI Tesseract
    // assumes by default — calibrates character model scaling to actual pixel size.
    // tessedit_pageseg_mode 11 (sparse text): finds text anywhere on the image
    // without assuming a uniform layout — best for mixed screen share content.
    await w.setParameters({
      user_defined_dpi: "96",
      tessedit_pageseg_mode: "11",
    });
    worker = w;
    console.log(`${LOG} OCR worker ready.`);
    return w;
  });

  return workerInitPromise;
}

// ── QR detection ──────────────────────────────────────────────────────────────

// White padding added around the frame on all sides. Ensures QR codes near
// the edge of the video tile always have an adequate quiet zone for jsQR's
// finder pattern detection — required by the QR spec (ISO/IEC 18004).
const QR_PADDING = 32;

function tryJsQR(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  blur: number
): string | null {
  // Fill with white first to establish the quiet zone padding.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  ctx.drawImage(img, QR_PADDING, QR_PADDING);
  ctx.filter = "none";
  const { data, width, height } = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const result = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  return result?.data ?? null;
}

function decodeQR(imageDataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log(`${LOG} QR decode: image ${img.width}×${img.height}`);
      const canvas = document.createElement("canvas");
      canvas.width = img.width + QR_PADDING * 2;
      canvas.height = img.height + QR_PADDING * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve([]); return; }

      // Try progressively stronger blur to counter H.264/VP9 DCT ringing artifacts.
      // Blur smooths module-edge corruption; too much blur merges adjacent modules.
      for (const blur of [0, 1, 2, 3]) {
        const found = tryJsQR(ctx, img, blur);
        if (found !== null) {
          console.log(`${LOG} QR found at blur=${blur}px: ${found}`);
          resolve([found]);
          return;
        }
      }

      console.log(`${LOG} QR codes (0): []`);
      resolve([]);
    };
    img.onerror = () => resolve([]);
    img.src = imageDataUrl;
  });
}

// ── OCR handler ───────────────────────────────────────────────────────────────

async function performOCR(
  imageDataUrl: string
): Promise<{ urls: string[]; qrCodes: string[]; emails: string[]; phones: string[]; text: string; elapsed: number }> {
  const t0 = performance.now();

  const [ocrResult, qrCodes] = await Promise.all([
    getWorker().then((w) => w.recognize(imageDataUrl)),
    decodeQR(imageDataUrl),
  ]);

  const elapsed = performance.now() - t0;
  const text = ocrResult.data.text;

  console.log(`${LOG} OCR done in ${elapsed.toFixed(0)} ms`);
  if (elapsed > 5_000) {
    console.warn(`${LOG} ⚠ OCR exceeded 5 s — consider reducing image resolution.`);
  }
  console.log(`${LOG} Raw text:`, text);

  const emails = extractEmails(text);
  const urls = deduplicateUrlsAgainstEmails(extractURLs(text), emails, text);
  const phones = extractPhones(text);
  console.log(`${LOG} URLs (${urls.length}):`, urls);
  console.log(`${LOG} Emails (${emails.length}):`, emails);
  console.log(`${LOG} Phones (${phones.length}):`, phones);
  return { urls, qrCodes, emails, phones, text, elapsed };
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "PERFORM_OCR") return false;

  console.log(`${LOG} PERFORM_OCR received, starting OCR…`);
  performOCR(message.imageDataUrl)
    .then(sendResponse)
    .catch((err) => {
      console.error(`${LOG} OCR failed:`, err);
      sendResponse({ urls: [], elapsed: 0, error: String(err) });
    });

  return true; // keep message channel open for async response
});

console.log(`${LOG} Ready.`);
