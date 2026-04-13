"""
FindIt Rectangle Editor — Flask App with Google Workspace OAuth
Matches the eduroam.rhpl.org authentication pattern.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import re
from datetime import timedelta
from email.utils import formatdate
from functools import wraps
from pathlib import Path

import requests as http_requests
from authlib.integrations.flask_client import OAuth
from flask import (Flask, abort, jsonify, redirect, render_template,
                   request, send_from_directory, session, url_for)

# ── Paths ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
STATIC_DIR = Path(os.environ.get("EDITOR_STATIC_DIR",
                                  str(Path.home() / "FindIT" / "editor" / "public")))

DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

# ── Flask app ─────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=None, template_folder=str(BASE_DIR / "templates"))
app.secret_key = os.environ["SECRET_KEY"]
app.permanent_session_lifetime = timedelta(minutes=120)

# ── Logging ───────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("editor")

# ── Google OAuth ──────────────────────────────────────────────────────
oauth = OAuth(app)
oauth.register(
    name="google",
    client_id=os.environ["GOOGLE_CLIENT_ID"],
    client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# ── Auth helpers ──────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


# ── Auth routes ───────────────────────────────────────────────────────

@app.route("/login")
def login():
    redirect_uri = url_for("callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@app.route("/callback")
def callback():
    token = oauth.google.authorize_access_token()
    userinfo = token.get("userinfo", {})
    email = userinfo.get("email", "")

    if not email.lower().endswith("@rhpl.org"):
        return render_template("login.html",
                               error="Only @rhpl.org Google Workspace accounts are permitted.")

    session.permanent = True
    session["user"] = {
        "email": email,
        "name": userinfo.get("name", email),
    }
    log.info("Login: %s from %s", email, request.remote_addr)
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    user = session.get("user", {})
    session.clear()
    log.info("Logout: %s", user.get("email", "unknown"))
    return redirect(url_for("login_page"))


# ── Pages ─────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")


@app.route("/auth")
def login_page():
    if "user" in session:
        return redirect(url_for("index"))
    return render_template("login.html", error=None)


# ── Static files ──────────────────────────────────────────────────────

@app.route("/<path:filename>")
@login_required
def static_files(filename):
    # Prevent path traversal
    if ".." in filename:
        abort(404)
    return send_from_directory(str(STATIC_DIR), filename)


# ── API: Images ───────────────────────────────────────────────────────

@app.route("/api/images")
@login_required
def list_images():
    images = []
    for f in sorted(UPLOAD_DIR.iterdir()):
        if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            images.append({
                "name": f.name,
                "url": f"/uploads/{f.name}",
                "size": f.stat().st_size,
            })
    return jsonify(images)


@app.route("/api/upload", methods=["POST"])
@login_required
def upload_image():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    original_name = Path(file.filename).name
    ext = Path(original_name).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return jsonify({"error": "Only image files allowed (jpg, png, webp, gif)"}), 400

    # Read and check size
    file_data = file.read()
    if len(file_data) > MAX_UPLOAD_SIZE:
        return jsonify({"error": "File too large (50 MB max)"}), 400

    # Safe filename
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "", Path(original_name).stem) or "upload"
    filename = f"{safe_stem}{ext}"
    dest = UPLOAD_DIR / filename
    counter = 1
    while dest.exists():
        filename = f"{safe_stem}_{counter}{ext}"
        dest = UPLOAD_DIR / filename
        counter += 1

    dest.write_bytes(file_data)
    log.info("Upload: %s by %s", filename, session["user"]["email"])
    return jsonify({"ok": True, "name": filename, "url": f"/uploads/{filename}"})


@app.route("/uploads/<filename>")
@login_required
def serve_upload(filename):
    safe_name = Path(filename).name
    return send_from_directory(str(UPLOAD_DIR), safe_name)


@app.route("/api/image/<filename>", methods=["DELETE"])
@login_required
def delete_image(filename):
    safe_name = Path(filename).name
    filepath = UPLOAD_DIR / safe_name
    if filepath.exists():
        filepath.unlink()
        log.info("Delete image: %s by %s", safe_name, session["user"]["email"])
    return jsonify({"ok": True})


# ── Polaris PAPI ──────────────────────────────────────────────────────

PAPI_BASE_URL = os.environ.get("PAPI_BASE_URL", "")
PAPI_ACCESS_ID = os.environ.get("PAPI_ACCESS_ID", "")
PAPI_ACCESS_KEY = os.environ.get("PAPI_ACCESS_KEY", "")
PAPI_LANG_ID = os.environ.get("PAPI_LANG_ID", "1033")
PAPI_APP_ID = os.environ.get("PAPI_APP_ID", "100")
PAPI_ORG_ID = os.environ.get("PAPI_ORG_ID", "3")


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


@app.route("/api/polaris/collections")
@login_required
def polaris_collections():
    try:
        path = f"/REST/public/v1/{PAPI_LANG_ID}/{PAPI_APP_ID}/{PAPI_ORG_ID}/collections"
        data = papi_get(path)
        rows = data.get("CollectionsRows", [])
        collections = [
            {"id": r["ID"], "name": r["Name"].strip(), "abbr": r.get("Abbreviation", "").strip()}
            for r in rows
        ]
        return jsonify(collections)
    except Exception as e:
        log.error("Polaris collections error: %s", e)
        return jsonify({"error": str(e)}), 502


@app.route("/api/polaris/shelflocations")
@login_required
def polaris_shelflocations():
    try:
        path = f"/REST/public/v1/{PAPI_LANG_ID}/{PAPI_APP_ID}/{PAPI_ORG_ID}/shelflocations"
        data = papi_get(path)
        rows = data.get("ShelfLocationsRows", [])
        locations = [
            {"id": r["ID"], "description": r["Description"].strip()}
            for r in rows
        ]
        return jsonify(locations)
    except Exception as e:
        log.error("Polaris shelf locations error: %s", e)
        return jsonify({"error": str(e)}), 502


# ── Public API (no auth — used by map.rhpl.org) ──────────────────────

@app.route("/api/search")
def public_search():
    """Search the Polaris catalog and return results with location matches."""
    from urllib.parse import quote
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Query required"}), 400
    limit = min(int(request.args.get("limit", 10)), 100)

    try:
        path = (f"/REST/public/v1/{PAPI_LANG_ID}/{PAPI_APP_ID}/1"
                f"/search/bibs/keyword/KW?q={quote(query)}&page=1&bibsperpage={limit}")
        data = papi_get(path)
        rows = data.get("BibSearchRows", [])

        # Load ranges for matching
        ranges_file = DATA_DIR / ".." / "data" / "ranges_cache.json"
        ranges = []
        for f in sorted(DATA_DIR.glob("*.json")):
            try:
                proj = json.loads(f.read_text())
                for rect in proj.get("rectangles", []):
                    props = rect.get("properties", {})
                    entry = {}
                    collection = (props.get("collection") or "").strip()
                    if collection:
                        entry["collection"] = collection
                    start = (props.get("callStart") or "").strip()
                    end = (props.get("callEnd") or "").strip()
                    if start and end:
                        entry["start"] = start
                        entry["end"] = end
                    if (props.get("label") or "").strip():
                        entry["label"] = props["label"].strip()
                    if (props.get("directions") or "").strip():
                        entry["directions"] = props["directions"].strip()
                    entry["area"] = {
                        "x": round(rect["x"], 2),
                        "y": round(rect["y"], 2),
                        "width": round(rect["width"], 2),
                        "height": round(rect["height"], 2),
                        "color": rect.get("color", "#00697f"),
                    }
                    entry["map"] = proj.get("image", "")
                    if entry["map"].startswith("/uploads/"):
                        img_name = entry["map"].split("/")[-1]
                        entry["map"] = f"https://findit.rhpl.org/maps/{img_name}"
                    ranges.append(entry)
            except (json.JSONDecodeError, OSError):
                continue

        results = []
        for row in rows:
            call_number = row.get("CallNumber", "")
            title = row.get("Title", "")
            author = row.get("Author", "")

            # Try to find a matching range
            match = None
            searchable = " ".join([
                title or "", author or "", call_number or "",
                row.get("KWIC", "") or "",
                row.get("Summary", "") or "",
            ]).lower()
            cn = (call_number or "").strip().upper()
            for r in ranges:
                # 1. Check call number range (numeric Dewey or alphabetic)
                start = r.get("start", "").strip()
                end = r.get("end", "").strip()
                if start and end and cn:
                    try:
                        # Try numeric (Dewey) comparison
                        cn_num = float(cn.split()[0])
                        if float(start) <= cn_num <= float(end):
                            match = r
                            break
                    except (ValueError, IndexError):
                        pass
                    # Try alphabetic comparison (e.g., A-K matches H)
                    cn_alpha = cn.split()[0] if cn else ""
                    if cn_alpha and start.upper() <= cn_alpha <= end.upper():
                        match = r
                        break
                # 2. Check collection name in search text
                coll = r.get("collection", "").lower()
                if coll and coll in searchable:
                    match = r
                    break
                # 3. Fuzzy collection match
                if coll:
                    words = coll.split()
                    if len(words) >= 2 and words[0] in searchable and words[1].rstrip("s") in searchable:
                        match = r
                        break

            results.append({
                "bibId": row.get("ControlNumber"),
                "title": title,
                "author": author,
                "callNumber": call_number,
                "format": row.get("Medium", ""),
                "publicationDate": row.get("PublicationDate", ""),
                "summary": row.get("Summary", ""),
                "isbn": (row.get("ISBN") or "").split(" ")[0].strip(),
                "upc": (row.get("UPC") or "").strip(),
                "thumbnail": row.get("ThumbnailLink") or row.get("WebLink") or "",
                "available": row.get("SystemItemsIn", 0) > 0,
                "totalCopies": row.get("SystemItemsTotal", 0),
                "copiesIn": row.get("SystemItemsIn", 0),
                "holds": row.get("CurrentHoldRequests", 0),
                "match": match,
            })

        return jsonify({
            "query": query,
            "total": data.get("TotalRecordsFound", 0),
            "results": results,
        })
    except Exception as e:
        log.error("Search error: %s", e)
        return jsonify({"error": str(e)}), 502


@app.route("/api/ranges")
def public_ranges():
    """Serve the current ranges.json (no auth required)."""
    all_ranges = []
    for f in sorted(DATA_DIR.glob("*.json")):
        try:
            proj = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        for rect in proj.get("rectangles", []):
            props = rect.get("properties", {})
            entry = {}
            collection = (props.get("collection") or "").strip()
            if collection:
                entry["collection"] = collection
            start = (props.get("callStart") or "").strip()
            end = (props.get("callEnd") or "").strip()
            if start and end:
                entry["start"] = start
                entry["end"] = end
            if (props.get("label") or "").strip():
                entry["label"] = props["label"].strip()
            if (props.get("directions") or "").strip():
                entry["directions"] = props["directions"].strip()
            image_url = proj.get("image", "")
            if image_url.startswith("/uploads/"):
                img_name = image_url.split("/")[-1]
                entry["map"] = f"https://findit.rhpl.org/maps/{img_name}"
            elif image_url:
                entry["map"] = image_url
            entry["x"] = round(rect["x"] + rect["width"] / 2, 2)
            entry["y"] = round(rect["y"] + rect["height"] / 2, 2)
            entry["area"] = {
                "x": round(rect["x"], 2),
                "y": round(rect["y"], 2),
                "width": round(rect["width"], 2),
                "height": round(rect["height"], 2),
                "color": rect.get("color", "#00697f"),
            }
            all_ranges.append(entry)
    return jsonify({"ranges": all_ranges, "defaultMap": "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg"})


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ── API: Projects ─────────────────────────────────────────────────────

@app.route("/api/projects")
@login_required
def list_projects():
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
    return jsonify(projects)


@app.route("/api/project/<name>")
@login_required
def load_project(name):
    safe_name = Path(name).name
    filepath = DATA_DIR / f"{safe_name}.json"
    if not filepath.exists():
        return jsonify({"error": "Project not found"}), 404
    return jsonify(json.loads(filepath.read_text()))


@app.route("/api/project", methods=["POST"])
@login_required
def save_project():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Project name required"}), 400
    safe_name = re.sub(r"[^a-zA-Z0-9_ -]", "", name).strip()
    if not safe_name:
        return jsonify({"error": "Invalid project name"}), 400

    filepath = DATA_DIR / f"{safe_name}.json"
    filepath.write_text(json.dumps(data, indent=2))
    log.info("Save project: %s by %s", safe_name, session["user"]["email"])
    return jsonify({"ok": True, "name": safe_name})


@app.route("/api/project/<name>", methods=["DELETE"])
@login_required
def delete_project(name):
    safe_name = Path(name).name
    filepath = DATA_DIR / f"{safe_name}.json"
    if filepath.exists():
        filepath.unlink()
        log.info("Delete project: %s by %s", safe_name, session["user"]["email"])
    return jsonify({"ok": True})


@app.route("/api/export", methods=["POST"])
@login_required
def export_findit():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    rectangles = data.get("rectangles", [])
    image_url = data.get("imageUrl", "")

    ranges = []
    for rect in rectangles:
        props = rect.get("properties", {})
        entry = {}
        start = (props.get("callStart") or "").strip()
        end = (props.get("callEnd") or "").strip()
        collection = (props.get("collection") or "").strip()
        if collection:
            entry["collection"] = collection
        if start and end:
            entry["start"] = start
            entry["end"] = end
        if (props.get("label") or "").strip():
            entry["label"] = props["label"].strip()
        if (props.get("directions") or "").strip():
            entry["directions"] = props["directions"].strip()
        if image_url:
            entry["map"] = image_url
        entry["x"] = round(rect["x"] + rect["width"] / 2, 2)
        entry["y"] = round(rect["y"] + rect["height"] / 2, 2)
        entry["area"] = {
            "x": round(rect["x"], 2),
            "y": round(rect["y"], 2),
            "width": round(rect["width"], 2),
            "height": round(rect["height"], 2),
            "color": rect.get("color", "#00697f"),
        }
        ranges.append(entry)

    return jsonify({"ranges": ranges})


# ── Publish to GoDaddy ────────────────────────────────────────────────

GODADDY_HOST = os.environ.get("GODADDY_HOST", "132.148.43.54")
GODADDY_USER = os.environ.get("GODADDY_USER", "rhpladmin")
GODADDY_KEY = os.environ.get("GODADDY_SSH_KEY", "/home/localadm/.ssh/godaddy_findit")
GODADDY_RANGES_PATH = os.environ.get(
    "GODADDY_RANGES_PATH",
    "/home/rhpladmin/public_html/FindIt/libraries/rhpl/ranges.json"
)
GODADDY_JS_PATH = os.environ.get(
    "GODADDY_JS_PATH",
    "/home/rhpladmin/public_html/FindIt/libraries/rhpl/findit-rhpl.js"
)
LOCAL_ENGINE_JS = Path(os.environ.get(
    "EDITOR_STATIC_DIR",
    str(Path.home() / "FindIT" / "editor" / "public")
)).parent.parent / "libraries" / "rhpl" / "findit-rhpl.js"


@app.route("/api/publish", methods=["POST"])
@login_required
def publish():
    """Build ranges.json from all saved projects and push to GoDaddy."""
    import subprocess
    import tempfile

    try:
        # Collect ranges from ALL saved projects
        all_ranges = []
        projects_used = []
        for f in sorted(DATA_DIR.glob("*.json")):
            try:
                proj = json.loads(f.read_text())
            except (json.JSONDecodeError, OSError):
                continue
            image_url = proj.get("image", "")
            projects_used.append(f.stem)
            for rect in proj.get("rectangles", []):
                props = rect.get("properties", {})
                entry = {}
                start = (props.get("callStart") or "").strip()
                end = (props.get("callEnd") or "").strip()
                collection = (props.get("collection") or "").strip()
                if collection:
                    entry["collection"] = collection
                if start and end:
                    entry["start"] = start
                    entry["end"] = end
                if (props.get("label") or "").strip():
                    entry["label"] = props["label"].strip()
                if (props.get("directions") or "").strip():
                    entry["directions"] = props["directions"].strip()
                # Use the floor plan URL from the project's image field
                # Convert local upload path to production URL
                if image_url.startswith("/uploads/"):
                    img_name = image_url.split("/")[-1]
                    entry["map"] = f"https://findit.rhpl.org/maps/{img_name}"
                elif image_url:
                    entry["map"] = image_url
                entry["x"] = round(rect["x"] + rect["width"] / 2, 2)
                entry["y"] = round(rect["y"] + rect["height"] / 2, 2)
                entry["area"] = {
                    "x": round(rect["x"], 2),
                    "y": round(rect["y"], 2),
                    "width": round(rect["width"], 2),
                    "height": round(rect["height"], 2),
                    "color": rect.get("color", "#00697f"),
                }
                all_ranges.append(entry)

        # Collect landmarks from all projects
        all_landmarks = []
        for f in sorted(DATA_DIR.glob("*.json")):
            try:
                proj = json.loads(f.read_text())
            except (json.JSONDecodeError, OSError):
                continue
            image_url = proj.get("image", "")
            floor_map = ""
            if image_url.startswith("/uploads/"):
                floor_map = f"https://findit.rhpl.org/maps/{image_url.split('/')[-1]}"
            elif image_url:
                floor_map = image_url
            for lm in proj.get("landmarks", []):
                all_landmarks.append({
                    "x": round(lm["x"], 2),
                    "y": round(lm["y"], 2),
                    "type": lm.get("type", ""),
                    "label": lm.get("label", ""),
                    "map": floor_map,
                })

        if not all_ranges and not all_landmarks:
            return jsonify({"error": "No data to publish. Save a project first."}), 400

        ranges_data = {
            "ranges": all_ranges,
            "landmarks": all_landmarks,
            "defaultMap": "https://findit.rhpl.org/maps/RHPL-First-Floor.jpg",
            "publishedBy": session["user"]["email"],
            "publishedAt": formatdate(usegmt=True),
            "projects": projects_used,
        }

        # Write ranges.json to temp file and SCP to GoDaddy
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
            json.dump(ranges_data, tmp, indent=2)
            tmp_path = tmp.name

        scp_cmd = [
            "scp", "-i", GODADDY_KEY,
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ConnectTimeout=10",
            tmp_path,
            f"{GODADDY_USER}@{GODADDY_HOST}:{GODADDY_RANGES_PATH}",
        ]
        result = subprocess.run(scp_cmd, capture_output=True, text=True, timeout=30)
        os.unlink(tmp_path)

        if result.returncode != 0:
            log.error("SCP ranges.json failed: %s", result.stderr)
            return jsonify({"error": f"SCP failed: {result.stderr.strip()}"}), 502

        # Fix permissions so the web server can read the file
        subprocess.run([
            "ssh", "-i", GODADDY_KEY,
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ConnectTimeout=10",
            f"{GODADDY_USER}@{GODADDY_HOST}",
            f"chmod 644 {GODADDY_RANGES_PATH} {GODADDY_JS_PATH}",
        ], capture_output=True, text=True, timeout=15)

        # Also push the updated findit-rhpl.js engine
        if LOCAL_ENGINE_JS.exists():
            scp_js = [
                "scp", "-i", GODADDY_KEY,
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                str(LOCAL_ENGINE_JS),
                f"{GODADDY_USER}@{GODADDY_HOST}:{GODADDY_JS_PATH}",
            ]
            js_result = subprocess.run(scp_js, capture_output=True, text=True, timeout=30)
            if js_result.returncode != 0:
                log.warning("SCP findit-rhpl.js failed: %s", js_result.stderr)

        log.info("Published %d ranges from %d projects by %s",
                 len(all_ranges), len(projects_used), session["user"]["email"])
        return jsonify({
            "ok": True,
            "rangeCount": len(all_ranges),
            "projects": projects_used,
        })

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Connection to GoDaddy timed out"}), 504
    except Exception as e:
        log.error("Publish error: %s", e)
        return jsonify({"error": str(e)}), 500


# ── Dev server ────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8700, debug=True)
