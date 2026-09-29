/**
 * Praxuni - Image Resizer
 * 100% Browser-Based Image Resizing with Interactive 2D Grid & Batch Processing
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    queue: [], // Array of { id, file, name, size, type, imgElement, origWidth, origHeight, origAspect, targetWidth, targetHeight, fitMode, resultBlob, resultUrl }
    activeId: null,
    method: 'dimensions', // 'dimensions' | 'percentage' | 'aspect' | 'grid'
    aspectLocked: true,
    fitMode: 'crop', // 'crop' | 'pad' | 'stretch'
    selectedAspect: '16:9', // '1:1' | '16:9' | '9:16' | '4:3' | '4:5' | '21:9'
    preventUpscaling: true,
    percentage: 100,
    targetWidth: 1920,
    targetHeight: 1080,
    format: 'original',
    quality: 0.9,
    zoomLevel: 'fit', // 'fit' = fit to view, 1 = 100%
    viewMode: 'after', // 'after' | 'before' | 'split'
    isDraggingGrid: false,
    renderDebounceTimer: null,
    lastEditedDimension: 'width', // 'width' | 'height'
    renderVersion: 0,
    activeResolutionPreset: 'original',
    customQualitySet: false
  };

  // --- DOM Elements ---
  const uploadDropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('fileInput');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const workspaceArea = document.getElementById('workspaceArea');
  const alertBanner = document.getElementById('alertBanner');
  const alertMessage = document.getElementById('alertMessage');
  const alertDismissBtn = document.getElementById('alertDismissBtn');
  const warningBanner = document.getElementById('warningBanner');
  const warningMessage = document.getElementById('warningMessage');

  // Toolbar
  const batchSummary = document.getElementById('batchSummary');
  const batchToast = document.getElementById('batchToast');
  const addMoreBtn = document.getElementById('addMoreBtn');
  const panelResetBtn = document.getElementById('panelResetBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const applyAllBtn = document.getElementById('applyAllBtn');
  const headerDownloadBtn = document.getElementById('headerDownloadBtn');
  const downloadAllZipBtn = document.getElementById('downloadAllZipBtn');

  // Preview & Meta
  const previewViewport = document.getElementById('previewViewport');
  const previewCanvasContainer = document.getElementById('previewCanvasContainer');
  const previewCanvas = document.getElementById('previewCanvas');
  const originalPreviewImg = document.getElementById('originalPreviewImg');
  const splitComparisonContainer = document.getElementById('splitComparisonContainer');
  const splitOriginalImg = document.getElementById('splitOriginalImg');
  const splitResizedImg = document.getElementById('splitResizedImg');
  const splitResizedCanvas = document.getElementById('splitResizedCanvas');
  const splitOrigDims = document.getElementById('splitOrigDims');
  const splitResizedDims = document.getElementById('splitResizedDims');
  const splitScaleBadge = document.getElementById('splitScaleBadge');
  const splitOrigWrapper = document.getElementById('splitOrigWrapper');
  const splitResizedWrapper = document.getElementById('splitResizedWrapper');
  const previewDimensionTag = document.getElementById('previewDimensionTag');

  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  const viewModeTabs = document.querySelectorAll('.view-mode-tabs .tab-btn');

  // Meta stats
  const activeImageName = document.getElementById('activeImageName');
  const metaOrigDims = document.getElementById('metaOrigDims');
  const metaNewDims = document.getElementById('metaNewDims');
  const metaOrigAspect = document.getElementById('metaOrigAspect');
  const metaNewAspect = document.getElementById('metaNewAspect');
  const metaOrigSize = document.getElementById('metaOrigSize');
  const metaOutputSize = document.getElementById('metaOutputSize');
  const metaOrigMP = document.getElementById('metaOrigMP');
  const metaNewMP = document.getElementById('metaNewMP');

  // Queue
  const queueCard = document.getElementById('queueCard');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');

  // Method Tabs & Tab Content Panels
  const methodTabs = document.querySelectorAll('.method-tab');
  const methodTabDimensions = document.getElementById('methodTabDimensions');
  const methodTabPercentage = document.getElementById('methodTabPercentage');
  const methodTabAspect = document.getElementById('methodTabAspect');
  const methodTabGrid = document.getElementById('methodTabGrid');

  // Dimensions Tab Controls
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const widthInputLabel = document.getElementById('widthInputLabel');
  const heightInputLabel = document.getElementById('heightInputLabel');
  const aspectLockBtn = document.getElementById('aspectLockBtn');
  const lockIconLocked = document.getElementById('lockIconLocked');
  const lockIconUnlocked = document.getElementById('lockIconUnlocked');
  const swapDimensionsBtn = document.getElementById('swapDimensionsBtn');
  const resPresetChips = document.querySelectorAll('.preset-chip[data-res]');

  // Percentage Tab Controls
  const percentageSlider = document.getElementById('percentageSlider');
  const percentageNumberInput = document.getElementById('percentageNumberInput');
  const percentageTargetDims = document.getElementById('percentageTargetDims');
  const percentPresetChips = document.querySelectorAll('.preset-chip[data-percent]');

  // Aspect Ratio Tab Controls
  const aspectBtns = document.querySelectorAll('.aspect-btn');

  // 2D Grid Tab Controls
  const gridPlane = document.getElementById('gridPlane');
  const gridRefBox = document.getElementById('gridRefBox');
  const gridAspectLine = document.getElementById('gridAspectLine');
  const gridActiveArea = document.getElementById('gridActiveArea');
  const gridHandle = document.getElementById('gridHandle');
  const gridHandleTooltip = document.getElementById('gridHandleTooltip');
  const gridLockStatus = document.getElementById('gridLockStatus');

  // Fit Behavior Controls
  const fitBehaviorSection = document.getElementById('fitBehaviorSection');
  const fitBehaviorHint = document.getElementById('fitBehaviorHint');
  const fitPills = document.querySelectorAll('.fit-pill');

  // Output & Actions
  const preventUpscaleToggle = document.getElementById('preventUpscaleToggle');
  const formatSelect = document.getElementById('formatSelect');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityValDisplay = document.getElementById('qualityValDisplay');
  const downloadActiveBtn = document.getElementById('downloadActiveBtn');
  const panelDownloadZipBtn = document.getElementById('panelDownloadZipBtn');

  // --- Helper Functions ---

  function showAlert(msg) {
    if (!alertBanner || !alertMessage) return;
    alertMessage.textContent = msg;
    alertBanner.classList.remove('hidden');
  }

  function hideAlert() {
    if (alertBanner) alertBanner.classList.add('hidden');
  }

  function showWarning(msg) {
    if (!warningBanner || !warningMessage) return;
    warningMessage.textContent = msg;
    warningBanner.classList.remove('hidden');
  }

  function hideWarning() {
    if (warningBanner) warningBanner.classList.add('hidden');
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 1) + ' ' + sizes[i];
  }

  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  const standardRatios = [
    { name: '1:1', ratio: 1.0 },
    { name: '16:9', ratio: 16 / 9 },
    { name: '9:16', ratio: 9 / 16 },
    { name: '4:3', ratio: 4 / 3 },
    { name: '3:4', ratio: 3 / 4 },
    { name: '3:2', ratio: 1.5 },
    { name: '2:3', ratio: 2 / 3 },
    { name: '4:5', ratio: 0.8 },
    { name: '5:4', ratio: 1.25 },
    { name: '16:10', ratio: 1.6 },
    { name: '10:16', ratio: 0.625 },
    { name: '21:9', ratio: 64 / 27 }, // Ultrawide standard (2560x1080, 3440x1440)
    { name: '21:9', ratio: 21 / 9 },
    { name: '9:21', ratio: 27 / 64 },
    { name: '9:21', ratio: 9 / 21 },
    { name: '2:1', ratio: 2.0 },
    { name: '1:2', ratio: 0.5 },
    { name: '5:3', ratio: 5 / 3 },
    { name: '3:5', ratio: 0.6 },
    { name: '7:5', ratio: 1.4 },
    { name: '5:7', ratio: 5 / 7 },
  ];

  function formatAspect(w, h) {
    if (!w || !h) return '-';
    w = Math.round(w);
    h = Math.round(h);
    const val = w / h;
    const ratioStr = val.toFixed(2);

    // 1. Check exact integer reduction first
    const divisor = gcd(w, h);
    const aspectW = Math.round(w / divisor);
    const aspectH = Math.round(h / divisor);
    if (aspectW <= 21 && aspectH <= 21) {
      return `${aspectW}:${aspectH} (${ratioStr}:1)`;
    }

    // 2. Check closest standard ratio within small tolerance for pixel rounding
    let bestMatch = null;
    let minDiff = 0.038;
    for (let i = 0; i < standardRatios.length; i++) {
      const diff = Math.abs(val - standardRatios[i].ratio);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = standardRatios[i].name;
      }
    }

    if (bestMatch) {
      return `${bestMatch} (${ratioStr}:1)`;
    }

    return `${ratioStr}:1`;
  }

  function getActiveItem() {
    return state.queue.find(item => item.id === state.activeId) || null;
  }

  // --- Pure JS ZIP Maker (Zero Dependencies) ---
  function makeZip(files) {
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
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirStart, true);
    eocdView.setUint16(20, 0, true);

    const parts = [];
    for (const entry of fileEntries) {
      parts.push(entry.header, entry.data);
    }
    parts.push(...centralDirParts, eocd);
    return new Blob(parts, { type: 'application/zip' });
  }

  // --- Image Ingestion ---

  function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    hideAlert();

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validFiles = Array.from(files).filter(file => {
      const isValid = validTypes.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!isValid) {
        showAlert(`Skipped unsupported file: ${file.name}. Only JPG, PNG, and WebP are supported.`);
      }
      return isValid;
    });

    if (validFiles.length === 0) return;

    let loadedCount = 0;
    validFiles.forEach(file => {
      const id = 'img_' + Math.random().toString(36).substr(2, 9);
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const origWidth = img.naturalWidth;
        const origHeight = img.naturalHeight;
        const origAspect = origWidth / origHeight;

        const item = {
          id,
          file,
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          imgElement: img,
          objectUrl,
          origWidth,
          origHeight,
          origAspect,
          targetWidth: origWidth,
          targetHeight: origHeight,
          resultBlob: null,
          resultUrl: null
        };

        state.queue.push(item);
        loadedCount++;

        if (state.activeId === null) {
          state.activeId = id;
          state.targetWidth = origWidth;
          state.targetHeight = origHeight;
          if (widthInput) widthInput.value = origWidth;
          if (heightInput) heightInput.value = origHeight;
        }

        if (loadedCount === validFiles.length) {
          onQueueUpdated();
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        showAlert(`Could not load image: ${file.name}`);
      };

      img.src = objectUrl;
    });
  }

  function onQueueUpdated() {
    if (state.queue.length === 0) {
      if (uploadDropzone) uploadDropzone.classList.remove('hidden');
      if (workspaceArea) workspaceArea.classList.add('hidden');
      state.activeId = null;
      return;
    }

    if (uploadDropzone) uploadDropzone.classList.add('hidden');
    if (workspaceArea) workspaceArea.classList.remove('hidden');

    // Update active item if deleted or null
    if (!state.queue.some(i => i.id === state.activeId)) {
      state.activeId = state.queue[0].id;
    }

    // Render Queue List
    renderQueueList();
    updateBatchSummary();
    updateControlsForActive();
    schedulePreviewRender();
  }

  function renderQueueList() {
    if (!queueList) return;
    queueList.innerHTML = '';
    if (queueCount) queueCount.textContent = state.queue.length;

    state.queue.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `queue-item ${item.id === state.activeId ? 'active' : ''}`;
      el.dataset.id = item.id;

      el.innerHTML = `
        <img class="queue-thumb" src="${item.objectUrl}" alt="${item.name}">
        <div class="queue-info">
          <span class="queue-name">${item.name}</span>
          <span class="queue-meta">${item.origWidth} × ${item.origHeight} px • ${formatBytes(item.size)}</span>
        </div>
        <div class="queue-actions">
          <button type="button" class="btn-icon remove-item-btn" title="Remove" aria-label="Remove image">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      el.addEventListener('click', (e) => {
        if (e.target.closest('.remove-item-btn')) {
          removeItem(item.id);
          return;
        }
        selectActiveItem(item.id);
      });

      queueList.appendChild(el);
    });

    const hasBatch = state.queue.length > 1;
    const hasSingle = state.queue.length === 1;
    if (applyAllBtn) applyAllBtn.classList.toggle('hidden', !hasBatch);
    if (downloadAllZipBtn) downloadAllZipBtn.classList.toggle('hidden', !hasBatch);
    if (panelDownloadZipBtn) panelDownloadZipBtn.classList.toggle('hidden', !hasBatch);
    if (headerDownloadBtn) headerDownloadBtn.classList.toggle('hidden', !hasSingle);
    if (clearAllBtn) {
      clearAllBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        ${hasBatch ? 'Clear All' : 'Clear'}
      `;
      clearAllBtn.title = hasBatch ? 'Clear all images' : 'Clear image';
    }
  }

  function selectActiveItem(id) {
    if (state.activeId === id) return;
    state.activeId = id;
    state.renderVersion++; // Invalidate any in-flight render for previously active item
    const active = getActiveItem();
    if (active) {
      // Re-calculate dimensions using Image B's own aspect ratio when aspect-lock is enabled
      recalculateDimensions();
    }
    renderQueueList();
    updateControlsForActive();
    schedulePreviewRender();
  }

  function removeItem(id) {
    const idx = state.queue.findIndex(i => i.id === id);
    if (idx !== -1) {
      const item = state.queue[idx];
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      state.queue.splice(idx, 1);
    }
    onQueueUpdated();
  }

  function clearAll() {
    state.queue.forEach(item => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    state.queue = [];
    state.activeId = null;
    onQueueUpdated();
  }

  function updateBatchSummary() {
    if (!batchSummary) return;
    const count = state.queue.length;
    if (count === 0) {
      batchSummary.textContent = '0 images selected';
      return;
    }
    let modeText = '';
    if (state.method === 'percentage') {
      modeText = ` • ${state.percentage}% scale`;
    } else if (state.method === 'aspect') {
      modeText = ` • Aspect ${state.selectedAspect} (${state.fitMode})`;
    } else {
      modeText = ` • ${state.targetWidth} × ${state.targetHeight} px`;
    }

    batchSummary.textContent = `${count} image${count > 1 ? 's' : ''} in queue${modeText}`;
  }

  function applySettingsToAll() {
    if (state.queue.length === 0) return;

    state.queue.forEach(item => {
      const dims = calculateDimensionsForItem(item);
      item.targetWidth = dims.width;
      item.targetHeight = dims.height;
      item.fitMode = state.fitMode;
    });

    if (batchToast) {
      batchToast.textContent = `✓ Applied to all ${state.queue.length} images`;
      batchToast.classList.remove('hidden');
      setTimeout(() => {
        batchToast.classList.add('hidden');
      }, 2500);
    }

    renderQueueList();
    updateBatchSummary();
  }

  // --- Dimensions & Method Logic ---

  /**
   * Calculates dimensions for any individual item based on its OWN aspect ratio and current method.
   * Ensures an item is NEVER stretched or distorted when aspect-ratio lock is enabled.
   */
  function calculateDimensionsForItem(item) {
    const origW = item.origWidth;
    const origH = item.origHeight;
    const ar = item.origAspect;

    let outW = state.targetWidth;
    let outH = state.targetHeight;

    if (state.method === 'percentage') {
      const s = state.percentage / 100;
      outW = Math.max(1, Math.round(origW * s));
      outH = Math.max(1, Math.round(origH * s));
    } else if (state.method === 'aspect') {
      const parts = state.selectedAspect.split(':').map(Number);
      const targetRatio = (parts[0] || 16) / (parts[1] || 9);

      if (state.fitMode === 'crop') {
        // Center crop to fill target ratio cleanly
        if (targetRatio >= ar) {
          outW = origW;
          outH = Math.max(1, Math.round(origW / targetRatio));
        } else {
          outH = origH;
          outW = Math.max(1, Math.round(origH * targetRatio));
        }
      } else if (state.fitMode === 'pad') {
        // Enclose inside target ratio with letterbox/pillarbox
        if (targetRatio >= ar) {
          outH = origH;
          outW = Math.max(1, Math.round(origH * targetRatio));
        } else {
          outW = origW;
          outH = Math.max(1, Math.round(origW / targetRatio));
        }
      } else {
        // Stretch to target ratio
        outW = origW;
        outH = Math.max(1, Math.round(origW / targetRatio));
      }
    } else {
      // state.method === 'dimensions' or 'grid'
      if (state.aspectLocked) {
        if (state.lastEditedDimension === 'height') {
          outH = state.targetHeight;
          outW = Math.max(1, Math.round(outH * ar));
        } else {
          outW = state.targetWidth;
          outH = Math.max(1, Math.round(outW / ar));
        }
      } else {
        outW = state.targetWidth;
        outH = state.targetHeight;
      }
    }

    // Apply prevent upscaling if checked
    if (state.preventUpscaling) {
      if (outW > origW || outH > origH) {
        const s = Math.min(origW / outW, origH / outH);
        outW = Math.max(1, Math.round(outW * s));
        outH = Math.max(1, Math.round(outH * s));
      }
    }

    return { width: Math.max(1, outW), height: Math.max(1, outH) };
  }

  function updateMethodUI() {
    // 1. Method tabs active state
    methodTabs.forEach(tab => {
      const isActive = tab.dataset.method === state.method;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // 2. Show corresponding method tab content panel
    if (methodTabDimensions) methodTabDimensions.classList.toggle('hidden', state.method !== 'dimensions');
    if (methodTabPercentage) methodTabPercentage.classList.toggle('hidden', state.method !== 'percentage');
    if (methodTabAspect) methodTabAspect.classList.toggle('hidden', state.method !== 'aspect');
    if (methodTabGrid) methodTabGrid.classList.toggle('hidden', state.method !== 'grid');

    // 3. Update aspect ratio buttons
    aspectBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.aspect === state.selectedAspect);
    });

    // 4. Update percentage presets & display
    if (percentageTargetDims) {
      percentageTargetDims.textContent = `${state.targetWidth} × ${state.targetHeight} px`;
    }
    percentPresetChips.forEach(chip => {
      chip.classList.toggle('active', parseInt(chip.dataset.percent) === state.percentage);
    });

    // 5. Update resolution chips in dimensions tab
    resPresetChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.res === state.activeResolutionPreset);
    });

    // 6. Check aspect ratio mismatch for Fit Behavior Section
    const active = getActiveItem();
    let ratioDiffers = false;
    if (active && state.targetWidth && state.targetHeight) {
      const currentRatio = state.targetWidth / state.targetHeight;
      ratioDiffers = Math.abs(currentRatio - active.origAspect) > 0.02;
    }

    if (fitBehaviorSection) {
      const showFit = (state.method === 'aspect') || (!state.aspectLocked && ratioDiffers);
      fitBehaviorSection.classList.toggle('hidden', !showFit);
      if (fitBehaviorHint) {
        if (state.method === 'aspect') {
          fitBehaviorHint.textContent = `Choose behavior for ${state.selectedAspect} conversion`;
        } else {
          fitBehaviorHint.textContent = `Target ratio differs from original (${active ? formatAspect(active.origWidth, active.origHeight) : ''})`;
        }
      }
    }

    // 7. Update Fit Pills
    fitPills.forEach(pill => {
      const isActive = pill.dataset.fit === state.fitMode;
      pill.classList.toggle('active', isActive);
      pill.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    // 8. Aspect lock button state
    if (aspectLockBtn) {
      aspectLockBtn.classList.toggle('locked', state.aspectLocked);
      if (lockIconLocked) lockIconLocked.classList.toggle('hidden', !state.aspectLocked);
      if (lockIconUnlocked) lockIconUnlocked.classList.toggle('hidden', state.aspectLocked);
    }
  }

  function recalculateDimensions() {
    const active = getActiveItem();
    if (!active) return;

    const dims = calculateDimensionsForItem(active);
    state.targetWidth = dims.width;
    state.targetHeight = dims.height;

    // Sync input fields
    if (widthInput) widthInput.value = state.targetWidth;
    if (heightInput) heightInput.value = state.targetHeight;

    updateMethodUI();
    updateGridVisuals();
    updateMetaDisplay();
    checkWarnings();
    updateBatchSummary();
  }

  function updateControlsForActive() {
    const active = getActiveItem();
    if (!active) return;

    if (activeImageName) activeImageName.textContent = active.name;
    if (widthInput) widthInput.value = state.targetWidth;
    if (heightInput) heightInput.value = state.targetHeight;

    updateMethodUI();
    updateGridVisuals();
    updateMetaDisplay();
    checkWarnings();
  }

  function checkWarnings() {
    const active = getActiveItem();
    if (!active) {
      hideWarning();
      return;
    }

    // 1. Warning when significantly upscaling (> 125%)
    const isEnlarged = (state.targetWidth > active.origWidth * 1.25) || (state.targetHeight > active.origHeight * 1.25);
    if (isEnlarged) {
      showWarning('⚠️ Notice: Upscaling image beyond 100% may cause softness or pixelation.');
      return;
    }

    // 2. Info when stretching an unlocked image
    if (!state.aspectLocked && state.fitMode === 'stretch' && state.method !== 'percentage') {
      const currentRatio = state.targetWidth / state.targetHeight;
      if (Math.abs(currentRatio - active.origAspect) > 0.02) {
        showWarning('ℹ️ Notice: Image aspect ratio is unlocked with "Stretch" mode. Proportions will distort.');
        return;
      }
    }

    hideWarning();
  }

  function updateMetaDisplay() {
    const active = getActiveItem();
    if (!active) return;

    if (metaOrigDims) metaOrigDims.textContent = `${active.origWidth} × ${active.origHeight} px`;
    if (metaNewDims) metaNewDims.textContent = `${state.targetWidth} × ${state.targetHeight} px`;
    if (metaOrigAspect) metaOrigAspect.textContent = formatAspect(active.origWidth, active.origHeight);
    if (metaNewAspect) metaNewAspect.textContent = formatAspect(state.targetWidth, state.targetHeight);
    if (metaOrigSize) metaOrigSize.textContent = formatBytes(active.size);

    const origMp = (active.origWidth * active.origHeight / 1000000).toFixed(1);
    const newMp = (state.targetWidth * state.targetHeight / 1000000).toFixed(1);
    if (metaOrigMP) metaOrigMP.textContent = `${origMp} MP`;
    if (metaNewMP) metaNewMP.textContent = `${newMp} MP`;

    if (previewDimensionTag) {
      previewDimensionTag.textContent = `${state.targetWidth} × ${state.targetHeight} px`;
    }

    if (state.viewMode === 'split') {
      updateSplitComparisonVisuals();
    }
  }

  // --- 2D Interactive Grid Logic ---

  function updateGridVisuals() {
    const active = getActiveItem();
    if (!active || !gridPlane) return;

    const origW = active.origWidth;
    const origH = active.origHeight;

    // Dynamically match the 2D grid proportions to the active image actual aspect ratio
    gridPlane.style.setProperty('--grid-aspect', (origW / origH).toString());
    gridPlane.style.aspectRatio = `${origW} / ${origH}`;

    // Define max boundaries for grid coordinates matching image proportions
    const maxScale = state.preventUpscaling ? 1.0 : 2.0;
    const maxW = Math.round(origW * maxScale);
    const maxH = Math.round(origH * maxScale);

    const u100 = Math.min(1, origW / maxW);
    const v100 = Math.min(1, origH / maxH);

    // Reference Box (Original 100%)
    if (gridRefBox) {
      gridRefBox.setAttribute('x', '0');
      gridRefBox.setAttribute('y', `${(1 - v100) * 100}%`);
      gridRefBox.setAttribute('width', `${u100 * 100}%`);
      gridRefBox.setAttribute('height', `${v100 * 100}%`);
    }

    // Aspect Ratio Line (Diagonal constraint along image proportions)
    if (gridAspectLine) {
      if (state.aspectLocked) {
        gridAspectLine.style.display = 'block';
        gridAspectLine.setAttribute('x1', '0');
        gridAspectLine.setAttribute('y1', '100%');
        gridAspectLine.setAttribute('x2', '100%');
        gridAspectLine.setAttribute('y2', '0');
      } else {
        gridAspectLine.style.display = 'none';
      }
    }

    // Active Area Fill & Handle
    const curW = state.targetWidth;
    const curH = state.targetHeight;
    const curU = Math.max(0, Math.min(1, curW / maxW));
    const curV = Math.max(0, Math.min(1, curH / maxH));

    if (gridActiveArea) {
      gridActiveArea.setAttribute('x', '0');
      gridActiveArea.setAttribute('y', `${(1 - curV) * 100}%`);
      gridActiveArea.setAttribute('width', `${curU * 100}%`);
      gridActiveArea.setAttribute('height', `${curV * 100}%`);
    }

    if (gridHandle) {
      gridHandle.style.left = `${curU * 100}%`;
      gridHandle.style.bottom = `${curV * 100}%`;

      // Prevent tooltip numbers from hiding or clipping when image is scaled near edges or full size
      gridHandle.classList.toggle('flip-down', curV > 0.78);
      gridHandle.classList.toggle('shift-left', curU > 0.78);
      gridHandle.classList.toggle('shift-right', curU < 0.22);
    }

    if (gridHandleTooltip) {
      gridHandleTooltip.textContent = `${state.targetWidth} × ${state.targetHeight}`;
    }

    if (gridLockStatus) {
      if (state.aspectLocked) {
        gridLockStatus.classList.remove('unlocked');
        gridLockStatus.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Aspect Ratio Locked
        `;
      } else {
        gridLockStatus.classList.add('unlocked');
        gridLockStatus.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
          </svg>
          Aspect Ratio Free
        `;
      }
    }
  }

  function handleGridPointer(e) {
    const active = getActiveItem();
    if (!active || !gridPlane) return;

    const rect = gridPlane.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const u = relX / rect.width;
    const v = (rect.height - relY) / rect.height; // inverted for bottom-left origin

    const origW = active.origWidth;
    const origH = active.origHeight;

    const maxScale = state.preventUpscaling ? 1.0 : 2.0;
    const maxW = Math.round(origW * maxScale);
    const maxH = Math.round(origH * maxScale);

    let rawW, rawH;
    if (state.aspectLocked) {
      const t = Math.max(0.01, Math.min(1, (u + v) / 2));
      const s = t * maxScale;
      rawW = Math.max(1, Math.round(origW * s));
      rawH = Math.max(1, Math.round(origH * s));
    } else {
      rawW = Math.max(1, Math.round(u * maxW));
      rawH = Math.max(1, Math.round(v * maxH));
    }

    if (state.preventUpscaling) {
      rawW = Math.min(rawW, origW);
      rawH = Math.min(rawH, origH);
    }

    state.targetWidth = rawW;
    state.targetHeight = rawH;
    if (widthInput) widthInput.value = state.targetWidth;
    if (heightInput) heightInput.value = state.targetHeight;

    updateGridVisuals();
    updateMetaDisplay();
    checkWarnings();
    schedulePreviewRender();
  }

  // --- Rendering & Resizing Canvas Engine ---

  function schedulePreviewRender() {
    state.renderVersion++; // Invalidate any running asynchronous render immediately
    if (state.renderDebounceTimer) {
      clearTimeout(state.renderDebounceTimer);
    }
    state.renderDebounceTimer = setTimeout(() => {
      renderActivePreview();
    }, 120);
  }

  async function renderActivePreview() {
    const active = getActiveItem();
    if (!active || !previewCanvas) return;

    // Token protection against stale async renders
    const currentVersion = ++state.renderVersion;
    const renderedItemId = active.id;

    const targetW = state.targetWidth;
    const targetH = state.targetHeight;
    const fitMode = state.fitMode;
    const format = state.format === 'original' ? active.type : state.format;
    const quality = state.quality;
    const isUntouched = (targetW === active.origWidth && targetH === active.origHeight && state.format === 'original' && !state.customQualitySet);

    // Sync quality slider UI
    if (qualityValDisplay) {
      if (format === 'image/png') {
        qualityValDisplay.textContent = 'Lossless (N/A)';
        if (qualitySlider) qualitySlider.disabled = true;
      } else if (isUntouched) {
        qualityValDisplay.textContent = 'Original (100%)';
        if (qualitySlider) qualitySlider.disabled = false;
      } else {
        qualityValDisplay.textContent = Math.round(state.quality * 100) + '%';
        if (qualitySlider) qualitySlider.disabled = false;
      }
    }

    try {
      let canvas, blob;

      if (isUntouched) {
        // Fast path for untouched original image: zero re-compression, instant preview!
        canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(active.imgElement, 0, 0, targetW, targetH);
        blob = active.file;
      } else {
        const res = await processImageCanvas(active, targetW, targetH, fitMode, format, quality);
        canvas = res.canvas;
        blob = res.blob;
      }

      // Stale check: Discard if a newer render was requested or active image changed
      if (currentVersion !== state.renderVersion || renderedItemId !== state.activeId) {
        return;
      }

      active.resultBlob = blob;

      // Copy to preview canvas
      previewCanvas.width = canvas.width;
      previewCanvas.height = canvas.height;
      const pctx = previewCanvas.getContext('2d');
      pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      pctx.drawImage(canvas, 0, 0);

      // Update estimated output size
      if (metaOutputSize && blob) {
        metaOutputSize.textContent = isUntouched ? `${formatBytes(active.size)} (Original)` : formatBytes(blob.size);
      }

      // Original Image element
      if (originalPreviewImg) {
        originalPreviewImg.src = active.objectUrl;
      }

      // Split View elements
      if (splitOriginalImg) splitOriginalImg.src = active.objectUrl;

      if (isUntouched) {
        if (splitResizedImg) {
          splitResizedImg.src = active.objectUrl;
          splitResizedImg.classList.remove('hidden');
        }
        if (splitResizedCanvas) splitResizedCanvas.classList.add('hidden');
      } else {
        if (splitResizedImg) splitResizedImg.classList.add('hidden');
        if (splitResizedCanvas) {
          splitResizedCanvas.classList.remove('hidden');
          splitResizedCanvas.width = canvas.width;
          splitResizedCanvas.height = canvas.height;
          const sctx = splitResizedCanvas.getContext('2d');
          sctx.clearRect(0, 0, splitResizedCanvas.width, splitResizedCanvas.height);
          sctx.drawImage(canvas, 0, 0);
        }
      }

      updateViewModeDisplay();
      if (state.viewMode === 'split') {
        updateSplitComparisonVisuals();
      }
      applyZoom();
    } catch (err) {
      if (currentVersion === state.renderVersion && renderedItemId === state.activeId) {
        showAlert('Preview rendering error: ' + err.message);
      }
    }
  }

  function processImageCanvas(item, targetW, targetH, fitMode, format, quality) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create 2D canvas context'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const origW = item.origWidth;
      const origH = item.origHeight;
      const origAspect = origW / origH;
      const targetAspect = targetW / targetH;

      // Background fill
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      } else if (fitMode === 'pad') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, targetW, targetH);
      } else {
        ctx.clearRect(0, 0, targetW, targetH);
      }

      if (Math.abs(targetAspect - origAspect) < 0.005) {
        // Proportional direct scale
        ctx.drawImage(item.imgElement, 0, 0, targetW, targetH);
      } else if (fitMode === 'crop') {
        // Crop to Fill: scale to cover target area, center cropped
        const scale = Math.max(targetW / origW, targetH / origH);
        const sw = origW * scale;
        const sh = origH * scale;
        const ox = (targetW - sw) / 2;
        const oy = (targetH - sh) / 2;
        ctx.drawImage(item.imgElement, ox, oy, sw, sh);
      } else if (fitMode === 'pad') {
        // Fit with Letterbox / Bars: scale to fit entirely inside target
        const scale = Math.min(targetW / origW, targetH / origH);
        const sw = origW * scale;
        const sh = origH * scale;
        const ox = (targetW - sw) / 2;
        const oy = (targetH - sh) / 2;
        ctx.drawImage(item.imgElement, ox, oy, sw, sh);
      } else {
        // Stretch / Distort
        ctx.drawImage(item.imgElement, 0, 0, targetW, targetH);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image data from canvas.toBlob()'));
          return;
        }
        resolve({ canvas, blob });
      }, format, quality);
    });
  }

  function updateViewModeDisplay() {
    if (!previewCanvas || !originalPreviewImg || !splitComparisonContainer) return;

    if (state.viewMode === 'before') {
      previewCanvas.classList.add('hidden');
      originalPreviewImg.classList.remove('hidden');
      splitComparisonContainer.classList.add('hidden');
    } else if (state.viewMode === 'split') {
      previewCanvas.classList.add('hidden');
      originalPreviewImg.classList.add('hidden');
      splitComparisonContainer.classList.remove('hidden');
      updateSplitComparisonVisuals();
    } else {
      // 'after' (resized)
      previewCanvas.classList.remove('hidden');
      originalPreviewImg.classList.add('hidden');
      splitComparisonContainer.classList.add('hidden');
    }
  }

  function updateSplitComparisonVisuals() {
    const active = getActiveItem();
    if (!active || !splitComparisonContainer) return;

    const origW = active.origWidth || 800;
    const origH = active.origHeight || 600;
    const targetW = state.targetWidth || origW;
    const targetH = state.targetHeight || origH;

    // Update textual meta labels
    if (splitOrigDims) {
      splitOrigDims.textContent = `${origW} × ${origH} px`;
    }
    if (splitResizedDims) {
      splitResizedDims.textContent = `${targetW} × ${targetH} px`;
    }

    // Update scale badge
    if (splitScaleBadge) {
      const pctW = Math.round((targetW / origW) * 100);
      const pctH = Math.round((targetH / origH) * 100);

      const isUntouched = (targetW === origW && targetH === origH && state.format === 'original' && !state.customQualitySet);
      splitScaleBadge.classList.remove('downscale', 'upscale', 'identical');
      if (pctW === pctH) {
        if (pctW === 100) {
          if (isUntouched) {
            splitScaleBadge.classList.add('identical');
            splitScaleBadge.textContent = '100%';
            splitScaleBadge.title = '100% Identical to original';
          } else {
            splitScaleBadge.textContent = '100%';
          }
        } else if (pctW < 100) {
          splitScaleBadge.classList.add('downscale');
          splitScaleBadge.textContent = `${pctW}% (-${100 - pctW}%)`;
        } else if (pctW > 100) {
          splitScaleBadge.classList.add('upscale');
          splitScaleBadge.textContent = `${pctW}% (+${pctW - 100}%)`;
        }
      } else {
        const diffW = pctW - 100;
        const diffH = pctH - 100;
        const signW = diffW >= 0 ? '+' : '';
        const signH = diffH >= 0 ? '+' : '';
        splitScaleBadge.textContent = `${signW}${diffW}% W • ${signH}${diffH}% H`;
      }
    }

    // Calculate relative visual scaling in stage
    if (splitOrigWrapper && splitResizedWrapper) {
      const maxW = Math.max(origW, targetW);
      const maxH = Math.max(origH, targetH);
      const stageAspect = maxW / maxH;

      // Available stage bounds
      const isMobile = window.innerWidth <= 640;
      const maxStageH = isMobile ? 210 : 330;

      // Container width divided between the two panes
      const containerW = splitComparisonContainer.clientWidth || (previewViewport ? previewViewport.clientWidth : 500);
      const panePadding = isMobile ? 24 : 40;
      const maxStageW = Math.max(60, Math.floor((containerW - panePadding) / 2));

      let refBoxW, refBoxH;
      if (maxStageW / maxStageH > stageAspect) {
        refBoxH = maxStageH;
        refBoxW = refBoxH * stageAspect;
      } else {
        refBoxW = maxStageW;
        refBoxH = refBoxW / stageAspect;
      }

      refBoxW = Math.min(refBoxW, maxStageW);
      refBoxH = Math.min(refBoxH, maxStageH);

      // Relative pixel sizes
      const origRenderW = Math.max(16, Math.round(refBoxW * (origW / maxW)));
      const origRenderH = Math.max(16, Math.round(refBoxH * (origH / maxH)));

      const resizedRenderW = Math.max(16, Math.round(refBoxW * (targetW / maxW)));
      const resizedRenderH = Math.max(16, Math.round(refBoxH * (targetH / maxH)));

      splitOrigWrapper.style.width = `${origRenderW}px`;
      splitOrigWrapper.style.height = `${origRenderH}px`;

      splitResizedWrapper.style.width = `${resizedRenderW}px`;
      splitResizedWrapper.style.height = `${resizedRenderH}px`;
    }
  }

  function applyZoom() {
    if (!previewCanvasContainer || !previewViewport) return;
    const z = typeof state.zoomLevel === 'number' ? state.zoomLevel : 1;
    previewCanvasContainer.style.transform = `scale(${z})`;
    previewViewport.classList.toggle('is-zoomed', z !== 1);
    if (zoomFitBtn) {
      zoomFitBtn.textContent = `${Math.round(z * 100)}%`;
      zoomFitBtn.classList.toggle('active', z === 1);
      zoomFitBtn.title = z === 1 ? 'Current scale 100%' : 'Click to reset to 100%';
    }
  }

  // --- Downloads ---

  async function downloadActiveImage() {
    const active = getActiveItem();
    if (!active) return;

    hideAlert();
    const btn = downloadActiveBtn;
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="status-dot"></span> Processing...';
    }

    try {
      const isUntouched = (state.targetWidth === active.origWidth && state.targetHeight === active.origHeight && state.format === 'original' && !state.customQualitySet);

      let blob, filename;
      if (isUntouched) {
        blob = active.file;
        filename = active.name;
      } else {
        const format = state.format === 'original' ? active.type : state.format;
        const { blob: encodedBlob, canvas } = await processImageCanvas(active, state.targetWidth, state.targetHeight, state.fitMode, format, state.quality);
        blob = encodedBlob;

        let ext = 'jpg';
        if (format === 'image/png') ext = 'png';
        else if (format === 'image/webp') ext = 'webp';

        const baseName = active.name.replace(/\.[^/.]+$/, '');
        filename = `${baseName}-resized-${canvas.width}x${canvas.height}.${ext}`;
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } catch (err) {
      showAlert('Failed to generate image download: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  async function downloadAllBatchZip() {
    if (state.queue.length === 0) return;

    hideAlert();
    const btns = [downloadAllZipBtn, panelDownloadZipBtn].filter(Boolean);
    const origHtmls = btns.map(b => b.innerHTML);
    btns.forEach(b => {
      b.disabled = true;
      b.innerHTML = '<span class="status-dot"></span> Packaging ZIP...';
    });

    try {
      const filesToZip = [];
      const format = state.format;
      const quality = state.quality;

      for (let i = 0; i < state.queue.length; i++) {
        const item = state.queue[i];
        btns.forEach(b => {
          b.innerHTML = `<span class="status-dot"></span> Processing ${i + 1} of ${state.queue.length}...`;
        });

        const mime = format === 'original' ? item.type : format;
        let ext = 'jpg';
        if (mime === 'image/png') ext = 'png';
        else if (mime === 'image/webp') ext = 'webp';

        // Calculate dimensions for this individual item preserving its own aspect ratio when locked
        const dims = calculateDimensionsForItem(item);
        const itemW = dims.width;
        const itemH = dims.height;
        const fitMode = item.fitMode || state.fitMode;

        const isItemUntouched = (itemW === item.origWidth && itemH === item.origHeight && format === 'original' && !state.customQualitySet);

        let blob, filename;
        if (isItemUntouched) {
          blob = item.file;
          filename = item.name;
        } else {
          const { blob: encodedBlob, canvas } = await processImageCanvas(item, itemW, itemH, fitMode, mime, quality);
          blob = encodedBlob;
          const baseName = item.name.replace(/\.[^/.]+$/, '');
          filename = `${baseName}-resized-${canvas.width}x${canvas.height}.${ext}`;
        }
        const arrayBuf = await blob.arrayBuffer();

        filesToZip.push({
          name: filename,
          data: new Uint8Array(arrayBuf)
        });
      }

      btns.forEach(b => {
        b.innerHTML = '<span class="status-dot"></span> Building ZIP...';
      });
      const zipBlob = makeZip(filesToZip);

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'praxuni-resized-images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } catch (err) {
      showAlert('Failed to create batch ZIP: ' + err.message);
    } finally {
      btns.forEach((b, idx) => {
        b.disabled = false;
        b.innerHTML = origHtmls[idx];
      });
    }
  }

  // --- Reset Function ---
  function resetToOriginal() {
    const active = getActiveItem();
    if (!active) return;

    state.method = 'dimensions';
    state.aspectLocked = true;
    state.fitMode = 'crop';
    state.percentage = 100;
    state.selectedAspect = '16:9';
    state.activeResolutionPreset = 'original';
    state.targetWidth = active.origWidth;
    state.targetHeight = active.origHeight;
    state.format = 'original';
    state.quality = 0.9;
    state.customQualitySet = false;

    if (percentageSlider) percentageSlider.value = 100;
    if (percentageNumberInput) percentageNumberInput.value = 100;
    if (widthInput) widthInput.value = active.origWidth;
    if (heightInput) heightInput.value = active.origHeight;
    if (formatSelect) {
      formatSelect.value = 'original';
      formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (qualitySlider) {
      qualitySlider.value = 90;
      qualitySlider.disabled = false;
    }

    updateMethodUI();
    updateGridVisuals();
    updateMetaDisplay();
    checkWarnings();
    updateBatchSummary();
    schedulePreviewRender();
  }

  // --- Setup Event Listeners ---

  function initEvents() {
    // Custom Dropdowns
    if (formatSelect && window.initCustomSelect) {
      window.initCustomSelect(formatSelect);
    }
    // Dropzone Events
    if (uploadDropzone) {
      uploadDropzone.addEventListener('click', (e) => {
        if (e.target !== selectFilesBtn && fileInput) fileInput.click();
      });
      uploadDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('drag-over');
      });
      uploadDropzone.addEventListener('dragleave', () => {
        uploadDropzone.classList.remove('drag-over');
      });
      uploadDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files) {
          handleFileSelect(e.dataTransfer.files);
        }
      });
      uploadDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInput) fileInput.click();
        }
      });
    }

    if (selectFilesBtn && fileInput) {
      selectFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
        fileInput.value = '';
      });
    }

    if (addMoreBtn && fileInput) {
      addMoreBtn.addEventListener('click', () => fileInput.click());
    }

    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);
    if (panelResetBtn) panelResetBtn.addEventListener('click', resetToOriginal);
    if (downloadActiveBtn) downloadActiveBtn.addEventListener('click', downloadActiveImage);
    if (headerDownloadBtn) headerDownloadBtn.addEventListener('click', downloadActiveImage);
    if (downloadAllZipBtn) downloadAllZipBtn.addEventListener('click', downloadAllBatchZip);
    if (panelDownloadZipBtn) panelDownloadZipBtn.addEventListener('click', downloadAllBatchZip);
    if (applyAllBtn) applyAllBtn.addEventListener('click', applySettingsToAll);

    if (alertDismissBtn) alertDismissBtn.addEventListener('click', hideAlert);

    // 2D Grid Pointer Events (Mouse, Touch, Stylus)
    if (gridPlane) {
      gridPlane.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { gridPlane.setPointerCapture(e.pointerId); } catch (_) {}
        state.isDraggingGrid = true;
        handleGridPointer(e);
      });

      window.addEventListener('pointermove', (e) => {
        if (!state.isDraggingGrid) return;
        handleGridPointer(e);
      });

      const endDrag = (e) => {
        if (state.isDraggingGrid) {
          state.isDraggingGrid = false;
          if (e.pointerId !== undefined) {
            try { gridPlane.releasePointerCapture(e.pointerId); } catch (_) {}
          }
        }
      };

      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);

      // Keyboard Controls on Grid
      gridPlane.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 1;
        let handled = false;
        if (e.key === 'ArrowRight') {
          state.targetWidth += step;
          handled = true;
        } else if (e.key === 'ArrowLeft') {
          state.targetWidth = Math.max(1, state.targetWidth - step);
          handled = true;
        } else if (e.key === 'ArrowUp') {
          state.targetHeight += step;
          handled = true;
        } else if (e.key === 'ArrowDown') {
          state.targetHeight = Math.max(1, state.targetHeight - step);
          handled = true;
        }

        if (handled) {
          e.preventDefault();
          const active = getActiveItem();
          if (active && state.aspectLocked) {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              state.targetHeight = Math.max(1, Math.round(state.targetWidth / active.origAspect));
            } else {
              state.targetWidth = Math.max(1, Math.round(state.targetHeight * active.origAspect));
            }
          }
          if (widthInput) widthInput.value = state.targetWidth;
          if (heightInput) heightInput.value = state.targetHeight;
          updateGridVisuals();
          updateMetaDisplay();
          checkWarnings();
          schedulePreviewRender();
        }
      });
    }

    // Numeric Width Input
    if (widthInput) {
      widthInput.addEventListener('input', () => {
        let val = parseInt(widthInput.value) || 1;
        state.lastEditedDimension = 'width';
        state.activeResolutionPreset = 'custom';
        const active = getActiveItem();

        if (active) {
          if (state.preventUpscaling && val > active.origWidth) {
            val = active.origWidth;
            widthInput.value = val;
          }
          state.targetWidth = val;
          if (state.aspectLocked) {
            state.targetHeight = Math.max(1, Math.round(val / active.origAspect));
            if (state.preventUpscaling && state.targetHeight > active.origHeight) {
              state.targetHeight = active.origHeight;
              state.targetWidth = Math.max(1, Math.round(state.targetHeight * active.origAspect));
              widthInput.value = state.targetWidth;
            }
            if (heightInput) heightInput.value = state.targetHeight;
          }
        } else {
          state.targetWidth = val;
        }
        updateMethodUI();
        updateGridVisuals();
        updateMetaDisplay();
        checkWarnings();
        schedulePreviewRender();
      });
    }

    // Numeric Height Input
    if (heightInput) {
      heightInput.addEventListener('input', () => {
        let val = parseInt(heightInput.value) || 1;
        state.lastEditedDimension = 'height';
        state.activeResolutionPreset = 'custom';
        const active = getActiveItem();

        if (active) {
          if (state.preventUpscaling && val > active.origHeight) {
            val = active.origHeight;
            heightInput.value = val;
          }
          state.targetHeight = val;
          if (state.aspectLocked) {
            state.targetWidth = Math.max(1, Math.round(val * active.origAspect));
            if (state.preventUpscaling && state.targetWidth > active.origWidth) {
              state.targetWidth = active.origWidth;
              state.targetHeight = Math.max(1, Math.round(state.targetWidth / active.origAspect));
              heightInput.value = state.targetHeight;
            }
            if (widthInput) widthInput.value = state.targetWidth;
          }
        } else {
          state.targetHeight = val;
        }
        updateMethodUI();
        updateGridVisuals();
        updateMetaDisplay();
        checkWarnings();
        schedulePreviewRender();
      });
    }

    // Aspect Lock Toggle
    if (aspectLockBtn) {
      aspectLockBtn.addEventListener('click', () => {
        state.aspectLocked = !state.aspectLocked;
        const active = getActiveItem();
        if (state.aspectLocked && active) {
          state.lastEditedDimension = 'width';
          state.targetHeight = Math.max(1, Math.round(state.targetWidth / active.origAspect));
          if (heightInput) heightInput.value = state.targetHeight;
        }
        updateMethodUI();
        updateGridVisuals();
        updateMetaDisplay();
        checkWarnings();
        schedulePreviewRender();
      });
    }

    // Swap Dimensions Button
    if (swapDimensionsBtn) {
      swapDimensionsBtn.addEventListener('click', () => {
        const tmp = state.targetWidth;
        state.targetWidth = state.targetHeight;
        state.targetHeight = tmp;
        state.activeResolutionPreset = 'custom';

        if (widthInput) widthInput.value = state.targetWidth;
        if (heightInput) heightInput.value = state.targetHeight;

        // Toggle dominant editing dimension to keep orientation
        state.lastEditedDimension = (state.lastEditedDimension === 'width') ? 'height' : 'width';

        updateMethodUI();
        updateGridVisuals();
        updateMetaDisplay();
        checkWarnings();
        updateBatchSummary();
        schedulePreviewRender();
      });
    }

    // Method Tabs
    methodTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        state.method = tab.dataset.method;
        updateMethodUI();
        recalculateDimensions();
        schedulePreviewRender();
      });
    });

    // Quick Resolution Chips (Dimensions Tab)
    resPresetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const res = chip.dataset.res;
        state.activeResolutionPreset = res;
        const active = getActiveItem();
        if (!active) return;

        if (res === 'original') {
          state.targetWidth = active.origWidth;
          state.targetHeight = active.origHeight;
        } else {
          let maxEdge = 1920;
          if (res === '720p') maxEdge = 1280;
          else if (res === '1080p') maxEdge = 1920;
          else if (res === '1440p') maxEdge = 2560;
          else if (res === '4k') maxEdge = 3840;

          if (state.aspectLocked) {
            if (active.origAspect >= 1) {
              state.targetWidth = maxEdge;
              state.targetHeight = Math.max(1, Math.round(maxEdge / active.origAspect));
            } else {
              state.targetHeight = maxEdge;
              state.targetWidth = Math.max(1, Math.round(maxEdge * active.origAspect));
            }
          } else {
            if (res === '720p') { state.targetWidth = 1280; state.targetHeight = 720; }
            else if (res === '1080p') { state.targetWidth = 1920; state.targetHeight = 1080; }
            else if (res === '1440p') { state.targetWidth = 2560; state.targetHeight = 1440; }
            else if (res === '4k') { state.targetWidth = 3840; state.targetHeight = 2160; }
          }
        }

        if (state.preventUpscaling) {
          if (state.targetWidth > active.origWidth || state.targetHeight > active.origHeight) {
            const scale = Math.min(active.origWidth / state.targetWidth, active.origHeight / state.targetHeight);
            state.targetWidth = Math.max(1, Math.round(state.targetWidth * scale));
            state.targetHeight = Math.max(1, Math.round(state.targetHeight * scale));
          }
        }

        if (widthInput) widthInput.value = state.targetWidth;
        if (heightInput) heightInput.value = state.targetHeight;
        updateMethodUI();
        updateGridVisuals();
        updateMetaDisplay();
        checkWarnings();
        updateBatchSummary();
        schedulePreviewRender();
      });
    });

    // Percentage Slider & Number
    if (percentageSlider && percentageNumberInput) {
      percentageSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 100;
        state.percentage = val;
        percentageNumberInput.value = val;
        recalculateDimensions();
        schedulePreviewRender();
      });

      percentageNumberInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 1;
        state.percentage = val;
        percentageSlider.value = Math.min(200, val);
        recalculateDimensions();
        schedulePreviewRender();
      });
    }

    // Percentage Preset Chips
    percentPresetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.dataset.percent) || 100;
        state.percentage = val;
        if (percentageSlider) percentageSlider.value = Math.min(200, val);
        if (percentageNumberInput) percentageNumberInput.value = val;
        recalculateDimensions();
        schedulePreviewRender();
      });
    });

    // Aspect Ratio Buttons
    aspectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedAspect = btn.dataset.aspect;
        updateMethodUI();
        recalculateDimensions();
        schedulePreviewRender();
      });
    });

    // Aspect Ratio Fit Mode Pills (Crop, Pad/Letterbox, Stretch)
    fitPills.forEach(pill => {
      pill.addEventListener('click', () => {
        state.fitMode = pill.dataset.fit;
        updateMethodUI();
        recalculateDimensions();
        schedulePreviewRender();
      });
    });

    // Prevent Upscaling Toggle
    if (preventUpscaleToggle) {
      preventUpscaleToggle.addEventListener('change', (e) => {
        state.preventUpscaling = e.target.checked;
        recalculateDimensions();
        schedulePreviewRender();
      });
    }

    // Format & Quality
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        state.format = e.target.value;
        const active = getActiveItem();
        if (state.format === 'image/png') {
          if (qualitySlider) qualitySlider.disabled = true;
          if (qualityValDisplay) qualityValDisplay.textContent = 'Lossless (N/A)';
        } else {
          if (qualitySlider) qualitySlider.disabled = false;
          if (qualityValDisplay) {
            const isUntouched = (state.targetWidth === active?.origWidth && state.targetHeight === active?.origHeight && state.format === 'original' && !state.customQualitySet);
            qualityValDisplay.textContent = isUntouched ? 'Original (100%)' : (Math.round(state.quality * 100) + '%');
          }
        }
        schedulePreviewRender();
      });
    }

    if (qualitySlider) {
      qualitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 90;
        state.quality = val / 100;
        state.customQualitySet = true;
        if (qualityValDisplay) qualityValDisplay.textContent = val + '%';
        schedulePreviewRender();
      });
    }

    // View Mode Tabs (After, Before, Split)
    viewModeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        viewModeTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.viewMode = tab.dataset.view;
        updateViewModeDisplay();
      });
    });

    // Zoom Controls
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        let z = typeof state.zoomLevel === 'number' ? state.zoomLevel : 1;
        state.zoomLevel = Math.min(3, Math.round((z + 0.25) * 100) / 100);
        applyZoom();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        let z = typeof state.zoomLevel === 'number' ? state.zoomLevel : 1;
        state.zoomLevel = Math.max(0.25, Math.round((z - 0.25) * 100) / 100);
        applyZoom();
      });
    }

    if (zoomFitBtn) {
      zoomFitBtn.addEventListener('click', () => {
        state.zoomLevel = 1;
        applyZoom();
      });
    }

    window.addEventListener('resize', () => {
      if (state.viewMode === 'split') {
        updateSplitComparisonVisuals();
      }
    });

    updateMethodUI();

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode') || urlParams.get('method');
      if (modeParam) {
        const method = (modeParam === 'exact' ? 'dimensions' : modeParam).toLowerCase();
        const targetTab = Array.from(methodTabs).find(t => t.dataset.method === method);
        if (targetTab) {
          targetTab.click();
        }
      }
      const w = parseInt(urlParams.get('width') || urlParams.get('w'), 10);
      const h = parseInt(urlParams.get('height') || urlParams.get('h'), 10);
      if (w > 0 && widthInput) {
        widthInput.value = w;
        state.targetWidth = w;
      }
      if (h > 0 && heightInput) {
        heightInput.value = h;
        state.targetHeight = h;
      }
    } catch (e) {
      // Gracefully ignore URL param errors
    }
  }

  // --- Initialize ---
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
  });
})();
