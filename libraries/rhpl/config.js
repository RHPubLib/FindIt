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

  defaultMap: "https://your-server.example.com/maps/second-floor-iic-marked.jpg",

  ranges: [
    {
      collection: "Innovative Items",
      label: "Innovative Items Collection - 2nd Floor",
      map: "https://your-server.example.com/maps/second-floor.jpg",
      x: 8,
      y: 43,
      area: { x: 2, y: 38, width: 12, height: 10, color: "#00697f" }
    }
  ]
};
