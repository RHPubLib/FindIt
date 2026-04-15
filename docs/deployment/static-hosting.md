# FindIt — Static Hosting Deployment Guide

Deploy FindIt without Docker or a server using free static hosting. This path works for the **map app** and **Vega widget** — the editor requires a backend server (see the Docker guide for that).

---

## Option 1: GitHub Pages (simplest)

### Setup

1. Fork the repository on GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch** → `main` → `/docs` or `/(root)`
4. Your site will be at `https://yourusername.github.io/FindIt/`

### Configuration

Edit `map-app/js/map-config.js` with your library's floor plan URLs and ranges.json location:

```javascript
var MapConfig = {
  libraryName: "Your Library",
  floors: [
    {
      id: "1f",
      label: "1st Floor",
      map: "https://yourusername.github.io/FindIt/maps/floor1.jpg"
    }
  ],
  defaultFloor: "1f",
  ranges: []
};

MapConfig.loadRanges = function (callback) {
  var url = "https://yourusername.github.io/FindIt/data/ranges.json";
  // ... (rest of loader)
};
```

### Add to Vega

```html
<script src="https://yourusername.github.io/FindIt/libraries/your-library/findit.js"></script>
```

---

## Option 2: Cloudflare Pages (fast global CDN)

### Setup

1. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com) (free tier)
2. Connect your GitHub repo
3. Set build output directory to `/` (no build step needed)
4. Add a custom domain: `findit.yourlibrary.org`

### Benefits

- Global CDN (fast worldwide)
- Free SSL
- Automatic deploys on git push
- 500 deploys/month on free tier

---

## Option 3: Netlify (easy drag-and-drop)

### Setup

1. Sign up at [netlify.com](https://www.netlify.com) (free tier)
2. Drag your `FindIt/` folder onto the deploy area, or connect GitHub
3. Add a custom domain

### Benefits

- Drag-and-drop deploys (no git required)
- Free SSL
- 100GB bandwidth/month on free tier

---

## Option 4: Any Web Server (Apache, Nginx, IIS)

Upload these directories to your web server:

```
your-server.com/
├── map/                    ← map-app/ directory
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── img/
├── data/
│   └── ranges.json         ← your shelf location data
├── maps/
│   ├── floor1.jpg
│   └── floor2.jpg
├── widget.js               ← findit-rhpl.js (renamed)
└── .htaccess               ← CORS headers (Apache only)
```

**Apache `.htaccess`:**
```apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
</IfModule>
```

**Nginx:**
```nginx
location /widget.js {
    add_header Access-Control-Allow-Origin "*";
}
location /data/ {
    add_header Access-Control-Allow-Origin "*";
}
```

---

## File Layout

```
dist/
├── map/                    # Public map app
│   ├── index.html
│   ├── css/map-app.css
│   ├── js/
│   │   ├── app.js
│   │   ├── map-config.js   ← Edit this for your library
│   │   ├── map-engine.js
│   │   └── map-viewer.js
│   └── img/
│       └── rhpl-logo-white.png  ← Replace with your logo
├── data/
│   └── ranges.json         # Your shelf locations (edit or generate with editor)
├── maps/
│   ├── floor1.jpg           # Your floor plan images
│   └── floor2.jpg
├── widget.js                # Vega catalog widget (edit config section)
└── .htaccess                # CORS headers
```

---

## Creating ranges.json Without the Editor

If you don't want to deploy the editor, you can create `ranges.json` manually:

```json
{
  "ranges": [
    {
      "collection": "Adult Fiction",
      "label": "Adult Fiction - Main Floor",
      "directions": "Located on the main floor in the east wing.",
      "map": "/maps/floor1.jpg",
      "x": 60,
      "y": 40,
      "area": {
        "x": 50,
        "y": 35,
        "width": 20,
        "height": 10,
        "color": "#00697f"
      }
    }
  ],
  "landmarks": [],
  "defaultMap": "/maps/floor1.jpg"
}
```

**How to find coordinates:**
1. Open your floor plan image in any image editor
2. Find the pixel position of the shelf area
3. Convert to percentages: `x% = (pixel_x / image_width) * 100`

---

## Limitations of Static Hosting

Without a backend server, you **cannot** use:
- The visual rectangle editor (requires Flask + OAuth)
- Polaris PAPI search proxy (requires server-side HMAC signing)
- One-click publish

You **can** use:
- The interactive map with pre-configured shelf locations
- The Vega catalog widget
- Floor switching, zoom, pan, landmarks
- Cover images (Syndetics works client-side)

For the full experience including the editor and catalog search, use the [Docker deployment](docker.md).
