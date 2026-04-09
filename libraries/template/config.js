/**
 * FindIt – Library Configuration Template
 *
 * Copy this file to libraries/your-library/config.js and customise.
 * Load it BEFORE findit.js in your Vega Custom Header.
 *
 * Full reference: docs/configuration.md
 */

window.FindItConfig = {

  /* Display name shown in the modal (optional) */
  libraryName: "Your Library",

  /* Text on the injected button (default: "Find It") */
  buttonLabel: "Find It",

  /* Fallback map if a range entry has no "map" property */
  defaultMap: "https://your-server.com/FindIt/libraries/your-library/maps/floor1.jpg",

  /**
   * ranges – an array of matcher objects.
   *
   * Each entry needs ONE matcher:
   *   Dewey range  → { start: "500", end: "599.99" }
   *   Collection   → { collection: "Large Print" }
   *   Location     → { location: "Children" }
   *   Prefix       → { prefix: "DVD" }
   *
   * Plus display properties:
   *   label  – text shown in the modal header
   *   map    – URL of the floor-plan image
   *   x, y   – marker position as % from top-left corner
   */
  ranges: [
    /* --- Example: Dewey range --- */
    {
      start: "000",
      end: "099.99",
      label: "Computer Science & General Works – 1st Floor",
      map: "https://your-server.com/FindIt/libraries/your-library/maps/floor1.jpg",
      x: 45,
      y: 30
    },

    /* --- Example: Collection match --- */
    {
      collection: "Large Print",
      label: "Large Print Collection – 2nd Floor",
      map: "https://your-server.com/FindIt/libraries/your-library/maps/floor2.jpg",
      x: 60,
      y: 55
    },

    /* --- Example: Prefix match --- */
    {
      prefix: "DVD",
      label: "DVDs – 1st Floor Media Area",
      map: "https://your-server.com/FindIt/libraries/your-library/maps/floor1.jpg",
      x: 25,
      y: 70
    }
  ]
};
