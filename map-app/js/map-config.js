/**
 * Map App – Configuration
 *
 * Branches, floor plan URLs, and API endpoints.
 * Ranges are loaded dynamically from the API or ranges.json.
 */

var MapConfig = {
  libraryName: "Rochester Hills Public Library",

  /* API base URL (same origin when hosted on map.rhpl.org) */
  apiBase: "",

  /* Floor plan images hosted on GoDaddy */
  floors: [
    {
      id: "1f",
      label: "1st Floor",
      map: "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg"
    },
    {
      id: "2f",
      label: "2nd Floor",
      map: "https://findit.rhpl.org/maps/RHPL-Second-Floor.jpg"
    }
  ],

  /* Branch definitions (matches FindIt config) */
  branches: [
    { id: "main-1f", label: "1st Floor",        location: "Main Library", floor: "1f" },
    { id: "main-2f", label: "2nd Floor",        location: "Main Library", floor: "2f" },
    { id: "van",     label: "Bookmobile (Van)", location: "Bookmobile",   floor: null }
  ],

  /* Default floor shown on load */
  defaultFloor: "1f",

  /* Kiosk inactivity timeout (ms) */
  kioskTimeout: 90000,

  /* Loaded at runtime */
  ranges: []
};

/**
 * Load ranges from the API or a static file.
 */
MapConfig.loadRanges = function (callback) {
  var url = this.apiBase
    ? this.apiBase + "/api/ranges"
    : "https://findit.rhpl.org/libraries/rhpl/ranges.json";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", url + "?t=" + Date.now(), true);
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        MapConfig.ranges = JSON.parse(xhr.responseText);
      } catch (e) {
        console.warn("[MapApp] Failed to parse ranges.json:", e);
        MapConfig.ranges = [];
      }
    }
    if (callback) callback(MapConfig.ranges);
  };
  xhr.onerror = function () {
    console.warn("[MapApp] Failed to load ranges.json");
    if (callback) callback([]);
  };
  xhr.send();
};
