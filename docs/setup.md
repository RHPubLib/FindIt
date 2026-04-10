# FindIt – Setup Guide

## Prerequisites

- Vega Discover with **Custom Header Code** capability
- A web server to host FindIt files (GoDaddy, Bluehost, any static host)
- An SFTP client (FileZilla, WinSCP, or cPanel File Manager)
- Floor plan images (JPEG or PNG)

## Step 1: Clone the Repository

```bash
git clone https://github.com/RHPubLib/FindIt.git
```

This gives you the project template. You will customize it locally and then upload your files to your own server.

## Step 2: Create Your Config

1. Copy `libraries/template/config.js` to `libraries/your-library/config.js`
2. Fill in your library name, floor map URLs, and call number ranges
3. See [configuration.md](configuration.md) for the full property reference

**Important:** All URLs in your config must point to **your own web server**, not to GitHub.

## Step 3: Bundle Your File

Create a single bundled file containing your config + the FindIt engine. See `libraries/rhpl/findit-rhpl.js` for the pattern — paste your config at the top, then the engine code below it.

## Step 4: Upload to Your Server

Upload the following to your web server via SFTP:

```
your-server.com/
├── findit-yourlibrary.js    (your bundled file)
├── findit.css               (from src/)
├── .htaccess                (copy from .htaccess.example)
└── maps/
    └── floor1-marked.jpg    (your floor plan images)
```

## Step 5: Add One Line to Vega Custom Header

In Vega Discover admin, paste this as the **very first line** of your **Custom Header Code**:

```html
<script src="https://your-server.com/libraries/your-library/findit-yourlibrary.js"></script>
```

That's it — one line. The bundled file includes inline styles, so no separate CSS link is needed.

> **Note:** Vega strips `<script>` tags that appear after HTML content, so the script tag must come before any `<style>` or `<div>` elements in the header.

### Multiple Vega Sites

If your library runs more than one Vega Discover instance (e.g., a public catalog and a kiosk), add the **same script tag** to each site's Custom Header Code. One hosted file powers all your Vega sites — no duplication needed. All Vega Discover instances share the same DOM structure, so FindIt works identically across them.

## Step 6: Verify

1. Open your Vega Discover catalog
2. Search for any item
3. Click on a result to open its detail page
4. Open the **Availability** section
5. You should see a **"View Shelf Location"** button next to each holding that matches a range in your config

### Quick Verification Snippet

Paste this into your browser console on a Vega item page to check that the availability selectors are present:

```js
document.querySelectorAll('[data-automation-id="availability_holding_container"]')
  .forEach(function(row, i) {
    var cn = row.querySelector('[data-automation-id="availability_call_number"]');
    console.log("Row " + i + ":", cn ? cn.textContent.trim() : "(no call number)");
  });
```

If you see call numbers logged, FindIt will work on this page.
