/**
 * FindIt – Example Configuration (Rochester Hills Public Library)
 *
 * This is a REFERENCE EXAMPLE showing how RHPL configured FindIt for
 * their Innovative Items Collection catalog. Copy and adapt for your
 * own library.
 *
 * IMPORTANT: Map URLs must point to YOUR OWN web server, not to this
 * GitHub repository. Upload maps via SFTP to your hosting provider.
 */

window.FindItConfig = {

  libraryName: "Rochester Hills Public Library",

  buttonLabel: "View Shelf Location",

  defaultMap: "https://your-server.example.com/maps/first-floor.jpg",

  /* Multi-branch support: RHPL has two floors + a Bookmobile */
  branches: [
    { id: "main-1f", label: "1st Floor",        location: "Main Library" },
    { id: "main-2f", label: "2nd Floor",        location: "Main Library" },
    { id: "van",     label: "Bookmobile (Van)", location: "Bookmobile" }
  ],

  ranges: [
    /* IIC – only on 2nd floor (single location, no tabs shown) */
    {
      collection: "Innovative Items",
      label: "Innovative Items Collection - 2nd Floor",
      branch: "main-2f",
      map: "https://your-server.example.com/maps/second-floor.jpg",
      x: 8,
      y: 43,
      area: { x: 2, y: 38, width: 12, height: 10, color: "#00697f" }
    }

    /* Multi-branch example: Large Print at Main 1F + Bookmobile
     * Uncomment and customise once map images and coordinates are ready.
     *
     * {
     *   collection: "Large Print",
     *   label: "Large Print - 1st Floor",
     *   branch: "main-1f",
     *   map: "https://your-server.example.com/maps/first-floor.jpg",
     *   x: 63, y: 15,
     *   area: { x: 60, y: 14, width: 7, height: 2, color: "#00697f" }
     * },
     * {
     *   collection: "Large Print",
     *   label: "Large Print - Bookmobile",
     *   branch: "van",
     *   map: "https://your-server.example.com/maps/bookmobile.jpg",
     *   x: 50, y: 50
     * }
     */
  ]
};
