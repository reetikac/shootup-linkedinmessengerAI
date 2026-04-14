/**
 * background.js — service worker
 *
 * 1. Open the side panel when the extension icon is clicked
 * 2. Relay GET_PROFILE:  side panel → content script (inject if needed) → side panel
 * 3. Cache + forward PROFILE_DATA pushed by content.js so an open panel auto-updates
 */

// ── 1. Open side panel on icon click ─────────────────────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ── In-memory cache: tabId → scraped profile object ──────────────────────────
const profileCache = {};

// ── Helper: try to send SCRAPE_PROFILE to the content script ─────────────────
// Returns the profile object on success, null if the content script is not there.
function pingContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PROFILE" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// ── 2 & 3. Message handling ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── Pull: side panel requests profile data ────────────────────────────────
  if (msg.type === "GET_PROFILE") {
    const tabId = msg.tabId;

    // Serve from cache if we have a proactive push already
    if (profileCache[tabId]) {
      sendResponse(profileCache[tabId]);
      return false; // synchronous — no need to keep the channel open
    }

    // Try message-passing first; fall back to programmatic injection if needed
    (async () => {
      let data = await pingContentScript(tabId);

      if (!data) {
        // Content script was never injected (page was open before the extension
        // was installed / enabled, or the manifest match didn't fire yet).
        // Inject content.js programmatically and retry.
        try {
          await chrome.scripting.executeScript({
            target: { tabId, allFrames: false },
            files:  ["content.js"],
          });
          // Give the script ~250 ms to register its message listener
          await new Promise((r) => setTimeout(r, 250));
          data = await pingContentScript(tabId);
        } catch (err) {
          sendResponse({ error: `Injection failed: ${err.message}` });
          return;
        }
      }

      if (data?.name) profileCache[tabId] = data;
      sendResponse(data ?? {});
    })();

    return true; // keep the message channel open for the async sendResponse
  }

  // ── Push: content.js proactively sends scraped data ───────────────────────
  if (msg.type === "PROFILE_DATA" && sender.tab?.id) {
    const tabId = sender.tab.id;
    profileCache[tabId] = msg.data;

    // Write to storage so any open side panel can react via onChanged listener
    chrome.storage.local.set({
      pendingProfileData: { tabId, data: msg.data },
    });

    return false;
  }
});

// ── Cache invalidation ────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  delete profileCache[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // changeInfo.url is set when the URL changes (requires host_permissions match)
  if (changeInfo.url) delete profileCache[tabId];
});
