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

    // Pin marker — pulsing red dot centered in the rectangle
    var cx = a.x + a.width / 2;
    var cy = a.y + a.height / 2;
    var pulse = document.createElementNS(svgNS, "circle");
    pulse.setAttribute("cx", cx);
    pulse.setAttribute("cy", cy);
    pulse.setAttribute("r", "1.2");
    pulse.setAttribute("fill", "none");
    pulse.setAttribute("stroke", "#e53935");
    pulse.setAttribute("stroke-width", "0.3");
    pulse.setAttribute("opacity", "0.6");
    var anim = document.createElementNS(svgNS, "animate");
    anim.setAttribute("attributeName", "r");
    anim.setAttribute("from", "0.8"); anim.setAttribute("to", "2.5");
    anim.setAttribute("dur", "1.5s"); anim.setAttribute("repeatCount", "indefinite");
    pulse.appendChild(anim);
    var animOp = document.createElementNS(svgNS, "animate");
    animOp.setAttribute("attributeName", "opacity");
    animOp.setAttribute("from", "0.7"); animOp.setAttribute("to", "0");
    animOp.setAttribute("dur", "1.5s"); animOp.setAttribute("repeatCount", "indefinite");
    pulse.appendChild(animOp);
    svg.appendChild(pulse);
    var dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
    dot.setAttribute("r", "0.7"); dot.setAttribute("fill", "#e53935");
    dot.setAttribute("stroke", "#fff"); dot.setAttribute("stroke-width", "0.2");
    svg.appendChild(dot);

    container.appendChild(svg);
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
MapEngine.renderLandmarks = function (container, floorMapUrl) {
  var ranges = MapConfig.ranges;
  var landmarks = (ranges && ranges.landmarks) || [];
  if (!landmarks.length) return;

  var ICONS = { restrooms: "🚻", info: "ℹ️", water: "💧" };

  var svgNS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "map-svg-overlay");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.overflow = "visible";

  for (var i = 0; i < landmarks.length; i++) {
    var lm = landmarks[i];
    // Only show landmarks for this floor
    if (lm.map && lm.map !== floorMapUrl) continue;

    var g = document.createElementNS(svgNS, "g");
    // Background circle
    var bg = document.createElementNS(svgNS, "circle");
    bg.setAttribute("cx", lm.x);
    bg.setAttribute("cy", lm.y);
    bg.setAttribute("r", "1.2");
    bg.setAttribute("fill", "#fff");
    bg.setAttribute("stroke", "#00697f");
    bg.setAttribute("stroke-width", "0.2");
    g.appendChild(bg);
    // Icon as text
    var text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", lm.x);
    text.setAttribute("y", lm.y);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "1.4");
    text.textContent = ICONS[lm.type] || "📍";
    g.appendChild(text);
    // Label
    var label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", lm.x);
    label.setAttribute("y", lm.y + 2);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "0.8");
    label.setAttribute("font-weight", "600");
    label.setAttribute("fill", "#00697f");
    label.textContent = lm.label || "";
    g.appendChild(label);
    svg.appendChild(g);
  }

  container.appendChild(svg);
};
