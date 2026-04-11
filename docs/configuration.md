# FindIt – Configuration Reference

All configuration lives in a single `config.js` file per library, loaded before `findit.js`.

## Top-Level Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `libraryName` | string | No | Display name (shown in modal if no range label) |
| `buttonLabel` | string | No | Button text (default: `"Find It"`) |
| `defaultMap` | string | No | Fallback floor map URL if a range has no `map` |
| `branches` | array | No | Branch/floor definitions for multi-branch support (see below) |
| `ranges` | array | **Yes** | Array of range matcher objects (see below) |

## Branches (Multi-Branch / Multi-Floor)

For libraries with multiple branches or floors, add an optional `branches` array. When present, the modal shows tabs letting patrons switch between locations. **Single-branch libraries can omit this entirely** — everything works as before.

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | string | **Yes** | Unique key referenced by ranges (e.g. `"main-1f"`) |
| `label` | string | **Yes** | Tab text shown in the modal (e.g. `"1st Floor"`) |
| `location` | string | **Yes** | Text to match against Vega's location pills (e.g. `"Main Library"`) |

Each range that should appear in a branch tab needs a `branch` property set to the branch `id`. Items at multiple locations need one range entry per branch with the same matcher. Tabs only appear for branches where the item actually exists — determined by comparing the branch `location` against Vega's location pills for that item.

The patron's primary branch is auto-detected from Vega (the first location pill shown for the item).

## Range Objects

Each range object needs **one matcher** and **display properties**.

### Matchers (use exactly one per range)

| Matcher | Type | Example | Description |
|---|---|---|---|
| `start` + `end` | string | `"500"` / `"599.99"` | Dewey decimal range (inclusive) |
| `collection` | string | `"Large Print"` | Matches if collection text contains this value (case-insensitive) |
| `location` | string | `"Children"` | Matches if branch/location text contains this value (case-insensitive) |
| `prefix` | string | `"DVD"` | Matches if call number starts with this value (case-insensitive) |

### Display Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `label` | string | No | Modal heading text |
| `map` | string | No | URL of floor plan image (falls back to `defaultMap`) |
| `area` | object | No | Rectangle overlay to highlight on the map (see below) |
| `x` | number | No | Pin marker horizontal position, % from left (also used as center fallback) |
| `y` | number | No | Pin marker vertical position, % from top (also used as center fallback) |
| `branch` | string | No | Branch `id` from `branches` array (for multi-branch support) |

### Area Rectangle Overlay

When `area` is present, FindIt renders a semi-transparent rectangle overlay on the floor plan. The `x`/`y` top-level properties are kept for backward compatibility (the editor exports both).

| Property | Type | Default | Description |
|---|---|---|---|
| `x` | number | — | Left edge, % from left of image |
| `y` | number | — | Top edge, % from top of image |
| `width` | number | — | Width as % of image width |
| `height` | number | — | Height as % of image height |
| `color` | string | `"#00697f"` | Fill and stroke color |
| `opacity` | number | `0.3` | Fill opacity (0–1) |

## Juvenile Prefix Handling

Call numbers beginning with `J`, `YA`, `E`, `JE`, `JR`, or `JUV` (followed by a space) are automatically stripped before Dewey numeric matching. This means `J 636.7` will match a range of `600–699.99`.

## Example Config

```js
window.FindItConfig = {
  libraryName: "Example Public Library",
  buttonLabel: "Find It",
  defaultMap: "https://example.com/FindIt/maps/floor1.jpg",
  ranges: [
    {
      start: "000", end: "099.99",
      label: "Computer Science – 1st Floor",
      map: "https://example.com/FindIt/maps/floor1.jpg",
      x: 45, y: 31,
      area: { x: 40, y: 25, width: 10, height: 12, color: "#00697f" }
    },
    {
      collection: "Large Print",
      label: "Large Print – 2nd Floor Reading Room",
      x: 62.5, y: 55,
      area: { x: 55, y: 50, width: 15, height: 10 }
    },
    {
      prefix: "DVD",
      label: "DVDs – Media Area",
      x: 25, y: 70
    }
  ]
};
```

The DVD example above uses a pin marker only (no `area`). Both styles work — use `area` for rectangle highlighting, or just `x`/`y` for a simple pin. The rectangle editor exports both formats for backward compatibility.

## Multi-Branch Example

```js
window.FindItConfig = {
  libraryName: "City Library System",
  buttonLabel: "View Shelf Location",
  defaultMap: "https://example.com/maps/main-floor1.jpg",
  branches: [
    { id: "main-1f", label: "Main - 1st Floor", location: "Main Library" },
    { id: "main-2f", label: "Main - 2nd Floor", location: "Main Library" },
    { id: "south",   label: "South Branch",     location: "South Branch" }
  ],
  ranges: [
    // Single-branch item: only on 2nd floor, no tabs shown
    {
      collection: "Special Collections",
      label: "Special Collections - 2nd Floor",
      branch: "main-2f",
      map: "https://example.com/maps/main-floor2.jpg",
      x: 30, y: 40,
      area: { x: 25, y: 35, width: 10, height: 10, color: "#00697f" }
    },
    // Multi-branch item: Large Print at Main 1F AND South Branch
    // Create one range per branch with the same matcher
    {
      collection: "Large Print",
      label: "Large Print - Main 1st Floor",
      branch: "main-1f",
      map: "https://example.com/maps/main-floor1.jpg",
      x: 60, y: 20,
      area: { x: 55, y: 15, width: 10, height: 10 }
    },
    {
      collection: "Large Print",
      label: "Large Print - South Branch",
      branch: "south",
      map: "https://example.com/maps/south-branch.jpg",
      x: 45, y: 50
    }
  ]
};
```

When a patron views a Large Print item that exists at both Main Library and South Branch, clicking "View Shelf Location" shows tabs for "Main - 1st Floor" and "South Branch". If the item only exists at one branch, no tabs appear.
