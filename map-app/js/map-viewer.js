/**
 * Map App – Viewer
 *
 * Interactive floor plan viewer with floor tabs, zoom, pan, and
 * touch gesture support. Adapted from findit-rhpl.js modal code.
 */

var MapViewer = {
  currentFloor: null,
  currentHighlight: null,
  zoom: 1,
  _viewport: null,
  _container: null,
  _tabBar: null
};

/**
 * Initialize the map viewer.
 */
MapViewer.init = function () {
  this._viewport = document.getElementById("map-viewport");
  this._container = document.getElementById("map-container");
  this._tabBar = document.getElementById("floor-tabs");

  this._buildTabs();
  this._bindZoom();
  this._bindPan();

  // Show default floor
  this.showFloor(MapConfig.defaultFloor);
};

/**
 * Build floor tabs from config.
 */
MapViewer._buildTabs = function () {
  var self = this;
  this._tabBar.innerHTML = "";

  MapConfig.floors.forEach(function (floor) {
    var tab = document.createElement("button");
    tab.className = "map-tab";
    tab.textContent = floor.label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("data-floor", floor.id);

    tab.addEventListener("click", function () {
      self.showFloor(floor.id);
      self.clearHighlight();
    });

    self._tabBar.appendChild(tab);
  });
};

/**
 * Switch to a floor and optionally highlight a match.
 */
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
  }

  // Render map content
  var match = highlight || null;
  MapEngine.renderMapContent(this._container, match, floor.map);

  // Reset zoom
  this.zoom = 1;
  this._applyZoom();
  this._viewport.scrollLeft = 0;
  this._viewport.scrollTop = 0;

  this.currentHighlight = highlight || null;
};

/**
 * Highlight a match on the map (switches floor if needed).
 */
MapViewer.highlight = function (match) {
  // Find which floor this match belongs to
  var floorId = this._getFloorForMatch(match);
  this.showFloor(floorId || MapConfig.defaultFloor, match);
};

/**
 * Clear any highlight and show the plain floor plan.
 */
MapViewer.clearHighlight = function () {
  this.currentHighlight = null;
  this.showFloor(this.currentFloor);
};

/**
 * Reset to default state (default floor, no highlight, zoom fit).
 */
MapViewer.reset = function () {
  this.currentHighlight = null;
  this.showFloor(MapConfig.defaultFloor);
};

/**
 * Determine which floor a match belongs to based on its branch.
 */
MapViewer._getFloorForMatch = function (match) {
  if (!match || !match.branch) return MapConfig.defaultFloor;

  for (var i = 0; i < MapConfig.branches.length; i++) {
    if (MapConfig.branches[i].id === match.branch) {
      return MapConfig.branches[i].floor || MapConfig.defaultFloor;
    }
  }

  // Fallback: try to infer from match.map URL
  for (var f = 0; f < MapConfig.floors.length; f++) {
    if (match.map && match.map === MapConfig.floors[f].map) {
      return MapConfig.floors[f].id;
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
    self.zoom = Math.min(self.zoom + 0.5, 4);
    self._applyZoom();
  });

  document.getElementById("zoom-out").addEventListener("click", function () {
    self.zoom = Math.max(self.zoom - 0.5, 0.5);
    self._applyZoom();
  });

  document.getElementById("zoom-fit").addEventListener("click", function () {
    self.zoom = 1;
    self._applyZoom();
    self._viewport.scrollLeft = 0;
    self._viewport.scrollTop = 0;
  });
};

MapViewer._applyZoom = function () {
  this._container.style.transform = "scale(" + this.zoom + ")";
  var img = this._container.querySelector("img");
  if (img) {
    if (this.zoom > 1) {
      img.style.maxWidth = "none";
      img.style.width = img.naturalWidth + "px";
      this._viewport.style.cursor = "grab";
    } else {
      img.style.maxWidth = "100%";
      img.style.width = "";
      this._viewport.style.cursor = "default";
    }
  }
};

/* ------------------------------------------------------------------ */
/*  Pan (mouse + touch)                                               */
/* ------------------------------------------------------------------ */

MapViewer._bindPan = function () {
  var self = this;
  var dragging = false, startX, startY, scrollL, scrollT;

  // Mouse pan
  this._viewport.addEventListener("mousedown", function (e) {
    if (self.zoom <= 1) return;
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

  // Touch pan
  var touchStartX, touchStartY, touchScrollL, touchScrollT;

  this._viewport.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1 && self.zoom > 1) {
      touchStartX = e.touches[0].pageX;
      touchStartY = e.touches[0].pageY;
      touchScrollL = self._viewport.scrollLeft;
      touchScrollT = self._viewport.scrollTop;
    }
  }, { passive: true });

  this._viewport.addEventListener("touchmove", function (e) {
    if (e.touches.length === 1 && self.zoom > 1) {
      self._viewport.scrollLeft = touchScrollL - (e.touches[0].pageX - touchStartX);
      self._viewport.scrollTop = touchScrollT - (e.touches[0].pageY - touchStartY);
      e.preventDefault();
    }
  }, { passive: false });

  // Pinch to zoom
  var lastPinchDist = 0;

  this._viewport.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      lastPinchDist = Math.hypot(
        e.touches[1].pageX - e.touches[0].pageX,
        e.touches[1].pageY - e.touches[0].pageY
      );
    }
  }, { passive: true });

  this._viewport.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2) {
      var dist = Math.hypot(
        e.touches[1].pageX - e.touches[0].pageX,
        e.touches[1].pageY - e.touches[0].pageY
      );
      var delta = dist - lastPinchDist;
      if (Math.abs(delta) > 10) {
        self.zoom = Math.min(Math.max(self.zoom + (delta > 0 ? 0.25 : -0.25), 0.5), 4);
        self._applyZoom();
        lastPinchDist = dist;
      }
      e.preventDefault();
    }
  }, { passive: false });
};
