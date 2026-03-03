console.info("[Overlink] Background service worker loaded.");

chrome.runtime.onInstalled.addListener(() => {
  console.info("[Overlink] Extension installed for Phase 1 feasibility validation.");
});
