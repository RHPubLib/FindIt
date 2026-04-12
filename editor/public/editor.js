/**
 * FindIt Rectangle Editor — Canvas Drawing Engine
 *
 * All rectangle coordinates are stored as percentages (0–100) of the
 * floor plan image dimensions, matching FindIt's coordinate system.
 */

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  const state = {
    tool: "select",       // "select" | "draw"
    image: null,          // HTMLImageElement
    imageUrl: "",
    imageName: "",
    rectangles: [],       // [{id, x, y, width, height, color, properties:{...}}]
    selectedId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    // Interaction
    dragging: false,
    dragType: null,       // "draw" | "move" | "resize"
    dragHandle: null,     // resize handle name
    dragStartX: 0,
    dragStartY: 0,
    dragOrigRect: null,
    drawStartPct: null,
    // Pan
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartPanX: 0,
    panStartPanY: 0,
    // Project
    projectName: "",
    dirty: false,
  };

  let nextId = 1;

  // ── DOM refs ───────────────────────────────────────────────────────
  const canvas = document.getElementById("editor-canvas");
  const ctx = canvas.getContext("2d");
  const canvasArea = document.getElementById("canvas-area");
  const container = document.getElementById("canvas-container");
  const emptyState = document.getElementById("empty-state");

  // Toolbar
  const btnSelect = document.getElementById("btn-select");
  const btnDraw = document.getElementById("btn-draw");
  const btnDelete = document.getElementById("btn-delete");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnZoomFit = document.getElementById("btn-zoom-fit");
  const zoomDisplay = document.getElementById("zoom-display");
  const btnSave = document.getElementById("btn-save");
  const btnExport = document.getElementById("btn-export");

  // Left sidebar
  const btnUpload = document.getElementById("btn-upload");
  const fileInput = document.getElementById("file-input");
  const imageSelect = document.getElementById("image-select");
  const imageInfo = document.getElementById("image-info");
  const projectName = document.getElementById("project-name");
  const projectLabel = document.getElementById("project-label");
  const projectSelect = document.getElementById("project-select");
  const btnProjectSave = document.getElementById("btn-project-save");
  const btnProjectLoad = document.getElementById("btn-project-load");
  const btnDeleteImage = document.getElementById("btn-delete-image");
  const btnDeleteProject = document.getElementById("btn-delete-project");
  const rectList = document.getElementById("rect-list");
  const rectCount = document.getElementById("rect-count");

  // Right sidebar (properties)
  const noSelection = document.getElementById("no-selection");
  const propsFields = document.getElementById("props-fields");
  const propPolarisCollection = document.getElementById("prop-polaris-collection");
  const propPolarisShelf = document.getElementById("prop-polaris-shelf");
  const propCollection = document.getElementById("prop-collection");
  const propCallStart = document.getElementById("prop-call-start");
  const propCallEnd = document.getElementById("prop-call-end");
  const propLabel = document.getElementById("prop-label");
  const propDirections = document.getElementById("prop-directions");
  const propColor = document.getElementById("prop-color");
  const propColorHex = document.getElementById("prop-color-hex");
  const propX = document.getElementById("prop-x");
  const propY = document.getElementById("prop-y");
  const propW = document.getElementById("prop-w");
  const propH = document.getElementById("prop-h");

  // Export modal
  const exportModal = document.getElementById("export-modal");
  const exportClose = document.getElementById("export-close");
  const exportOutput = document.getElementById("export-output");
  const exportImageUrl = document.getElementById("export-image-url");
  const exportCopy = document.getElementById("export-copy");
  const exportDownload = document.getElementById("export-download");

  // Help modal
  const helpModal = document.getElementById("help-modal");
  const btnHelp = document.getElementById("btn-help");
  const helpClose = document.getElementById("help-close");

  // ── Helpers ────────────────────────────────────────────────────────

  function toast(msg, isError) {
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    document.getElementById("toast-container").appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  /** Get the displayed image rect in canvas pixel coordinates */
  function imageRect() {
    if (!state.image) return null;
    const w = state.image.naturalWidth * state.zoom;
    const h = state.image.naturalHeight * state.zoom;
    return { x: state.panX, y: state.panY, w, h };
  }

  /** Convert canvas pixel position to image percentage coordinates */
  function canvasToPercent(cx, cy) {
    const ir = imageRect();
    if (!ir) return null;
    return {
      px: ((cx - ir.x) / ir.w) * 100,
      py: ((cy - ir.y) / ir.h) * 100,
    };
  }

  /** Convert image percentage to canvas pixels */
  function percentToCanvas(px, py) {
    const ir = imageRect();
    if (!ir) return null;
    return {
      cx: ir.x + (px / 100) * ir.w,
      cy: ir.y + (py / 100) * ir.h,
    };
  }

  /** Get mouse position relative to canvas */
  function mousePos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Resize canvas to fill container ────────────────────────────────
  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    render();
  }

  // ── Rendering ──────────────────────────────────────────────────────

  const HANDLE_SIZE = 8;
  const HANDLE_HALF = HANDLE_SIZE / 2;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.image) {
      emptyState.style.display = "";
      return;
    }
    emptyState.style.display = "none";

    // Draw image
    const ir = imageRect();
    ctx.drawImage(state.image, ir.x, ir.y, ir.w, ir.h);

    // Draw rectangles
    for (const rect of state.rectangles) {
      drawRect(rect, rect.id === state.selectedId);
    }
  }

  function drawRect(rect, selected) {
    const tl = percentToCanvas(rect.x, rect.y);
    const br = percentToCanvas(rect.x + rect.width, rect.y + rect.height);
    if (!tl || !br) return;

    const x = tl.cx, y = tl.cy;
    const w = br.cx - tl.cx, h = br.cy - tl.cy;
    const color = rect.color || "#00697f";

    // Fill with transparency
    ctx.fillStyle = color + "33"; // ~20% opacity
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    if (selected) ctx.setLineDash([]);
    else ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    // Label
    const label = rect.properties?.label || rect.properties?.collection || "";
    if (label && w > 30 && h > 18) {
      ctx.save();
      ctx.font = `${Math.max(10, Math.min(13, w / label.length * 1.5))}px -apple-system, sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.fillText(label, x + 4, y + 3, w - 8);
      ctx.restore();
    }

    // Selection handles
    if (selected) {
      const handles = getHandles(x, y, w, h);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (const h of Object.values(handles)) {
        ctx.fillRect(h.x - HANDLE_HALF, h.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(h.x - HANDLE_HALF, h.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
      }
    }
  }

  function getHandles(x, y, w, h) {
    return {
      nw: { x: x, y: y },
      n:  { x: x + w / 2, y: y },
      ne: { x: x + w, y: y },
      e:  { x: x + w, y: y + h / 2 },
      se: { x: x + w, y: y + h },
      s:  { x: x + w / 2, y: y + h },
      sw: { x: x, y: y + h },
      w:  { x: x, y: y + h / 2 },
    };
  }

  // ── Hit testing ────────────────────────────────────────────────────

  function hitTestHandle(mx, my) {
    if (!state.selectedId) return null;
    const rect = state.rectangles.find(r => r.id === state.selectedId);
    if (!rect) return null;
    const tl = percentToCanvas(rect.x, rect.y);
    const br = percentToCanvas(rect.x + rect.width, rect.y + rect.height);
    const handles = getHandles(tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
    for (const [name, h] of Object.entries(handles)) {
      if (Math.abs(mx - h.x) <= HANDLE_HALF + 2 && Math.abs(my - h.y) <= HANDLE_HALF + 2) {
        return name;
      }
    }
    return null;
  }

  function hitTestRect(mx, my) {
    // Test in reverse order (top-most first)
    for (let i = state.rectangles.length - 1; i >= 0; i--) {
      const rect = state.rectangles[i];
      const tl = percentToCanvas(rect.x, rect.y);
      const br = percentToCanvas(rect.x + rect.width, rect.y + rect.height);
      if (mx >= tl.cx && mx <= br.cx && my >= tl.cy && my <= br.cy) {
        return rect;
      }
    }
    return null;
  }

  // ── Tool management ────────────────────────────────────────────────

  function setTool(tool) {
    state.tool = tool;
    btnSelect.classList.toggle("active", tool === "select");
    btnDraw.classList.toggle("active", tool === "draw");
    canvasArea.className = tool === "draw" ? "mode-draw" : "mode-select";
  }

  // ── Selection ──────────────────────────────────────────────────────

  function selectRect(id) {
    state.selectedId = id;
    updatePropsPanel();
    updateRectList();
    render();
  }

  // ── Mouse events ───────────────────────────────────────────────────

  canvas.addEventListener("mousedown", (e) => {
    if (!state.image) return;
    const pos = mousePos(e);

    // Middle-click, right-click, or space+click: pan
    if (e.button === 1 || e.button === 2 || state.isPanning) {
      state.isPanning = true;
      state.panStartX = pos.x;
      state.panStartY = pos.y;
      state.panStartPanX = state.panX;
      state.panStartPanY = state.panY;
      canvasArea.className = "mode-move";
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    if (state.tool === "draw") {
      // Start drawing
      const pct = canvasToPercent(pos.x, pos.y);
      if (!pct) return;
      state.dragging = true;
      state.dragType = "draw";
      state.drawStartPct = pct;
      return;
    }

    // Select tool
    // Check resize handle first
    const handle = hitTestHandle(pos.x, pos.y);
    if (handle) {
      state.dragging = true;
      state.dragType = "resize";
      state.dragHandle = handle;
      state.dragStartX = pos.x;
      state.dragStartY = pos.y;
      const rect = state.rectangles.find(r => r.id === state.selectedId);
      state.dragOrigRect = { ...rect };
      return;
    }

    // Check rect hit
    const hit = hitTestRect(pos.x, pos.y);
    if (hit) {
      selectRect(hit.id);
      state.dragging = true;
      state.dragType = "move";
      state.dragStartX = pos.x;
      state.dragStartY = pos.y;
      state.dragOrigRect = { ...hit };
      canvasArea.className = "mode-move";
      return;
    }

    // Click on empty space: deselect
    selectRect(null);
  });

  canvas.addEventListener("mousemove", (e) => {
    const pos = mousePos(e);

    // Panning
    if (state.isPanning) {
      state.panX = state.panStartPanX + (pos.x - state.panStartX);
      state.panY = state.panStartPanY + (pos.y - state.panStartY);
      render();
      return;
    }

    if (!state.dragging) {
      // Update cursor based on hover
      if (state.tool === "select" && state.selectedId) {
        const handle = hitTestHandle(pos.x, pos.y);
        if (handle) {
          canvasArea.className = `mode-resize-${handle}`;
          return;
        }
      }
      if (state.tool === "select") {
        const hit = hitTestRect(pos.x, pos.y);
        canvasArea.className = hit ? "mode-move" : "mode-select";
      }
      return;
    }

    if (state.dragType === "draw") {
      // Live preview while drawing
      const pct = canvasToPercent(pos.x, pos.y);
      if (!pct) return;
      // Temporary draw rect
      render();
      const s = state.drawStartPct;
      const x = Math.min(s.px, pct.px);
      const y = Math.min(s.py, pct.py);
      const w = Math.abs(pct.px - s.px);
      const h = Math.abs(pct.py - s.py);
      const tl = percentToCanvas(x, y);
      const br = percentToCanvas(x + w, y + h);
      ctx.strokeStyle = "#00697f";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
      ctx.setLineDash([]);
      ctx.fillStyle = "#00697f22";
      ctx.fillRect(tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
      return;
    }

    if (state.dragType === "move") {
      const rect = state.rectangles.find(r => r.id === state.selectedId);
      if (!rect) return;
      const ir = imageRect();
      const dx = ((pos.x - state.dragStartX) / ir.w) * 100;
      const dy = ((pos.y - state.dragStartY) / ir.h) * 100;
      rect.x = state.dragOrigRect.x + dx;
      rect.y = state.dragOrigRect.y + dy;
      // Clamp to image bounds
      rect.x = Math.max(0, Math.min(100 - rect.width, rect.x));
      rect.y = Math.max(0, Math.min(100 - rect.height, rect.y));
      updatePropsPosition();
      render();
      return;
    }

    if (state.dragType === "resize") {
      const rect = state.rectangles.find(r => r.id === state.selectedId);
      if (!rect) return;
      const ir = imageRect();
      const dx = ((pos.x - state.dragStartX) / ir.w) * 100;
      const dy = ((pos.y - state.dragStartY) / ir.h) * 100;
      const orig = state.dragOrigRect;
      const handle = state.dragHandle;

      let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;

      if (handle.includes("w")) {
        nx = orig.x + dx;
        nw = orig.width - dx;
      }
      if (handle.includes("e")) {
        nw = orig.width + dx;
      }
      if (handle.includes("n")) {
        ny = orig.y + dy;
        nh = orig.height - dy;
      }
      if (handle.includes("s")) {
        nh = orig.height + dy;
      }

      // Enforce minimum size
      if (nw < 0.5) { nw = 0.5; if (handle.includes("w")) nx = orig.x + orig.width - 0.5; }
      if (nh < 0.5) { nh = 0.5; if (handle.includes("n")) ny = orig.y + orig.height - 0.5; }

      rect.x = nx;
      rect.y = ny;
      rect.width = nw;
      rect.height = nh;
      updatePropsPosition();
      render();
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (state.isPanning) {
      state.isPanning = false;
      canvasArea.className = state.tool === "draw" ? "mode-draw" : "mode-select";
      return;
    }

    if (!state.dragging) return;

    if (state.dragType === "draw") {
      const pos = mousePos(e);
      const pct = canvasToPercent(pos.x, pos.y);
      if (pct && state.drawStartPct) {
        const s = state.drawStartPct;
        let x = Math.min(s.px, pct.px);
        let y = Math.min(s.py, pct.py);
        let w = Math.abs(pct.px - s.px);
        let h = Math.abs(pct.py - s.py);

        // Only create if big enough
        if (w > 0.5 && h > 0.5) {
          const newRect = {
            id: nextId++,
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.min(w, 100 - x),
            height: Math.min(h, 100 - y),
            color: "#00697f",
            properties: {
              collection: "",
              callStart: "",
              callEnd: "",
              label: "",
            },
          };
          state.rectangles.push(newRect);
          selectRect(newRect.id);
          state.dirty = true;
          updateRectList();
        }
      }
    }

    if (state.dragType === "move" || state.dragType === "resize") {
      state.dirty = true;
    }

    state.dragging = false;
    state.dragType = null;
    state.drawStartPct = null;
    render();
  });

  // Mouse wheel zoom
  canvas.addEventListener("wheel", (e) => {
    if (!state.image) return;
    e.preventDefault();
    const pos = mousePos(e);
    const oldZoom = state.zoom;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    state.zoom = Math.max(0.1, Math.min(10, state.zoom * factor));
    // Zoom toward cursor
    state.panX = pos.x - (pos.x - state.panX) * (state.zoom / oldZoom);
    state.panY = pos.y - (pos.y - state.panY) * (state.zoom / oldZoom);
    zoomDisplay.textContent = Math.round(state.zoom * 100) + "%";
    render();
  }, { passive: false });

  // Space bar for panning
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

    if (e.code === "Space") {
      e.preventDefault();
      state.isPanning = true;
      canvasArea.className = "mode-move";
    }
    if (e.key === "v" || e.key === "V") setTool("select");
    if (e.key === "r" || e.key === "R") setTool("draw");
    if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
      deleteSelected();
    }
    if (e.key === "=" || e.key === "+") zoomIn();
    if (e.key === "-") zoomOut();
    if (e.key === "0") zoomFit();
    // Arrow key panning
    const PAN_STEP = 80;
    if (e.key === "ArrowLeft")  { e.preventDefault(); state.panX += PAN_STEP; render(); }
    if (e.key === "ArrowRight") { e.preventDefault(); state.panX -= PAN_STEP; render(); }
    if (e.key === "ArrowUp")    { e.preventDefault(); state.panY += PAN_STEP; render(); }
    if (e.key === "ArrowDown")  { e.preventDefault(); state.panY -= PAN_STEP; render(); }
    if (e.key === "?") { helpModal.style.display = helpModal.style.display === "none" ? "" : "none"; }
    if (e.key === "Escape") {
      selectRect(null);
      if (exportModal.style.display !== "none") exportModal.style.display = "none";
      if (helpModal.style.display !== "none") helpModal.style.display = "none";
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "Space" && !state.dragging) {
      state.isPanning = false;
      canvasArea.className = state.tool === "draw" ? "mode-draw" : "mode-select";
    }
  });

  // ── Zoom controls ──────────────────────────────────────────────────

  function zoomIn() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const oldZoom = state.zoom;
    state.zoom = Math.min(10, state.zoom * 1.25);
    state.panX = cx - (cx - state.panX) * (state.zoom / oldZoom);
    state.panY = cy - (cy - state.panY) * (state.zoom / oldZoom);
    zoomDisplay.textContent = Math.round(state.zoom * 100) + "%";
    render();
  }

  function zoomOut() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const oldZoom = state.zoom;
    state.zoom = Math.max(0.1, state.zoom / 1.25);
    state.panX = cx - (cx - state.panX) * (state.zoom / oldZoom);
    state.panY = cy - (cy - state.panY) * (state.zoom / oldZoom);
    zoomDisplay.textContent = Math.round(state.zoom * 100) + "%";
    render();
  }

  function zoomFit() {
    if (!state.image) return;
    const pad = 40;
    const scaleX = (canvas.width - pad * 2) / state.image.naturalWidth;
    const scaleY = (canvas.height - pad * 2) / state.image.naturalHeight;
    state.zoom = Math.min(scaleX, scaleY);
    const iw = state.image.naturalWidth * state.zoom;
    const ih = state.image.naturalHeight * state.zoom;
    state.panX = (canvas.width - iw) / 2;
    state.panY = (canvas.height - ih) / 2;
    zoomDisplay.textContent = Math.round(state.zoom * 100) + "%";
    render();
  }

  btnZoomIn.addEventListener("click", zoomIn);
  btnZoomOut.addEventListener("click", zoomOut);
  btnZoomFit.addEventListener("click", zoomFit);

  // ── Tool buttons ───────────────────────────────────────────────────

  btnSelect.addEventListener("click", () => setTool("select"));
  btnDraw.addEventListener("click", () => setTool("draw"));
  btnDelete.addEventListener("click", deleteSelected);

  function deleteSelected() {
    if (!state.selectedId) return;
    state.rectangles = state.rectangles.filter(r => r.id !== state.selectedId);
    state.selectedId = null;
    state.dirty = true;
    updatePropsPanel();
    updateRectList();
    render();
  }

  // ── Properties panel ───────────────────────────────────────────────

  function updatePropsPanel() {
    const rect = state.rectangles.find(r => r.id === state.selectedId);
    if (!rect) {
      noSelection.style.display = "";
      propsFields.style.display = "none";
      return;
    }
    noSelection.style.display = "none";
    propsFields.style.display = "";

    propCollection.value = rect.properties?.collection || "";
    propCallStart.value = rect.properties?.callStart || "";
    propCallEnd.value = rect.properties?.callEnd || "";
    propLabel.value = rect.properties?.label || "";
    propDirections.value = rect.properties?.directions || "";
    propColor.value = rect.color || "#00697f";
    propColorHex.textContent = rect.color || "#00697f";

    // Sync Polaris dropdowns to current values
    const coll = rect.properties?.collection || "";
    propPolarisCollection.value = coll;
    if (propPolarisCollection.value !== coll) propPolarisCollection.selectedIndex = 0;
    const shelf = rect.properties?.shelfLocation || "";
    propPolarisShelf.value = shelf;
    if (propPolarisShelf.value !== shelf) propPolarisShelf.selectedIndex = 0;

    updatePropsPosition();
    updateColorSwatches();
  }

  function updatePropsPosition() {
    const rect = state.rectangles.find(r => r.id === state.selectedId);
    if (!rect) return;
    propX.value = rect.x.toFixed(1);
    propY.value = rect.y.toFixed(1);
    propW.value = rect.width.toFixed(1);
    propH.value = rect.height.toFixed(1);
  }

  function updateColorSwatches() {
    const current = propColor.value;
    document.querySelectorAll(".color-swatch").forEach(s => {
      s.classList.toggle("active", s.dataset.color === current);
    });
  }

  // Property input handlers
  function onPropChange() {
    const rect = state.rectangles.find(r => r.id === state.selectedId);
    if (!rect) return;
    rect.properties = rect.properties || {};
    rect.properties.collection = propCollection.value;
    rect.properties.callStart = propCallStart.value;
    rect.properties.callEnd = propCallEnd.value;
    rect.properties.label = propLabel.value;
    rect.properties.directions = propDirections.value;
    state.dirty = true;
    updateRectList();
    render();
  }

  propCollection.addEventListener("input", onPropChange);
  propDirections.addEventListener("input", onPropChange);
  propCallStart.addEventListener("input", onPropChange);
  propCallEnd.addEventListener("input", onPropChange);
  propLabel.addEventListener("input", onPropChange);

  propColor.addEventListener("input", () => {
    const rect = state.rectangles.find(r => r.id === state.selectedId);
    if (!rect) return;
    rect.color = propColor.value;
    propColorHex.textContent = propColor.value;
    updateColorSwatches();
    state.dirty = true;
    render();
  });

  document.querySelectorAll(".color-swatch").forEach(s => {
    s.style.backgroundColor = s.dataset.color;
    s.addEventListener("click", () => {
      propColor.value = s.dataset.color;
      propColor.dispatchEvent(new Event("input"));
    });
  });

  // Position inputs
  [propX, propY, propW, propH].forEach(input => {
    input.addEventListener("change", () => {
      const rect = state.rectangles.find(r => r.id === state.selectedId);
      if (!rect) return;
      rect.x = parseFloat(propX.value) || 0;
      rect.y = parseFloat(propY.value) || 0;
      rect.width = Math.max(0.5, parseFloat(propW.value) || 1);
      rect.height = Math.max(0.5, parseFloat(propH.value) || 1);
      state.dirty = true;
      render();
    });
  });

  // ── Rectangle list ─────────────────────────────────────────────────

  function updateRectList() {
    rectCount.textContent = state.rectangles.length;
    rectList.innerHTML = "";
    for (const rect of state.rectangles) {
      const li = document.createElement("li");
      li.className = rect.id === state.selectedId ? "selected" : "";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.backgroundColor = rect.color || "#00697f";
      li.appendChild(swatch);
      const text = document.createElement("span");
      text.textContent = rect.properties?.label || rect.properties?.collection || `Rectangle ${rect.id}`;
      li.appendChild(text);
      li.addEventListener("click", () => {
        selectRect(rect.id);
      });
      rectList.appendChild(li);
    }
  }

  // ── Image loading ──────────────────────────────────────────────────

  function loadImage(url, name) {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.imageUrl = url;
      state.imageName = name || "";
      imageInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
      zoomFit();
      toast("Image loaded");
    };
    img.onerror = () => toast("Failed to load image", true);
    img.src = url;
  }

  btnUpload.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    fetch("/api/upload", { method: "POST", body: formData })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        // Clear current project when uploading a new image
        state.rectangles = [];
        state.selectedId = null;
        state.projectName = "";
        state.dirty = false;
        projectName.value = "";
        projectLabel.value = "";
        projectSelect.selectedIndex = 0;
        updateRectList();
        updatePropsPanel();
        loadImage(data.url, data.name);
        refreshImages();
      })
      .catch(e => toast(e.message, true));
    fileInput.value = "";
  });

  imageSelect.addEventListener("change", () => {
    const url = imageSelect.value;
    if (url) {
      const name = imageSelect.options[imageSelect.selectedIndex].text;
      // Clear current project when switching images
      state.rectangles = [];
      state.selectedId = null;
      state.projectName = "";
      state.dirty = false;
      projectName.value = "";
      projectLabel.value = "";
      projectSelect.selectedIndex = 0;
      updateRectList();
      updatePropsPanel();
      loadImage(url, name);
    }
  });

  function refreshImages() {
    fetch("/api/images")
      .then(r => r.json())
      .then(images => {
        // Keep first option
        while (imageSelect.options.length > 1) imageSelect.remove(1);
        for (const img of images) {
          const opt = document.createElement("option");
          opt.value = img.url;
          opt.textContent = img.name;
          imageSelect.appendChild(opt);
        }
      });
  }

  // ── Project save/load ──────────────────────────────────────────────

  function saveProject() {
    const name = projectName.value.trim();
    if (!name) return toast("Enter a project name", true);
    const data = {
      name,
      label: projectLabel.value.trim(),
      image: state.imageUrl,
      imageName: state.imageName,
      rectangles: state.rectangles,
      nextId,
    };
    fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(r => r.json())
      .then(res => {
        if (res.error) throw new Error(res.error);
        state.projectName = name;
        state.dirty = false;
        toast("Project saved");
        refreshProjects();
      })
      .catch(e => toast(e.message, true));
  }

  function loadProject(name) {
    if (!name) return;
    fetch(`/api/project/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        state.rectangles = data.rectangles || [];
        nextId = data.nextId || (Math.max(0, ...state.rectangles.map(r => r.id)) + 1);
        state.selectedId = null;
        projectName.value = data.name || name;
        projectLabel.value = data.label || "";
        state.projectName = data.name || name;
        state.dirty = false;
        if (data.image) {
          loadImage(data.image, data.imageName || "");
          // Set image select if matching
          for (let i = 0; i < imageSelect.options.length; i++) {
            if (imageSelect.options[i].value === data.image) {
              imageSelect.selectedIndex = i;
              break;
            }
          }
        }
        updateRectList();
        updatePropsPanel();
        render();
        toast(`Loaded project "${name}"`);
      })
      .catch(e => toast(e.message, true));
  }

  function refreshProjects() {
    fetch("/api/projects")
      .then(r => r.json())
      .then(projects => {
        while (projectSelect.options.length > 1) projectSelect.remove(1);
        for (const p of projects) {
          const opt = document.createElement("option");
          opt.value = p.name;
          opt.textContent = `${p.label || p.name} (${p.rectangleCount} rects)`;
          projectSelect.appendChild(opt);
        }
      });
  }

  btnProjectSave.addEventListener("click", saveProject);
  btnSave.addEventListener("click", saveProject);
  btnProjectLoad.addEventListener("click", () => {
    const name = projectSelect.value;
    if (name) loadProject(name);
  });

  btnDeleteImage.addEventListener("click", () => {
    const selected = imageSelect.options[imageSelect.selectedIndex];
    if (!selected || !selected.value) return toast("Select an image first", true);
    const name = selected.text;
    if (!confirm(`Delete image "${name}"? This cannot be undone.`)) return;
    const filename = selected.value.split("/").pop();
    fetch(`/api/image/${encodeURIComponent(filename)}`, { method: "DELETE" })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        // Clear canvas if this was the loaded image
        if (state.imageUrl === selected.value) {
          state.image = null;
          state.imageUrl = "";
          state.imageName = "";
          imageInfo.textContent = "";
          render();
        }
        imageSelect.selectedIndex = 0;
        refreshImages();
        toast(`Deleted image "${name}"`);
      })
      .catch(e => toast(e.message, true));
  });

  btnDeleteProject.addEventListener("click", () => {
    const selected = projectSelect.options[projectSelect.selectedIndex];
    if (!selected || !selected.value) return toast("Select a project first", true);
    const name = selected.value;
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    fetch(`/api/project/${encodeURIComponent(name)}`, { method: "DELETE" })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        // Clear editor if this was the loaded project
        if (state.projectName === name) {
          state.rectangles = [];
          state.selectedId = null;
          state.projectName = "";
          projectName.value = "";
          projectLabel.value = "";
          updateRectList();
          updatePropsPanel();
          render();
        }
        projectSelect.selectedIndex = 0;
        refreshProjects();
        toast(`Deleted project "${name}"`);
      })
      .catch(e => toast(e.message, true));
  });

  // ── Export ─────────────────────────────────────────────────────────

  function generateExport() {
    const imageUrl = exportImageUrl.value.trim();
    const ranges = state.rectangles.map(rect => {
      const props = rect.properties || {};
      const entry = {};

      // Matcher
      const start = (props.callStart || "").trim();
      const end = (props.callEnd || "").trim();
      const collection = (props.collection || "").trim();
      if (start && end) {
        entry.start = start;
        entry.end = end;
      } else if (collection) {
        entry.collection = collection;
      }

      // Display
      if (props.label?.trim()) entry.label = props.label.trim();
      if (imageUrl) entry.map = imageUrl;

      // Center point (backward compat)
      entry.x = Math.round((rect.x + rect.width / 2) * 100) / 100;
      entry.y = Math.round((rect.y + rect.height / 2) * 100) / 100;

      // Area overlay
      entry.area = {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        color: rect.color || "#00697f",
      };

      return entry;
    });

    return JSON.stringify(ranges, null, 2);
  }

  btnExport.addEventListener("click", () => {
    exportModal.style.display = "";
    exportOutput.value = generateExport();
  });

  // Publish to FindIt (GoDaddy)
  const btnPublish = document.getElementById("btn-publish");
  btnPublish.addEventListener("click", () => {
    if (!confirm("Publish ALL saved projects to findit.rhpl.org?\n\nThis will update the live FindIt configuration immediately.")) return;
    btnPublish.disabled = true;
    btnPublish.textContent = "Publishing…";
    fetch("/api/publish", { method: "POST" })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        toast(`Published ${data.rangeCount} ranges from ${data.projects.length} project(s) to findit.rhpl.org`);
      })
      .catch(e => toast(e.message, true))
      .finally(() => {
        btnPublish.disabled = false;
        btnPublish.textContent = "Publish to FindIt";
      });
  });

  exportClose.addEventListener("click", () => { exportModal.style.display = "none"; });
  exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) exportModal.style.display = "none";
  });

  // Help modal
  btnHelp.addEventListener("click", () => { helpModal.style.display = ""; });
  helpClose.addEventListener("click", () => { helpModal.style.display = "none"; });
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.style.display = "none";
  });

  exportImageUrl.addEventListener("input", () => {
    exportOutput.value = generateExport();
  });

  exportCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(exportOutput.value)
      .then(() => toast("Copied to clipboard"))
      .catch(() => {
        exportOutput.select();
        document.execCommand("copy");
        toast("Copied to clipboard");
      });
  });

  exportDownload.addEventListener("click", () => {
    const blob = new Blob([exportOutput.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (state.projectName || "findit-rectangles") + ".json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded JSON file");
  });

  // ── Polaris data ────────────────────────────────────────────────────

  let polarisCollections = [];
  let polarisShelfLocations = [];

  function loadPolarisData() {
    fetch("/api/polaris/collections")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        polarisCollections = data;
        while (propPolarisCollection.options.length > 1) propPolarisCollection.remove(1);
        for (const c of data) {
          const opt = document.createElement("option");
          opt.value = c.name;
          opt.textContent = `${c.name} (${c.abbr})`;
          propPolarisCollection.appendChild(opt);
        }
      })
      .catch(e => console.warn("Could not load Polaris collections:", e));

    fetch("/api/polaris/shelflocations")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        polarisShelfLocations = data;
        while (propPolarisShelf.options.length > 1) propPolarisShelf.remove(1);
        for (const s of data) {
          const opt = document.createElement("option");
          opt.value = s.description;
          opt.textContent = s.description;
          propPolarisShelf.appendChild(opt);
        }
      })
      .catch(e => console.warn("Could not load Polaris shelf locations:", e));
  }

  propPolarisCollection.addEventListener("change", () => {
    const val = propPolarisCollection.value;
    if (!val) return;
    propCollection.value = val;
    // Auto-fill label if empty
    if (!propLabel.value) {
      propLabel.value = val;
    }
    onPropChange();
  });

  propPolarisShelf.addEventListener("change", () => {
    const val = propPolarisShelf.value;
    if (!val) return;
    const rect = state.rectangles.find(r => r.id === state.selectedId);
    if (!rect) return;
    rect.properties = rect.properties || {};
    rect.properties.shelfLocation = val;
    // Append to label if collection is already set
    if (propCollection.value && propLabel.value === propCollection.value) {
      propLabel.value = `${propCollection.value} – ${val}`;
    } else if (!propLabel.value) {
      propLabel.value = val;
    }
    onPropChange();
  });

  // ── Init ───────────────────────────────────────────────────────────

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  setTool("select");
  refreshImages();
  refreshProjects();
  loadPolarisData();

  // Prevent context menu on canvas
  canvas.addEventListener("contextmenu", e => e.preventDefault());

})();
