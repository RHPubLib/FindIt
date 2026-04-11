/**
 * Map App – Main Entry Point
 *
 * Initializes the map viewer and wires up the search bar.
 * Search API integration and results panel will be added in Phase 3.
 */

(function () {
  "use strict";

  function init() {
    // Initialize the map viewer
    MapViewer.init();

    // Load ranges for search matching
    MapConfig.loadRanges(function (ranges) {
      console.log("[MapApp] Loaded " + ranges.length + " ranges");
    });

    // Wire up reset button
    document.getElementById("reset-btn").addEventListener("click", function () {
      MapViewer.reset();
      clearSearch();
    });

    // Wire up search bar (Phase 3 will add API calls)
    var searchInput = document.getElementById("search-input");
    var searchBtn = document.getElementById("search-btn");
    var searchClear = document.getElementById("search-clear");

    searchBtn.addEventListener("click", function () {
      doSearch(searchInput.value.trim());
    });

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doSearch(searchInput.value.trim());
    });

    searchInput.addEventListener("input", function () {
      searchClear.hidden = !searchInput.value;
    });

    searchClear.addEventListener("click", function () {
      clearSearch();
    });

    // Check for kiosk mode
    if (getParam("kiosk") === "1") {
      document.body.classList.add("kiosk-mode");
      document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }

    // Check for deep-link search
    var q = getParam("q");
    if (q) {
      searchInput.value = q;
      searchClear.hidden = false;
      doSearch(q);
    }
  }

  function doSearch(query) {
    if (!query) return;
    console.log("[MapApp] Search:", query);
    // Phase 3: call SearchAPI.search(query) and render results
  }

  function clearSearch() {
    var searchInput = document.getElementById("search-input");
    var searchClear = document.getElementById("search-clear");
    var resultsPanel = document.getElementById("results-panel");

    searchInput.value = "";
    searchClear.hidden = true;
    resultsPanel.hidden = true;
    MapViewer.clearHighlight();
  }

  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
