#!/usr/bin/env python3
"""
DEPRECATED — This is the original standalone dev server (no auth, no OAuth, no PAPI).
Use editor/app.py instead, which includes Google OAuth, Polaris PAPI integration,
and the publish-to-production flow.

This file is kept as a reference for the minimal API structure.
"""

import http.server
import json
import os
import sys
import uuid
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = 8700
BASE_DIR = Path(__file__).parent.resolve()
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB


class EditorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API routes
        if path == "/api/projects":
            return self._list_projects()
        if path == "/api/images":
            return self._list_images()
        if path.startswith("/api/project/"):
            name = path[len("/api/project/"):]
            return self._load_project(name)
        if path.startswith("/uploads/"):
            return self._serve_upload(path[len("/uploads/"):])

        # Serve static files from public/
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/upload":
            return self._handle_upload()
        if path == "/api/project":
            return self._save_project()
        if path == "/api/export":
            return self._export_findit()

        self._json_response(404, {"error": "Not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/project/"):
            name = path[len("/api/project/"):]
            return self._delete_project(name)

        self._json_response(404, {"error": "Not found"})

    def _json_response(self, status, data):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length)

    def _list_projects(self):
        projects = []
        for f in sorted(DATA_DIR.glob("*.json")):
            try:
                data = json.loads(f.read_text())
                projects.append({
                    "name": f.stem,
                    "label": data.get("label", f.stem),
                    "rectangleCount": len(data.get("rectangles", [])),
                    "image": data.get("image", ""),
                })
            except (json.JSONDecodeError, OSError):
                continue
        self._json_response(200, projects)

    def _list_images(self):
        images = []
        for f in sorted(UPLOAD_DIR.iterdir()):
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                images.append({
                    "name": f.name,
                    "url": f"/uploads/{f.name}",
                    "size": f.stat().st_size,
                })
        self._json_response(200, images)

    def _load_project(self, name):
        safe_name = Path(name).name  # prevent path traversal
        filepath = DATA_DIR / f"{safe_name}.json"
        if not filepath.exists():
            return self._json_response(404, {"error": "Project not found"})
        try:
            data = json.loads(filepath.read_text())
            self._json_response(200, data)
        except (json.JSONDecodeError, OSError) as e:
            self._json_response(500, {"error": str(e)})

    def _save_project(self):
        try:
            body = self._read_body()
            data = json.loads(body)
            name = data.get("name", "").strip()
            if not name:
                return self._json_response(400, {"error": "Project name required"})
            safe_name = "".join(c for c in name if c.isalnum() or c in "-_ ").strip()
            if not safe_name:
                return self._json_response(400, {"error": "Invalid project name"})
            filepath = DATA_DIR / f"{safe_name}.json"
            filepath.write_text(json.dumps(data, indent=2))
            self._json_response(200, {"ok": True, "name": safe_name})
        except (json.JSONDecodeError, OSError) as e:
            self._json_response(400, {"error": str(e)})

    def _delete_project(self, name):
        safe_name = Path(name).name
        filepath = DATA_DIR / f"{safe_name}.json"
        if filepath.exists():
            filepath.unlink()
        self._json_response(200, {"ok": True})

    def _parse_multipart(self):
        """Parse multipart/form-data without the deprecated cgi module."""
        content_type = self.headers.get("Content-Type", "")
        # Extract boundary
        match = re.search(r'boundary=([^\s;]+)', content_type)
        if not match:
            return None, None
        boundary = match.group(1).encode()

        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_UPLOAD_SIZE + 4096:
            return None, None
        body = self.rfile.read(length)

        # Split on boundary
        parts = body.split(b"--" + boundary)
        for part in parts:
            if b"Content-Disposition" not in part:
                continue
            # Split headers from content
            header_end = part.find(b"\r\n\r\n")
            if header_end < 0:
                continue
            headers_raw = part[:header_end].decode("utf-8", errors="replace")
            file_data = part[header_end + 4:]
            # Strip trailing \r\n
            if file_data.endswith(b"\r\n"):
                file_data = file_data[:-2]

            if 'name="file"' in headers_raw:
                # Extract filename
                fn_match = re.search(r'filename="([^"]*)"', headers_raw)
                filename = fn_match.group(1) if fn_match else "upload"
                return filename, file_data

        return None, None

    def _handle_upload(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self._json_response(400, {"error": "Expected multipart/form-data"})

        try:
            original_name_raw, file_data = self._parse_multipart()
            if not file_data:
                return self._json_response(400, {"error": "No file uploaded"})

            if len(file_data) > MAX_UPLOAD_SIZE:
                return self._json_response(400, {"error": "File too large (50 MB max)"})

            # Determine extension from original filename
            original_name = Path(original_name_raw).name if original_name_raw else "upload"
            ext = Path(original_name).suffix.lower()
            if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                return self._json_response(400, {"error": "Only image files allowed (jpg, png, webp, gif)"})

            # Save with a safe unique-ish name
            safe_original = "".join(c for c in Path(original_name).stem if c.isalnum() or c in "-_")
            if not safe_original:
                safe_original = "upload"
            filename = f"{safe_original}{ext}"
            # Avoid overwrites
            dest = UPLOAD_DIR / filename
            counter = 1
            while dest.exists():
                filename = f"{safe_original}_{counter}{ext}"
                dest = UPLOAD_DIR / filename
                counter += 1

            dest.write_bytes(file_data)
            self._json_response(200, {
                "ok": True,
                "name": filename,
                "url": f"/uploads/{filename}",
            })
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _serve_upload(self, filename):
        safe_name = Path(filename).name
        filepath = UPLOAD_DIR / safe_name
        if not filepath.exists():
            self.send_error(404, "File not found")
            return

        ext = filepath.suffix.lower()
        content_types = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".webp": "image/webp",
            ".gif": "image/gif",
        }
        ct = content_types.get(ext, "application/octet-stream")
        data = filepath.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(data))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    def _export_findit(self):
        """Export rectangle data in FindIt config.ranges format."""
        try:
            body = self._read_body()
            data = json.loads(body)
            rectangles = data.get("rectangles", [])
            image_url = data.get("imageUrl", "")

            ranges = []
            for rect in rectangles:
                props = rect.get("properties", {})
                entry = {}

                # Matcher
                collection = props.get("collection", "").strip()
                start = props.get("callStart", "").strip()
                end = props.get("callEnd", "").strip()
                if start and end:
                    entry["start"] = start
                    entry["end"] = end
                elif collection:
                    entry["collection"] = collection

                # Display
                if props.get("label", "").strip():
                    entry["label"] = props["label"].strip()
                if image_url:
                    entry["map"] = image_url

                # Center point (for backward compat marker)
                entry["x"] = round(rect["x"] + rect["width"] / 2, 2)
                entry["y"] = round(rect["y"] + rect["height"] / 2, 2)

                # Rectangle overlay data
                entry["area"] = {
                    "x": round(rect["x"], 2),
                    "y": round(rect["y"], 2),
                    "width": round(rect["width"], 2),
                    "height": round(rect["height"], 2),
                    "color": rect.get("color", "#00697f"),
                }

                ranges.append(entry)

            self._json_response(200, {"ranges": ranges})
        except (json.JSONDecodeError, OSError) as e:
            self._json_response(400, {"error": str(e)})

    def log_message(self, format, *args):
        sys.stderr.write(f"[editor] {self.address_string()} - {format % args}\n")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    server = http.server.HTTPServer(("0.0.0.0", port), EditorHandler)
    print(f"FindIt Rectangle Editor running at http://localhost:{port}")
    print(f"  Public dir: {PUBLIC_DIR}")
    print(f"  Data dir:   {DATA_DIR}")
    print(f"  Uploads:    {UPLOAD_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
