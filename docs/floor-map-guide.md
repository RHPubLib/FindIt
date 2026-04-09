# FindIt – Floor Map Guide

How to prepare floor plan images and measure x/y marker coordinates.

## Preparing Floor Plan Images

1. **Source images:** Use existing library floor plans, architect drawings, or create simple diagrams
2. **Format:** JPEG or PNG (JPEG for photos/scans, PNG for clean diagrams)
3. **Resolution:** Aim for 1200–1600px wide — sharp enough to read labels, small enough to load fast
4. **Orientation:** Landscape works best in the modal on both desktop and mobile

### Tips

- Remove unnecessary detail (plumbing, electrical) — patrons just need shelving areas
- Label major sections directly on the image (Fiction, Non-Fiction, Children's, etc.)
- Use consistent colours for different collection areas
- Include landmarks patrons will recognise (entrance, service desk, stairs)

## Measuring x/y Coordinates

The `x` and `y` values in your config are **percentages from the top-left corner** of the image:

- `x: 0` = left edge, `x: 100` = right edge
- `y: 0` = top edge, `y: 100` = bottom edge

### Method 1: Image Editor

1. Open your floor plan in any image editor (GIMP, Photoshop, Preview, etc.)
2. Hover your cursor over the target shelf location
3. Note the pixel coordinates (e.g., 480, 210)
4. Convert to percentages:
   - `x = (pixel_x / image_width) * 100`
   - `y = (pixel_y / image_height) * 100`

### Method 2: Browser Dev Tools

1. Open the floor plan image in a browser
2. Right-click → Inspect, then use the element picker
3. Hover over the target location and note pixel position
4. Convert to percentages as above

### Method 3: Trial and Error

1. Start with a rough estimate (e.g., `x: 50, y: 50` for centre)
2. Load the page and click "Find It"
3. Adjust values and reload until the marker is positioned correctly

## Example

For a 1400×900 image where the Fiction section is at pixel (700, 360):

```
x = (700 / 1400) * 100 = 50
y = (360 / 900) * 100  = 40
```

Config entry:
```js
{
  start: "800", end: "899.99",
  label: "Fiction – Main Floor",
  map: "https://your-server.com/FindIt/maps/main-floor.jpg",
  x: 50,
  y: 40
}
```
