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
   * branches – optional, for multi-branch/multi-floor libraries.
   *
   * Each entry defines a branch or floor that items can live at.
   * Omit this entirely for single-branch libraries.
   *
   *   id       – unique key referenced by ranges (e.g. "main-1f")
   *   label    – tab text shown in the modal (e.g. "1st Floor")
   *   location – text to match against Vega's location pills
   */
  // branches: [
  //   { id: "main-1f", label: "1st Floor",   location: "Main Library" },
  //   { id: "main-2f", label: "2nd Floor",   location: "Main Library" },
  //   { id: "branch2", label: "South Branch", location: "South Branch" }
  // ],

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
   *   branch – (optional) ties this range to a branch id from the
   *            branches array above. For multi-branch items, create
   *            one range per branch with the same matcher.
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
