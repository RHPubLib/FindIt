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

    // Animated book marker centered in the rectangle
    var cx = a.x + a.width / 2;
    var cy = a.y + a.height / 2;
    var bk = document.createElementNS(svgNS, "g");
    bk.setAttribute("transform", "translate(" + cx + "," + cy + ")");
    var spine = document.createElementNS(svgNS, "rect");
    spine.setAttribute("x", "-0.08"); spine.setAttribute("y", "-0.7");
    spine.setAttribute("width", "0.16"); spine.setAttribute("height", "1.4");
    spine.setAttribute("fill", "#00697f"); spine.setAttribute("rx", "0.04");
    bk.appendChild(spine);
    var pageR = document.createElementNS(svgNS, "rect");
    pageR.setAttribute("x", "0.08"); pageR.setAttribute("y", "-0.65");
    pageR.setAttribute("width", "0.7"); pageR.setAttribute("height", "1.3");
    pageR.setAttribute("fill", "#fff"); pageR.setAttribute("stroke", "#00697f");
    pageR.setAttribute("stroke-width", "0.08"); pageR.setAttribute("rx", "0.05");
    bk.appendChild(pageR);
    for (var ln = 0; ln < 4; ln++) {
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", "0.2"); line.setAttribute("x2", "0.65");
      line.setAttribute("y1", -0.3 + ln * 0.3); line.setAttribute("y2", -0.3 + ln * 0.3);
      line.setAttribute("stroke", "#b0bec5"); line.setAttribute("stroke-width", "0.04");
      bk.appendChild(line);
    }
    var pageGroup = document.createElementNS(svgNS, "g");
    pageGroup.setAttribute("transform", "translate(-0.08, 0)");
    var pageInner = document.createElementNS(svgNS, "g");
    pageInner.setAttribute("transform", "translate(0.08, 0)");
    var pageL = document.createElementNS(svgNS, "rect");
    pageL.setAttribute("x", "-0.7"); pageL.setAttribute("y", "-0.65");
    pageL.setAttribute("width", "0.7"); pageL.setAttribute("height", "1.3");
    pageL.setAttribute("fill", "#f5f5f5"); pageL.setAttribute("stroke", "#00697f");
    pageL.setAttribute("stroke-width", "0.08"); pageL.setAttribute("rx", "0.05");
    var flipAnim = document.createElementNS(svgNS, "animateTransform");
    flipAnim.setAttribute("attributeName", "transform"); flipAnim.setAttribute("type", "scale");
    flipAnim.setAttribute("values", "1,1;0.15,1;1,1"); flipAnim.setAttribute("keyTimes", "0;0.5;1");
    flipAnim.setAttribute("dur", "2.5s"); flipAnim.setAttribute("repeatCount", "indefinite");
    flipAnim.setAttribute("additive", "sum");
    pageL.appendChild(flipAnim);
    pageInner.appendChild(pageL);
    pageGroup.appendChild(pageInner);
    bk.appendChild(pageGroup);
    svg.appendChild(bk);

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

  var ICONS = { restrooms: "🚻", info: "ℹ️", water: "💧", elevator: "🛗" };

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
