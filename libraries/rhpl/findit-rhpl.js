/**
 * FindIt – Rochester Hills Public Library (Bundled)
 * IIC (Innovative Items Collection) – iic.rhpl.org
 * This file combines config + findit.js into one script.
 */

/* ---- Config ---- */
window.FindItConfig = {
  libraryName: "Rochester Hills Public Library",
  buttonLabel: "View Shelf Location",
  defaultMap: "https://findit.rhpl.org/maps/RHPL%20Second%20Floor/RHPL-Second-Floor-IIC-Marked.jpg",
  ranges: [
    {
      collection: "Innovative Items",
      label: "Innovative Items Collection - 2nd Floor",
      map: "https://findit.rhpl.org/maps/RHPL%20Second%20Floor/RHPL-Second-Floor-IIC-Marked.jpg",
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
    var zoom = 1;
    var overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    var dialog = document.createElement("div");
    dialog.style.cssText = "position:relative;max-width:850px;width:92vw;max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.3);";
    // Header bar
    var header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:#00697f;color:#fff;padding:10px 20px;border-radius:8px 8px 0 0;flex-shrink:0;";
    var title = document.createElement("h2");
    title.style.cssText = "margin:0;font-size:1rem;font-weight:600;color:#fff;";
    title.textContent = match.label || "Shelf Location";
    header.appendChild(title);
    var headerRight = document.createElement("div");
    headerRight.style.cssText = "display:flex;align-items:center;gap:8px;";
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = "font-size:1.5rem;line-height:1;background:none;border:none;cursor:pointer;color:#fff;padding:0 4px;";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", closeModal);
    headerRight.appendChild(closeBtn);
    header.appendChild(headerRight);
    dialog.appendChild(header);
    // Zoom controls
    var zoomBar = document.createElement("div");
    zoomBar.style.cssText = "display:flex;align-items:center;gap:12px;padding:8px 20px;background:#f5f5f5;border-bottom:1px solid #e0e0e0;flex-shrink:0;";
    var zoomBtnStyle = "background:none;border:1px solid #00697f;color:#00697f;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;";
    var zoomInBtn = document.createElement("button");
    zoomInBtn.style.cssText = zoomBtnStyle;
    zoomInBtn.textContent = "+ Zoom In";
    var zoomOutBtn = document.createElement("button");
    zoomOutBtn.style.cssText = zoomBtnStyle;
    zoomOutBtn.textContent = "- Zoom Out";
    var zoomFitBtn = document.createElement("button");
    zoomFitBtn.style.cssText = zoomBtnStyle;
    zoomFitBtn.textContent = "Fit";
    zoomBar.appendChild(zoomInBtn);
    zoomBar.appendChild(zoomOutBtn);
    zoomBar.appendChild(zoomFitBtn);
    dialog.appendChild(zoomBar);
    // Map viewport (scrollable)
    var viewport = document.createElement("div");
    viewport.style.cssText = "overflow:auto;flex:1;min-height:0;cursor:grab;";
    // Map container (zoomable)
    var mapWrap = document.createElement("div");
    mapWrap.style.cssText = "position:relative;display:inline-block;transform-origin:0 0;transition:transform 0.2s ease;line-height:0;padding:16px;";
    var img = document.createElement("img");
    img.style.cssText = "max-width:100%;height:auto;border:1px solid #e0e0e0;border-radius:4px;pointer-events:none;";
    img.src = match.map || config.defaultMap;
    img.alt = match.label || "Floor map";
    img.draggable = false;
    mapWrap.appendChild(img);
    viewport.appendChild(mapWrap);
    dialog.appendChild(viewport);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    // Zoom functions
    function applyZoom() {
      mapWrap.style.transform = "scale(" + zoom + ")";
      if (zoom > 1) {
        img.style.maxWidth = "none";
        img.style.width = img.naturalWidth + "px";
        viewport.style.cursor = "grab";
      } else {
        img.style.maxWidth = "100%";
        img.style.width = "";
        viewport.style.cursor = "default";
      }
    }
    zoomInBtn.addEventListener("click", function () {
      zoom = Math.min(zoom + 0.5, 4);
      applyZoom();
    });
    zoomOutBtn.addEventListener("click", function () {
      zoom = Math.max(zoom - 0.5, 0.5);
      applyZoom();
    });
    zoomFitBtn.addEventListener("click", function () {
      zoom = 1;
      applyZoom();
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });
    // Drag to pan
    var dragging = false, startX, startY, scrollL, scrollT;
    viewport.addEventListener("mousedown", function (e) {
      if (zoom <= 1) return;
      dragging = true;
      startX = e.pageX;
      startY = e.pageY;
      scrollL = viewport.scrollLeft;
      scrollT = viewport.scrollTop;
      viewport.style.cursor = "grabbing";
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      viewport.scrollLeft = scrollL - (e.pageX - startX);
      viewport.scrollTop = scrollT - (e.pageY - startY);
    });
    document.addEventListener("mouseup", function () {
      dragging = false;
      if (zoom > 1) viewport.style.cursor = "grab";
    });
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
