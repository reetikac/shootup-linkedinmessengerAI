/**
 * content.js — LinkedIn profile scraper
 * Runs on: https://www.linkedin.com/in/*
 *
 * Wrapped in an IIFE so re-injection via chrome.scripting.executeScript is safe:
 *  - The message listener is only registered ONCE (window.__liOutreachActive flag)
 *  - broadcastProfile() runs on every injection so fresh data reaches the panel
 *  - A MutationObserver watches for LinkedIn SPA URL changes between profiles
 */
(function () {

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Return trimmed innerText of the first matching selector, or "". */
  function pick(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const t = (el.innerText || el.textContent || "").trim();
          if (t) return t;
        }
      } catch (_) {}
    }
    return "";
  }

  /** Like pick(), but walks all matches for each selector. */
  function pickAll(selectors) {
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const t = (el.innerText || el.textContent || "").trim();
          if (t) return t;
        }
      } catch (_) {}
    }
    return "";
  }

  // ── Field extractors ─────────────────────────────────────────────────────────

  function getName() {
    return pick([
      "h1.text-heading-xlarge",   // 2023-2025 authenticated view
      ".top-card-layout__title",  // public / logged-out view
      "h1",
    ]);
  }

  function getHeadline() {
    // Preferred: element that immediately follows the h1 inside the intro card
    try {
      const h1 = document.querySelector("h1.text-heading-xlarge, h1");
      if (h1) {
        let sib = h1.parentElement?.nextElementSibling;
        while (sib) {
          if (sib.classList.contains("text-body-medium")) {
            const t = (sib.innerText || sib.textContent || "").trim();
            if (t) return t;
          }
          const child = sib.querySelector(".text-body-medium.break-words, .text-body-medium");
          if (child) {
            const t = (child.innerText || child.textContent || "").trim();
            if (t) return t;
          }
          sib = sib.nextElementSibling;
        }
      }
    } catch (_) {}

    return pick([
      ".text-body-medium.break-words",
      ".top-card-layout__headline",
      ".pv-text-details__left-panel .text-body-medium",
    ]);
  }

  function getCompany() {
    // 1. Experience section — first item = current/most recent role
    try {
      const expAnchor = document.getElementById("experience");
      if (expAnchor) {
        const wrapper = expAnchor.closest("section") ?? expAnchor.parentElement;
        const listContainer =
          wrapper?.nextElementSibling ??
          wrapper?.querySelector(".pvs-list__container");

        if (listContainer) {
          const firstItem = listContainer.querySelector(
            "li.pvs-list__item--line-separated, li.pvs-list__item, li"
          );
          if (firstItem) {
            // aria-hidden spans: [0]=title, [1]="Company · type", [2]=dates
            const spans = Array.from(
              firstItem.querySelectorAll("span[aria-hidden='true']")
            )
              .map((s) => s.textContent.trim())
              .filter(Boolean);

            if (spans.length >= 2) {
              return spans[1].split("·")[0].trim();
            }
          }
        }
      }
    } catch (_) {}

    // 2. Top-card subtitle ("Company · Location")
    const subtitle = pick([
      ".top-card-layout__first-subline",
      ".pv-text-details__right-panel-item-text",
      ".top-card__subline-text",
    ]);
    if (subtitle) return subtitle.split("·")[0].trim();

    // 3. Parse "at Company" from headline
    const headline = getHeadline();
    if (headline) {
      const m = headline.match(/\bat\s+([^·|•,\n]+)/i);
      if (m) return m[1].trim();
    }

    return "";
  }

  function getAbout() {
    const raw = pickAll([
      "#about ~ .display-flex span[aria-hidden='true']",
      "section:has(#about) .pv-shared-text-with-see-more span[aria-hidden='true']",
      "#about + div span[aria-hidden='true']",
      ".pv-about__summary-text",
      ".pv-about-section .pv-about__summary-text",
      "[data-generated-suggestion-target] span[aria-hidden='true']",
    ]);

    if (!raw) return "";
    return raw.length > 300 ? raw.slice(0, 300) + "…" : raw;
  }

  function scrapeProfile() {
    return {
      name:     getName(),
      headline: getHeadline(),
      company:  getCompany(),
      about:    getAbout(),
    };
  }

  // ── Broadcast ────────────────────────────────────────────────────────────────
  // Sends scraped data to background.js, which caches it and notifies the panel.

  function broadcastProfile() {
    const data = scrapeProfile();
    if (data.name) {
      chrome.runtime.sendMessage({ type: "PROFILE_DATA", data }).catch(() => {
        // Background not ready yet — the pull model (SCRAPE_PROFILE) covers this
      });
    }
  }

  // ── Reactive listener (register only once per page) ──────────────────────────
  if (!window.__liOutreachActive) {
    window.__liOutreachActive = true;

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === "SCRAPE_PROFILE") {
        sendResponse(scrapeProfile());
      }
      return true;
    });

    // ── SPA navigation observer ────────────────────────────────────────────
    // LinkedIn is a React SPA: navigating between profiles changes the URL
    // without a page reload, so the `load` event never fires again.
    // A MutationObserver watching the document body catches these transitions.
    let _lastUrl = location.href;

    const _navObserver = new MutationObserver(() => {
      if (location.href !== _lastUrl) {
        _lastUrl = location.href;
        if (/linkedin\.com\/in\//.test(location.href)) {
          // Wait for React to render the new profile before scraping
          setTimeout(broadcastProfile, 1200);
        }
      }
    });

    _navObserver.observe(document.body, { subtree: true, childList: true });
  }

  // ── Initial broadcast ────────────────────────────────────────────────────────
  // Runs on every injection (including programmatic re-injection via executeScript)
  // so the panel always gets fresh data immediately.
  if (document.readyState === "complete") {
    setTimeout(broadcastProfile, 1500);
  } else {
    window.addEventListener("load", () => setTimeout(broadcastProfile, 1500));
  }

})(); // end IIFE
