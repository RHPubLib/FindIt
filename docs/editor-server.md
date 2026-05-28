# Rectangle Editor — Server Setup Reference

This documents the full server-side stack for the FindIt Rectangle Editor. RHPL runs it at `editor.rhpl.org` on a Debian dev server; substitute your own server, hostname, and IPs throughout the examples below.

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
| Frontend files | `/home/youruser/FindIT/editor/public/` (index.html, editor.js, editor.css) |
| Saved projects | `/opt/findit-editor/data/*.json` |
| Uploaded images | `/opt/findit-editor/uploads/` |
| Environment config | `/etc/findit-editor/config.env` (mode 640) |
| Systemd service | `/etc/systemd/system/findit-editor.service` |
| Nginx config | `/etc/nginx/sites-available/editor` |
| Gunicorn logs | `/var/log/findit-editor/` |
| Login template | `/opt/findit-editor/templates/login.html` |
| SSH key to publish target | `/home/youruser/.ssh/your_publish_key` |

---

## Environment Variables (`/etc/findit-editor/config.env`)

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
SECRET_KEY=<random hex>
EDITOR_STATIC_DIR=/home/youruser/FindIT/editor/public

# Polaris PAPI
PAPI_BASE_URL=https://your-polaris-server/PAPIService
PAPI_ACCESS_ID=your_access_id
PAPI_ACCESS_KEY=your_secret_key
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

### Example: OrgID layout

OrgIDs are library-specific (defined in your Polaris configuration). RHPL's layout illustrates the typical pattern — a System/District/Main-branch hierarchy plus auxiliary collection points:

| OrgID | Branch (example) |
|-------|------------------|
| 1 | System |
| 2 | District |
| 3 | Main Library |
| 4-7 | Mobile branch, Drive-up service point, Outreach buses, Mail service |
| 8+ | Mini-branches and special collections |

Use Polaris's `/REST/public/v1/{lang}/{app}/branches` endpoint to enumerate your own OrgIDs.

---

## Publish Flow (SCP to GoDaddy)

When a user clicks "Publish to FindIt":

1. The backend reads ALL saved projects from `/opt/findit-editor/data/*.json`
2. Combines all rectangles into a single `ranges.json` with FindIt-compatible format
3. SCPs `ranges.json` to your production web host (e.g. `youruser@your-publish-host:/home/youruser/public_html/FindIt/libraries/yourlibrary/ranges.json`)
4. Also SCPs the updated `findit-yourlibrary.js` engine
5. Runs `chmod 644` on both files via SSH so the web server can serve them
6. Uses an ed25519 SSH key dedicated to this publish flow (no passphrase, restricted to scp on the target path)

### Publish-target file layout

```
/home/youruser/public_html/FindIt/     <-- your-findit-domain document root
├── libraries/yourlibrary/
│   ├── findit-yourlibrary.js          # Engine (fetches ranges.json at runtime)
│   └── ranges.json                    # Published by editor
├── maps/
│   ├── YourLibrary-First-Floor.jpg
│   └── YourLibrary-Second-Floor.jpg
└── .htaccess                          # CORS headers
```

### URL mapping

Your FindIt domain (e.g. RHPL uses `findit.rhpl.org`) maps to `/home/youruser/public_html/FindIt/` — so URLs are:
- `https://your-findit-domain/libraries/yourlibrary/findit-yourlibrary.js`
- `https://your-findit-domain/maps/YourLibrary-First-Floor.jpg`

---

## Google OAuth

Uses a Google Workspace OAuth 2.0 client (you can share one client across multiple internal apps if convenient):

- Client ID: `your-client-id.apps.googleusercontent.com`
- Redirect URI: `https://your-editor-domain/callback`
- Domain restriction: `@yourlibrary.org` only (enforced server-side after token exchange)
- Session: 2-hour expiry, signed cookies
- Pattern: Flask + Authlib (see `editor/app.py` for the reference implementation)

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
