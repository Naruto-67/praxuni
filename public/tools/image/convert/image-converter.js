/**
 * Praxuni - Image Converter Tool Engine
 * Pure Vanilla JavaScript (Client-Side HTML5 Canvas + Web APIs)
 * Zero Remote Server Uploads • Maximum Privacy
 */

(() => {
  "use strict";

  // Application State
  const state = {
    queue: [],
    isProcessing: false,
    settingsVersion: 0,
    activeId: null,
    viewMode: "original", // 'original' | 'converted' | 'compare'
    zoomLevel: 1,
    settings: {
      targetFormat: "image/jpeg",
      quality: 0.95,
      bgFill: "#ffffff"
    }
  };

  const SUPPORTED_EXTENSIONS = [".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp", ".svg", ".bmp", ".gif"];
  const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB safe limit
  const MAX_SAFE_PIXELS = 40_000_000; // 40 megapixels browser-safe canvas allocation cap

  let dom = {};
  let activeConvertedPreviewUrl = null;
  let activeConvertedPreviewBlob = null;
  let isDraggingCompare = false;

  document.addEventListener("DOMContentLoaded", () => {
    initDom();
    initHealthCheck();
    initEvents();
    initPreviewCompareSlider();
    applyUrlParams();
  });

  window.addEventListener("beforeunload", () => {
    clearConvertedPreview();
    state.queue.forEach(item => {
      if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
    });
  });

  function initDom() {
    dom = {
      serviceStatus: document.getElementById("serviceStatus"),
      uploadDropzone: document.getElementById("uploadDropzone"),
      fileInput: document.getElementById("fileInput"),
      selectFilesBtn: document.getElementById("selectFilesBtn"),
      workspaceArea: document.getElementById("workspaceArea"),
      cardsList: document.getElementById("cardsList"),
      alertBanner: document.getElementById("alertBanner"),
      alertMessage: document.getElementById("alertMessage"),
      alertDismissBtn: document.getElementById("alertDismissBtn"),
      queueCounter: document.getElementById("queueCounter"),
      conversionProgressText: document.getElementById("conversionProgressText"),
      addMoreBtn: document.getElementById("addMoreBtn"),
      clearAllBtn: document.getElementById("clearAllBtn"),
      convertAllBtn: document.getElementById("convertAllBtn"),
      downloadAllZipBtn: document.getElementById("downloadAllZipBtn"),

      // Settings
      formatPresetPills: document.querySelectorAll(".format-preset-pill"),
      transparencyNotice: document.getElementById("transparencyNotice"),
      convertQualitySlider: document.getElementById("convertQualitySlider"),
      convertQualityVal: document.getElementById("convertQualityVal"),
      qualityGroup: document.getElementById("qualityGroup"),
      bgSwatchPills: document.querySelectorAll(".bg-swatch-pill"),
      bgFillGroup: document.getElementById("bgFillGroup"),
      resetSettingsBtn: document.getElementById("resetSettingsBtn"),
      applySettingsBtn: document.getElementById("applySettingsBtn"),

      // Live Preview Elements
      viewModeTabs: document.querySelectorAll(".view-mode-tabs .tab-btn"),
      zoomOutBtn: document.getElementById("zoomOutBtn"),
      zoomFitBtn: document.getElementById("zoomFitBtn"),
      zoomInBtn: document.getElementById("zoomInBtn"),
      previewViewport: document.getElementById("previewViewport"),
      previewCanvasContainer: document.getElementById("previewCanvasContainer"),
      convertedPreviewImg: document.getElementById("convertedPreviewImg"),
      originalPreviewImg: document.getElementById("originalPreviewImg"),

      // Compare Slider Elements
      previewCompareContainer: document.getElementById("previewCompareContainer"),
      previewCompareStage: document.getElementById("previewCompareStage"),
      previewCompareConvertedImg: document.getElementById("previewCompareConvertedImg"),
      previewCompareOverlay: document.getElementById("previewCompareOverlay"),
      previewCompareOriginalImg: document.getElementById("previewCompareOriginalImg"),
      previewCompareHandle: document.getElementById("previewCompareHandle"),
      previewCompareOrigBadge: document.getElementById("previewCompareOrigBadge"),
      previewCompareConvBadge: document.getElementById("previewCompareConvBadge"),

      previewFormatTag: document.getElementById("previewFormatTag"),
      previewDimensionTag: document.getElementById("previewDimensionTag"),

      // Active Meta Details
      activeItemName: document.getElementById("activeItemName"),
      activeStatusBadge: document.getElementById("activeStatusBadge"),
      downloadActiveBtn: document.getElementById("downloadActiveBtn"),
      metaOrigFormat: document.getElementById("metaOrigFormat"),
      metaTargetFormat: document.getElementById("metaTargetFormat"),
      metaOrigSize: document.getElementById("metaOrigSize"),
      metaConvSize: document.getElementById("metaConvSize"),
      metaDimensions: document.getElementById("metaDimensions"),

      // Queue & Action Buttons
      queueCard: document.getElementById("queueCard"),
      queueItemCount: document.getElementById("queueItemCount"),
      headerDownloadBtn: document.getElementById("headerDownloadBtn"),
      panelDownloadBtn: document.getElementById("panelDownloadBtn"),
      panelDownloadZipBtn: document.getElementById("panelDownloadZipBtn")
    };
  }

  async function initHealthCheck() {
    const statusEl = dom.serviceStatus || document.getElementById("serviceStatus");
    if (!statusEl) return;
    const labelEl = statusEl.querySelector(".status-label");

    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok") {
          statusEl.className = "status-badge online";
          if (labelEl) labelEl.textContent = "Worker: Online (100% Edge)";
          statusEl.title = `Worker operational: ${data.timestamp || "Active"}`;
        }
      }
    } catch {
      // Gracefully maintain checking state
    }
  }


  function showAlert(msg) {
    if (!dom.alertBanner || !dom.alertMessage) return;
    dom.alertMessage.textContent = msg;
    dom.alertBanner.classList.remove("hidden");
  }

  function hideAlert() {
    if (!dom.alertBanner) return;
    dom.alertBanner.classList.add("hidden");
  }

  function clearConvertedPreview() {
    if (activeConvertedPreviewUrl) {
      URL.revokeObjectURL(activeConvertedPreviewUrl);
      activeConvertedPreviewUrl = null;
      activeConvertedPreviewBlob = null;
    }
    if (dom.convertedPreviewImg) dom.convertedPreviewImg.src = "";
    if (dom.previewCompareConvertedImg) dom.previewCompareConvertedImg.src = "";
  }

  function invalidateConversions() {
    state.settingsVersion++;
    state.isProcessing = false;
    if (dom.conversionProgressText) {
      dom.conversionProgressText.classList.add("hidden");
    }

    let hadChanges = false;
    state.queue.forEach(item => {
      if (item.convertedBlob !== null || item.convertedSize !== null || item.status !== "ready" || item.errorMessage !== null) {
        item.convertedBlob = null;
        item.convertedSize = null;
        item.status = "ready";
        item.errorMessage = null;
        hadChanges = true;
      }
    });

    clearConvertedPreview();
    setViewMode("original");

    if (hadChanges || state.queue.length > 0) {
      updateWorkspaceUI();
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    if (!bytes || isNaN(bytes)) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function getFileExtension(filename) {
    if (!filename) return "";
    const idx = filename.lastIndexOf(".");
    return idx !== -1 ? filename.substring(idx).toLowerCase() : "";
  }

  function removeFileExtension(filename) {
    if (!filename) return "";
    const idx = filename.lastIndexOf(".");
    return idx !== -1 ? filename.substring(0, idx) : filename;
  }

  function getExtensionForMime(mime) {
    switch (mime) {
      case "image/jpeg": return ".jpg";
      case "image/png": return ".png";
      case "image/webp": return ".webp";
      case "image/bmp": return ".bmp";
      default: return ".jpg";
    }
  }

  function formatMimeTitle(mime) {
    switch (mime) {
      case "image/jpeg": return "JPEG";
      case "image/png": return "PNG";
      case "image/webp": return "WebP";
      case "image/bmp": return "BMP";
      case "image/heic":
      case "image/heif": return "HEIC";
      case "image/svg+xml": return "SVG";
      default: return mime ? mime.replace("image/", "").toUpperCase() : "IMAGE";
    }
  }

  function isHeic(file) {
    const ext = getFileExtension(file.name);
    return ext === ".heic" || ext === ".heif" || file.type === "image/heic" || file.type === "image/heif";
  }

  // Lazy-load HEIC decoder on-demand
  let heicDecoderPromise = null;
  function loadHeicDecoder() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (heicDecoderPromise) return heicDecoderPromise;

    heicDecoderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
      script.async = true;
      script.onload = () => {
        if (window.heic2any) {
          resolve(window.heic2any);
        } else {
          reject(new Error("HEIC decoder failed to initialize."));
        }
      };
      script.onerror = () => {
        reject(new Error("Could not load client-side HEIC decoder script."));
      };
      document.head.appendChild(script);
    });

    return heicDecoderPromise;
  }

  function initPreviewCompareSlider() {
    const container = dom.previewCompareStage || dom.previewCompareContainer;
    if (!container) return;

    function startDrag(e) {
      if (e.type === "mousedown" && e.button !== 0) return;
      isDraggingCompare = true;
      container.classList.add("is-dragging");
      updateFromEvent(e);
      e.preventDefault();
    }

    function updateFromEvent(e) {
      if (!isDraggingCompare) return;
      const target = dom.previewCompareStage || dom.previewCompareContainer;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!rect.width) return;
      const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
      if (clientX === undefined) return;
      const offsetX = clientX - rect.left;
      let pct = (offsetX / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      setPreviewComparePos(pct);
    }

    function stopDrag() {
      if (isDraggingCompare) {
        isDraggingCompare = false;
        container.classList.remove("is-dragging");
      }
    }

    container.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", updateFromEvent);
    window.addEventListener("mouseup", stopDrag);

    container.addEventListener("touchstart", startDrag, { passive: false });
    window.addEventListener("touchmove", updateFromEvent, { passive: true });
    window.addEventListener("touchend", stopDrag);
    window.addEventListener("touchcancel", stopDrag);

    if (dom.previewCompareHandle) {
      dom.previewCompareHandle.addEventListener("keydown", (e) => {
        const target = dom.previewCompareStage || dom.previewCompareContainer;
        let currentPct = parseFloat(target.style.getPropertyValue("--compare-pos")) || 50;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          setPreviewComparePos(Math.max(0, currentPct - 5));
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          setPreviewComparePos(Math.min(100, currentPct + 5));
        }
      });
    }
  }

  function setPreviewComparePos(pct) {
    const target = dom.previewCompareStage || dom.previewCompareContainer;
    if (!target) return;
    const rounded = Math.round(pct * 10) / 10;
    target.style.setProperty("--compare-pos", `${rounded}%`);
    if (dom.previewCompareHandle) {
      dom.previewCompareHandle.setAttribute("aria-valuenow", Math.round(rounded));
    }
  }

  function updateFormatPresetPills(selectedMime) {
    if (dom.formatPresetPills) {
      dom.formatPresetPills.forEach(pill => {
        pill.classList.toggle("active", pill.dataset.format === selectedMime);
      });
    }
  }

  function updateBgSwatchPills(selectedColor) {
    if (dom.bgSwatchPills) {
      dom.bgSwatchPills.forEach(pill => {
        pill.classList.toggle("active", (pill.dataset.color || "").toLowerCase() === (selectedColor || "").toLowerCase());
      });
    }
  }

  function resetSettings() {
    state.settings.targetFormat = "image/jpeg";
    state.settings.quality = 0.95;
    state.settings.bgFill = "#ffffff";

    if (dom.convertQualitySlider) dom.convertQualitySlider.value = 95;
    if (dom.convertQualityVal) dom.convertQualityVal.textContent = "95% (High)";

    updateFormatPresetPills("image/jpeg");
    updateBgSwatchPills("#ffffff");
    updateControlsVisibility();
    invalidateConversions();
  }

  function updateTransparencyNotice() {
    if (!dom.transparencyNotice) return;
    const isOpaqueTarget = state.settings.targetFormat === "image/jpeg" || state.settings.targetFormat === "image/bmp";
    const active = getActiveItem();
    const hasTransparentSource = active && (active.ext === ".png" || active.ext === ".svg" || active.ext === ".webp" || active.ext === ".gif");
    dom.transparencyNotice.classList.toggle("hidden", !(isOpaqueTarget && hasTransparentSource));
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    if (dom.viewModeTabs) {
      dom.viewModeTabs.forEach(b => {
        const isActive = b.dataset.view === state.viewMode;
        b.classList.toggle("active", isActive);
        b.setAttribute("aria-selected", String(isActive));
      });
    }
    updateActivePreviewDisplay();
  }

  function initEvents() {
    if (dom.alertDismissBtn) {
      dom.alertDismissBtn.addEventListener("click", hideAlert);
    }

    // Dropzone Click
    if (dom.uploadDropzone) {
      dom.uploadDropzone.addEventListener("click", (e) => {
        if (e.target !== dom.selectFilesBtn && dom.fileInput) {
          dom.fileInput.click();
        }
      });
    }

    if (dom.selectFilesBtn && dom.fileInput) {
      dom.selectFilesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dom.fileInput.click();
      });
    }

    if (dom.addMoreBtn && dom.fileInput) {
      dom.addMoreBtn.addEventListener("click", () => {
        dom.fileInput.click();
      });
    }

    if (dom.fileInput) {
      dom.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFiles(Array.from(e.target.files));
          dom.fileInput.value = "";
        }
      });
    }

    // Drag and drop
    if (dom.uploadDropzone) {
      ["dragenter", "dragover"].forEach(evtName => {
        dom.uploadDropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dom.uploadDropzone.classList.add("drag-active");
        });
      });

      ["dragleave", "drop"].forEach(evtName => {
        dom.uploadDropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dom.uploadDropzone.classList.remove("drag-active");
        });
      });

      dom.uploadDropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleFiles(Array.from(dt.files));
        }
      });
    }

    // Clipboard Paste
    document.addEventListener("paste", (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        handleFiles(Array.from(e.clipboardData.files));
      }
    });

    // Reset Button
    if (dom.resetSettingsBtn) {
      dom.resetSettingsBtn.addEventListener("click", resetSettings);
    }

    // Format Preset Pills
    if (dom.formatPresetPills) {
      dom.formatPresetPills.forEach(pill => {
        pill.addEventListener("click", () => {
          const fmt = pill.dataset.format;
          if (fmt && state.settings.targetFormat !== fmt) {
            state.settings.targetFormat = fmt;
            updateFormatPresetPills(fmt);
            updateControlsVisibility();
            invalidateConversions();
          }
        });
      });
    }

    // Quality Slider
    if (dom.convertQualitySlider) {
      dom.convertQualitySlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        const newQ = val / 100;
        if (dom.convertQualityVal) {
          dom.convertQualityVal.textContent = `${val}% ${val >= 90 ? "(High)" : val >= 70 ? "(Balanced)" : "(Compact)"}`;
        }
        if (state.settings.quality !== newQ) {
          state.settings.quality = newQ;
          invalidateConversions();
        }
      });
    }

    // Background Swatches
    if (dom.bgSwatchPills) {
      dom.bgSwatchPills.forEach(pill => {
        pill.addEventListener("click", () => {
          const color = pill.dataset.color;
          if (color && state.settings.bgFill !== color) {
            state.settings.bgFill = color;
            updateBgSwatchPills(color);
            invalidateConversions();
          }
        });
      });
    }

    // Sidebar Apply / Convert Button
    if (dom.applySettingsBtn) {
      dom.applySettingsBtn.addEventListener("click", () => {
        if (state.queue.length > 1) {
          convertAll();
        } else {
          const active = getActiveItem();
          if (active) convertItem(active);
        }
      });
    }

    // Action buttons
    if (dom.clearAllBtn) {
      dom.clearAllBtn.addEventListener("click", clearAll);
    }

    if (dom.convertAllBtn) {
      dom.convertAllBtn.addEventListener("click", convertAll);
    }

    if (dom.downloadAllZipBtn) {
      dom.downloadAllZipBtn.addEventListener("click", downloadAllZip);
    }

    if (dom.panelDownloadZipBtn) {
      dom.panelDownloadZipBtn.addEventListener("click", downloadAllZip);
    }

    if (dom.downloadActiveBtn) {
      dom.downloadActiveBtn.addEventListener("click", downloadActiveItem);
    }

    if (dom.panelDownloadBtn) {
      dom.panelDownloadBtn.addEventListener("click", downloadActiveItem);
    }

    if (dom.headerDownloadBtn) {
      dom.headerDownloadBtn.addEventListener("click", downloadActiveItem);
    }

    if (dom.viewModeTabs) {
      dom.viewModeTabs.forEach(btn => {
        btn.addEventListener("click", () => {
          setViewMode(btn.dataset.view);
        });
      });
    }

    if (dom.zoomInBtn) {
      dom.zoomInBtn.addEventListener("click", () => {
        let z = typeof state.zoomLevel === "number" ? state.zoomLevel : 1;
        z = Math.min(3, Math.round((z + 0.25) * 100) / 100);
        state.zoomLevel = z;
        applyZoom();
      });
    }
    if (dom.zoomOutBtn) {
      dom.zoomOutBtn.addEventListener("click", () => {
        let z = typeof state.zoomLevel === "number" ? state.zoomLevel : 1;
        z = Math.max(0.25, Math.round((z - 0.25) * 100) / 100);
        state.zoomLevel = z;
        applyZoom();
      });
    }
    if (dom.zoomFitBtn) {
      dom.zoomFitBtn.addEventListener("click", () => {
        state.zoomLevel = 1;
        applyZoom();
      });
    }
  }

  function getActiveItem() {
    if (!state.queue || state.queue.length === 0) return null;
    return state.queue.find(i => i.id === state.activeId) || state.queue[0];
  }

  function selectActiveItem(id) {
    if (state.activeId === id) return;
    state.activeId = id;
    renderAllCards();
    updateActivePreviewDisplay();
  }

  function applyZoom() {
    const container = dom.previewCanvasContainer;
    if (!container) return;
    const z = typeof state.zoomLevel === "number" ? state.zoomLevel : 1;
    container.style.transform = `scale(${z})`;
    if (dom.zoomFitBtn) {
      dom.zoomFitBtn.textContent = `${Math.round(z * 100)}%`;
      dom.zoomFitBtn.classList.toggle("active", z === 1);
    }
  }

  function updateActivePreviewDisplay() {
    const active = getActiveItem();
    if (!active) {
      clearConvertedPreview();
      return;
    }

    const mode = state.viewMode || "converted";

    // Manage object URL for active converted blob
    let convertedUrl = "";
    if (active.convertedBlob) {
      if (activeConvertedPreviewBlob !== active.convertedBlob) {
        if (activeConvertedPreviewUrl) {
          URL.revokeObjectURL(activeConvertedPreviewUrl);
        }
        activeConvertedPreviewBlob = active.convertedBlob;
        activeConvertedPreviewUrl = URL.createObjectURL(active.convertedBlob);
      }
      convertedUrl = activeConvertedPreviewUrl;
    } else {
      if (activeConvertedPreviewUrl) {
        URL.revokeObjectURL(activeConvertedPreviewUrl);
        activeConvertedPreviewUrl = null;
        activeConvertedPreviewBlob = null;
      }
      convertedUrl = active.thumbUrl || "";
    }

    if (dom.convertedPreviewImg) {
      dom.convertedPreviewImg.classList.toggle("hidden", mode !== "converted");
      if (mode === "converted") {
        dom.convertedPreviewImg.src = convertedUrl || active.thumbUrl || "";
      }
    }
    if (dom.originalPreviewImg) {
      dom.originalPreviewImg.classList.toggle("hidden", mode !== "original");
      if (mode === "original") {
        dom.originalPreviewImg.src = active.thumbUrl || "";
      }
    }
    if (dom.previewCompareContainer) {
      dom.previewCompareContainer.classList.toggle("hidden", mode !== "compare");
      if (mode === "compare") {
        if (dom.previewCompareConvertedImg) {
          dom.previewCompareConvertedImg.src = convertedUrl || active.thumbUrl || "";
        }
        if (dom.previewCompareOriginalImg) {
          dom.previewCompareOriginalImg.src = active.thumbUrl || "";
        }
        if (dom.previewCompareOrigBadge) {
          dom.previewCompareOrigBadge.textContent = `Original • ${active.ext.replace('.', '').toUpperCase()} (${formatBytes(active.size)})`;
        }
        if (dom.previewCompareConvBadge) {
          const targetFmt = getExtensionForMime(state.settings.targetFormat).replace('.', '').toUpperCase();
          if (active.convertedSize) {
            dom.previewCompareConvBadge.textContent = `${targetFmt} • ${formatBytes(active.convertedSize)}`;
          } else {
            dom.previewCompareConvBadge.textContent = `${targetFmt} • Ready`;
          }
        }
      }
    }

    if (dom.previewFormatTag) {
      if (mode === "compare") {
        dom.previewFormatTag.classList.add("hidden");
      } else {
        dom.previewFormatTag.classList.remove("hidden");
        const fromFmt = active.ext.replace('.', '').toUpperCase() || "IMAGE";
        const toFmt = getExtensionForMime(state.settings.targetFormat).replace('.', '').toUpperCase();
        dom.previewFormatTag.textContent = `${fromFmt} → ${toFmt}`;
      }
    }

    const dimsText = (active.width && active.height) ? `${active.width} × ${active.height} px` : active.name;
    if (dom.previewDimensionTag) {
      dom.previewDimensionTag.textContent = dimsText;
    }

    // Meta Card
    if (dom.activeItemName) {
      dom.activeItemName.textContent = active.name;
      dom.activeItemName.title = active.name;
    }
    if (dom.activeStatusBadge) {
      if (active.status === "done") {
        dom.activeStatusBadge.textContent = "✓ Converted";
        dom.activeStatusBadge.className = "status-badge-inline done";
      } else if (active.status === "converting") {
        dom.activeStatusBadge.textContent = "⏳ Converting...";
        dom.activeStatusBadge.className = "status-badge-inline warning";
      } else if (active.status === "error") {
        dom.activeStatusBadge.textContent = "⚠ Failed";
        dom.activeStatusBadge.className = "status-badge-inline error";
      } else {
        dom.activeStatusBadge.textContent = "Ready";
        dom.activeStatusBadge.className = "status-badge-inline ready";
      }
    }

    if (dom.downloadActiveBtn) {
      const isDone = active.status === "done" && active.convertedBlob;
      dom.downloadActiveBtn.classList.toggle("hidden", !isDone);
    }

    if (dom.metaOrigFormat) {
      dom.metaOrigFormat.textContent = active.ext.replace('.', '').toUpperCase();
      dom.metaOrigFormat.title = dom.metaOrigFormat.textContent;
    }
    if (dom.metaTargetFormat) {
      dom.metaTargetFormat.textContent = getExtensionForMime(state.settings.targetFormat).replace('.', '').toUpperCase();
      dom.metaTargetFormat.title = dom.metaTargetFormat.textContent;
    }
    if (dom.metaOrigSize) {
      dom.metaOrigSize.textContent = formatBytes(active.size);
      dom.metaOrigSize.title = dom.metaOrigSize.textContent;
    }
    if (dom.metaConvSize) {
      dom.metaConvSize.textContent = active.convertedSize ? formatBytes(active.convertedSize) : "--";
      dom.metaConvSize.title = dom.metaConvSize.textContent;
      if (active.convertedSize && active.convertedSize < active.size) {
        dom.metaConvSize.className = "meta-value highlight-green";
      } else {
        dom.metaConvSize.className = "meta-value";
      }
    }
    if (dom.metaDimensions) {
      dom.metaDimensions.textContent = (active.width && active.height) ? `${active.width} × ${active.height} px` : "--";
      dom.metaDimensions.title = dom.metaDimensions.textContent;
    }

    updateTransparencyNotice();
    applyZoom();
  }

  async function downloadActiveItem() {
    const active = getActiveItem();
    if (!active) return;
    if (active.convertedBlob) {
      downloadItem(active);
    } else {
      await convertItem(active);
      updateWorkspaceUI();
      if (active.convertedBlob) {
        downloadItem(active);
      }
    }
  }

  function updateControlsVisibility() {
    const isLossy = state.settings.targetFormat === "image/jpeg" || state.settings.targetFormat === "image/webp";
    if (dom.qualityGroup) {
      dom.qualityGroup.style.display = isLossy ? "flex" : "none";
    }

    const needsBgFill = state.settings.targetFormat === "image/jpeg" || state.settings.targetFormat === "image/bmp";
    if (dom.bgFillGroup) {
      dom.bgFillGroup.style.display = needsBgFill ? "flex" : "none";
    }

    updateTransparencyNotice();
  }

  function applyUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const toParam = params.get("to") || params.get("format");
      if (toParam) {
        const map = {
          "jpg": "image/jpeg",
          "jpeg": "image/jpeg",
          "png": "image/png",
          "webp": "image/webp",
          "bmp": "image/bmp"
        };
        const mime = map[toParam.toLowerCase()] || toParam;
        const validMimes = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
        if (validMimes.includes(mime)) {
          state.settings.targetFormat = mime;
          updateFormatPresetPills(mime);
          updateControlsVisibility();
        }
      }
    } catch {
      // Ignore
    }
  }

  async function handleFiles(files) {
    hideAlert();
    const validFiles = [];

    for (const file of files) {
      const ext = getFileExtension(file.name);
      const isMimeSupported = file.type && file.type.startsWith("image/");
      const isExtSupported = SUPPORTED_EXTENSIONS.includes(ext);

      if (!isMimeSupported && !isExtSupported) {
        showAlert(`File "${file.name}" is not a recognized image format.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        showAlert(`File "${file.name}" exceeds the maximum 60MB browser limit.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const item = {
        id: "img_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
        file,
        name: file.name,
        size: file.size,
        ext: getFileExtension(file.name),
        isHeic: isHeic(file),
        status: "ready",
        thumbUrl: null,
        convertedBlob: null,
        convertedSize: null,
        errorMessage: null
      };

      state.queue.push(item);

      // Generate preview thumbnail
      generateThumbnail(item);
    }

    updateWorkspaceUI();
  }

  async function generateThumbnail(item) {
    try {
      if (item.isHeic) {
        // HEIC placeholder until decoded or load decoder
        item.thumbUrl = "";
        renderItemCard(item);
      } else {
        item.thumbUrl = URL.createObjectURL(item.file);
        const testImg = new Image();
        testImg.onload = () => {
          item.width = testImg.naturalWidth;
          item.height = testImg.naturalHeight;
          if (item.id === state.activeId) {
            updateActivePreviewDisplay();
          }
        };
        testImg.src = item.thumbUrl;
        renderItemCard(item);
      }
    } catch {
      renderItemCard(item);
    }
  }

  function updateWorkspaceUI() {
    if (state.queue.length > 0) {
      dom.uploadDropzone.classList.add("hidden");
      dom.workspaceArea.classList.remove("hidden");
    } else {
      clearConvertedPreview();
      dom.uploadDropzone.classList.remove("hidden");
      dom.workspaceArea.classList.add("hidden");
      state.activeId = null;
      return;
    }

    if (!state.activeId || !state.queue.find(i => i.id === state.activeId)) {
      state.activeId = state.queue[0]?.id || null;
    }

    const count = state.queue.length;
    const doneCount = state.queue.filter(i => i.status === "done").length;

    if (dom.queueCounter) {
      dom.queueCounter.textContent = `${count} image${count === 1 ? "" : "s"} (${doneCount} converted)`;
    }

    if (dom.clearAllBtn) {
      dom.clearAllBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        ${count === 1 ? "Clear" : "Clear All"}
      `;
      dom.clearAllBtn.title = count === 1 ? "Clear image" : "Clear all images";
    }

    if (dom.convertAllBtn) {
      dom.convertAllBtn.classList.toggle("hidden", count <= 1);
      dom.convertAllBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        Convert All (${count})
      `;
    }

    const active = getActiveItem();
    const isConverting = state.isProcessing || (active && active.status === "converting");
    const activeIsDone = active && active.status === "done" && active.convertedBlob;
    const hasDone = state.queue.some(i => i.status === "done" && i.convertedBlob);
    const allDone = count > 1 && state.queue.every(i => i.status === "done" && i.convertedBlob);

    if (dom.applySettingsBtn) {
      dom.applySettingsBtn.disabled = isConverting;
      if (isConverting) {
        dom.applySettingsBtn.className = "btn btn-primary btn-block btn-lg btn-convert-main is-loading";
        dom.applySettingsBtn.innerHTML = `<span>⏳ Converting...</span>`;
      } else if (count === 1 && activeIsDone) {
        dom.applySettingsBtn.className = "btn btn-outline btn-block btn-reconvert";
        dom.applySettingsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Reconvert Image</span>
        `;
      } else if (count > 1 && allDone) {
        dom.applySettingsBtn.className = "btn btn-outline btn-block btn-reconvert";
        dom.applySettingsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Reconvert All (${count})</span>
        `;
      } else {
        dom.applySettingsBtn.className = "btn btn-primary btn-block btn-lg btn-convert-main";
        dom.applySettingsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>${count === 1 ? "Convert Image" : `Convert All (${count})`}</span>
        `;
      }
    }

    if (dom.downloadAllZipBtn) {
      dom.downloadAllZipBtn.classList.toggle("hidden", !(hasDone && count > 1));
    }
    if (dom.panelDownloadZipBtn) {
      dom.panelDownloadZipBtn.classList.toggle("hidden", !(hasDone && count > 1));
    }
    if (dom.panelDownloadBtn) {
      dom.panelDownloadBtn.classList.toggle("hidden", !(activeIsDone && count === 1));
    }
    if (dom.headerDownloadBtn) {
      dom.headerDownloadBtn.classList.toggle("hidden", !(activeIsDone && count === 1));
    }

    if (dom.queueCard) {
      dom.queueCard.classList.toggle("hidden", count <= 1);
      if (dom.queueItemCount) dom.queueItemCount.textContent = count;
    }

    renderAllCards();
    updateActivePreviewDisplay();
  }

  function renderAllCards() {
    if (!dom.cardsList) return;
    dom.cardsList.innerHTML = "";
    state.queue.forEach(item => {
      const card = createCardElement(item);
      dom.cardsList.appendChild(card);
    });
  }

  function renderItemCard(item) {
    const existing = document.getElementById("card_" + item.id);
    if (existing) {
      const newCard = createCardElement(item);
      existing.replaceWith(newCard);
    } else {
      renderAllCards();
    }
  }

  function createCardElement(item) {
    const card = document.createElement("div");
    card.id = "card_" + item.id;
    card.className = "convert-card" + (item.id === state.activeId ? " is-active" : "");
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-card-action") || e.target.closest(".btn-remove-item")) return;
      selectActiveItem(item.id);
    });

    // Thumb
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "convert-thumb-wrap";
    if (item.thumbUrl) {
      const img = document.createElement("img");
      img.src = item.thumbUrl;
      img.alt = item.name;
      img.className = "convert-thumb";
      thumbWrap.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.style.fontSize = "1.5rem";
      icon.textContent = item.isHeic ? "📱" : "🖼️";
      thumbWrap.appendChild(icon);
    }

    // Info
    const info = document.createElement("div");
    info.className = "convert-info";

    const title = document.createElement("div");
    title.className = "convert-title";
    title.textContent = item.name;
    title.title = item.name;

    const meta = document.createElement("div");
    meta.className = "convert-meta";

    const origSpan = document.createElement("span");
    origSpan.className = "meta-original-format";
    origSpan.textContent = `${formatMimeTitle(item.file.type || item.ext)} • ${formatBytes(item.size)}`;
    meta.appendChild(origSpan);

    if (item.status === "done" && item.convertedBlob) {
      const arrow = document.createElement("span");
      arrow.className = "meta-arrow";
      arrow.textContent = "→";
      meta.appendChild(arrow);

      const convSpan = document.createElement("span");
      convSpan.className = "meta-converted";
      convSpan.textContent = `${formatMimeTitle(state.settings.targetFormat)} • ${formatBytes(item.convertedSize)}`;
      meta.appendChild(convSpan);
    }

    const badge = document.createElement("div");
    badge.className = `convert-status-badge ${item.status}`;
    if (item.status === "ready") badge.textContent = "Ready";
    else if (item.status === "converting") badge.textContent = "Converting...";
    else if (item.status === "done") badge.textContent = "✓ Converted";
    else if (item.status === "error") badge.textContent = item.errorMessage || "Failed";

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(badge);

    // Actions
    const actions = document.createElement("div");
    actions.className = "convert-actions";

    if (item.status === "done" && item.convertedBlob) {
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "btn btn-primary btn-card-action";
      downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download
      `;
      downloadBtn.addEventListener("click", () => downloadItem(item));
      actions.appendChild(downloadBtn);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove-item";
    removeBtn.title = "Remove image";
    removeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    removeBtn.addEventListener("click", () => removeItem(item.id));
    actions.appendChild(removeBtn);

    card.appendChild(thumbWrap);
    card.appendChild(info);
    card.appendChild(actions);

    return card;
  }

  function removeItem(id) {
    const idx = state.queue.findIndex(i => i.id === id);
    if (idx !== -1) {
      const item = state.queue[idx];
      if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
      if (state.activeId === id) {
        clearConvertedPreview();
      }
      state.queue.splice(idx, 1);
    }
    updateWorkspaceUI();
  }

  function clearAll() {
    clearConvertedPreview();
    state.queue.forEach(item => {
      if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
    });
    state.queue = [];
    updateWorkspaceUI();
  }

  async function convertItem(item) {
    if (!item) return;
    const runVersion = state.settingsVersion;
    item.status = "converting";
    item.errorMessage = null;
    renderItemCard(item);
    if (item.id === state.activeId) updateActivePreviewDisplay();

    try {
      const blob = await convertSingleImage(
        item,
        state.settings.targetFormat,
        state.settings.quality,
        state.settings.bgFill
      );

      // Async Safety Guard: If settings changed or item was removed mid-conversion, discard result
      if (runVersion !== state.settingsVersion || !state.queue.some(i => i.id === item.id)) {
        return;
      }

      item.convertedBlob = blob;
      item.convertedSize = blob.size;
      item.status = "done";
      item.errorMessage = null;
    } catch (err) {
      // Async Safety Guard: Do not set error on item if settings changed mid-conversion
      if (runVersion !== state.settingsVersion || !state.queue.some(i => i.id === item.id)) {
        return;
      }
      item.status = "error";
      item.errorMessage = err.message || "Conversion failed";
    }

    if (runVersion !== state.settingsVersion || !state.queue.some(i => i.id === item.id)) {
      return;
    }

    if (item.status === "done" && item.id === state.activeId) {
      try {
        setViewMode("compare");
      } catch {
        // fallback safe
      }
    }

    renderItemCard(item);
    if (item.id === state.activeId) updateActivePreviewDisplay();
    updateWorkspaceUI();
  }

  async function convertAll() {
    if (state.isProcessing || state.queue.length === 0) return;
    state.isProcessing = true;
    hideAlert();
    const runVersion = state.settingsVersion;

    if (dom.conversionProgressText) {
      dom.conversionProgressText.classList.remove("hidden");
    }

    for (let i = 0; i < state.queue.length; i++) {
      if (runVersion !== state.settingsVersion) {
        // Settings changed mid-batch, abort remaining queue
        break;
      }
      const item = state.queue[i];
      if (dom.conversionProgressText) {
        dom.conversionProgressText.textContent = `Converting ${i + 1} of ${state.queue.length}...`;
      }
      await convertItem(item);
    }

    if (runVersion === state.settingsVersion) {
      state.isProcessing = false;
      if (dom.conversionProgressText) {
        dom.conversionProgressText.classList.add("hidden");
      }
      updateWorkspaceUI();
    }
  }

  async function convertSingleImage(item, targetFormat, quality, bgFill) {
    let sourceBlob = item.file;

    // Handle HEIC
    if (item.isHeic) {
      const heic2any = await loadHeicDecoder();
      const res = await heic2any({
        blob: item.file,
        toType: "image/jpeg",
        quality: 0.98
      });
      sourceBlob = Array.isArray(res) ? res[0] : res;
      if (!item.thumbUrl) {
        item.thumbUrl = URL.createObjectURL(sourceBlob);
      }
    }

    // Load source into Image
    const img = await loadImageFromBlob(sourceBlob);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    item.width = width;
    item.height = height;

    // Megapixel / Browser Safety Check before allocating canvas
    const totalPixels = width * height;
    if (totalPixels > MAX_SAFE_PIXELS) {
      const mp = (totalPixels / 1_000_000).toFixed(1);
      throw new Error(`Image resolution too large (${width} × ${height} px, ${mp} MP). Exceeds safe browser limit of 40 Megapixels.`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create canvas 2D rendering context.");
    }

    // Background fill for formats without transparency (JPEG / BMP)
    if (targetFormat === "image/jpeg" || targetFormat === "image/bmp") {
      ctx.fillStyle = bgFill || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    // Export to target format
    if (targetFormat === "image/bmp") {
      return canvasToBmpBlob(canvas);
    }

    const q = targetFormat === "image/png" ? undefined : quality;
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Browser canvas failed to encode image."));
      }, targetFormat, q);
    });
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to decode image bitmap."));
      };
      img.src = url;
    });
  }

  // Pure JavaScript 24-bit Windows BMP Encoder
  function canvasToBmpBlob(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const rowBytes = (width * 3 + 3) & ~3; // Pad each row to a multiple of 4 bytes
    const imageSize = rowBytes * height;
    const fileSize = 54 + imageSize; // 14 byte file header + 40 byte DIB header

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // 1. BMP File Header (14 bytes)
    view.setUint16(0, 0x424D, false); // "BM" signature: 'B' (0x42) followed by 'M' (0x4D)
    view.setUint32(2, fileSize, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint32(10, 54, true); // Offset to pixel data

    // 2. DIB Header (BITMAPINFOHEADER - 40 bytes)
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true); // Bottom-up standard
    view.setUint16(26, 1, true); // Planes
    view.setUint16(28, 24, true); // 24-bit RGB
    view.setUint32(30, 0, true); // BI_RGB (uncompressed)
    view.setUint32(34, imageSize, true);
    view.setInt32(38, 2835, true); // ~72 DPI horizontal
    view.setInt32(42, 2835, true); // ~72 DPI vertical
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // 3. Pixel Array (BGR format, bottom row to top row)
    const pixels = new Uint8Array(buffer, 54);
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const rowOffset = y * rowBytes;
      for (let x = 0; x < width; x++) {
        const srcIdx = (srcY * width + x) * 4;
        const dstIdx = rowOffset + x * 3;
        pixels[dstIdx] = data[srcIdx + 2];     // Blue
        pixels[dstIdx + 1] = data[srcIdx + 1]; // Green
        pixels[dstIdx + 2] = data[srcIdx];     // Red
      }
    }

    return new Blob([buffer], { type: "image/bmp" });
  }

  function downloadItem(item) {
    if (!item.convertedBlob) return;
    const base = removeFileExtension(item.name);
    const ext = getExtensionForMime(state.settings.targetFormat);
    const filename = `${base}-converted${ext}`;

    const url = URL.createObjectURL(item.convertedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadAllZip() {
    const doneItems = state.queue.filter(i => i.status === "done" && i.convertedBlob);
    if (doneItems.length === 0) return;

    const filesForZip = [];
    const ext = getExtensionForMime(state.settings.targetFormat);

    for (let i = 0; i < doneItems.length; i++) {
      const item = doneItems[i];
      const base = removeFileExtension(item.name);
      const name = `${base}-converted${ext}`;
      const buf = await item.convertedBlob.arrayBuffer();
      filesForZip.push({ name, data: new Uint8Array(buf) });
    }

    const zipBlob = buildSimpleZip(filesForZip);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `praxuni-converted-images.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Zero-dependency pure JS ZIP generator
  function buildSimpleZip(files) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      table[i] = c >>> 0;
    }
    function crc32(buf) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
      return ((crc ^ 0xFFFFFFFF) >>> 0);
    }

    const encoder = new TextEncoder();
    const fileEntries = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;

      const header = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, size, true);
      view.setUint32(22, size, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      header.set(nameBytes, 30);

      fileEntries.push({ header, data: file.data, nameBytes, crc, size, offset });
      offset += header.length + size;
    }

    const centralDirStart = offset;
    const centralDirParts = [];

    for (const entry of fileEntries) {
      const cd = new Uint8Array(46 + entry.nameBytes.length);
      const view = new DataView(cd.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 0, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.size, true);
      view.setUint32(24, entry.size, true);
      view.setUint16(28, entry.nameBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, entry.offset, true);
      cd.set(entry.nameBytes, 46);
      centralDirParts.push(cd);
      offset += cd.length;
    }

    const centralDirSize = offset - centralDirStart;
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, fileEntries.length, true);
    eocdView.setUint16(10, fileEntries.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirStart, true);
    eocdView.setUint16(20, 0, true);

    const parts = [];
    for (const fe of fileEntries) {
      parts.push(fe.header);
      parts.push(fe.data);
    }
    for (const c of centralDirParts) parts.push(c);
    parts.push(eocd);

    return new Blob(parts, { type: "application/zip" });
  }

})();
