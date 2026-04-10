# FindIt

Open-source shelf-mapping for [Vega Discover](https://www.iii.com/products/vega/) library catalogs. Shows patrons exactly where an item is physically located using an interactive floor map — no paid subscription required.

---

> **This repository is a project template, not a deployment source.**
> Clone or fork it, customize the config for your library, and deploy
> the files to **your own web server** via SFTP or your preferred method.
> Never link your catalog directly to files hosted on GitHub.

---

## What It Does

When a patron views an item in your Vega Discover catalog, FindIt adds a **"View Shelf Location"** button alongside the existing action buttons (Place Hold, Find Specific Edition). Clicking the button opens a modal overlay with:

- A teal header bar showing the collection/location name
- The library's floor map with the item's shelf location highlighted
- Zoom in, zoom out, and fit-to-view controls
- Click-and-drag panning when zoomed in
- Close via the X button, clicking outside the modal, or pressing Escape

The button integrates seamlessly with Vega's existing UI — matching the style and placement of native action buttons.

---

## How It Works

FindIt is a single JavaScript file that:

1. **Scans** the Vega DOM for availability information using `data-automation-id` attributes (`item-availability-message`, `item-call-number-and-location`)
2. **Matches** the item's collection, location, call number, or Dewey range against a library-defined configuration
3. **Injects** a "View Shelf Location" button into the action area (next to Place Hold)
4. **Opens** an interactive map modal when the button is clicked

No server-side component. No recurring cost. No external API calls. Pure vanilla JavaScript.

---

## Security: Self-Host Your Files

FindIt is designed so that each library hosts its own copy of the script and map images on infrastructure they control. This is intentional:

- **Map images** contain your library's floor plans — host them on your own server, uploaded via SFTP
- **Config files** contain URLs pointing to your server — keep them on your server, not on GitHub
- **The bundled JS file** runs in your patrons' browsers — serve it from your own domain

**Do not** load scripts or images directly from this GitHub repository into your catalog. If you do, anyone with push access to the repo could change what your patrons see. Always deploy to your own server first.

---

## Quick Start

### 1. Clone this repository

```bash
git clone https://github.com/RHPubLib/FindIt.git
```

### 2. Create your library's config

Copy the template and customize for your library:

```
libraries/your-library/
└── findit-yourlibrary.js   (config + engine bundled together)
```

The bundled file includes both your library's configuration (collection names, map URLs) and the FindIt engine in a single file. See `libraries/rhpl/findit-rhpl.js` for a working example.

### 3. Prepare floor plan images

Create floor plan images with highlighted areas showing where items are shelved:

- Use any image editor to highlight shelf locations with a colored overlay
- Save as JPEG for photographs/scans, PNG for digital drawings
- Full resolution is fine — the modal includes zoom controls

See [docs/floor-map-guide.md](docs/floor-map-guide.md) for detailed guidance.

### 4. Upload to your web server

Upload your bundled JS file, CSS, and map images to any web server your Vega instance can reach. For example, using SFTP to a GoDaddy cPanel host with a `findit.` subdomain:

```
your-server.com/
├── findit-yourlibrary.js
├── findit.css
├── .htaccess              (copy from .htaccess.example)
└── maps/
    └── floor1-marked.jpg
```

### 5. Add one line to Vega Custom Header Code

Add a single `<script>` tag as the **very first line** of your Custom Header Code. That's it — one line enables FindIt on that catalog:

```html
<script src="https://your-server.com/libraries/your-library/findit-yourlibrary.js"></script>
```

**Important:** Vega strips `<script>` tags that appear after HTML content, so the script tag must come before any `<style>` or `<div>` elements in the header.

The bundled JS file includes inline styles, so no separate CSS file is required. If you prefer using the external stylesheet for the standalone (non-bundled) setup, add this anywhere in the header:

```html
<link rel="stylesheet" href="https://your-server.com/src/findit.css">
```

---

## Configuration

The bundled JS file includes a `FindItConfig` object:

```js
window.FindItConfig = {
  libraryName: "Your Library",
  buttonLabel: "View Shelf Location",
  defaultMap: "https://your-server.com/maps/floor1-marked.jpg",
  ranges: [
    {
      collection: "Innovative Items",
      label: "Innovative Items Collection - 2nd Floor",
      map: "https://your-server.com/maps/floor1-iic-marked.jpg"
    }
  ]
};
```

### Matching Rules

Each range entry uses one matcher:

| Matcher | Example | Description |
|---|---|---|
| `collection` | `"Large Print"` | Matches if collection text contains this value (case-insensitive) |
| `location` | `"Children"` | Matches if branch/location text contains this value |
| `prefix` | `"DVD"` | Matches if call number starts with this value |
| `start` + `end` | `"500"` / `"599.99"` | Dewey decimal range (inclusive) |

Juvenile prefixes (`J`, `YA`, `E`, etc.) are automatically stripped before Dewey comparison.

### Display Properties

| Property | Description |
|---|---|
| `label` | Text shown in the modal header bar |
| `map` | URL of the floor plan image (falls back to `defaultMap`) |

---

## Architecture

```
FindIt/                        <-- PROJECT TEMPLATE (do not serve from GitHub)
├── src/
│   ├── findit.js              # Standalone engine (for separate config loading)
│   └── findit.css             # Modal, button, and marker styles
├── libraries/
│   ├── template/
│   │   └── config.js          # Template for new libraries
│   └── rhpl/
│       ├── config.js          # RHPL example config (reference only)
│       └── findit-rhpl.js     # RHPL example bundled file (reference only)
├── maps/
│   └── README.md              # Maps go on YOUR server, not here
├── docs/                      # Setup and configuration guides
├── .htaccess.example          # Copy to your server as .htaccess
└── README.md
```

### Bundled vs. Separate Loading

- **Bundled** (recommended): Single file contains config + engine. Works with Vega's script restrictions. Used for production deployment.
- **Separate**: Config and engine in separate files. Requires Vega to load multiple script tags, which may not work depending on your Vega version.

---

## Deployment

### Recommended: SFTP to your hosting provider

1. Set up a subdomain (e.g., `findit.yourlibrary.org`) on your hosting
2. Upload files via SFTP to the subdomain's document root
3. Copy `.htaccess.example` to `.htaccess` on your server for CORS headers
4. Point your Vega Custom Header Code at your server's URLs

### What goes on your server vs. what stays in the repo

| Location | Purpose |
|---|---|
| **Your server** | Production files: bundled JS, CSS, map images, .htaccess |
| **This repo** | Source code, templates, documentation, examples |

---

## Multiple Vega Sites, One Script

A single FindIt script on your server can power multiple Vega Discover sites. If your library runs separate Vega instances — for example, a public catalog and a kiosk — you just add the same one-line `<script>` tag to each site's Custom Header Code:

```html
<script src="https://your-server.com/libraries/your-library/findit-yourlibrary.js"></script>
```

This works because:

- **All Vega Discover sites share the same DOM structure** — the same `data-automation-id` attributes, the same `app-physical-item-availability` components
- **FindIt matches on collection/location text**, not on the site URL — so if both sites display "On shelf at Large Print", both will show the button
- **One hosted file, many catalogs** — update the script once on your server and every site picks up the change

For example, Rochester Hills Public Library uses the same `findit-rhpl.js` across their IIC Collection catalog and their IIC Kiosk catalog. Both sites point to the same file on `findit.rhpl.org` — no duplication, no separate configs.

### When you might need separate configs

If different Vega sites use different collection names or need different map images, you can create separate bundled files (e.g., `findit-main.js` and `findit-kiosk.js`) with their own config sections. But in most cases, one file covers all your sites.

---

## Vega Integration Notes

- Vega's Custom Header Code field has specific behavior around `<script>` tags
- External `<script src="...">` tags **must be placed as the first line** of the header code to execute
- `<link>` tags for CSS work from any position
- Inline `<script>` content (code between tags) is stripped by Vega
- The engine uses `MutationObserver` and polling to handle Vega's SPA navigation

### CORS

If hosting on a different domain than your Vega instance, copy `.htaccess.example` to your server as `.htaccess`:

```apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
</IfModule>
```

---

## Requirements

- Vega Discover with Custom Header Code capability
- A web server to host the files (any static file host works — GoDaddy, Bluehost, etc.)
- Floor plan images with highlighted shelf locations
- SFTP client for uploading files to your server

No build step. No npm. No dependencies.

---

## Contributing

PRs welcome. If you add a config for your library, please contribute it back to `libraries/` so others can see real-world examples. Use placeholder URLs (`your-server.example.com`) in contributed configs — do not include your production server URLs.

To report a bug or request a feature: [open an issue](https://github.com/RHPubLib/FindIt/issues).

---

## License

MIT — free to use, modify, and share.
