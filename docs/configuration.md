# FindIt – Configuration Reference

All configuration lives in a single `config.js` file per library, loaded before `findit.js`.

## Top-Level Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `libraryName` | string | No | Display name (shown in modal if no range label) |
| `buttonLabel` | string | No | Button text (default: `"Find It"`) |
| `defaultMap` | string | No | Fallback floor map URL if a range has no `map` |
| `ranges` | array | **Yes** | Array of range matcher objects (see below) |

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
