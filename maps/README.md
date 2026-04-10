# Maps Directory

This directory is a placeholder showing the expected structure. **Do not commit actual floor plan images to this repository.**

Floor plan images should be hosted on your own web server (e.g., via SFTP to your hosting provider) and referenced by URL in your library's config file.

## Example structure on your server

```
your-server.com/
  maps/
    first-floor-marked.jpg
    second-floor-marked.jpg
```

Then in your config:

```js
map: "https://your-server.com/maps/first-floor-marked.jpg"
```

See [docs/floor-map-guide.md](../docs/floor-map-guide.md) for how to prepare floor plan images.
