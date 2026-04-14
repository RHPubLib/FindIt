/**
 * Map App – Viewer
 *
 * Interactive floor plan viewer with floor tabs, zoom, pan, and
 * touch gesture support.
 *
 * Zoom approach: sets the image width directly in pixels (no CSS transform).
 * This lets the browser handle scrolling natively in all directions.
 */

var MapViewer = {
  currentFloor: null,
  currentHighlight: null,
  zoom: 1,
  _baseWidth: 0,   // image width at zoom=1 (fit to viewport)
  _viewport: null,
  _container: null,
  _tabBar: null
};

MapViewer.init = function () {
  this._viewport = document.getElementById("map-viewport");
  this._viewport.setAttribute("role", "tabpanel");
  this._viewport.setAttribute("aria-label", "Floor map");
  this._container = document.getElementById("map-container");
  this._tabBar = document.getElementById("floor-tabs");

  this._buildTabs();
  this._bindZoom();
  this._bindPan();

  this.showFloor(MapConfig.defaultFloor);
};

MapViewer._buildTabs = function () {
  var self = this;
  this._tabBar.innerHTML = "";
  this._tabBar.setAttribute("role", "tablist");
  this._tabBar.setAttribute("aria-label", "Floor selection");

  MapConfig.floors.forEach(function (floor) {
    var tab = document.createElement("button");
    tab.className = "map-tab";
    tab.textContent = floor.label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("data-floor", floor.id);
    tab.setAttribute("aria-controls", "map-viewport");
    tab.id = "tab-" + floor.id;

    tab.addEventListener("click", function () {
      self.showFloor(floor.id);
      self.clearHighlight();
    });

    self._tabBar.appendChild(tab);
  });
};

MapViewer.showFloor = function (floorId, highlight) {
  var floor = null;
  for (var i = 0; i < MapConfig.floors.length; i++) {
    if (MapConfig.floors[i].id === floorId) { floor = MapConfig.floors[i]; break; }
  }
  if (!floor) return;

  this.currentFloor = floorId;

  // Update tab active state
  var tabs = this._tabBar.querySelectorAll(".map-tab");
  for (var t = 0; t < tabs.length; t++) {
    var isActive = tabs[t].getAttribute("data-floor") === floorId;
    tabs[t].className = "map-tab" + (isActive ? " map-tab-active" : "");
    tabs[t].setAttribute("aria-selected", isActive ? "true" : "false");
    tabs[t].setAttribute("tabindex", isActive ? "0" : "-1");
    if (isActive) this._viewport.setAttribute("aria-labelledby", tabs[t].id);
  }

  // Render map content
  var match = highlight || null;
  MapEngine.renderMapContent(this._container, match, floor.map);

  // Reset zoom to fit
  this.zoom = 1;
  this._baseWidth = 0;
  this.currentHighlight = highlight || null;

  // Once image loads, set base width and apply zoom
  var self = this;
  var img = this._container.querySelector("img");
  if (img) {
    self._viewport.scrollLeft = 0;
    self._viewport.scrollTop = 0;

    var onReady = function () {
      // Reset CSS constraints for initial fit
      img.style.width = "auto";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "calc(100vh - 140px)";
      // Capture rendered width after CSS applies
      setTimeout(function () {
        self._baseWidth = img.offsetWidth;
        if (!self._baseWidth) self._baseWidth = img.naturalWidth;
      }, 100);
    };
    if (img.complete && img.naturalWidth) setTimeout(onReady, 50);
    else img.addEventListener("load", onReady);
  }
};

MapViewer.highlight = function (match) {
  var floorId = this._getFloorForMatch(match);
  this.showFloor(floorId || MapConfig.defaultFloor, match);
};

MapViewer.clearHighlight = function () {
  this.currentHighlight = null;
  this.showFloor(this.currentFloor);
};

MapViewer.reset = function () {
  this.currentHighlight = null;
  this.showFloor(MapConfig.defaultFloor);
};

MapViewer._getFloorForMatch = function (match) {
  if (!match) return MapConfig.defaultFloor;

  if (match.branch) {
    for (var i = 0; i < MapConfig.branches.length; i++) {
      if (MapConfig.branches[i].id === match.branch) {
        return MapConfig.branches[i].floor || MapConfig.defaultFloor;
      }
    }
  }

  if (match.map) {
    for (var f = 0; f < MapConfig.floors.length; f++) {
      if (match.map === MapConfig.floors[f].map) {
        return MapConfig.floors[f].id;
      }
    }
  }

  return MapConfig.defaultFloor;
};

/* ------------------------------------------------------------------ */
/*  Zoom                                                              */
/* ------------------------------------------------------------------ */

MapViewer._bindZoom = function () {
  var self = this;

  document.getElementById("zoom-in").addEventListener("click", function () {
    self._zoomTo(self.zoom * 1.4);
  });

  document.getElementById("zoom-out").addEventListener("click", function () {
    self._zoomTo(self.zoom / 1.4);
  });

  document.getElementById("zoom-fit").addEventListener("click", function () {
    self._zoomTo(1);
  });
};

MapViewer._zoomTo = function (newZoom) {
  newZoom = Math.min(Math.max(newZoom, 1), 6);
  if (!this._baseWidth) return;

  var vp = this._viewport;
  var img = this._container.querySelector("img");
  if (!img) return;

  // Remember what fraction of the content is at viewport center
  var sw = vp.scrollWidth || 1;
  var sh = vp.scrollHeight || 1;
  var fracX = (vp.scrollLeft + vp.clientWidth / 2) / sw;
  var fracY = (vp.scrollTop + vp.clientHeight / 2) / sh;

  // Apply new zoom
  this.zoom = newZoom;
  if (newZoom <= 1) {
    // Reset to CSS-handled fit
    img.style.width = "auto";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "calc(100vh - 140px)";
    this._baseWidth = img.offsetWidth;
  } else {
    if (!this._baseWidth) this._baseWidth = img.offsetWidth;
    var newWidth = this._baseWidth * this.zoom;
    img.style.width = newWidth + "px";
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
  }

  // Also resize SVG overlay to match
  var svg = this._container.querySelector("svg");
  if (svg) {
    svg.style.width = newWidth + "px";
    // Maintain aspect ratio
    var aspect = img.naturalHeight / img.naturalWidth;
    svg.style.height = (newWidth * aspect) + "px";
  }

  // Restore center point
  var newSW = vp.scrollWidth;
  var newSH = vp.scrollHeight;
  vp.scrollLeft = Math.max(0, fracX * newSW - vp.clientWidth / 2);
  vp.scrollTop = Math.max(0, fracY * newSH - vp.clientHeight / 2);
};

/* ------------------------------------------------------------------ */
/*  Pan (mouse + touch pinch)                                         */
/* ------------------------------------------------------------------ */

MapViewer._bindPan = function () {
  var self = this;
  var dragging = false, startX, startY, scrollL, scrollT;

  // Mouse drag to pan
  this._viewport.addEventListener("mousedown", function (e) {
    dragging = true;
    startX = e.pageX;
    startY = e.pageY;
    scrollL = self._viewport.scrollLeft;
    scrollT = self._viewport.scrollTop;
    self._viewport.classList.add("dragging");
    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    self._viewport.scrollLeft = scrollL - (e.pageX - startX);
    self._viewport.scrollTop = scrollT - (e.pageY - startY);
  });

  document.addEventListener("mouseup", function () {
    dragging = false;
    self._viewport.classList.remove("dragging");
  });

  // Pinch to zoom (touch)
  var lastPinchDist = 0;
  var pinching = false;

  this._viewport.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      pinching = true;
      lastPinchDist = Math.hypot(
        e.touches[1].pageX - e.touches[0].pageX,
        e.touches[1].pageY - e.touches[0].pageY
      );
    }
  }, { passive: true });

  this._viewport.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && pinching) {
      var dist = Math.hypot(
        e.touches[1].pageX - e.touches[0].pageX,
        e.touches[1].pageY - e.touches[0].pageY
      );
      if (Math.abs(dist - lastPinchDist) > 5) {
        var scale = dist / lastPinchDist;
        self._zoomTo(self.zoom * scale);
        lastPinchDist = dist;
      }
      e.preventDefault();
    }
  }, { passive: false });

  this._viewport.addEventListener("touchend", function () {
    pinching = false;
  }, { passive: true });
};
