const INTERVALS = [
  { label: "1s",  ms: 1_000 },
  { label: "3s",  ms: 3_000 },
  { label: "5s",  ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
];

const DEFAULT_MS = 5_000;

// ── Auth state rendering ──────────────────────────────────────────────────────

const API_BASE = "https://overlink-web.vercel.app";

async function fetchPlan(token: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/user/plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { plan } = await res.json();
      await chrome.storage.sync.set({ userPlan: plan });
      return plan;
    }
  } catch { /* network unavailable */ }
  return "free";
}

async function renderAuthSection(): Promise<void> {
  const { authToken, userEmail } =
    await chrome.storage.sync.get(["authToken", "userEmail"]);

  const userPlan = authToken ? await fetchPlan(authToken) : "free";

  const section = document.getElementById("auth-section")!;
  section.innerHTML = "";

  if (!authToken) {
    // Logged out
    const btn = document.createElement("button");
    btn.textContent = "Sign in for Pro";
    btn.className = "auth-btn";
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
    });
    section.appendChild(btn);
    return;
  }

  // Logged in — show email
  const emailSpan = document.createElement("span");
  emailSpan.className = "auth-email";
  emailSpan.textContent = userEmail ?? "Signed in";
  section.appendChild(emailSpan);

  if (userPlan === "pro") {
    // Pro badge
    const badge = document.createElement("span");
    badge.className = "badge-pro";
    badge.textContent = "Pro";
    section.appendChild(badge);
  } else {
    // Upgrade button
    const btn = document.createElement("button");
    btn.textContent = "Upgrade to Pro";
    btn.className = "auth-btn upgrade";
    btn.style.flex = "none";
    btn.style.width = "auto";
    btn.style.padding = "4px 10px";
    btn.style.fontSize = "11px";
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_CHECKOUT" });
    });
    section.appendChild(btn);
  }
}

// ── Poll interval buttons ─────────────────────────────────────────────────────

async function init(): Promise<void> {
  await renderAuthSection();

  const { pollInterval = DEFAULT_MS } =
    await chrome.storage.sync.get("pollInterval");

  const container = document.getElementById("options")!;

  for (const { label, ms } of INTERVALS) {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (ms === pollInterval) btn.classList.add("active");

    btn.addEventListener("click", async () => {
      await chrome.storage.sync.set({ pollInterval: ms });
      container
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });

    container.appendChild(btn);
  }
}

init();
