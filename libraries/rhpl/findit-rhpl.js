/**
 * FindIt – Rochester Hills Public Library
 *
 * Config is loaded dynamically from ranges.json (published by the
 * rectangle editor at editor.rhpl.org). The engine below includes
 * branch tabs and multi-match support.
 */

/* ---- Dynamic Config Loader ---- */
(function () {
  var RANGES_URL = "https://findit.rhpl.org/libraries/rhpl/ranges.json";

  window.FindItConfig = {
    libraryName: "Rochester Hills Public Library",
    buttonLabel: "View Shelf Location",
    defaultMap: "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg",
    ranges: []
  };

  var xhr = new XMLHttpRequest();
  xhr.open("GET", RANGES_URL + "?t=" + Date.now(), true);
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        window.FindItConfig.ranges = data.ranges || data;
        if (data.defaultMap) window.FindItConfig.defaultMap = data.defaultMap;
        if (data.branches) window.FindItConfig.branches = data.branches;
        if (data.landmarks) window.FindItConfig.landmarks = data.landmarks;
      } catch (e) {
        console.error("[FindIt] Failed to parse ranges.json:", e);
      }
    } else {
      console.warn("[FindIt] Could not load ranges.json (HTTP " + xhr.status + ")");
    }
  };
  xhr.send();
})();

/* ---- FindIt Engine ---- */
(function () {
  "use strict";

  var POLL_INTERVAL = 500;
  var POLL_TIMEOUT  = 30000;
  var BTN_CLASS     = "findit-btn";
  var MODAL_ID      = "findit-modal";
  var LANDMARK_ICONS = { restrooms: "🚻", info: "ℹ️", water: "💧", elevator: "🛗" };

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
    img.style.cssText = "width:100%;height:auto;display:block;border:1px solid #e0e0e0;border-radius:4px;pointer-events:none;";
    img.src = match.map || config.defaultMap;
    img.alt = match.label || "Floor map";
    img.draggable = false;
    mapWrap.appendChild(img);
    // Render landmarks FIRST (below highlight layer)
    var landmarks = (config && config.landmarks) || [];
    var mapUrl = (match && match.map) || config.defaultMap;
    for (var li = 0; li < landmarks.length; li++) {
      var lm = landmarks[li];
      if (lm.map && lm.map !== mapUrl) continue;
      var lmPin = document.createElement("div");
      lmPin.className = "findit-landmark";
      lmPin.setAttribute("role", "img");
      lmPin.setAttribute("aria-label", (lm.label || lm.type || "Landmark") + " location");
      lmPin.style.cssText = "position:absolute;pointer-events:none;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);z-index:1;";
      lmPin.style.left = lm.x + "%";
      lmPin.style.top = lm.y + "%";
      var lmIcon = document.createElement("span");
      lmIcon.style.cssText = "width:36px;height:36px;background:#fff;border:2.5px solid #00697f;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 6px rgba(0,0,0,0.25);";
      lmIcon.textContent = LANDMARK_ICONS[lm.type] || "📍";
      lmPin.appendChild(lmIcon);
      if (lm.label) {
        var lmLabel = document.createElement("span");
        lmLabel.style.cssText = "font-size:11px;font-weight:700;color:#00697f;margin-top:3px;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff;background:rgba(255,255,255,0.85);padding:1px 5px;border-radius:3px;";
        lmLabel.textContent = lm.label;
        lmPin.appendChild(lmLabel);
      }
      mapWrap.appendChild(lmPin);
    }
    // Highlight overlay ON TOP of landmarks
    if (match.area) {
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;";
      var a = match.area;
      // Area rectangle — teal highlight zone
      var rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", a.x);
      rect.setAttribute("y", a.y);
      rect.setAttribute("width", a.width);
      rect.setAttribute("height", a.height);
      rect.setAttribute("fill", "#00697f");
      rect.setAttribute("fill-opacity", "0.18");
      rect.setAttribute("stroke", "#00697f");
      rect.setAttribute("stroke-width", "0.25");
      rect.setAttribute("stroke-opacity", "0.7");
      rect.setAttribute("rx", "0.3");
      svg.appendChild(rect);
      svg.appendChild(rect);
      mapWrap.appendChild(svg);
      // Google Maps-style library pin as HTML element (not SVG, to avoid stretching)
      var pinEl = document.createElement("div");
      pinEl.style.cssText = "position:absolute;pointer-events:none;z-index:3;transform:translate(-50%,-85%);";
      pinEl.style.left = (a.x + a.width / 2) + "%";
      pinEl.style.top = (a.y + a.height / 2) + "%";
      pinEl.innerHTML = '<svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="20" cy="52" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>'
        + '<path d="M20 0C9 0 0 9 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 9 31 0 20 0Z" fill="#e53935" stroke="#b71c1c" stroke-width="1.5"/>'
        + '<circle cx="20" cy="18" r="7.5" fill="white"/>'
        + '</svg>';
      mapWrap.appendChild(pinEl);
    }
    return img;
  }

  function openModal(matches, config, preferredBranch, itemTitle) {
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
    overlay.setAttribute("role", "presentation");
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    var dialog = document.createElement("div");
    dialog.id = "findit-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "findit-dialog-title");
    dialog.style.cssText = "position:relative;width:94vw;max-height:90vh;max-width:1200px;display:flex;flex-direction:column;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.3);overflow:hidden;";
    // Header bar
    var header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:#00697f;color:#fff;padding:14px 24px;border-radius:10px 10px 0 0;flex-shrink:0;gap:16px;";
    var headerLeft = document.createElement("div");
    headerLeft.style.cssText = "display:flex;align-items:center;gap:14px;min-width:0;";
    var logo = document.createElement("img");
    logo.src = "https://findit.rhpl.org/maps/rhpl-logo-white.png";
    logo.alt = "RHPL";
    logo.style.cssText = "height:40px;width:auto;flex-shrink:0;opacity:0.95;";
    headerLeft.appendChild(logo);
    var title = document.createElement("h2");
    title.id = "findit-dialog-title";
    title.style.cssText = "margin:0;font-size:1.2rem;font-weight:600;color:#fff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    title.textContent = matches[activeIndex].label || "Shelf Location";
    headerLeft.appendChild(title);
    header.appendChild(headerLeft);
    // Hide title text on mobile — info panel shows it instead
    var mobileStyle = document.createElement("style");
    mobileStyle.textContent = "@media(max-width:600px){#findit-modal h2{display:none !important;}#findit-modal img[alt='RHPL']{height:30px !important;}}@media(min-width:601px){#findit-dialog{height:88vh !important;}}@media(prefers-reduced-motion:reduce){#findit-modal *{animation:none !important;transition:none !important;}#findit-modal animate{display:none;}}#findit-modal button:focus-visible{outline:2px solid #004d5c !important;outline-offset:2px;}#findit-modal .findit-btn:focus-visible{outline:2px solid #fff !important;outline-offset:2px;}";
    header.appendChild(mobileStyle);
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = "font-size:1.8rem;line-height:1;background:none;border:none;cursor:pointer;color:#fff;padding:4px 8px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", closeModal);
    header.appendChild(closeBtn);
    dialog.appendChild(header);
    // Map container (created early so tabs can reference it)
    var mapWrap = document.createElement("div");
    mapWrap.style.cssText = "position:relative;display:inline-block;line-height:0;padding:0;background:#fff;";
    var img; // will hold current img reference for zoom
    // Branch/floor tabs (only if multiple matches)
    if (matches.length > 1) {
      var tabBar = document.createElement("div");
      tabBar.style.cssText = "display:flex;padding:0 20px;background:#f5f5f5;border-bottom:1px solid #e0e0e0;overflow-x:auto;flex-shrink:0;";
      var tabStyle = "padding:10px 16px;font-size:13px;font-weight:500;color:#333;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap;font-family:inherit;";
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
          // Update info panel
          var ic = document.getElementById("findit-info-collection");
          if (ic) ic.textContent = m.collection || m.label || "";
          var id = document.getElementById("findit-info-directions");
          if (id) {
            id.textContent = m.directions || "";
            id.style.display = m.directions ? "" : "none";
          }
        });
        tabBar.appendChild(tab);
      });
      dialog.appendChild(tabBar);
    }
    // Map viewport (scrollable) with floating zoom controls
    var viewportWrap = document.createElement("div");
    viewportWrap.style.cssText = "position:relative;flex:1;min-height:0;overflow:hidden;background:#f0f0f0;";
    var viewport = document.createElement("div");
    viewport.style.cssText = "overflow:auto;width:100%;height:100%;-webkit-overflow-scrolling:touch;background:#f0f0f0;";
    img = renderMapContent(mapWrap, matches[activeIndex], config);
    viewport.appendChild(mapWrap);
    viewportWrap.appendChild(viewport);
    // Floating zoom controls
    var zoomBar = document.createElement("div");
    zoomBar.style.cssText = "position:absolute;bottom:12px;right:12px;display:flex;flex-direction:column;gap:4px;z-index:10;";
    var zoomBtnStyle = "background:#fff;border:1px solid #ccc;color:#00697f;width:44px;height:44px;border-radius:6px;cursor:pointer;font-size:18px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;";
    var zoomInBtn = document.createElement("button");
    zoomInBtn.style.cssText = zoomBtnStyle;
    zoomInBtn.textContent = "+";
    var zoomOutBtn = document.createElement("button");
    zoomOutBtn.style.cssText = zoomBtnStyle;
    zoomOutBtn.innerHTML = "&minus;";
    var zoomFitBtn = document.createElement("button");
    zoomFitBtn.style.cssText = zoomBtnStyle + "font-size:12px;font-weight:600;color:#00697f;";
    zoomFitBtn.textContent = "Fit";
    zoomBar.appendChild(zoomInBtn);
    zoomBar.appendChild(zoomOutBtn);
    zoomBar.appendChild(zoomFitBtn);
    // Landmark toggle button
    var lmToggle = document.createElement("button");
    lmToggle.style.cssText = zoomBtnStyle + "font-size:14px;margin-top:6px;";
    lmToggle.textContent = "ℹ️";
    lmToggle.title = "Hide landmarks";
    var lmVisible = true;
    lmToggle.addEventListener("click", function () {
      lmVisible = !lmVisible;
      var icons = mapWrap.querySelectorAll(".findit-landmark");
      for (var li = 0; li < icons.length; li++) {
        icons[li].style.display = lmVisible ? "" : "none";
      }
      lmToggle.style.opacity = lmVisible ? "1" : "0.4";
      lmToggle.title = lmVisible ? "Hide landmarks" : "Show landmarks";
    });
    zoomBar.appendChild(lmToggle);
    viewportWrap.appendChild(zoomBar);
    dialog.appendChild(viewportWrap);
    // Info panel below the map
    var infoPanel = document.createElement("div");
    infoPanel.style.cssText = "padding:16px 24px;border-top:3px solid #00697f;flex-shrink:0;background:#f8fafb;border-radius:0 0 10px 10px;border-left:4px solid #00697f;margin:0;";
    var activeMatch = matches[activeIndex];
    // Item title
    if (itemTitle) {
      var infoItemName = document.createElement("div");
      infoItemName.style.cssText = "font-size:18px;font-weight:700;color:#222;margin-bottom:6px;line-height:1.3;";
      infoItemName.textContent = itemTitle;
      infoItemName.id = "findit-info-item";
      infoPanel.appendChild(infoItemName);
    }
    // Collection with pin icon
    var infoCollectionEl = document.createElement("div");
    infoCollectionEl.style.cssText = "font-size:15px;font-weight:600;color:#00697f;margin-bottom:8px;";
    infoCollectionEl.innerHTML = "&#128205; " + (activeMatch.collection || activeMatch.label || "");
    infoCollectionEl.id = "findit-info-collection";
    infoPanel.appendChild(infoCollectionEl);
    // Directions
    var infoDirEl = document.createElement("div");
    infoDirEl.style.cssText = "font-size:15px;color:#444;line-height:1.6;";
    infoDirEl.id = "findit-info-directions";
    infoDirEl.textContent = activeMatch.directions || "";
    if (activeMatch.directions) infoPanel.appendChild(infoDirEl);
    dialog.appendChild(infoPanel);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    // Zoom — direct image sizing (no CSS transform)
    var baseWidth = 0;
    function initBaseWidth() {
      var curImg = mapWrap.querySelector("img");
      if (curImg) {
        baseWidth = viewport.clientWidth;
        curImg.style.width = baseWidth + "px";
        curImg.style.maxWidth = "none";
        // Size SVG overlay to match
        var svg = mapWrap.querySelector("svg");
        if (svg) {
          svg.style.width = baseWidth + "px";
          svg.style.height = (baseWidth * curImg.naturalHeight / curImg.naturalWidth) + "px";
        }
      }
    }
    function zoomTo(newZoom) {
      newZoom = Math.min(Math.max(newZoom, 1), 6);
      if (!baseWidth) initBaseWidth();
      var curImg = mapWrap.querySelector("img");
      if (!curImg) return;
      // Remember center point
      var sw = viewport.scrollWidth || 1;
      var sh = viewport.scrollHeight || 1;
      var fracX = (viewport.scrollLeft + viewport.clientWidth / 2) / sw;
      var fracY = (viewport.scrollTop + viewport.clientHeight / 2) / sh;
      // Apply new size
      zoom = newZoom;
      var newWidth = baseWidth * zoom;
      curImg.style.width = newWidth + "px";
      // Size SVG overlay to match
      var svg = mapWrap.querySelector("svg");
      if (svg) {
        svg.style.width = newWidth + "px";
        svg.style.height = (newWidth * curImg.naturalHeight / curImg.naturalWidth) + "px";
      }
      // Restore center
      var newSW = viewport.scrollWidth;
      var newSH = viewport.scrollHeight;
      viewport.scrollLeft = Math.max(0, fracX * newSW - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, fracY * newSH - viewport.clientHeight / 2);
    }
    // Initialize base width once image loads
    var initImg = mapWrap.querySelector("img");
    if (initImg) {
      if (initImg.complete && initImg.naturalWidth) initBaseWidth();
      else initImg.addEventListener("load", initBaseWidth);
    }
    zoomInBtn.addEventListener("click", function () { zoomTo(zoom * 1.4); });
    zoomOutBtn.addEventListener("click", function () { zoomTo(zoom / 1.4); });
    zoomFitBtn.addEventListener("click", function () {
      zoomTo(1);
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });
    // Drag to pan (mouse)
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
    // Pinch to zoom (touch)
    var lastPinchDist = 0, pinching = false;
    viewport.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        pinching = true;
        lastPinchDist = Math.hypot(
          e.touches[1].pageX - e.touches[0].pageX,
          e.touches[1].pageY - e.touches[0].pageY
        );
      }
    }, { passive: true });
    viewport.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2 && pinching) {
        var dist = Math.hypot(
          e.touches[1].pageX - e.touches[0].pageX,
          e.touches[1].pageY - e.touches[0].pageY
        );
        if (Math.abs(dist - lastPinchDist) > 5) {
          zoomTo(zoom * (dist / lastPinchDist));
          lastPinchDist = dist;
        }
        e.preventDefault();
      }
    }, { passive: false });
    viewport.addEventListener("touchend", function () { pinching = false; }, { passive: true });
    closeBtn.focus();
    document.addEventListener("keydown", escHandler);
    // Focus trap — keep Tab within the modal
    dialog.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusable = dialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    });
  }

  function closeModal() {
    var el = document.getElementById(MODAL_ID);
    if (el) el.parentNode.removeChild(el);
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e) {
    if (e.key === "Escape" || e.keyCode === 27) closeModal();
    // Zoom with +/- keys
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    var vp = modal.querySelector("div[style*='overflow:auto']");
    if (e.key === "=" || e.key === "+") { e.preventDefault(); var zIn = modal.querySelector("button"); if (zIn) zIn.click(); }
    if (e.key === "-") { e.preventDefault(); }
    // Arrow key panning
    if (vp) {
      if (e.key === "ArrowLeft") { vp.scrollLeft -= 60; e.preventDefault(); }
      if (e.key === "ArrowRight") { vp.scrollLeft += 60; e.preventDefault(); }
      if (e.key === "ArrowUp") { vp.scrollTop -= 60; e.preventDefault(); }
      if (e.key === "ArrowDown") { vp.scrollTop += 60; e.preventDefault(); }
    }
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
      // Try to get the item title from the card
      var itemTitle = "";
      if (card) {
        var titleEl = card.querySelector("h2 a, h2, h3 a, h3, [data-automation-id*='title']");
        if (titleEl) itemTitle = (titleEl.textContent || "").trim();
      }
      openModal(matches, config, preferredBranch, itemTitle);
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
    // Wait for ranges.json to load before scanning
    if (!config.ranges || config.ranges.length === 0) {
      var waitElapsed = 0;
      var waitTimer = setInterval(function () {
        waitElapsed += 200;
        if (config.ranges && config.ranges.length > 0) {
          clearInterval(waitTimer);
          beginScanning(config);
        } else if (waitElapsed >= 5000) {
          clearInterval(waitTimer);
          console.warn("[FindIt] No ranges loaded after 5s — starting with empty config.");
          beginScanning(config);
        }
      }, 200);
      return;
    }
    beginScanning(config);
  }

  function beginScanning(config) {
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
