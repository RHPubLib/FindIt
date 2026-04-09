/**
 * FindIt – Show patrons where a book lives on the shelf.
 * Injects a "Find It" button into Vega Discover availability rows.
 * https://github.com/RHPubLib/FindIt
 *
 * No dependencies. No build step. Pure vanilla JS.
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Globals set by the library's config.js                            */
  /* ------------------------------------------------------------------ */
  // window.FindItConfig is expected to be set before this script loads.

  var POLL_INTERVAL = 500;   // ms – how often we check for new rows
  var POLL_TIMEOUT  = 30000; // ms – stop polling after this long
  var BTN_CLASS     = "findit-btn";
  var MODAL_ID      = "findit-modal";

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getConfig() {
    return window.FindItConfig || null;
  }

  /**
   * Strip common juvenile prefixes so "J 636.7" becomes "636.7".
   */
  function stripPrefix(callNumber) {
    return callNumber.replace(/^(J|YA|E|JE|JR|JUV)\s+/i, "").trim();
  }

  /**
   * True when `num` falls inside a Dewey range [start, end].
   */
  function inDeweyRange(num, start, end) {
    var n = parseFloat(num);
    return !isNaN(n) && n >= parseFloat(start) && n <= parseFloat(end);
  }

  /**
   * Walk the config ranges and return the first match, or null.
   * Each range can match by: dewey range, collection, location, or prefix.
   */
  function findMatch(callNumber, collection, location, ranges) {
    var stripped = stripPrefix(callNumber);

    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];

      // Dewey numeric range
      if (r.start !== undefined && r.end !== undefined) {
        if (inDeweyRange(stripped, r.start, r.end)) return r;
      }

      // Collection contains
      if (r.collection && collection &&
          collection.toLowerCase().indexOf(r.collection.toLowerCase()) !== -1) {
        return r;
      }

      // Location contains
      if (r.location && location &&
          location.toLowerCase().indexOf(r.location.toLowerCase()) !== -1) {
        return r;
      }

      // Call-number prefix
      if (r.prefix &&
          callNumber.toUpperCase().indexOf(r.prefix.toUpperCase()) === 0) {
        return r;
      }
    }

    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Modal                                                             */
  /* ------------------------------------------------------------------ */

  function openModal(match, config) {
    closeModal(); // ensure no duplicate

    var overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.className = "findit-overlay";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });

    var dialog = document.createElement("div");
    dialog.className = "findit-dialog";

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.className = "findit-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", closeModal);
    dialog.appendChild(closeBtn);

    // Title
    if (match.label) {
      var title = document.createElement("h2");
      title.className = "findit-title";
      title.textContent = match.label;
      dialog.appendChild(title);
    }

    // Floor map container
    var mapWrap = document.createElement("div");
    mapWrap.className = "findit-map-wrap";

    var img = document.createElement("img");
    img.className = "findit-map-img";
    img.src = match.map || config.defaultMap;
    img.alt = match.label || "Floor map";

    // Marker
    var marker = document.createElement("div");
    marker.className = "findit-marker";
    marker.style.left = (match.x || 50) + "%";
    marker.style.top  = (match.y || 50) + "%";

    mapWrap.appendChild(img);
    mapWrap.appendChild(marker);
    dialog.appendChild(mapWrap);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Trap focus
    closeBtn.focus();

    // Close on Escape
    document.addEventListener("keydown", escHandler);
  }

  function closeModal() {
    var el = document.getElementById(MODAL_ID);
    if (el) el.parentNode.removeChild(el);
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e) {
    if (e.key === "Escape" || e.keyCode === 27) closeModal();
  }

  /* ------------------------------------------------------------------ */
  /*  Button injection                                                  */
  /* ------------------------------------------------------------------ */

  function injectButton(row, match, config) {
    if (row.querySelector("." + BTN_CLASS)) return; // already injected

    var btn = document.createElement("button");
    btn.className = BTN_CLASS;
    btn.textContent = config.buttonLabel || "Find It";
    btn.addEventListener("click", function () {
      openModal(match, config);
    });

    row.appendChild(btn);
  }

  /* ------------------------------------------------------------------ */
  /*  Availability row scanner                                          */
  /* ------------------------------------------------------------------ */

  function scanRows(config) {
    // Vega renders availability rows with data-automation-id attributes
    var rows = document.querySelectorAll(
      '[data-automation-id="availability_holding_container"]'
    );

    rows.forEach(function (row) {
      if (row.querySelector("." + BTN_CLASS)) return;

      var callNumEl = row.querySelector(
        '[data-automation-id="availability_call_number"]'
      );
      var collectionEl = row.querySelector(
        '[data-automation-id="availability_collection"]'
      );
      var locationEl = row.querySelector(
        '[data-automation-id="availability_branch_name"]'
      );

      if (!callNumEl) return;

      var callNumber = (callNumEl.textContent || "").trim();
      var collection = collectionEl ? (collectionEl.textContent || "").trim() : "";
      var location   = locationEl   ? (locationEl.textContent   || "").trim() : "";

      var match = findMatch(callNumber, collection, location, config.ranges || []);
      if (match) {
        injectButton(row, match, config);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Polling loop                                                      */
  /* ------------------------------------------------------------------ */

  function startPolling() {
    var config = getConfig();
    if (!config) {
      console.warn("[FindIt] No FindItConfig found. Load your library config.js before findit.js.");
      return;
    }

    var elapsed = 0;
    var timer = setInterval(function () {
      scanRows(config);
      elapsed += POLL_INTERVAL;
      if (elapsed >= POLL_TIMEOUT) clearInterval(timer);
    }, POLL_INTERVAL);

    // Also run once immediately
    scanRows(config);

    // Watch for SPA navigation (Vega is an SPA)
    var observer = new MutationObserver(function () {
      scanRows(config);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                              */
  /* ------------------------------------------------------------------ */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPolling);
  } else {
    startPolling();
  }
})();
