/**
 * Map App – Engine
 *
 * Matching and rendering functions extracted from FindIt (src/findit.js).
 * These are the same algorithms used by the Vega widget.
 */

var MapEngine = {};

/**
 * Strip common juvenile prefixes so "J 636.7" becomes "636.7".
 */
MapEngine.stripPrefix = function (callNumber) {
  return callNumber.replace(/^(J|YA|E|JE|JR|JUV)\s+/i, "").trim();
};

/**
 * True when `num` falls inside a Dewey range [start, end].
 */
MapEngine.inDeweyRange = function (num, start, end) {
  var n = parseFloat(num);
  return !isNaN(n) && n >= parseFloat(start) && n <= parseFloat(end);
};

/**
 * Walk the config ranges and return the first match, or null.
 */
MapEngine.findMatch = function (callNumber, collection, location, ranges) {
  var stripped = this.stripPrefix(callNumber);

  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];

    if (r.start !== undefined && r.end !== undefined) {
      if (this.inDeweyRange(stripped, r.start, r.end)) return r;
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
};

/**
 * Like findMatch but returns ALL matching ranges (for multi-branch).
 */
MapEngine.findAllMatches = function (callNumber, collection, location, ranges) {
  var stripped = this.stripPrefix(callNumber);
  var results = [];

  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    var matched = false;

    if (r.start !== undefined && r.end !== undefined) {
      if (this.inDeweyRange(stripped, r.start, r.end)) matched = true;
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
};

/**
 * Render floor map image + overlay (rectangle or pin) into a container.
 */
MapEngine.renderMapContent = function (container, match, floorMapUrl) {
  container.innerHTML = "";

  var img = document.createElement("img");
  img.src = (match && match.map) || floorMapUrl;
  img.alt = (match && match.label) || "Floor map";
  img.draggable = false;
  container.appendChild(img);

  if (match && match.area) {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "map-svg-overlay");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    var a = match.area;
    // Teal highlight zone
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
    container.appendChild(svg);

    // Google Maps-style library pin as HTML element (not SVG, to avoid stretching)
    var pinEl = document.createElement("div");
    pinEl.style.cssText = "position:absolute;pointer-events:none;z-index:10;transform:translate(-50%,-85%);";
    pinEl.style.left = (a.x + a.width / 2) + "%";
    pinEl.style.top = (a.y + a.height / 2) + "%";
    pinEl.innerHTML = '<svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<ellipse cx="20" cy="52" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>'
      + '<path d="M20 0C9 0 0 9 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 9 31 0 20 0Z" fill="#e53935" stroke="#b71c1c" stroke-width="1.5"/>'
      + '<circle cx="20" cy="18" r="7.5" fill="white"/>'
      + '</svg>';
    container.appendChild(pinEl);
  } else if (match && (match.x || match.y)) {
    var marker = document.createElement("div");
    marker.className = "map-marker";
    marker.style.left = (match.x || 50) + "%";
    marker.style.top  = (match.y || 50) + "%";
    container.appendChild(marker);
  }

  // Render landmarks for this floor
  MapEngine.renderLandmarks(container, floorMapUrl);

  return img;
};

/**
 * Render landmark icons on the map for the given floor.
 */
MapEngine.landmarksHidden = false;

MapEngine.renderLandmarks = function (container, floorMapUrl) {
  var ranges = MapConfig.ranges;
  var landmarks = (ranges && ranges.landmarks) || [];
  if (!landmarks.length) return;

  var ICONS = { restrooms: "🚻", info: "ℹ️", water: "💧", elevator: "🛗" };

  for (var i = 0; i < landmarks.length; i++) {
    var lm = landmarks[i];
    if (lm.map && lm.map !== floorMapUrl) continue;

    var pin = document.createElement("div");
    pin.className = "map-landmark-icon";
    pin.setAttribute("role", "img");
    pin.setAttribute("aria-label", (lm.label || ICONS[lm.type] || "Landmark") + " location");
    pin.style.cssText = "position:absolute;pointer-events:none;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);z-index:1;";
    if (MapEngine.landmarksHidden) pin.style.display = "none";
    pin.style.left = lm.x + "%";
    pin.style.top = lm.y + "%";
    var icon = document.createElement("span");
    icon.style.cssText = "width:36px;height:36px;background:#fff;border:2.5px solid #00697f;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 6px rgba(0,0,0,0.25);";
    icon.textContent = ICONS[lm.type] || "📍";
    pin.appendChild(icon);
    if (lm.label) {
      var label = document.createElement("span");
      label.style.cssText = "font-size:11px;font-weight:700;color:#00697f;margin-top:3px;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff;background:rgba(255,255,255,0.85);padding:1px 5px;border-radius:3px;";
      label.textContent = lm.label;
      pin.appendChild(label);
    }
    container.appendChild(pin);
  }
};
