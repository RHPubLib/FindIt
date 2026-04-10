/**
 * FindIt – Rochester Hills Public Library (Bundled)
 * IIC (Innovative Items Collection) – iic.rhpl.org
 * This file combines config + findit.js into one script.
 */

/* ---- Config ---- */
window.FindItConfig = {
  libraryName: "Rochester Hills Public Library",
  buttonLabel: "View Shelf Location",
  defaultMap: "https://findit.rhpl.org/maps/RHPL%20Second%20Floor/RHPL-Second-Floor-IIC-FullRes.jpg",
  ranges: [
    {
      collection: "Innovative Items",
      label: "Innovative Items Collection - 2nd Floor",
      map: "https://findit.rhpl.org/maps/RHPL%20Second%20Floor/RHPL-Second-Floor-IIC-FullRes.jpg",
      x: 5,
      y: 42
    }
  ]
};

/* ---- FindIt Engine ---- */
(function () {
  "use strict";

  var POLL_INTERVAL = 500;
  var POLL_TIMEOUT  = 30000;
  var BTN_CLASS     = "findit-btn";
  var MODAL_ID      = "findit-modal";

  function getConfig() {
    return window.FindItConfig || null;
  }

  function stripPrefix(callNumber) {
    return callNumber.replace(/^(J|YA|E|JE|JR|JUV)\s+/i, "").trim();
  }

  function inDeweyRange(num, start, end) {
    var n = parseFloat(num);
    return !isNaN(n) && n >= parseFloat(start) && n <= parseFloat(end);
  }

  function findMatch(callNumber, collection, location, ranges) {
    var stripped = stripPrefix(callNumber);
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (r.start !== undefined && r.end !== undefined) {
        if (inDeweyRange(stripped, r.start, r.end)) return r;
      }
      if (r.collection && collection &&
          collection.toLowerCase().indexOf(r.collection.toLowerCase()) !== -1) {
        return r;
      }
      if (r.location && location &&
          location.toLowerCase().indexOf(r.location.toLowerCase()) !== -1) {
        return r;
      }
      if (r.prefix &&
          callNumber.toUpperCase().indexOf(r.prefix.toUpperCase()) === 0) {
        return r;
      }
    }
    return null;
  }

  function openModal(match, config) {
    closeModal();
    var overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.id = MODAL_ID;
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    var dialog = document.createElement("div");
    dialog.style.cssText = "position:relative;max-width:800px;width:90vw;max-height:90vh;overflow-y:auto;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.3);";
    // Header bar
    var header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:#00697f;color:#fff;padding:12px 20px;border-radius:8px 8px 0 0;";
    var title = document.createElement("h2");
    title.style.cssText = "margin:0;font-size:1rem;font-weight:600;color:#fff;";
    title.textContent = match.label || "Shelf Location";
    header.appendChild(title);
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = "font-size:1.5rem;line-height:1;background:none;border:none;cursor:pointer;color:#fff;padding:0 4px;";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", closeModal);
    header.appendChild(closeBtn);
    dialog.appendChild(header);
    // Map area
    var mapWrap = document.createElement("div");
    mapWrap.style.cssText = "position:relative;width:100%;line-height:0;padding:20px;";
    var img = document.createElement("img");
    img.style.cssText = "width:100%;height:auto;border:1px solid #e0e0e0;border-radius:4px;";
    img.src = match.map || config.defaultMap;
    img.alt = match.label || "Floor map";
    var marker = document.createElement("div");
    marker.style.cssText = "position:absolute;width:24px;height:24px;margin-left:-12px;margin-top:-24px;background:#e53935;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.35);pointer-events:none;";
    marker.style.left = (match.x || 50) + "%";
    marker.style.top = (match.y || 50) + "%";
    mapWrap.appendChild(img);
    mapWrap.appendChild(marker);
    dialog.appendChild(mapWrap);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    closeBtn.focus();
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

  function injectButton(row, match, config) {
    // Avoid duplicates anywhere on the page
    if (document.querySelector("." + BTN_CLASS)) return;
    var btn = document.createElement("button");
    btn.className = BTN_CLASS;
    btn.style.cssText = "display:block;width:100%;margin-top:8px;padding:8px 16px;font-size:14px;font-weight:500;color:#fff;background:#00697f;border:2px solid #00697f;border-radius:4px;cursor:pointer;text-align:center;font-family:inherit;line-height:1.4;";
    btn.textContent = config.buttonLabel || "View Shelf Location";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(match, config);
    });
    // Place after "Find Specific Edition" button in the action area
    var fseBtn = document.querySelector('[data-automation-id="find-specific-edition-btn"]');
    if (fseBtn) {
      fseBtn.insertAdjacentElement("afterend", btn);
      return;
    }
    // Fallback: place after "Place Hold" button
    var holdBtn = document.querySelector('[data-automation-id="place-hold-btn"]');
    if (holdBtn) {
      var holdParent = holdBtn.closest('div') || holdBtn.parentElement;
      if (holdParent) {
        holdParent.parentElement.appendChild(btn);
        return;
      }
    }
    // Last fallback: place in the availability container
    row.appendChild(btn);
  }

  function scanRows(config) {
    var containers = document.querySelectorAll('app-physical-item-availability');
    containers.forEach(function (container) {
      if (container.querySelector("." + BTN_CLASS)) return;
      var availMsg = container.querySelector('[data-automation-id="item-availability-message"]');
      var callLocEl = container.querySelector('[data-automation-id="item-call-number-and-location"]');
      var collection = "";
      var callNumber = "";
      var location = "";
      if (availMsg) {
        var msgText = (availMsg.textContent || "").trim();
        var atMatch = msgText.match(/On shelf at\s+(.+)/i);
        if (atMatch) collection = atMatch[1].trim();
      }
      if (callLocEl) {
        var locText = (callLocEl.textContent || "").trim();
        var parts = locText.split("|");
        if (parts.length > 0) {
          var strongEl = callLocEl.querySelector("strong");
          callNumber = strongEl ? (strongEl.textContent || "").trim() : parts[0].trim();
        }
        var collMatch = locText.match(/Collection\s+(.+?)(?:\||$)/i);
        if (collMatch && !collection) {
          collection = collMatch[1].trim();
        }
      }
      var locationLinks = container.parentElement ?
        container.parentElement.querySelectorAll('[data-automation-id*="location-"]') : [];
      locationLinks.forEach(function (link) {
        var linkText = (link.textContent || "").trim();
        if (linkText && !collection) collection = linkText;
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

  function startPolling() {
    var config = getConfig();
    if (!config) {
      console.warn("[FindIt] No FindItConfig found.");
      return;
    }
    var elapsed = 0;
    var timer = setInterval(function () {
      scanRows(config);
      elapsed += POLL_INTERVAL;
      if (elapsed >= POLL_TIMEOUT) clearInterval(timer);
    }, POLL_INTERVAL);
    scanRows(config);
    var observer = new MutationObserver(function () {
      scanRows(config);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPolling);
  } else {
    startPolling();
  }
})();
