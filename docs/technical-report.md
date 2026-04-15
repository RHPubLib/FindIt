# FindIt — Technical Report

Rochester Hills Public Library | April 2026
Built by Derek Brown (IT) with Claude Code (AI pair programming)

---

## Executive Summary

FindIt is a shelf-mapping system for the Rochester Hills Public Library that shows patrons exactly where an item is physically located on a floor plan. The system consists of three interconnected applications — a staff editor, a public map app, and a Vega catalog widget — connected through a shared JSON configuration file and five external API integrations.

The entire system was built in approximately 3 days with zero external dependencies, zero recurring costs, and zero vendor lock-in. It achieved a 100/100 Lighthouse accessibility score and is deployed across desktop browsers, mobile devices, and a Google Chrome OS kiosk.

---

## System Architecture

```
                    ┌─────────────────────────────────┐
                    │        editor.rhpl.org           │
                    │    (Staff Rectangle Editor)      │
                    │   Flask + Google OAuth + Canvas   │
                    └────────────┬────────────────────┘
                                 │ SCP push
                                 ▼
┌──────────────┐    ┌─────────────────────────────────┐    ┌──────────────────┐
│  Polaris ILS │◄───│      findit.rhpl.org (GoDaddy)  │───►│  Syndetics       │
│  (PAPI)      │    │  ranges.json + findit-rhpl.js   │    │  (Clarivate)     │
└──────┬───────┘    └──────┬──────────────┬───────────┘    └──────────────────┘
       │                   │              │
       ▼                   ▼              ▼
┌──────────────┐    ┌─────────────┐  ┌──────────────────┐
│ map.rhpl.org │    │ iic.rhpl.org│  │ rhpl.na3.iiivega │
│ (Map App)    │    │ (IIC Vega)  │  │ (Main Catalog)   │
└──────────────┘    └─────────────┘  └──────────────────┘
```

### Data Flow

1. Staff opens `editor.rhpl.org` and authenticates via Google Workspace OAuth
2. Editor loads collection names and shelf locations from Polaris PAPI
3. Staff draws rectangles on floor plan images, labels them, adds directions, places landmark icons
4. Staff clicks "Publish to FindIt"
5. Flask backend collects all rectangles + landmarks from all saved projects
6. Generates `ranges.json` and pushes it + `findit-rhpl.js` to GoDaddy via SCP
7. Patron searches on `map.rhpl.org` — Flask proxies search to Polaris PAPI
8. Results matched against `ranges.json` entries (collection name + call number range)
9. Matched items sorted to top, cover images loaded from Syndetics
10. On Vega catalog sites, `findit-rhpl.js` loads `ranges.json`, scans DOM for item availability, injects "View Shelf Location" button
11. Clicking the button opens a modal with floor plan, highlighted shelf area, pin marker, landmarks, and walking directions

---

## Application Layer 1: Rectangle Editor (editor.rhpl.org)

### Purpose
Web-based tool for IT staff to visually define shelf locations on floor plan images.

### Technology Stack
| Component | Technology |
|-----------|-----------|
| Backend | Python 3.13, Flask 3.1.3, Gunicorn 25.3.0 |
| Authentication | Authlib 1.6.9 (Google Workspace OAuth 2.0 / OpenID Connect) |
| Frontend | Vanilla HTML/CSS/JS, HTML5 Canvas API |
| Process Manager | systemd (`findit-editor.service`) |
| Reverse Proxy | Nginx with `*.rhpl.org` wildcard SSL certificate |

### Key Features
- **Canvas drawing engine**: Click-and-drag rectangle drawing, selection, move, resize, delete
- **Landmark system**: Drag-and-drop icons (🚻 Restrooms, ℹ️ Information, 💧 Water Fountain, 🛗 Elevator) with editable labels
- **Polaris PAPI integration**: Dropdown lookup for 98 collections and 30 shelf locations
- **Directions field**: Staff write walking directions per shelf location
- **One-click publish**: SCP push to GoDaddy production server
- **Project management**: Save/load multiple floor projects, delete images and projects

### Authentication Flow
1. User visits `editor.rhpl.org` → redirected to `/login`
2. Flask redirects to Google OAuth consent screen ("RHPL Web Services")
3. Google authenticates user, returns authorization code
4. Flask exchanges code for tokens via Authlib
5. Email domain checked: must end with `@rhpl.org`
6. Session created (signed cookie, 2-hour expiry, HMAC-SHA1)
7. All API endpoints protected with `@login_required` decorator

### File Locations
| Path | Purpose |
|------|---------|
| `/opt/findit-editor/app.py` | Flask application (all routes) |
| `/opt/findit-editor/venv/` | Python virtual environment |
| `/opt/findit-editor/data/*.json` | Saved project files |
| `/opt/findit-editor/uploads/` | Uploaded floor plan images |
| `/etc/findit-editor/config.env` | Environment config (mode 640) |
| `/etc/systemd/system/findit-editor.service` | systemd service |
| `/etc/nginx/sites-available/editor` | Nginx reverse proxy config |
| `/var/log/findit-editor/` | Gunicorn logs |
| `/home/localadm/FindIT/editor/public/` | Frontend source files |
| `/home/localadm/.ssh/godaddy_findit` | SSH key for GoDaddy deployment |

---

## Application Layer 2: Map App (map.rhpl.org)

### Purpose
Public-facing interactive library map with catalog search. Also deployed as a Google Chrome OS kiosk.

### Technology Stack
| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla HTML/CSS/JS (zero frameworks) |
| API Proxy | Flask (shared with editor on port 8700) |
| Web Server | Nginx (static files + `/api/` proxy to Flask) |
| Kiosk | Google Chrome OS managed device (`?kiosk=1` parameter) |

### Key Features
- **Catalog search**: Queries Polaris PAPI in real-time (100 results per search)
- **Smart result sorting**: Mapped items sorted to top, then available items
- **Rich item card**: Book/DVD cover (Syndetics), title, author, format, availability, "View in Catalog" link
- **Interactive floor plan**: Zoom (buttons + pinch-to-zoom), pan (drag + arrow keys), floor switching
- **Shelf highlighting**: Teal rectangle overlay + Google Maps-style red pin
- **Landmark icons**: Always visible wayfinding (restrooms, elevator, reference desks)
- **Landmark toggle**: ℹ️ button hides/shows landmarks to reduce clutter
- **Collapsible results**: Minimize to bottom bar, expand to see full list
- **Walking directions**: Step-by-step text explaining how to find the shelf
- **Responsive layout**: Desktop (info panel left, map right) / Mobile (map top, info below)
- **Kiosk mode**: Larger touch targets, no text selection, auto-timeout

### Zoom Implementation
The zoom system uses direct image width sizing (NOT CSS transforms):
- **Zoom 1**: CSS handles fit with `max-width: 100%` and `max-height: calc(100vh - 140px)`
- **Zoom > 1**: JavaScript sets `img.style.width` in pixels, clears CSS constraints
- **Zoom back to 1**: CSS constraints restored, `baseWidth` recaptured
- **Pinch-to-zoom**: `touchstart` captures finger distance, `touchmove` scales proportionally
- **Center-preserving**: Scroll fraction saved before zoom, restored after

CSS transforms were attempted initially but caused:
- Broken scrolling on mobile (couldn't scroll in all directions)
- Scroll position calculation errors
- Pinch-to-zoom fighting with browser native gestures

### Caching Strategy
- Nginx adds `Cache-Control: no-cache, must-revalidate` for HTML/JS/CSS
- Ensures kiosk devices pick up code changes without manual cache clearing
- `ranges.json` loaded with `?t=Date.now()` cache-buster
- Editor HTML includes `?v=20260413` on JS/CSS includes

### File Locations
| Path | Purpose |
|------|---------|
| `/home/localadm/FindIT/map-app/index.html` | Page shell |
| `/home/localadm/FindIT/map-app/js/app.js` | Search, results, info panel |
| `/home/localadm/FindIT/map-app/js/map-viewer.js` | Floor tabs, zoom, pan |
| `/home/localadm/FindIT/map-app/js/map-engine.js` | Matching logic, SVG rendering, landmarks |
| `/home/localadm/FindIT/map-app/js/map-config.js` | Config loader, floor definitions |
| `/home/localadm/FindIT/map-app/css/map-app.css` | All styles including responsive |
| `/etc/nginx/sites-available/map` | Nginx config |

---

## Application Layer 3: Vega Catalog Widget (findit-rhpl.js)

### Purpose
JavaScript widget injected into Vega Discover catalog pages that adds a "View Shelf Location" button and interactive map modal.

### Technology Stack
| Component | Technology |
|-----------|-----------|
| Language | Vanilla JavaScript (ES5 compatible) |
| Rendering | Dynamic DOM creation, inline SVG |
| Hosting | GoDaddy cPanel (Apache) |
| Config | Dynamic JSON fetch at runtime |

### How It Works

1. **Script loading**: Single `<script>` tag in Vega Custom Header Code
2. **Config fetch**: XHR loads `ranges.json` from same directory (cache-busted)
3. **DOM scanning**: `MutationObserver` + 500ms polling (30s timeout) watches for `app-physical-item-availability` elements
4. **Data extraction**: Reads `data-automation-id` attributes for:
   - `item-availability-message` — "On shelf at [Collection]"
   - `item-call-number-and-location` — call number, collection text
   - `location-*` — branch/location links
5. **Matching**: Call number checked against ranges (Dewey numeric + alphabetic), collection name substring matched
6. **Button injection**: "View Shelf Location" button placed after Place Hold / Find Specific Edition
7. **Item title extraction**: Reads `h2`/`h3` from parent `app-rollup-card`
8. **Modal display**: Full interactive modal with map, zoom, landmarks, info panel

### Modal Structure
```
┌─────────────────────────────────────┐
│ [RHPL Logo] Collection Name    [X] │  ← Header (teal)
├─────────────────────────────────────┤
│                                     │
│         Floor Plan Image            │  ← Scrollable viewport
│     [Landmarks] [Highlight] [Pin]   │
│                              [+]    │  ← Floating zoom controls
│                              [-]    │
│                              [Fit]  │
│                              [ℹ️]   │  ← Landmark toggle
├─────────────────────────────────────┤
│ Item Title                          │  ← Info panel
│ 📍 Collection Name                  │
│ Walking directions text...          │
└─────────────────────────────────────┘
```

### Rendering Layers (Z-Index Order)
| Z-Index | Element | Rendering |
|---------|---------|-----------|
| 1 | Landmarks | HTML `<div>` elements with emoji + labels |
| 5 | Highlight rectangle | SVG `<rect>` with teal fill (18% opacity) |
| 10 | Pin marker | HTML `<div>` with inline SVG (red teardrop) |

All overlay elements use HTML positioning (CSS percentage left/top + transform) rather than SVG `preserveAspectRatio="none"` to avoid stretching on non-square floor plans.

### Accessibility Features
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on modal
- Focus trap (Tab cycles within modal)
- `focus-visible` outlines on all buttons
- `prefers-reduced-motion` disables animations
- Landmark icons have `role="img"` and `aria-label`
- Keyboard: Escape closes, arrow keys pan

### File Locations (GoDaddy)
| Path | Purpose |
|------|---------|
| `/home/rhpladmin/public_html/FindIt/libraries/rhpl/findit-rhpl.js` | Widget code |
| `/home/rhpladmin/public_html/FindIt/libraries/rhpl/ranges.json` | Config data |
| `/home/rhpladmin/public_html/FindIt/maps/` | Floor plan images |
| `/home/rhpladmin/public_html/FindIt/maps/rhpl-logo-white.png` | RHPL logo |

---

## API Integration Layer

### 1. Polaris PAPI (Polaris Application Programming Interface)

**Protocol**: REST with HMAC-SHA1 request signing
**Base URL**: `https://catalog.rhpl.org/PAPIService`

#### Authentication
Every request requires:
- `Date` header in RFC 1123 format
- `Authorization` header with HMAC-SHA1 signature

Signature algorithm:
```
message = "GET\n\n{date_string}\n\n{uri_lowercase}"
signature = base64(hmac_sha1(secret_key, message))
header = "PWS {access_id}:{signature}"
```

Critical rules:
- URI in signature MUST be lowercase
- Date header must match signed value exactly
- GET requests: content_type is empty string, no Content-Type header
- Clock skew > 5 minutes = request rejected

#### Endpoints Used
| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /REST/public/v1/1033/100/3/collections` | List collections | 98 rows |
| `GET /REST/public/v1/1033/100/3/shelflocations` | List shelf locations | 30 rows |
| `GET /REST/public/v1/1033/100/1/search/bibs/keyword/KW` | Catalog search | Up to 100 results |

#### RHPL-Specific Values
| Parameter | Value |
|-----------|-------|
| LangID | 1033 (English US) |
| AppID | 100 |
| OrgID (search) | 1 (System-level, cross-branch) |
| OrgID (collections) | 3 (Main Library) |

### 2. Vega Discover DOM Integration

FindIt reads Vega's rendered page using `data-automation-id` attributes:

| Attribute | Data Extracted |
|-----------|---------------|
| `item-availability-message` | "On shelf at [Collection Name]" |
| `item-call-number-and-location` | Call number, collection text |
| `location-{Name}-{index}` | Branch/location links |

DOM observation:
- `MutationObserver` on `document.body` (childList + subtree)
- 500ms polling interval, 30s timeout
- Handles Vega's SPA navigation (page doesn't reload between items)

Button injection targets:
- After `find-specific-edition-btn`
- After `place-hold-btn` parent
- Fallback: appended to `app-physical-item-availability` container

### 3. Syndetics (Clarivate) — Cover Images

**URL Patterns**:
- Books: `https://syndetics.com/index.aspx?isbn={ISBN}/MC.GIF`
- DVDs/Blu-ray: `https://syndetics.com/index.aspx?upc={UPC}/MC.GIF`

| Size | Suffix | Dimensions |
|------|--------|-----------|
| Medium | `/MC.GIF` | 132x200 |
| Large | `/LC.JPG` | 265x400 |

- Included free with Clarivate/Polaris subscription
- Same cover source as Vega Discover catalog
- No client ID needed for basic cover API
- RHPL Syndetics Unbound account ID: 2292 (separate from cover API)
- Fallback: `onerror` handler hides image element gracefully

Cover image cascade:
1. PAPI `ThumbnailLink` (OverDrive e-content)
2. Syndetics ISBN lookup (books, audiobooks)
3. Syndetics UPC lookup (DVDs, Blu-rays, kits)

### 4. Vega Discover Deep Linking

"View in Catalog" links from the map app:
```
https://rhpl.na3.iiivega.com/search?query={title}&searchType=everything
```
- Title cleaned of format tags (`[large print]`, `[kit]`, etc.) before encoding
- Opens in new tab (`target="_blank"`)

### 5. Google Workspace OAuth 2.0

Shared OAuth client "RHPL Web Services" across all RHPL web apps:

| Parameter | Value |
|-----------|-------|
| Client ID | `310402963061-...apps.googleusercontent.com` |
| Provider | Google OpenID Connect |
| Scopes | `openid email profile` |
| Domain restriction | `@rhpl.org` email suffix |
| Session | Signed cookies, 2-hour expiry |
| Redirect URI | `https://editor.rhpl.org/callback` |

---

## Search Matching Algorithm

For each Polaris search result, the matching engine checks ranges in order:

### Step 1: Call Number Range Match
```python
# Try numeric (Dewey) comparison
cn_num = float(call_number.split()[0])
if float(start) <= cn_num <= float(end): MATCH

# Try alphabetic comparison (e.g., A-K matches H for DVDs)
cn_alpha = call_number.split()[0]
if start.upper() <= cn_alpha <= end.upper(): MATCH
```

### Step 2: Collection Name Substring Match
```python
searchable = (title + author + call_number + KWIC + summary).lower()
if collection_name.lower() in searchable: MATCH
```

### Step 3: Fuzzy Collection Match
```python
# "Innovative Item" (author) matches "Innovative Items" (collection)
words = collection_name.split()
if words[0] in searchable and words[1].rstrip("s") in searchable: MATCH
```

### Result Sorting
```javascript
results.sort(function(a, b) {
  if (a.match && !b.match) return -1;  // Mapped items first
  if (a.available && !b.available) return -1;  // Available second
  return 0;
});
```

---

## Infrastructure Layer

### Debian Server (d-webL01)
| Property | Value |
|----------|-------|
| Internal IP | 10.5.172.10 |
| External IP | 216.150.230.172 |
| OS | Debian 13 (Trixie) |
| Python | 3.13 |
| Nginx | With `*.rhpl.org` wildcard SSL cert |

### GoDaddy cPanel
| Property | Value |
|----------|-------|
| IP | 132.148.43.54 |
| User | rhpladmin |
| SSH Key | ed25519 (`findit-editor`) |
| Document Root | `/home/rhpladmin/public_html/FindIt/` |
| URL Mapping | `findit.rhpl.org` → document root (no `/FindIt/` prefix) |

### DNS (GoDaddy A Records → 216.150.230.172)
- `editor.rhpl.org`
- `map.rhpl.org`

### GitHub
| Property | Value |
|----------|-------|
| Repository | `github.com/RHPubLib/FindIt` |
| SSH Key | ed25519 (`findit-debian`) |
| License | MIT |

### systemd Services
| Service | Port | Purpose |
|---------|------|---------|
| `findit-editor.service` | 8700 | Flask/Gunicorn (editor + map API) |
| Nginx | 80/443 | Reverse proxy, SSL termination, static files |

---

## Accessibility Compliance

### Lighthouse Score: 100/100

24 audits passed, 0 failures, 0 warnings.

### WCAG 2.1 AA Compliance Measures

| Category | Implementation |
|----------|---------------|
| Color Contrast | All text meets 4.5:1 minimum (muted text #666, status green #1b5e20, red #b71c1c) |
| Focus Indicators | `focus-visible` outlines on all interactive elements |
| Keyboard Navigation | Escape closes, +/- zoom, arrow keys pan, Tab trapped in modals |
| Screen Readers | `aria-live` regions, `role="dialog"`, `aria-labelledby`, `aria-controls` |
| Touch Targets | Minimum 44x44px on all buttons |
| Motion Sensitivity | `prefers-reduced-motion` disables all animations |
| Landmarks | `role="img"` with `aria-label` on all icon elements |
| Alt Text | Dynamic `alt="Cover of [title]"` on all images |
| Tab Pattern | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `tabindex` management |
| Viewport | `user-scalable` allowed (no restriction) |

---

## Data Format: ranges.json

```json
{
  "ranges": [
    {
      "collection": "Large Print Biography",
      "start": "BIO A",
      "end": "BIO Z",
      "label": "Large Print Biography",
      "directions": "The highlighted area on the map shows where your item is located...",
      "map": "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg",
      "x": 63.58,
      "y": 15.06,
      "area": {
        "x": 60.34,
        "y": 14.06,
        "width": 6.48,
        "height": 2.0,
        "color": "#00697f"
      }
    }
  ],
  "landmarks": [
    {
      "x": 25.5,
      "y": 45.2,
      "type": "restrooms",
      "label": "Restrooms",
      "map": "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg"
    }
  ],
  "defaultMap": "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg",
  "publishedBy": "derek.brown@rhpl.org",
  "publishedAt": "Mon, 13 Apr 2026 13:06:30 GMT",
  "projects": ["1st Floor Main Building", "2nd Floor Main Building"]
}
```

All coordinates are percentages (0-100) of the floor plan image dimensions.

---

## Deployment Pipeline

```
Editor Save → /opt/findit-editor/data/{project}.json
     ↓
Publish to FindIt (button click)
     ↓
Flask collects all projects → builds ranges.json
     ↓
SCP to GoDaddy:
  - ranges.json → /home/rhpladmin/public_html/FindIt/libraries/rhpl/ranges.json
  - findit-rhpl.js → /home/rhpladmin/public_html/FindIt/libraries/rhpl/findit-rhpl.js
     ↓
chmod 644 via SSH
     ↓
Live on all Vega catalogs + map.rhpl.org (cache-busted)
```

---

## Dependencies

### Runtime Dependencies (Python venv)
| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 3.1.3 | Web framework |
| Authlib | 1.6.9 | Google OAuth client |
| Gunicorn | 25.3.0 | WSGI server |
| requests | 2.33.1 | HTTP client (Polaris PAPI) |
| cryptography | 46.0.7 | SSL/certificate handling |

### Frontend Dependencies
**None.** Zero frameworks, zero npm packages, zero build step. Pure vanilla HTML/CSS/JS.

### External Services
| Service | Cost | Purpose |
|---------|------|---------|
| GoDaddy cPanel | Existing hosting | Production file serving |
| Google Workspace | Existing subscription | OAuth authentication |
| Polaris ILS | Existing ILS | Catalog data (PAPI) |
| Syndetics | Included with Polaris | Cover images |
| Vega Discover | Existing catalog | DOM integration target |

**Total additional recurring cost: $0**

---

## Lines of Code

| File | Lines | Purpose |
|------|-------|---------|
| `findit-rhpl.js` | ~600 | Vega widget (config loader + engine + modal) |
| `editor/app.py` | ~650 | Flask backend (all API routes) |
| `editor/public/editor.js` | ~1400 | Canvas drawing engine |
| `editor/public/editor.css` | ~700 | Editor styles |
| `editor/public/index.html` | ~280 | Editor HTML |
| `map-app/js/app.js` | ~300 | Map app logic |
| `map-app/js/map-viewer.js` | ~230 | Zoom/pan/tabs |
| `map-app/js/map-engine.js` | ~180 | Matching + rendering |
| `map-app/css/map-app.css` | ~700 | Map app styles |
| **Total** | **~5,040** | |

---

## Browser Support

Tested and working on:
- Chrome (desktop + mobile)
- Safari (iOS)
- Firefox (desktop)
- Chrome OS (kiosk mode)
- Edge (desktop)

---

## Future Considerations

1. Map all 98 Polaris collections across both floors
2. Expand to main catalog (`rhpl.na3.iiivega.com`)
3. Add Google Sheets data layer for librarian-maintained mappings
4. Add staircase/entrance landmark icons
5. Auto-zoom to highlighted shelf on item selection
6. Multiple highlight support (item available at multiple locations)
7. Google Analytics integration for search/usage tracking
8. Print-friendly map view
