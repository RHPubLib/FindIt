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

    // Wire up results panel close button
    document.getElementById("results-close").addEventListener("click", function () {
      document.getElementById("results-panel").style.display = "none";
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

    var resultsPanel = document.getElementById("results-panel");
    var resultsList = document.getElementById("results-list");
    resultsPanel.style.display = "flex";
    resultsList.innerHTML = '<li class="result-loading">Searching...</li>';

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/search?q=" + encodeURIComponent(query) + "&limit=100", true);
    xhr.onload = function () {
      if (xhr.status !== 200) {
        resultsList.innerHTML = '<li class="result-error">Search failed</li>';
        return;
      }
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.error) {
          resultsList.innerHTML = '<li class="result-error">' + data.error + '</li>';
          return;
        }
        renderResults(data.results || [], data.total || 0);
      } catch (e) {
        resultsList.innerHTML = '<li class="result-error">Failed to parse results</li>';
      }
    };
    xhr.onerror = function () {
      resultsList.innerHTML = '<li class="result-error">Search failed — check connection</li>';
    };
    xhr.send();
  }

  function renderResults(results, total) {
    var resultsList = document.getElementById("results-list");
    if (!results.length) {
      resultsList.innerHTML = '<li class="result-empty">No results found</li>';
      return;
    }

    // Sort: mapped items first, then available, then the rest
    results.sort(function (a, b) {
      if (a.match && !b.match) return -1;
      if (!a.match && b.match) return 1;
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return 0;
    });

    // Update the collapsed bar text
    var barText = document.getElementById("results-bar-text");
    if (barText) barText.textContent = total + " result" + (total !== 1 ? "s" : "");

    resultsList.innerHTML = "";
    var header = document.createElement("li");
    header.className = "result-header";
    header.textContent = total + " result" + (total !== 1 ? "s" : "") + " found";
    resultsList.appendChild(header);

    results.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "result-item" + (item.match ? " has-match" : "");

      var title = document.createElement("div");
      title.className = "result-title";
      title.textContent = item.title || "Untitled";
      li.appendChild(title);

      if (item.author) {
        var author = document.createElement("div");
        author.className = "result-author";
        author.textContent = item.author;
        li.appendChild(author);
      }

      var meta = document.createElement("div");
      meta.className = "result-meta";
      var parts = [];
      if (item.callNumber) parts.push(item.callNumber);
      if (item.format) parts.push(item.format);
      if (item.available) parts.push("Available");
      else if (item.totalCopies > 0) parts.push(item.copiesIn + "/" + item.totalCopies + " in");
      meta.textContent = parts.join(" · ");
      li.appendChild(meta);

      if (item.match) {
        var loc = document.createElement("div");
        loc.className = "result-location";
        loc.textContent = item.match.label || item.match.collection || "View on map";
        li.appendChild(loc);

        li.addEventListener("click", function () {
          document.getElementById("results-panel").style.display = "none";
          document.getElementById("results-bar").style.display = "flex";
          MapViewer.highlight(item.match);
          showInfoPanel(item);
        });
      }

      resultsList.appendChild(li);
    });
  }

  function showInfoPanel(item) {
    var panel = document.getElementById("info-panel");
    if (!item) { panel.style.display = "none"; return; }

    var match = item.match || {};
    var coverUrl = item.thumbnail || "";
    if (!coverUrl && item.isbn) {
      coverUrl = "https://syndetics.com/index.aspx?isbn=" + item.isbn + "/MC.GIF&client=2292";
    }

    var html = '<div class="info-card">';
    if (coverUrl) {
      html += '<img class="info-cover" src="' + coverUrl + '" alt="" onerror="this.style.display=\'none\'">';
    }
    html += '<div class="info-details">';
    html += '<div class="info-item-title">' + (item.title || "") + '</div>';
    if (item.author) html += '<div class="info-author">' + item.author + '</div>';
    var meta = [];
    if (item.format) meta.push(item.format);
    if (item.publicationDate) meta.push(item.publicationDate);
    if (item.callNumber) meta.push(item.callNumber);
    if (meta.length) html += '<div class="info-meta">' + meta.join(" · ") + '</div>';
    if (item.available) {
      html += '<div class="info-avail available">Available (' + item.copiesIn + ' of ' + item.totalCopies + ')</div>';
    } else if (item.totalCopies > 0) {
      html += '<div class="info-avail checked-out">Checked Out (' + item.holds + ' holds)</div>';
    }
    // Catalog link
    var cleanTitle = (item.title || "").replace(/\s*\[.*?\]\s*/g, "").trim();
    var vegaUrl = "https://rhpl.na3.iiivega.com/search?query=" + encodeURIComponent(cleanTitle) + "&searchType=everything";
    html += '<a class="info-catalog-link" href="' + vegaUrl + '" target="_blank">View in Catalog →</a>';
    html += '</div></div>';
    // Location & directions
    if (match.collection || match.directions) {
      html += '<div class="info-location">';
      if (match.collection) html += '<div class="info-collection">📍 ' + match.collection + '</div>';
      if (match.directions) html += '<div class="info-directions">' + match.directions + '</div>';
      html += '</div>';
    }

    panel.innerHTML = html;
    panel.style.display = "";
  }

  function hideInfoPanel() {
    document.getElementById("info-panel").style.display = "none";
  }

  function clearSearch() {
    var searchInput = document.getElementById("search-input");
    var searchClear = document.getElementById("search-clear");
    var resultsPanel = document.getElementById("results-panel");

    searchInput.value = "";
    searchClear.hidden = true;
    resultsPanel.style.display = "none";
    document.getElementById("results-bar").style.display = "none";
    hideInfoPanel();
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
