/**
 * FindIt – Example Bundled File (Rochester Hills Public Library)
 *
 * This is a REFERENCE EXAMPLE showing how to bundle config + engine
 * into a single file for deployment. Copy and adapt for your library.
 *
 * IMPORTANT: Map URLs must point to YOUR OWN web server, not to this
 * GitHub repository. Upload maps via SFTP to your hosting provider.
 */

/* ---- Config ---- */
window.FindItConfig = {
  libraryName: "Rochester Hills Public Library",
  buttonLabel: "View Shelf Location",
  defaultMap: "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg",
  branches: [
    { id: "main-1f", label: "1st Floor",        location: "Main Library" },
    { id: "main-2f", label: "2nd Floor",        location: "Main Library" },
    { id: "van",     label: "Bookmobile (Van)", location: "Bookmobile" }
  ],
  ranges: [
    {
      collection: "Innovative Items",
      label: "Innovative Items Collection - 2nd Floor",
      branch: "main-2f",
      map: "https://findit.rhpl.org/maps/RHPL%20Second%20Floor/RHPL-Second-Floor-IIC-Marked.jpg",
      x: 5,
      y: 42
    },
    {
      collection: "Large Print Biography",
      label: "Large Print Biography - 1st Floor",
      branch: "main-1f",
      map: "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg",
      x: 63.58,
      y: 15.06,
      area: { x: 60.34, y: 14.06, width: 6.48, height: 2, color: "#00697f" }
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

  function findAllMatches(callNumber, collection, location, ranges) {
    var stripped = stripPrefix(callNumber);
    var results = [];
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      var matched = false;
      if (r.start !== undefined && r.end !== undefined) {
        if (inDeweyRange(stripped, r.start, r.end)) matched = true;
      }
      if (!matched && r.collection && collection &&
          collection.toLowerCase().indexOf(r.collection.toLowerCase()) !== -1) {
        matched = true;
      }
      if (!matched && r.location && location &&
          location.toLowerCase().indexOf(r.location.toLowerCase()) !== -1) {
        matched = true;
      }
      if (!matched && r.prefix &&
          callNumber.toUpperCase().indexOf(r.prefix.toUpperCase()) === 0) {
        matched = true;
      }
      if (matched) results.push(r);
    }
    return results;
  }

  function renderMapContent(mapWrap, match, config, zoom) {
    mapWrap.innerHTML = "";
    var img = document.createElement("img");
    img.style.cssText = "max-width:100%;height:auto;border:1px solid #e0e0e0;border-radius:4px;pointer-events:none;";
    img.src = match.map || config.defaultMap;
    img.alt = match.label || "Floor map";
    img.draggable = false;
    mapWrap.appendChild(img);
    if (match.area) {
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText = "position:absolute;top:16px;left:16px;width:calc(100% - 32px);height:calc(100% - 32px);pointer-events:none;";
      var a = match.area;
      var rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", a.x);
      rect.setAttribute("y", a.y);
      rect.setAttribute("width", a.width);
      rect.setAttribute("height", a.height);
      rect.setAttribute("fill", a.color || "#00697f");
      rect.setAttribute("fill-opacity", a.opacity || "0.3");
      rect.setAttribute("stroke", a.color || "#00697f");
      rect.setAttribute("stroke-width", "0.3");
      rect.setAttribute("stroke-opacity", "0.8");
      svg.appendChild(rect);
      mapWrap.appendChild(svg);
    }
    return img;
  }

  function openModal(matches, config, preferredBranch) {
    closeModal();
    if (!Array.isArray(matches)) matches = [matches];
    var activeIndex = 0;
    if (preferredBranch && matches.length > 1) {
      for (var i = 0; i < matches.length; i++) {
        if (matches[i].branch === preferredBranch) { activeIndex = i; break; }
      }
    }
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
    title.textContent = matches[activeIndex].label || "Shelf Location";
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
    // Map container (created early so tabs can reference it)
    var mapWrap = document.createElement("div");
    mapWrap.style.cssText = "position:relative;display:inline-block;transform-origin:0 0;transition:transform 0.2s ease;line-height:0;padding:16px;";
    var img; // will hold current img reference for zoom
    // Branch/floor tabs (only if multiple matches)
    if (matches.length > 1) {
      var tabBar = document.createElement("div");
      tabBar.style.cssText = "display:flex;padding:0 20px;background:#f5f5f5;border-bottom:1px solid #e0e0e0;overflow-x:auto;flex-shrink:0;";
      var tabStyle = "padding:10px 16px;font-size:13px;font-weight:500;color:#555;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap;font-family:inherit;";
      var tabActiveExtra = "color:#00697f;border-bottom-color:#00697f;font-weight:600;";
      matches.forEach(function (m, idx) {
        var tab = document.createElement("button");
        tab.style.cssText = tabStyle + (idx === activeIndex ? tabActiveExtra : "");
        var tabLabel = m.label;
        if (m.branch && config.branches) {
          for (var b = 0; b < config.branches.length; b++) {
            if (config.branches[b].id === m.branch) { tabLabel = config.branches[b].label; break; }
          }
        }
        tab.textContent = tabLabel;
        tab.addEventListener("click", function () {
          var tabs = tabBar.querySelectorAll("button");
          for (var t = 0; t < tabs.length; t++) {
            tabs[t].style.cssText = tabStyle + (tabs[t] === tab ? tabActiveExtra : "");
          }
          title.textContent = m.label || "Shelf Location";
          img = renderMapContent(mapWrap, m, config);
          zoom = 1;
          applyZoom();
        });
        tabBar.appendChild(tab);
      });
      dialog.appendChild(tabBar);
    }
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
    img = renderMapContent(mapWrap, matches[activeIndex], config);
    viewport.appendChild(mapWrap);
    dialog.appendChild(viewport);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    // Zoom functions
    function applyZoom() {
      mapWrap.style.transform = "scale(" + zoom + ")";
      var curImg = mapWrap.querySelector("img");
      if (curImg) {
        if (zoom > 1) {
          curImg.style.maxWidth = "none";
          curImg.style.width = curImg.naturalWidth + "px";
          viewport.style.cursor = "grab";
        } else {
          curImg.style.maxWidth = "100%";
          curImg.style.width = "";
          viewport.style.cursor = "default";
        }
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

  function injectButton(row, matches, config, preferredBranch) {
    // Find the closest parent card/item container
    var card = row.closest('app-rollup-card, [data-automation-id="search-card"]') || row.closest('.row') || row.parentElement;
    // Check if this specific card already has our button
    if (card && card.querySelector("." + BTN_CLASS)) return;
    var btn = document.createElement("button");
    btn.className = BTN_CLASS;
    btn.style.cssText = "display:block;width:100%;margin-top:8px;padding:8px 16px;font-size:14px;font-weight:500;color:#fff;background:#00697f;border:2px solid #00697f;border-radius:4px;cursor:pointer;text-align:center;font-family:inherit;line-height:1.4;";
    btn.textContent = config.buttonLabel || "View Shelf Location";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(matches, config, preferredBranch);
    });
    // Find action buttons within this specific card
    var fseBtn = card ? card.querySelector('[data-automation-id="find-specific-edition-btn"]') : null;
    if (fseBtn) {
      fseBtn.insertAdjacentElement("afterend", btn);
      return;
    }
    var holdBtn = card ? card.querySelector('[data-automation-id="place-hold-btn"]') : null;
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
        if (collMatch) {
          // Append explicit Collection text so matching checks both sources
          collection = collection ? collection + " " + collMatch[1].trim() : collMatch[1].trim();
        }
      }
      var locationLinks = container.parentElement ?
        container.parentElement.querySelectorAll('[data-automation-id*="location-"]') : [];
      var availableBranches = [];
      locationLinks.forEach(function (link) {
        var linkText = (link.textContent || "").trim();
        if (linkText && !collection) collection = linkText;
        var locId = link.getAttribute("data-automation-id") || "";
        var locMatch = locId.match(/^location-(.+)-\d+$/);
        if (locMatch) {
          if (!location) location = locMatch[1];
          availableBranches.push(locMatch[1]);
        }
      });
      if (config.branches && config.branches.length > 0) {
        var allMatches = findAllMatches(callNumber, collection, location, config.ranges || []);
        var filtered = allMatches.filter(function (m) {
          if (!m.branch) return true;
          for (var b = 0; b < config.branches.length; b++) {
            if (config.branches[b].id === m.branch) {
              var branchLoc = config.branches[b].location.toLowerCase();
              for (var a = 0; a < availableBranches.length; a++) {
                if (availableBranches[a].toLowerCase().indexOf(branchLoc) !== -1) return true;
              }
              return false;
            }
          }
          return true;
        });
        if (filtered.length > 0) {
          var preferredBranch = null;
          if (availableBranches.length > 0) {
            var firstLoc = availableBranches[0].toLowerCase();
            for (var b = 0; b < config.branches.length; b++) {
              if (firstLoc.indexOf(config.branches[b].location.toLowerCase()) !== -1) {
                preferredBranch = config.branches[b].id;
                break;
              }
            }
          }
          injectButton(container, filtered, config, preferredBranch);
        }
      } else {
        var match = findMatch(callNumber, collection, location, config.ranges || []);
        if (match) {
          injectButton(container, match, config, null);
        }
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
