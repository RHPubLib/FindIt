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
    // Vega uses app-physical-item-availability components with
    // data-automation-id="item-availability-message" (contains "On shelf at <Collection>")
    // data-automation-id="item-call-number-and-location" (contains call number and collection)
    // Location links use data-automation-id="location-<Name>-<index>"

    var containers = document.querySelectorAll('app-physical-item-availability');

    containers.forEach(function (container) {
      if (container.querySelector("." + BTN_CLASS)) return;

      // Extract availability message: "On shelf at Innovative Items Collection"
      var availMsg = container.querySelector('[data-automation-id="item-availability-message"]');
      var callLocEl = container.querySelector('[data-automation-id="item-call-number-and-location"]');

      var collection = "";
      var callNumber = "";
      var location = "";

      if (availMsg) {
        var msgText = (availMsg.textContent || "").trim();
        // "On shelf at Innovative Items Collection" -> extract collection
        var atMatch = msgText.match(/On shelf at\s+(.+)/i);
        if (atMatch) collection = atMatch[1].trim();
      }

      if (callLocEl) {
        var locText = (callLocEl.textContent || "").trim();
        // Format: "EXPERIENCES BIRDING KIT #3 | Shelf location ... | Collection Innovative Items"
        var parts = locText.split("|");
        if (parts.length > 0) {
          // First part before | is the call number
          var strongEl = callLocEl.querySelector("strong");
          callNumber = strongEl ? (strongEl.textContent || "").trim() : parts[0].trim();
        }
        // Look for "Collection <name>" in the text
        var collMatch = locText.match(/Collection\s+(.+?)(?:\||$)/i);
        if (collMatch && !collection) {
          collection = collMatch[1].trim();
        }
      }

      // Also check location links
      var locationLinks = container.parentElement ?
        container.parentElement.querySelectorAll('[data-automation-id*="location-"]') : [];
      locationLinks.forEach(function (link) {
        var linkText = (link.textContent || "").trim();
        if (linkText && !collection) collection = linkText;
        // Extract location from the automation id: "location-Innovative Items Collection-0"
        var locId = link.getAttribute("data-automation-id") || "";
        var locMatch = locId.match(/^location-(.+)-\d+$/);
        if (locMatch && !location) location = locMatch[1];
      });

      var match = findMatch(callNumber, collection, location, config.ranges || []);
      if (match) {
        injectButton(container, match, config);
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
