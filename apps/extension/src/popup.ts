const INTERVALS = [
  { label: "1s",  ms: 1_000 },
  { label: "3s",  ms: 3_000 },
  { label: "5s",  ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
];

const DEFAULT_MS = 5_000;

async function init(): Promise<void> {
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
