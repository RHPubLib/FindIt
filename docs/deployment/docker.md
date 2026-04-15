# FindIt — Docker Deployment Guide

Deploy FindIt for your library using Docker. No Linux server expertise required beyond basic Docker knowledge.

---

## Prerequisites

- Docker and Docker Compose installed ([Install Docker](https://docs.docker.com/get-docker/))
- Your library's Polaris PAPI credentials (AccessID + Secret Key)
- Floor plan images (JPEG or PNG)
- 10 minutes

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/RHPubLib/FindIt.git
cd FindIt
```

### 2. Add your floor plan images

Place your floor plan images in the `maps/` directory:

```
maps/
├── floor1.jpg
├── floor2.jpg
└── logo.png        (optional: your library's white logo for the header)
```

**Image tips:**
- JPEG for photographs/scans, PNG for digital drawings
- 1200-3000px wide recommended
- The system includes zoom controls, so full resolution is fine

### 3. Configure your library

Edit `docker-compose.yml` and fill in your library's values:

```yaml
environment:
  FINDIT_LIBRARY_NAME: "Springfield Public Library"
  FINDIT_PAPI_BASE_URL: "https://polaris.springfieldpl.org/PAPIService"
  FINDIT_PAPI_ACCESS_ID: "your_access_id"
  FINDIT_PAPI_ACCESS_KEY: "your_secret_key"
  FINDIT_PAPI_ORG_ID: "3"
  FINDIT_VEGA_BASE_URL: "https://springfieldpl.na3.iiivega.com"
  FINDIT_VEGA_DEEP_LINK: "https://springfieldpl.na3.iiivega.com/search?query={title}&searchType=everything"
```

### 4. Create your ranges.json

Create a `data/` directory with a `ranges.json` file:

```bash
mkdir -p data
```

```json
{
  "ranges": [
    {
      "collection": "Adult Fiction",
      "label": "Adult Fiction - 1st Floor",
      "directions": "The highlighted area on the map shows where your item is located. This item is part of the Adult Fiction collection. It is located on the 1st floor, in the main reading area.",
      "map": "/maps/floor1.jpg",
      "x": 45.0,
      "y": 30.0,
      "area": {
        "x": 35.0,
        "y": 25.0,
        "width": 20.0,
        "height": 10.0,
        "color": "#00697f"
      }
    }
  ],
  "landmarks": [
    {
      "x": 50.0,
      "y": 80.0,
      "type": "restrooms",
      "label": "Restrooms",
      "map": "/maps/floor1.jpg"
    }
  ],
  "defaultMap": "/maps/floor1.jpg"
}
```

All coordinates are percentages (0-100) of the image dimensions.

### 5. Start FindIt

```bash
docker-compose up -d
```

### 6. Verify it's running

Visit `http://localhost:8080/map` in your browser. You should see your floor plan with landmarks.

### 7. Add the widget to Vega

In your Vega Discover Admin, add this as the **first line** of Custom Header Code:

```html
<script src="https://findit.yourlibrary.org/widget.js"></script>
```

Replace the URL with wherever your Docker container is accessible.

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `FINDIT_LIBRARY_NAME` | Your library's display name | `Springfield Public Library` |
| `FINDIT_PAPI_BASE_URL` | Polaris PAPI server URL | `https://polaris.spl.org/PAPIService` |
| `FINDIT_PAPI_ACCESS_ID` | PAPI AccessID | `myaccessid` |
| `FINDIT_PAPI_ACCESS_KEY` | PAPI Secret Key | `abc123-def456-...` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `FINDIT_BRAND_COLOR` | `#00697f` | Primary brand color (hex) |
| `FINDIT_LOGO_URL` | (none) | URL to your white logo PNG |
| `FINDIT_PAPI_LANG_ID` | `1033` | Locale ID (1033 = English US) |
| `FINDIT_PAPI_APP_ID` | `100` | Polaris Application ID |
| `FINDIT_PAPI_ORG_ID` | `1` | Organization/branch ID |
| `FINDIT_VEGA_BASE_URL` | (none) | Your Vega Discover URL |
| `FINDIT_VEGA_DEEP_LINK` | (none) | Deep link pattern (`{title}` replaced) |
| `FINDIT_SYNDETICS_URL` | `https://syndetics.com/index.aspx` | Syndetics cover API URL |
| `FINDIT_DEFAULT_MAP` | `/maps/floor1.jpg` | Default floor plan URL |
| `FINDIT_FLOOR1_ID` | `1f` | First floor ID |
| `FINDIT_FLOOR1_LABEL` | `1st Floor` | First floor tab label |
| `FINDIT_FLOOR1_MAP` | `/maps/floor1.jpg` | First floor image URL |
| `FINDIT_FLOOR2_ID` | `2f` | Second floor ID |
| `FINDIT_FLOOR2_LABEL` | `2nd Floor` | Second floor tab label |
| `FINDIT_FLOOR2_MAP` | `/maps/floor2.jpg` | Second floor image URL |

---

## Production Deployment

### Behind a Reverse Proxy (recommended)

Put the Docker container behind your existing reverse proxy (Nginx, Apache, Caddy) with SSL:

```nginx
server {
    listen 443 ssl;
    server_name findit.yourlibrary.org;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Updating Content

To update `ranges.json` or floor plan images, just edit the files in your mounted volumes:

```bash
# Edit ranges.json
nano data/ranges.json

# Changes are live immediately (no restart needed)
```

To update the FindIt code:

```bash
git pull
docker-compose build
docker-compose up -d
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't reach Polaris PAPI | Ensure the Docker host can access your Polaris server. Check firewall rules. |
| CORS errors on widget.js | The nginx config includes CORS headers. If using a reverse proxy, ensure it passes them through. |
| No cover images | Syndetics requires the ISBN/UPC from Polaris search results. Verify your PAPI credentials return ISBN data. |
| Widget doesn't appear in Vega | The `<script>` tag must be the **first line** in Custom Header Code. Vega strips scripts that appear after HTML. |
| Floor plan too large/small | Images scale automatically. Use 1200-3000px wide for best results. |

---

## Getting Your Polaris PAPI Credentials

1. Contact your Polaris system administrator
2. Request an API AccessID and Secret Key for public read-only access
3. Ask for the AppID assigned to your API application
4. Find your OrgID (branch ID) in Polaris Administration

The PAPI Swagger documentation is available at:
`https://your-polaris-server/PAPIService/swagger/index.html`
