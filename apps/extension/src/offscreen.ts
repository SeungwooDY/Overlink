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

const LOG = "[Overlink Offscreen]";

// ── URL extraction ────────────────────────────────────────────────────────────

const URL_PATTERN =
  /(?:https?:\/\/[^\s<>"{}|\\^[\]`]+|www\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+[^\s<>"{}|\\^[\]`]*|[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:com|org|edu)(?:\/[^\s<>"{}|\\^[\]`]*)?)/gi;

function extractURLs(text: string): string[] {
  const raw = text.match(URL_PATTERN) ?? [];
  return [...new Set(raw.map((u) => u.replace(/[.,;:!?)\]}>]+$/, "")))];
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
  }).then((w) => {
    worker = w;
    console.log(`${LOG} OCR worker ready.`);
    return w;
  });

  return workerInitPromise;
}

// ── QR detection ──────────────────────────────────────────────────────────────

function tryJsQR(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  blur: number
): string | null {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  ctx.drawImage(img, 0, 0);
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
      canvas.width = img.width;
      canvas.height = img.height;
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
): Promise<{ urls: string[]; qrCodes: string[]; elapsed: number }> {
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

  const urls = extractURLs(text);
  console.log(`${LOG} URLs (${urls.length}):`, urls);
  return { urls, qrCodes, elapsed };
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
