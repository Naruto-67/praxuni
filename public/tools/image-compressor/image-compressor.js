/**
 * Praxuni - Image Compressor Tool Engine
 * Pure Vanilla JavaScript (Zero External Dependencies)
 * Browser-First Processing via HTML5 Canvas & Web APIs
 */

(() => {
  "use strict";

  // Application State
  const state = {
    queue: [],
    isProcessing: false,
    activeCompareId: null,
    settings: {
      mode: "balanced",
      quality: 0.80,
      format: "auto",
      targetSizeEnabled: false,
      targetSizeBytes: 100 * 1024,
      preserveDimensions: true,
      maxWidth: null,
      maxHeight: null
    }
  };

  const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB safe browser limit
  const MAX_SAFE_PIXELS = 40_000_000; // 40 megapixels canvas allocation cap

  let dom = {};
  let activeProcessingPromise = null;
  let currentRunSettings = null;

  document.addEventListener("DOMContentLoaded", () => {
    initDomReferences();
    initHealthCheck();
    initUploadEvents();
    initWorkspaceEvents();
    initSettingsEvents();
    initComparisonEvents();
  });

  window.addEventListener("beforeunload", () => {
    state.queue.forEach(item => revokeItemUrls(item));
  });

  function initDomReferences() {
    dom = {
      uploadDropzone: document.getElementById("uploadDropzone"),
      fileInput: document.getElementById("fileInput"),
      selectFilesBtn: document.getElementById("selectFilesBtn"),
      workspaceArea: document.getElementById("workspaceArea"),
      cardsList: document.getElementById("cardsList"),
      queueCounter: document.getElementById("queueCounter"),
      savingsSummary: document.getElementById("savingsSummary"),
      alertBanner: document.getElementById("alertBanner"),
      alertMessage: document.getElementById("alertMessage"),
      alertDismissBtn: document.getElementById("alertDismissBtn"),
      addMoreBtn: document.getElementById("addMoreBtn"),
      clearAllBtn: document.getElementById("clearAllBtn"),
      compressAllBtn: document.getElementById("compressAllBtn"),
      downloadAllBtn: document.getElementById("downloadAllBtn"),

      settingsCard: document.querySelector(".settings-card"),
      modePills: document.querySelectorAll(".mode-pill"),
      qualitySlider: document.getElementById("qualitySlider"),
      qualityValue: document.getElementById("qualityValue"),
      formatSelect: document.getElementById("formatSelect"),
      transparencyNotice: document.getElementById("transparencyNotice"),
      targetSizeToggle: document.getElementById("targetSizeToggle"),
      targetSizeOptions: document.getElementById("targetSizeOptions"),
      targetPresets: document.querySelectorAll(".preset-btn"),
      customTargetInput: document.getElementById("customTargetInput"),
      customTargetUnit: document.getElementById("customTargetUnit"),
      advancedToggleBtn: document.getElementById("advancedToggleBtn"),
      advancedContent: document.getElementById("advancedContent"),
      preserveDimensions: document.getElementById("preserveDimensions"),
      dimensionInputs: document.getElementById("dimensionInputs"),
      maxWidthInput: document.getElementById("maxWidthInput"),
      maxHeightInput: document.getElementById("maxHeightInput"),
      resetSettingsBtn: document.getElementById("resetSettingsBtn"),
      applySettingsBtn: document.getElementById("applySettingsBtn"),

      compareModal: document.getElementById("compareModal"),
      compareBackdrop: document.getElementById("compareBackdrop"),
      compareCloseBtn: document.getElementById("compareCloseBtn"),
      compareTitle: document.getElementById("compareTitle"),
      compareOriginalBadge: document.getElementById("compareOriginalBadge"),
      compareCompressedBadge: document.getElementById("compareCompressedBadge"),
      compareSavedBadge: document.getElementById("compareSavedBadge"),
      comparisonContainer: document.getElementById("comparisonContainer"),
      compareImgOriginal: document.getElementById("compareImgOriginal"),
      compareImgCompressed: document.getElementById("compareImgCompressed"),
      compareOverlay: document.getElementById("compareOverlay"),
      compareHandle: document.getElementById("compareHandle"),
      compareDimensions: document.getElementById("compareDimensions"),
      compareFormat: document.getElementById("compareFormat"),
      compareDownloadBtn: document.getElementById("compareDownloadBtn")
    };
  }

  async function initHealthCheck() {
    const statusEl = document.getElementById("serviceStatus");
    if (!statusEl) return;
    const labelEl = statusEl.querySelector(".status-label");

    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok") {
          statusEl.className = "status-badge online";
          if (labelEl) labelEl.textContent = "Worker: Live";
          return;
        }
      }
      throw new Error();
    } catch {
      statusEl.className = "status-badge offline";
      if (labelEl) labelEl.textContent = "Offline / Local";
    }
  }

  function showAlert(msg) {
    if (!dom.alertBanner || !dom.alertMessage) return;
    dom.alertMessage.textContent = msg;
    dom.alertBanner.classList.remove("hidden");
  }

  function hideAlert() {
    if (dom.alertBanner) dom.alertBanner.classList.add("hidden");
  }

  function initUploadEvents() {
    if (dom.alertDismissBtn) {
      dom.alertDismissBtn.addEventListener("click", hideAlert);
    }

    if (dom.uploadDropzone && dom.fileInput) {
      dom.uploadDropzone.addEventListener("click", (e) => {
        if (e.target !== dom.fileInput) {
          dom.fileInput.click();
        }
      });

      dom.uploadDropzone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dom.fileInput.click();
        }
      });

      ["dragenter", "dragover"].forEach(eventName => {
        dom.uploadDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dom.uploadDropzone.classList.add("drag-over");
        });
      });

      ["dragleave", "drop"].forEach(eventName => {
        dom.uploadDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dom.uploadDropzone.classList.remove("drag-over");
        });
      });

      dom.uploadDropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleSelectedFiles(Array.from(dt.files));
        }
      });
    }

    if (dom.selectFilesBtn && dom.fileInput) {
      dom.selectFilesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dom.fileInput.click();
      });
    }

    if (dom.fileInput) {
      dom.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleSelectedFiles(Array.from(e.target.files));
          e.target.value = "";
        }
      });
    }

    if (dom.addMoreBtn && dom.fileInput) {
      dom.addMoreBtn.addEventListener("click", () => {
        dom.fileInput.click();
      });
    }
  }

  async function handleSelectedFiles(files) {
    hideAlert();
    const errors = [];
    let addedCount = 0;

    for (const file of files) {
      if (file.size === 0) {
        errors.push(`\"${file.name}\" is empty (0 bytes).`);
        continue;
      }

      const ext = getFileExtension(file.name).toLowerCase();
      const mime = file.type.toLowerCase();
      const isExtSupported = SUPPORTED_EXTENSIONS.includes(ext);
      const isMimeSupported = SUPPORTED_MIME_TYPES.includes(mime);

      if (!isExtSupported && !isMimeSupported) {
        errors.push(`\"${file.name}\" is not a supported format. Please use JPG, PNG, or WebP.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`\"${file.name}\" is larger than 50MB. Please select a smaller image for safe browser processing.`);
        continue;
      }

      const isDuplicate = state.queue.some(item => item.file.name === file.name && item.file.size === file.size);
      if (isDuplicate) continue;

      try {
        const item = await createQueueItem(file);
        state.queue.push(item);
        addedCount++;
      } catch (err) {
        errors.push(`Couldn't read \"${file.name}\". The file may be corrupted or unsupported.`);
      }
    }

    if (errors.length > 0) showAlert(errors.join(" "));
    if (addedCount > 0) {
      renderWorkspace();
      checkTransparencyWarning();
      processQueue();
    }
  }

  async function createQueueItem(file) {
    const objectUrl = URL.createObjectURL(file);
    const id = "img_" + Math.random().toString(36).substring(2, 11);
    const meta = await decodeImageMetadata(file, objectUrl);

    return {
      id,
      file,
      originalName: file.name,
      originalSize: file.size,
      originalWidth: meta.width,
      originalHeight: meta.height,
      originalType: meta.mimeType || file.type || "image/jpeg",
      hasAlpha: meta.hasAlpha,
      originalUrl: objectUrl,
      sourceElement: meta.sourceElement,

      cancelled: false,
      status: "ready",
      statusMessage: "Ready to compress",
      compressedBlob: null,
      compressedUrl: null,
      compressedSize: null,
      compressedWidth: null,
      compressedHeight: null,
      compressedType: null,
      targetStatus: "none",
      errorMessage: null
    };
  }

  async function decodeImageMetadata(file, objectUrl) {
    let width = 0;
    let height = 0;
    let sourceElement = null;
    let hasAlpha = false;

    if ("createImageBitmap" in window) {
      try {
        sourceElement = await createImageBitmap(file, { imageOrientation: "from-image" });
        width = sourceElement.width;
        height = sourceElement.height;
      } catch {
        sourceElement = null;
      }
    }

    if (!sourceElement) {
      sourceElement = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image decode failed"));
        img.src = objectUrl;
      });
      width = sourceElement.naturalWidth || sourceElement.width;
      height = sourceElement.naturalHeight || sourceElement.height;
    }

    if (width === 0 || height === 0) throw new Error("Zero dimension image");

    // Check transparency for both PNG and WebP formats
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const isWebp = file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp");

    if (isPng || isWebp) {
      try {
        const probeCanvas = document.createElement("canvas");
        const probeW = Math.min(width, 100);
        const probeH = Math.min(height, 100);
        probeCanvas.width = probeW;
        probeCanvas.height = probeH;
        const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
        if (probeCtx) {
          probeCtx.drawImage(sourceElement, 0, 0, probeW, probeH);
          const imgData = probeCtx.getImageData(0, 0, probeW, probeH).data;
          for (let i = 3; i < imgData.length; i += 4) {
            if (imgData[i] < 254) {
              hasAlpha = true;
              break;
            }
          }
        }
      } catch {
        hasAlpha = false;
      }
    }

    let mimeType = file.type;
    if (!mimeType) {
      const ext = getFileExtension(file.name).toLowerCase();
      if (ext === ".png") mimeType = "image/png";
      else if (ext === ".webp") mimeType = "image/webp";
      else mimeType = "image/jpeg";
    }

    return { width, height, sourceElement, hasAlpha, mimeType };
  }

  function initWorkspaceEvents() {
    if (dom.clearAllBtn) dom.clearAllBtn.addEventListener("click", clearQueue);
    if (dom.compressAllBtn) dom.compressAllBtn.addEventListener("click", () => processQueue(true));
    if (dom.downloadAllBtn) dom.downloadAllBtn.addEventListener("click", downloadAllAsZip);
  }

  function clearQueue() {
    state.queue.forEach(item => {
      item.cancelled = true;
      revokeItemUrls(item);
    });
    state.queue = [];
    hideAlert();
    renderWorkspace();
    checkTransparencyWarning();
  }

  function removeItem(id) {
    const index = state.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = state.queue[index];
      item.cancelled = true;
      revokeItemUrls(item);
      state.queue.splice(index, 1);
      renderWorkspace();
      checkTransparencyWarning();
    }
  }

  function revokeItemUrls(item) {
    if (item.originalUrl) {
      URL.revokeObjectURL(item.originalUrl);
      item.originalUrl = null;
    }
    if (item.compressedUrl) {
      URL.revokeObjectURL(item.compressedUrl);
      item.compressedUrl = null;
    }
    if (item.sourceElement && typeof item.sourceElement.close === "function") {
      try {
        item.sourceElement.close();
      } catch {}
      item.sourceElement = null;
    }
  }

  function renderWorkspace() {
    const count = state.queue.length;
    if (count === 0) {
      dom.workspaceArea.classList.add("hidden");
      dom.uploadDropzone.classList.remove("hidden");
      return;
    }

    dom.uploadDropzone.classList.add("hidden");
    dom.workspaceArea.classList.remove("hidden");
    dom.queueCounter.textContent = `${count} ${count === 1 ? "image" : "images"} selected`;

    renderCards();
    updateSavingsSummary();
  }

  function renderCards() {
    dom.cardsList.innerHTML = "";
    state.queue.forEach(item => {
      const card = createCardElement(item);
      dom.cardsList.appendChild(card);
    });
  }

  function createCardElement(item) {
    const card = document.createElement("article");
    card.className = "image-card";
    card.id = `card_${item.id}`;
    card.setAttribute("role", "listitem");

    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "card-thumb-wrapper";
    const img = document.createElement("img");
    img.className = "card-thumb";
    img.src = item.compressedUrl || item.originalUrl;
    img.alt = item.originalName;
    img.loading = "lazy";
    thumbWrapper.appendChild(img);

    const details = document.createElement("div");
    details.className = "card-details";

    const titleRow = document.createElement("div");
    titleRow.className = "card-title-row";
    const nameEl = document.createElement("span");
    nameEl.className = "file-name";
    nameEl.textContent = item.originalName;
    nameEl.title = item.originalName;
    titleRow.appendChild(nameEl);

    const metaRow = document.createElement("div");
    metaRow.className = "card-meta-row";

    const origSpan = document.createElement("span");
    origSpan.className = "meta-original";
    origSpan.textContent = `${formatBytes(item.originalSize)} (${item.originalWidth} × ${item.originalHeight})`;
    metaRow.appendChild(origSpan);

    if (item.status === "done" && item.compressedSize !== null) {
      const arrowSpan = document.createElement("span");
      arrowSpan.className = "meta-arrow";
      arrowSpan.textContent = "→";
      metaRow.appendChild(arrowSpan);

      const compSpan = document.createElement("span");
      compSpan.className = "meta-compressed";
      compSpan.textContent = `${formatBytes(item.compressedSize)} (${item.compressedWidth} × ${item.compressedHeight})`;
      metaRow.appendChild(compSpan);

      const savings = calculateSavings(item.originalSize, item.compressedSize);
      const savingsSpan = document.createElement("span");
      savingsSpan.className = `meta-savings ${savings.type}`;
      savingsSpan.textContent = `(${savings.text})`;
      metaRow.appendChild(savingsSpan);
    }

    const badge = document.createElement("div");
    if (item.status === "processing") {
      badge.className = "card-status-badge processing";
      badge.textContent = "Compressing...";
    } else if (item.status === "done") {
      if (item.targetStatus === "met") {
        badge.className = "card-status-badge target-met";
        badge.textContent = "✓ Target Met";
      } else if (item.targetStatus === "missed") {
        badge.className = "card-status-badge target-missed";
        badge.textContent = "⚠ Target Not Reached";
      } else {
        badge.className = "card-status-badge done";
        badge.textContent = "✓ Compressed";
      }
    } else if (item.status === "error") {
      badge.className = "card-status-badge error";
      badge.textContent = item.errorMessage || "Compression failed";
    } else {
      badge.className = "card-status-badge ready";
      badge.textContent = "Ready to compress";
    }

    details.appendChild(titleRow);
    details.appendChild(metaRow);
    details.appendChild(badge);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    if (item.status === "done") {
      const compareBtn = document.createElement("button");
      compareBtn.type = "button";
      compareBtn.className = "btn btn-outline btn-card-action";
      compareBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
        Compare
      `;
      compareBtn.title = "View interactive before/after comparison";
      compareBtn.addEventListener("click", () => openComparisonModal(item.id));
      actions.appendChild(compareBtn);

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
      downloadBtn.title = "Download this compressed image";
      downloadBtn.addEventListener("click", () => downloadItem(item));
      actions.appendChild(downloadBtn);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-icon";
    removeBtn.setAttribute("aria-label", `Remove ${item.originalName}`);
    removeBtn.title = "Remove from queue";
    removeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    removeBtn.addEventListener("click", () => removeItem(item.id));
    actions.appendChild(removeBtn);

    card.appendChild(thumbWrapper);
    card.appendChild(details);
    card.appendChild(actions);

    return card;
  }

  function updateSavingsSummary() {
    let totalOriginal = 0;
    let totalCompressed = 0;
    let compressedCount = 0;

    state.queue.forEach(item => {
      if (item.status === "done" && item.compressedSize !== null) {
        totalOriginal += item.originalSize;
        totalCompressed += item.compressedSize;
        compressedCount++;
      }
    });

    if (compressedCount > 0 && totalOriginal > 0) {
      if (totalCompressed < totalOriginal) {
        const savedBytes = totalOriginal - totalCompressed;
        const percent = Math.round((savedBytes / totalOriginal) * 1000) / 10;
        dom.savingsSummary.textContent = `Saved ${formatBytes(savedBytes)} (${percent}%)`;
        dom.savingsSummary.className = "savings-summary success";
      } else if (totalCompressed > totalOriginal) {
        const incBytes = totalCompressed - totalOriginal;
        const percent = Math.round((incBytes / totalOriginal) * 1000) / 10;
        dom.savingsSummary.textContent = `Increased by ${formatBytes(incBytes)} (${percent}%)`;
        dom.savingsSummary.className = "savings-summary warning";
      } else {
        dom.savingsSummary.textContent = `No change (0%)`;
        dom.savingsSummary.className = "savings-summary";
      }
      dom.savingsSummary.classList.remove("hidden");
      dom.downloadAllBtn.classList.remove("hidden");
    } else {
      dom.savingsSummary.classList.add("hidden");
      dom.downloadAllBtn.classList.add("hidden");
    }
  }

  function setSettingsDisabled(disabled) {
    if (!dom.settingsCard) return;
    if (disabled) {
      dom.settingsCard.classList.add("processing");
    } else {
      dom.settingsCard.classList.remove("processing");
    }

    [
      dom.qualitySlider,
      dom.formatSelect,
      dom.targetSizeToggle,
      dom.customTargetInput,
      dom.customTargetUnit,
      dom.preserveDimensions,
      dom.maxWidthInput,
      dom.maxHeightInput,
      dom.applySettingsBtn,
      dom.resetSettingsBtn
    ].forEach(el => {
      if (el) el.disabled = disabled;
    });

    dom.modePills.forEach(p => {
      p.style.pointerEvents = disabled ? "none" : "";
    });

    dom.targetPresets.forEach(b => {
      b.style.pointerEvents = disabled ? "none" : "";
    });
  }

  function initSettingsEvents() {
    dom.modePills.forEach(pill => {
      pill.addEventListener("click", () => {
        if (state.isProcessing) return;
        dom.modePills.forEach(p => {
          p.classList.remove("active");
          p.setAttribute("aria-checked", "false");
        });
        pill.classList.add("active");
        pill.setAttribute("aria-checked", "true");

        const mode = pill.dataset.mode;
        state.settings.mode = mode;

        if (mode === "balanced") {
          updateQuality(80);
        } else if (mode === "smaller") {
          updateQuality(65);
          if (dom.formatSelect.value === "auto") {
            dom.formatSelect.value = "image/webp";
            state.settings.format = "image/webp";
          }
        } else if (mode === "quality") {
          updateQuality(90);
        }
      });
    });

    dom.qualitySlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      updateQuality(val);
    });

    dom.formatSelect.addEventListener("change", (e) => {
      state.settings.format = e.target.value;
      checkTransparencyWarning();
    });

    dom.targetSizeToggle.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      state.settings.targetSizeEnabled = enabled;
      if (enabled) {
        dom.targetSizeOptions.classList.remove("hidden");
      } else {
        dom.targetSizeOptions.classList.add("hidden");
      }
      recalculateTargetBytes();
    });

    dom.targetPresets.forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.isProcessing) return;
        dom.targetPresets.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const val = parseInt(btn.dataset.target, 10);
        dom.customTargetInput.value = val;
        dom.customTargetUnit.value = "KB";
        recalculateTargetBytes();
      });
    });

    dom.customTargetInput.addEventListener("input", () => {
      dom.targetPresets.forEach(b => b.classList.remove("active"));
      recalculateTargetBytes();
    });

    dom.customTargetUnit.addEventListener("change", () => {
      recalculateTargetBytes();
    });

    dom.advancedToggleBtn.addEventListener("click", () => {
      const isExpanded = dom.advancedToggleBtn.getAttribute("aria-expanded") === "true";
      dom.advancedToggleBtn.setAttribute("aria-expanded", String(!isExpanded));
      if (isExpanded) {
        dom.advancedContent.classList.add("hidden");
      } else {
        dom.advancedContent.classList.remove("hidden");
      }
    });

    dom.preserveDimensions.addEventListener("change", (e) => {
      state.settings.preserveDimensions = e.target.checked;
      if (e.target.checked) {
        dom.dimensionInputs.classList.add("hidden");
      } else {
        dom.dimensionInputs.classList.remove("hidden");
      }
    });

    dom.maxWidthInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.maxWidth = isNaN(val) || val <= 0 ? null : val;
    });

    dom.maxHeightInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.maxHeight = isNaN(val) || val <= 0 ? null : val;
    });

    dom.resetSettingsBtn.addEventListener("click", resetSettings);

    dom.applySettingsBtn.addEventListener("click", () => {
      processQueue(true);
    });
  }

  function updateQuality(val) {
    state.settings.quality = val / 100;
    dom.qualitySlider.value = val;
    dom.qualityValue.textContent = `${val}%`;
  }

  function recalculateTargetBytes() {
    const val = parseFloat(dom.customTargetInput.value);
    const unit = dom.customTargetUnit.value;
    if (isNaN(val) || val <= 0) {
      state.settings.targetSizeBytes = 100 * 1024;
      return;
    }

    if (unit === "MB") {
      state.settings.targetSizeBytes = Math.round(val * 1024 * 1024);
    } else {
      state.settings.targetSizeBytes = Math.round(val * 1024);
    }
  }

  function checkTransparencyWarning() {
    const chosenFormat = dom.formatSelect.value;
    const hasTransparentInQueue = state.queue.some(item => item.hasAlpha);

    if (chosenFormat === "image/jpeg" && hasTransparentInQueue) {
      dom.transparencyNotice.classList.remove("hidden");
    } else {
      dom.transparencyNotice.classList.add("hidden");
    }
  }

  function resetSettings() {
    state.settings = {
      mode: "balanced",
      quality: 0.80,
      format: "auto",
      targetSizeEnabled: false,
      targetSizeBytes: 100 * 1024,
      preserveDimensions: true,
      maxWidth: null,
      maxHeight: null
    };

    dom.modePills.forEach(p => {
      const isBalanced = p.dataset.mode === "balanced";
      p.classList.toggle("active", isBalanced);
      p.setAttribute("aria-checked", String(isBalanced));
    });

    updateQuality(80);
    dom.formatSelect.value = "auto";
    dom.transparencyNotice.classList.add("hidden");
    dom.targetSizeToggle.checked = false;
    dom.targetSizeOptions.classList.add("hidden");
    dom.preserveDimensions.checked = true;
    dom.dimensionInputs.classList.add("hidden");
    dom.maxWidthInput.value = "";
    dom.maxHeightInput.value = "";
  }

  /**
   * Queue Draining Loop with Concurrency and Frozen Settings Snapshot
   */
  async function processQueue(forceAll = false) {
    // If already processing, immediately return active processing promise
    if (state.isProcessing) {
      return activeProcessingPromise;
    }

    if (forceAll) {
      state.queue.forEach(item => {
        if (!item.cancelled) {
          item.status = "ready";
          item.errorMessage = null;
        }
      });
      renderCards();
    }

    state.isProcessing = true;
    currentRunSettings = { ...state.settings };
    setSettingsDisabled(true);

    activeProcessingPromise = (async () => {
      try {
        const CONCURRENCY = 2;
        const workers = [];

        async function drainWorker() {
          while (true) {
            // Find next ready item in queue that is not cancelled
            const item = state.queue.find(i => i.status === "ready" && !i.cancelled);
            if (!item) break; // Queue drained

            item.status = "processing";
            renderCards();

            await compressSingleItem(item, currentRunSettings);
          }
        }

        for (let i = 0; i < CONCURRENCY; i++) {
          workers.push(drainWorker());
        }

        await Promise.all(workers);
      } finally {
        state.isProcessing = false;
        currentRunSettings = null;
        activeProcessingPromise = null;
        setSettingsDisabled(false);
        updateSavingsSummary();
        renderCards();
      }
    })();

    return activeProcessingPromise;
  }

  async function compressSingleItem(item, runSettings) {
    if (!item || item.cancelled || !state.queue.some(i => i.id === item.id)) {
      return;
    }

    const settings = runSettings || state.settings;

    try {
      let targetMime = settings.format;
      if (targetMime === "auto") {
        if (settings.mode === "smaller" && !item.hasAlpha) {
          targetMime = "image/webp";
        } else {
          targetMime = item.originalType;
        }
      }

      let outW = item.originalWidth;
      let outH = item.originalHeight;

      if (!settings.preserveDimensions) {
        const maxW = settings.maxWidth || outW;
        const maxH = settings.maxHeight || outH;
        const scale = Math.min(1, maxW / outW, maxH / outH);
        outW = Math.max(1, Math.round(outW * scale));
        outH = Math.max(1, Math.round(outH * scale));
      }

      if (outW * outH > MAX_SAFE_PIXELS) {
        const scale = Math.sqrt(MAX_SAFE_PIXELS / (outW * outH));
        outW = Math.round(outW * scale);
        outH = Math.round(outH * scale);
      }

      if (item.cancelled || !item.sourceElement || !state.queue.some(i => i.id === item.id)) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { alpha: targetMime !== "image/jpeg" });

      if (!ctx) {
        throw new Error("Canvas context initialization failed");
      }

      if (targetMime === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, outW, outH);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(item.sourceElement, 0, 0, outW, outH);

      if (item.cancelled || !state.queue.some(i => i.id === item.id)) {
        return;
      }

      let compressedBlob = null;
      let targetStatus = "none";
      let finalW = outW;
      let finalH = outH;

      if (settings.targetSizeEnabled && settings.targetSizeBytes) {
        const targetResult = await compressToTargetSize(
          canvas,
          targetMime,
          settings.targetSizeBytes,
          outW,
          outH,
          item.sourceElement
        );

        if (item.cancelled || !state.queue.some(i => i.id === item.id)) {
          return;
        }

        compressedBlob = targetResult.blob;
        targetStatus = targetResult.targetStatus;
        finalW = targetResult.width;
        finalH = targetResult.height;
      } else {
        const q = targetMime === "image/png" ? undefined : settings.quality;
        compressedBlob = await canvasToBlobAsync(canvas, targetMime, q);
      }

      if (item.cancelled || !state.queue.some(i => i.id === item.id)) {
        return;
      }

      if (!compressedBlob || compressedBlob.size === 0) {
        throw new Error("Zero-byte output generated");
      }

      // Check if item is still in queue (was not removed while processing)
      const currentItem = state.queue.find(i => i.id === item.id);
      if (!currentItem || currentItem.cancelled) {
        return;
      }

      // Revoke prior compressed URL
      if (item.compressedUrl) {
        URL.revokeObjectURL(item.compressedUrl);
      }

      item.compressedBlob = compressedBlob;
      item.compressedUrl = URL.createObjectURL(compressedBlob);
      item.compressedSize = compressedBlob.size;
      item.compressedWidth = finalW;
      item.compressedHeight = finalH;
      item.compressedType = targetMime;
      item.targetStatus = targetStatus;
      item.status = "done";
      item.errorMessage = null;

    } catch (err) {
      if (item.cancelled || !state.queue.some(i => i.id === item.id)) {
        return;
      }
      item.status = "error";
      item.errorMessage = "Failed to compress image.";
    }

    if (item.cancelled || !state.queue.some(i => i.id === item.id)) {
      return;
    }

    renderCards();
  }

  /**
   * Target-size compression returning exact Blob, status, and actual dimensions
   */
  async function compressToTargetSize(canvas, mimeType, targetBytes, width, height, sourceElement) {
    if (mimeType === "image/png") {
      const pngBlob = await canvasToBlobAsync(canvas, "image/png");
      const targetStatus = pngBlob.size <= targetBytes ? "met" : "missed";
      return { blob: pngBlob, targetStatus, width, height };
    }

    let minQ = 0.10;
    let maxQ = 0.98;
    let iterations = 0;
    const MAX_ITERATIONS = 7;

    let bestMetBlob = null;
    let bestMetW = width;
    let bestMetH = height;

    let smallestBlob = null;
    let smallestW = width;
    let smallestH = height;

    function registerCandidate(blob, w, h) {
      if (!blob || blob.size === 0) return;

      // Track smallest blob found if target cannot be reached
      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob;
        smallestW = w;
        smallestH = h;
      }

      // Track best blob that meets target (<= targetBytes)
      if (blob.size <= targetBytes) {
        if (!bestMetBlob || blob.size > bestMetBlob.size) {
          bestMetBlob = blob;
          bestMetW = w;
          bestMetH = h;
        }
      }
    }

    while (iterations < MAX_ITERATIONS && (maxQ - minQ) > 0.04) {
      iterations++;
      const currentQ = (minQ + maxQ) / 2;
      const blob = await canvasToBlobAsync(canvas, mimeType, currentQ);

      registerCandidate(blob, width, height);

      if (blob.size <= targetBytes) {
        minQ = currentQ;
      } else {
        maxQ = currentQ;
      }
    }

    // If target not reached with quality adjustments, try intelligent downscale passes
    if (!bestMetBlob && sourceElement) {
      let currentScale = 0.8;
      while (currentScale >= 0.38 && !bestMetBlob) {
        const scaledW = Math.max(1, Math.round(width * currentScale));
        const scaledH = Math.max(1, Math.round(height * currentScale));

        const scaleCanvas = document.createElement("canvas");
        scaleCanvas.width = scaledW;
        scaleCanvas.height = scaledH;
        const scaleCtx = scaleCanvas.getContext("2d");
        if (scaleCtx) {
          if (mimeType === "image/jpeg") {
            scaleCtx.fillStyle = "#FFFFFF";
            scaleCtx.fillRect(0, 0, scaledW, scaledH);
          }
          scaleCtx.imageSmoothingEnabled = true;
          scaleCtx.imageSmoothingQuality = "high";

          try {
            scaleCtx.drawImage(sourceElement, 0, 0, scaledW, scaledH);
            const scaledBlob = await canvasToBlobAsync(scaleCanvas, mimeType, 0.4);
            registerCandidate(scaledBlob, scaledW, scaledH);
          } catch {
            break;
          }
        }
        currentScale -= 0.2;
      }
    }

    if (bestMetBlob) {
      return {
        blob: bestMetBlob,
        targetStatus: "met",
        width: bestMetW,
        height: bestMetH
      };
    }

    return {
      blob: smallestBlob,
      targetStatus: smallestBlob && smallestBlob.size <= targetBytes ? "met" : "missed",
      width: smallestW,
      height: smallestH
    };
  }

  function canvasToBlobAsync(canvas, mimeType, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, mimeType, quality);
    });
  }

  // Download Management
  function downloadItem(item) {
    if (!item || !item.compressedBlob) {
      showAlert("The compressed image is not available for download.");
      return;
    }

    const baseName = removeFileExtension(item.file.name);
    const ext = getExtensionForMime(item.compressedType || item.originalType);
    const filename = `${baseName}-compressed${ext}`;

    triggerBlobDownload(item.compressedBlob, filename);
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }

  async function downloadAllAsZip() {
    const readyItems = state.queue.filter(
      item => item.status === "done" && item.compressedBlob
    );

    if (readyItems.length === 0) {
      showAlert("No compressed images available to download yet.");
      return;
    }

    if (readyItems.length === 1) {
      downloadItem(readyItems[0]);
      return;
    }

    const originalBtnText = dom.downloadAllBtn.innerHTML;
    try {
      dom.downloadAllBtn.disabled = true;
      dom.downloadAllBtn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"></circle>
        </svg>
        Creating ZIP...
      `;

      const files = [];
      const usedNames = new Set();

      for (const item of readyItems) {
        const baseName = removeFileExtension(item.file.name);
        const ext = getExtensionForMime(item.compressedType || item.originalType);
        let filename = `${baseName}-compressed${ext}`;

        if (usedNames.has(filename)) {
          let counter = 1;
          while (usedNames.has(`${baseName}-compressed-${counter}${ext}`)) {
            counter++;
          }
          filename = `${baseName}-compressed-${counter}${ext}`;
        }
        usedNames.add(filename);

        const arrayBuffer = await item.compressedBlob.arrayBuffer();
        files.push({
          name: filename,
          data: new Uint8Array(arrayBuffer)
        });
      }

      const zipBlob = createZipBlob(files);
      triggerBlobDownload(zipBlob, "praxuni-compressed-images.zip");
    } catch (err) {
      console.error("ZIP creation error:", err);
      showAlert("Failed to generate ZIP archive. You can download images individually.");
    } finally {
      dom.downloadAllBtn.disabled = false;
      dom.downloadAllBtn.innerHTML = originalBtnText;
    }
  }

  // Zero-dependency Store-mode (method 0) PKZIP Generator
  const textEncoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function computeCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createZipBlob(files) {
    const fileEntries = [];
    let localOffset = 0;

    for (const f of files) {
      const nameBytes = textEncoder.encode(f.name);
      const dataBytes = f.data;
      const crc = computeCrc32(dataBytes);
      const size = dataBytes.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lView = new DataView(localHeader.buffer);

      lView.setUint32(0, 0x04034b50, true);
      lView.setUint16(4, 20, true);
      lView.setUint16(6, 0x0800, true); // UTF-8 filename flag
      lView.setUint16(8, 0, true);      // Store mode (uncompressed)
      lView.setUint16(10, 0, true);     // Mod time
      lView.setUint16(12, 0x21, true);  // Mod date (1980-01-01)
      lView.setUint32(14, crc, true);
      lView.setUint32(18, size, true);  // Compressed size
      lView.setUint32(22, size, true);  // Uncompressed size
      lView.setUint16(26, nameBytes.length, true);
      lView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileEntries.push({
        nameBytes,
        dataBytes,
        crc,
        size,
        offset: localOffset,
        localHeader
      });

      localOffset += localHeader.length + size;
    }

    const centralEntries = [];
    let centralDirSize = 0;

    for (const f of fileEntries) {
      const cdHeader = new Uint8Array(46 + f.nameBytes.length);
      const cView = new DataView(cdHeader.buffer);

      cView.setUint32(0, 0x02014b50, true);
      cView.setUint16(4, 20, true);
      cView.setUint16(6, 20, true);
      cView.setUint16(8, 0x0800, true); // UTF-8 filename flag
      cView.setUint16(10, 0, true);     // Store mode
      cView.setUint16(12, 0, true);
      cView.setUint16(14, 0x21, true);
      cView.setUint32(16, f.crc, true);
      cView.setUint32(20, f.size, true);
      cView.setUint32(24, f.size, true);
      cView.setUint16(28, f.nameBytes.length, true);
      cView.setUint16(30, 0, true);
      cView.setUint16(32, 0, true);
      cView.setUint16(34, 0, true);
      cView.setUint16(36, 0, true);
      cView.setUint32(38, 0, true);
      cView.setUint32(42, f.offset, true);
      cdHeader.set(f.nameBytes, 46);

      centralEntries.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    const centralOffset = localOffset;
    const eocd = new Uint8Array(22);
    const eView = new DataView(eocd.buffer);

    eView.setUint32(0, 0x06054b50, true);
    eView.setUint16(4, 0, true);
    eView.setUint16(6, 0, true);
    eView.setUint16(8, files.length, true);
    eView.setUint16(10, files.length, true);
    eView.setUint32(12, centralDirSize, true);
    eView.setUint32(16, centralOffset, true);
    eView.setUint16(20, 0, true);

    const totalLength = centralOffset + centralDirSize + 22;
    const out = new Uint8Array(totalLength);
    let pos = 0;

    for (const f of fileEntries) {
      out.set(f.localHeader, pos);
      pos += f.localHeader.length;
      out.set(f.dataBytes, pos);
      pos += f.dataBytes.length;
    }

    for (const c of centralEntries) {
      out.set(c, pos);
      pos += c.length;
    }

    out.set(eocd, pos);
    return new Blob([out], { type: "application/zip" });
  }

  // Comparison Modal & Slider
  let isDraggingSlider = false;

  function initComparisonEvents() {
    if (dom.compareCloseBtn) {
      dom.compareCloseBtn.addEventListener("click", closeComparisonModal);
    }
    if (dom.compareBackdrop) {
      dom.compareBackdrop.addEventListener("click", closeComparisonModal);
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.activeCompareId) {
        closeComparisonModal();
      }
    });

    const startDrag = (e) => {
      isDraggingSlider = true;
      updateSliderFromEvent(e);
    };

    const doDrag = (e) => {
      if (!isDraggingSlider) return;
      updateSliderFromEvent(e);
    };

    const stopDrag = () => {
      isDraggingSlider = false;
    };

    if (dom.comparisonContainer) {
      dom.comparisonContainer.addEventListener("mousedown", startDrag);
      dom.comparisonContainer.addEventListener("touchstart", startDrag, { passive: true });
    }

    window.addEventListener("mousemove", doDrag);
    window.addEventListener("touchmove", doDrag, { passive: true });
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchend", stopDrag);

    if (dom.compareHandle) {
      dom.compareHandle.addEventListener("keydown", (e) => {
        const currentPct = parseFloat(dom.compareOverlay.style.width) || 50;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          setSliderPercentage(Math.max(0, currentPct - 5));
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          setSliderPercentage(Math.min(100, currentPct + 5));
        }
      });
    }

    if (dom.compareImgOriginal) {
      dom.compareImgOriginal.addEventListener("load", syncComparisonSizes);
    }
    window.addEventListener("resize", syncComparisonSizes);
  }

  function syncComparisonSizes() {
    if (!state.activeCompareId || !dom.compareImgOriginal || !dom.compareImgCompressed) return;
    const w = dom.compareImgOriginal.offsetWidth;
    const h = dom.compareImgOriginal.offsetHeight;
    if (w > 0) {
      dom.compareImgCompressed.style.width = `${w}px`;
      dom.compareImgCompressed.style.height = `${h}px`;
    }
  }

  function updateSliderFromEvent(e) {
    if (!dom.comparisonContainer) return;
    const rect = dom.comparisonContainer.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    if (clientX === undefined) return;
    const offsetX = clientX - rect.left;
    let pct = (offsetX / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    setSliderPercentage(pct);
  }

  function setSliderPercentage(pct) {
    if (!dom.compareOverlay || !dom.compareHandle) return;
    dom.compareOverlay.style.width = `${pct}%`;
    dom.compareHandle.style.left = `${pct}%`;
    dom.compareHandle.setAttribute("aria-valuenow", Math.round(pct));
  }

  function openComparisonModal(id) {
    const item = state.queue.find(i => i.id === id);
    if (!item || item.status !== "done" || !item.compressedUrl) return;

    state.activeCompareId = id;

    if (dom.compareTitle) {
      dom.compareTitle.textContent = item.file.name;
    }

    if (dom.compareOriginalBadge) {
      dom.compareOriginalBadge.textContent = `Original: ${formatBytes(item.originalSize)}`;
    }

    if (dom.compareCompressedBadge) {
      dom.compareCompressedBadge.textContent = `Compressed: ${formatBytes(item.compressedSize)}`;
    }

    if (dom.compareSavedBadge) {
      const savings = calculateSavings(item.originalSize, item.compressedSize);
      if (savings.type === "saved") {
        dom.compareSavedBadge.textContent = `Saved: ${savings.text}`;
        dom.compareSavedBadge.className = "meta-pill highlight";
      } else if (savings.type === "increased") {
        dom.compareSavedBadge.textContent = `Size: ${savings.text}`;
        dom.compareSavedBadge.className = "meta-pill warning";
      } else {
        dom.compareSavedBadge.textContent = `Size: 0%`;
        dom.compareSavedBadge.className = "meta-pill";
      }
    }

    if (dom.compareImgOriginal) {
      dom.compareImgOriginal.src = item.originalUrl;
    }
    if (dom.compareImgCompressed) {
      dom.compareImgCompressed.src = item.compressedUrl;
    }

    // Dimensions: using actual compressed dimensions from compressToTargetSize
    if (dom.compareDimensions) {
      const origDim = `${item.originalWidth}×${item.originalHeight}`;
      const compDim = `${item.compressedWidth}×${item.compressedHeight}`;
      if (item.compressedWidth !== item.originalWidth || item.compressedHeight !== item.originalHeight) {
        dom.compareDimensions.textContent = `Dimensions: ${origDim} → ${compDim}`;
      } else {
        dom.compareDimensions.textContent = `Dimensions: ${compDim} (Preserved)`;
      }
    }

    if (dom.compareFormat) {
      const origFmt = formatMimeName(item.originalType);
      const compFmt = formatMimeName(item.compressedType || item.originalType);
      if (origFmt !== compFmt) {
        dom.compareFormat.textContent = `Format: ${origFmt} → ${compFmt}`;
      } else {
        dom.compareFormat.textContent = `Format: ${compFmt}`;
      }
    }

    if (dom.compareDownloadBtn) {
      dom.compareDownloadBtn.onclick = () => downloadItem(item);
    }

    setSliderPercentage(50);

    if (dom.compareModal) {
      dom.compareModal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      setTimeout(syncComparisonSizes, 60);
    }
  }

  function closeComparisonModal() {
    state.activeCompareId = null;
    if (dom.compareModal) {
      dom.compareModal.classList.add("hidden");
    }
    document.body.style.overflow = "";
    if (dom.compareImgOriginal) dom.compareImgOriginal.src = "";
    if (dom.compareImgCompressed) dom.compareImgCompressed.src = "";
  }

  // Utility Helpers
  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0 || !bytes) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const idx = Math.min(i, sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
  }

  function calculateSavings(originalBytes, compressedBytes) {
    if (!originalBytes || originalBytes <= 0 || compressedBytes === null || compressedBytes === undefined) {
      return { percent: 0, text: "--", type: "same" };
    }

    if (compressedBytes < originalBytes) {
      const diff = originalBytes - compressedBytes;
      const percent = Math.round((diff / originalBytes) * 1000) / 10;
      return {
        percent,
        text: `-${percent}%`,
        type: "saved"
      };
    } else if (compressedBytes > originalBytes) {
      const diff = compressedBytes - originalBytes;
      const percent = Math.round((diff / originalBytes) * 1000) / 10;
      return {
        percent,
        text: `+${percent}%`,
        type: "increased"
      };
    } else {
      return {
        percent: 0,
        text: "0%",
        type: "same"
      };
    }
  }

  function getFileExtension(filename) {
    if (!filename) return "";
    const idx = filename.lastIndexOf(".");
    return idx !== -1 ? filename.substring(idx) : "";
  }

  function removeFileExtension(filename) {
    if (!filename) return "";
    const idx = filename.lastIndexOf(".");
    return idx !== -1 ? filename.substring(0, idx) : filename;
  }

  function getExtensionForMime(mime) {
    switch (mime) {
      case "image/png":
        return ".png";
      case "image/webp":
        return ".webp";
      case "image/jpeg":
      default:
        return ".jpg";
    }
  }

  function formatMimeName(mime) {
    switch (mime) {
      case "image/jpeg":
        return "JPEG";
      case "image/png":
        return "PNG";
      case "image/webp":
        return "WebP";
      default:
        return mime ? mime.replace("image/", "").toUpperCase() : "Image";
    }
  }

})();
