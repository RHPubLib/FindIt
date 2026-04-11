# Rectangle Editor — Server Setup Reference

This documents the full server-side stack for the FindIt Rectangle Editor running at `editor.rhpl.org` on the RHPL Debian dev server (`d-webL01`, 10.5.172.10, external 216.150.230.172).

---

## Stack

- **Python 3.13** with Flask, Authlib, Gunicorn
- **Nginx** reverse proxy with SSL (wildcard cert `*.rhpl.org`)
- **systemd** service for auto-start
- **Google Workspace OAuth** for authentication (@rhpl.org only)
- **Polaris PAPI** integration for collections and shelf locations
- **SCP to GoDaddy** for publishing ranges.json to production

---

## File Locations

| What | Where |
|------|-------|
| Flask app | `/opt/findit-editor/app.py` (also `editor/app.py` in this repo) |
| Python venv | `/opt/findit-editor/venv/` |
| Frontend files | `/home/localadm/FindIT/editor/public/` (index.html, editor.js, editor.css) |
| Saved projects | `/opt/findit-editor/data/*.json` |
| Uploaded images | `/opt/findit-editor/uploads/` |
| Environment config | `/etc/findit-editor/config.env` (mode 640) |
| Systemd service | `/etc/systemd/system/findit-editor.service` |
| Nginx config | `/etc/nginx/sites-available/editor` |
| Gunicorn logs | `/var/log/findit-editor/` |
| Login template | `/opt/findit-editor/templates/login.html` |
| SSH key for GoDaddy | `/home/localadm/.ssh/godaddy_findit` |

---

## Environment Variables (`/etc/findit-editor/config.env`)

```
GOOGLE_CLIENT_ID=310402963061-...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
SECRET_KEY=<random hex>
EDITOR_STATIC_DIR=/home/localadm/FindIT/editor/public

# Polaris PAPI
PAPI_BASE_URL=https://catalog.rhpl.org/PAPIService
PAPI_ACCESS_ID=localpull
PAPI_ACCESS_KEY=<key>
PAPI_LANG_ID=1033
PAPI_APP_ID=100
PAPI_ORG_ID=3
```

---

## Polaris PAPI Integration

The editor proxies two Polaris API endpoints so the frontend can populate dropdowns for labeling rectangles. The browser never talks to Polaris directly — the Flask backend makes the authenticated PAPI calls.

### How PAPI Authentication Works

Polaris uses HMAC-SHA1 request signing (not OAuth/JWT):

1. Build a message string: `HTTP_METHOD\ncontent_type\ndate_string\npatron_password\nuri_lowercase`
2. Sign with HMAC-SHA1 using the Access Key
3. Base64-encode the signature
4. Send as `Authorization: PWS {AccessID}:{base64_signature}`

For public GET requests, `content_type` and `patron_password` are empty strings.

### Backend Code (in `app.py`)

```python
def papi_get(path):
    """Make an authenticated GET request to the Polaris API."""
    date_str = formatdate(usegmt=True)
    message = f"GET\n\n{date_str}\n\n{path.lower()}"
    sig = base64.b64encode(
        hmac.new(PAPI_ACCESS_KEY.encode(), message.encode(), hashlib.sha1).digest()
    ).decode()
    headers = {
        "Date": date_str,
        "Authorization": f"PWS {PAPI_ACCESS_ID}:{sig}",
        "Accept": "application/json",
    }
    resp = http_requests.get(PAPI_BASE_URL + path, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()
```

### API Endpoints Exposed to Frontend

**`GET /api/polaris/collections`** — Returns all 98 Polaris collections for OrgID 3 (Main Library).

Calls: `GET /REST/public/v1/1033/100/3/collections`

Response: `[{"id": 1, "name": "Adult Biography", "abbr": "A Bio"}, ...]`

**`GET /api/polaris/shelflocations`** — Returns all 30 shelf locations for OrgID 3.

Calls: `GET /REST/public/v1/1033/100/3/shelflocations`

Response: `[{"id": 5, "description": "Language Kit"}, ...]`

### Frontend Usage

On page load, `editor.js` calls both endpoints and populates two `<select>` dropdowns in the Properties panel. When a user selects a collection or shelf location, it auto-fills the Collection Name and Display Label fields on the selected rectangle.

### PAPI Notes

- The `PAPIErrorCode` in responses is actually a row count, not an error code (e.g., 98 = 98 collections returned)
- The response key for collections is `CollectionsRows`, for shelf locations it's `ShelfLocationsRows`
- Collections have: `ID`, `Name`, `Abbreviation`
- Shelf locations have: `ID`, `Description`
- Material type is per-item, not per-collection — PAPI cannot tell you the material type for a collection
- Swagger UI: `https://catalog.rhpl.org/PAPIService/swagger/index.html`

### RHPL Branch OrgIDs

| OrgID | Branch |
|-------|--------|
| 1 | System |
| 2 | District |
| 3 | Main Library |
| 4 | Bookmobile |
| 5 | Drive-Up Window |
| 6 | Kids' Bus |
| 7 | Books by Mail |
| 8-13 | Mini-Branches (Avon on the Lake, Avon Tower, OPC, Danish Village, Bellbrook, Waltonwood) |
| 15 | Innovative Items Collection |

---

## Publish Flow (SCP to GoDaddy)

When a user clicks "Publish to FindIt":

1. The backend reads ALL saved projects from `/opt/findit-editor/data/*.json`
2. Combines all rectangles into a single `ranges.json` with FindIt-compatible format
3. SCPs `ranges.json` to `rhpladmin@132.148.43.54:/home/rhpladmin/public_html/FindIt/libraries/rhpl/ranges.json`
4. Also SCPs the updated `findit-rhpl.js` engine
5. Runs `chmod 644` on both files via SSH so Apache can serve them
6. Uses SSH key at `/home/localadm/.ssh/godaddy_findit` (ed25519, no passphrase)

### GoDaddy File Layout

```
/home/rhpladmin/public_html/FindIt/    <-- findit.rhpl.org document root
├── libraries/rhpl/
│   ├── findit-rhpl.js                 # Engine (fetches ranges.json at runtime)
│   └── ranges.json                    # Published by editor
├── maps/
│   ├── RHPL-First-Floor.jpg
│   └── RHPL-Second-Floor.jpg
└── .htaccess                          # CORS headers
```

### URL Mapping

`findit.rhpl.org` maps to `/home/rhpladmin/public_html/FindIt/` — so URLs are:
- `https://findit.rhpl.org/libraries/rhpl/findit-rhpl.js` (NOT `/FindIt/libraries/...`)
- `https://findit.rhpl.org/maps/RHPL-First-Floor.jpg`

---

## Google OAuth

Uses the shared "RHPL Web Services" OAuth client (same as eduroam.rhpl.org):

- Client ID: `310402963061-...apps.googleusercontent.com`
- Redirect URI: `https://editor.rhpl.org/callback`
- Domain restriction: `@rhpl.org` only (checked after token exchange)
- Session: 2-hour expiry, signed cookies
- Pattern: Flask + Authlib (identical to `/opt/eduroam-portal/app.py`)

---

## Service Management

```bash
# Check status
sudo systemctl status findit-editor

# Restart after code changes
sudo systemctl restart findit-editor

# View logs
sudo journalctl -u findit-editor -f
cat /var/log/findit-editor/gunicorn.log
cat /var/log/findit-editor/gunicorn-error.log

# Nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## Dependencies (in venv)

```
flask==3.1.3
authlib==1.6.9
gunicorn==25.3.0
requests==2.33.1
cryptography==46.0.7
```
