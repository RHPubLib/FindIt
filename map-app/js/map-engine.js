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

    container.appendChild(svg);
  } else if (match && (match.x || match.y)) {
    var marker = document.createElement("div");
    marker.className = "map-marker";
    marker.style.left = (match.x || 50) + "%";
    marker.style.top  = (match.y || 50) + "%";
    container.appendChild(marker);
  }

  return img;
};
