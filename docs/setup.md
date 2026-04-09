# FindIt – Setup Guide

## Prerequisites

- Vega Discover with **Custom Header Code** capability
- A web server to host FindIt files (any static host works)
- Floor plan images (JPEG or PNG)

## Step 1: Host the Files

Upload the project to any web server your Vega instance can reach:

```
https://your-server.com/FindIt/
├── src/findit.js
├── src/findit.css
└── libraries/your-library/
    ├── config.js
    └── maps/floor1.jpg
```

## Step 2: Create Your Config

1. Copy `libraries/template/config.js` to `libraries/your-library/config.js`
2. Fill in your library name, floor map URLs, and call number ranges
3. See [configuration.md](configuration.md) for the full property reference

## Step 3: Add to Vega Custom Header

In Vega Discover admin, paste this into **Custom Header Code**:

```html
<!-- FindIt: https://github.com/RHPubLib/FindIt -->
<link  rel="stylesheet" href="https://your-server.com/FindIt/src/findit.css">
<script src="https://your-server.com/FindIt/libraries/your-library/config.js"></script>
<script src="https://your-server.com/FindIt/src/findit.js"></script>
```

> **Note:** Load `config.js` *before* `findit.js` so the configuration is available when the script initialises.

## Step 4: Verify

1. Open your Vega Discover catalog
2. Search for any item
3. Click on a result to open its detail page
4. Open the **Availability** section
5. You should see a **Find It** button next to each holding that matches a range in your config

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
