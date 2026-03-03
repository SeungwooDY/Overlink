import { createWorker, type PSM } from "tesseract.js";

const POLL_INTERVAL_MS = 5000;
const MAX_FRAME_WIDTH = 800;
const TARGET_HOST = "meet.google.com";

const urlRegex = /(?:https?:\/\/[^\s]+|www\.[^\s]+|\b[^\s]+\.(?:com|org|edu)\b)/gi;

let activeVideo: HTMLVideoElement | null = null;
let processing = false;
let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

function isMeetPage(): boolean {
  return window.location.hostname === TARGET_HOST;
}

function detectScreenShareVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
  const candidates = videos
    .filter((video) => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
    .filter((video) => video.videoWidth > 0 && video.videoHeight > 0)
    .sort((a, b) => b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight);

  for (const candidate of candidates) {
    const aspectRatio = candidate.videoWidth / candidate.videoHeight;
    const isLikelySlides = aspectRatio > 1.2 && aspectRatio < 2.2;
    if (isLikelySlides) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

function captureFrame(video: HTMLVideoElement): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    console.warn("[Overlink] Failed to acquire 2d canvas context.");
    return null;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    console.error("[Overlink] Canvas tainted — feasibility blocked.", error);
    return null;
  }
}

function downscaleFrame(imageData: ImageData): ImageData {
  if (imageData.width <= MAX_FRAME_WIDTH) {
    return imageData;
  }

  const scale = MAX_FRAME_WIDTH / imageData.width;
  const width = Math.floor(imageData.width * scale);
  const height = Math.floor(imageData.height * scale);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;

  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    return imageData;
  }

  sourceContext.putImageData(imageData, 0, 0);

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = width;
  targetCanvas.height = height;

  const targetContext = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!targetContext) {
    return imageData;
  }

  targetContext.drawImage(sourceCanvas, 0, 0, width, height);
  return targetContext.getImageData(0, 0, width, height);
}

async function getWorker() {
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          console.info("[Overlink] OCR progress", message.progress);
        }
      },
    });

    await ocrWorker.setParameters({
      tessedit_pageseg_mode: "6" as PSM,
    });
  }

  return ocrWorker;
}

function extractUrls(text: string): string[] {
  const matches = text.match(urlRegex) ?? [];
  return Array.from(new Set(matches));
}

function logResourceUsage() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  if (memory) {
    console.info("[Overlink] Memory usage", {
      usedMB: Number((memory.usedJSHeapSize / 1024 / 1024).toFixed(2)),
      totalMB: Number((memory.totalJSHeapSize / 1024 / 1024).toFixed(2)),
    });
  } else {
    console.info("[Overlink] JS memory API unavailable. Use Chrome Task Manager for CPU and memory spikes.");
  }
}

async function runFeasibilityCycle() {
  if (!activeVideo || processing) {
    return;
  }

  processing = true;

  try {
    const rawFrame = captureFrame(activeVideo);
    if (!rawFrame) {
      return;
    }

    const resizedFrame = downscaleFrame(rawFrame);
    const ocrStart = performance.now();
    const worker = await getWorker();
    const result = await worker.recognize(resizedFrame);
    const ocrEnd = performance.now();

    const ocrDurationMs = Number((ocrEnd - ocrStart).toFixed(2));
    console.info("[Overlink] OCR raw text", result.data.text);
    console.info("[Overlink] OCR duration (ms)", ocrDurationMs);

    if (ocrDurationMs > 5000) {
      console.warn("[Overlink] OCR consistently above 5s should trigger feasibility reassessment.");
    }

    const urls = extractUrls(result.data.text);
    console.info("[Overlink] Extracted URLs", urls);

    if (urls.length === 0) {
      console.warn("[Overlink] URLs not detected in this frame; verify readability and OCR quality.");
    }

    logResourceUsage();
  } catch (error) {
    console.error("[Overlink] Feasibility cycle failed.", error);
  } finally {
    processing = false;
  }
}

function monitorMeetVideos() {
  const videos = Array.from(document.querySelectorAll("video"));
  const detected = detectScreenShareVideo(videos);

  if (!detected) {
    activeVideo = null;
    console.info("[Overlink] Waiting for screen-share video element.");
    return;
  }

  if (activeVideo !== detected) {
    activeVideo = detected;
    console.info("[Overlink] Screen-share candidate detected", {
      width: activeVideo.videoWidth,
      height: activeVideo.videoHeight,
      readyState: activeVideo.readyState,
    });
  }
}

function startPhaseOneValidation() {
  if (!isMeetPage()) {
    return;
  }

  console.info("[Overlink] Starting Phase 1 feasibility loop for Google Meet.");
  monitorMeetVideos();
  setInterval(monitorMeetVideos, POLL_INTERVAL_MS);
  setInterval(() => {
    void runFeasibilityCycle();
  }, POLL_INTERVAL_MS);
}

startPhaseOneValidation();
