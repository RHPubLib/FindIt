# FindIt

Open-source shelf-mapping for [Vega Discover](https://www.iii.com/products/vega/) library catalogs. Shows patrons exactly where a book is physically shelved — a floor map with a marker — without a paid subscription.

**Live demo:** Rochester Hills Public Library → [discover.rhpl.org](https://discover.rhpl.org)

---

## How It Works

Three lines of code go into Vega's **Custom Header Code** field. The script polls the page for availability drawer elements (the `data-automation-id` attributes Vega already renders), extracts the call number and location, matches against a library-provided range table, and injects a "Find It" button. Clicking the button opens a modal with a floor plan image and a positioned marker.

No server-side component. No recurring cost. No external API calls. Pure vanilla JavaScript.

---

## Quick Start

### 1. Host this project

Upload the files to any web server your Vega instance can reach:

```
https://your-server.com/FindIt/
├── src/findit.js
├── src/findit.css
└── libraries/your-library/
    ├── config.js
    └── maps/floor1.jpg
```

### 2. Create your config

Copy `libraries/template/config.js` to `libraries/your-library/config.js` and fill in:
- Floor plan image URLs
- Call number ranges with `x`/`y` marker positions (percentages from top-left)
- Any collection/location overrides

### 3. Add to Vega Custom Header

```html
<!-- FindIt: https://github.com/RHPubLib/FindIt -->
<link  rel="stylesheet" href="https://your-server.com/FindIt/src/findit.css">
<script src="https://your-server.com/FindIt/libraries/your-library/config.js"></script>
<script src="https://your-server.com/FindIt/src/findit.js"></script>
```

Full instructions: [docs/setup.md](docs/setup.md)

---

## Documentation

| Document | Contents |
|---|---|
| [docs/setup.md](docs/setup.md) | Step-by-step Vega Custom Header setup; selector verification snippet |
| [docs/configuration.md](docs/configuration.md) | Full config property reference |
| [docs/floor-map-guide.md](docs/floor-map-guide.md) | Preparing images; measuring x/y coordinates |

---

## Supported Matching Rules

Each range entry uses one matcher:

| Matcher | Example |
|---|---|
| Dewey numeric range | `{ start: "500", end: "599.99", ... }` |
| Collection contains | `{ collection: "Large Print", ... }` |
| Location contains | `{ location: "Children", ... }` |
| Call-number prefix | `{ prefix: "DVD", ... }` |

Juvenile prefixes (`J`, `YA`, `E`, etc.) are automatically stripped before numeric comparison.

---

## Requirements

- Vega Discover with Custom Header Code capability
- A web server to host the files (any static file host works)
- Floor plan images (JPEG or PNG)

No build step. No npm. No dependencies.

---

## Contributing

PRs welcome. If you add a config for your library, please contribute it back to `libraries/` so others can see real-world examples.

To report a bug or request a feature: [open an issue](https://github.com/RHPubLib/FindIt/issues).

---

## License

MIT — free to use, modify, and share.
