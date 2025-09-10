// Snowglobe Layering App - Client-side only
(function () {
  /** @type {HTMLElement} */
  const stage = document.getElementById('stage');
  const layerList = document.getElementById('layerList');
  const stageScaler = document.getElementById('stageScaler');
  const cropOverlay = document.getElementById('cropOverlay');
  const cropRect = document.getElementById('cropRect');
  const selectedInfo = document.getElementById('selectedInfo');
  const scaleRange = document.getElementById('scaleRange');
  const scalePct = document.getElementById('scalePct');
  const centerHBtn = document.getElementById('centerHBtn');
  const centerVBtn = document.getElementById('centerVBtn');
  

  const addVideoFileBtn = document.getElementById('addVideoFileBtn');
  const videoFileInput = document.getElementById('videoFileInput');
  const reloadManifestsBtn = document.getElementById('reloadManifestsBtn');
  const generateThumbsBtn = document.getElementById('generateThumbsBtn');
  // Legacy selects (may not exist)
  const videoSelect = document.getElementById('videoSelect');
  const pngSelect = document.getElementById('pngSelect');
  const bringForwardBtn = document.getElementById('bringForwardBtn');
  const sendBackwardBtn = document.getElementById('sendBackwardBtn');

  const addPngFileBtn = document.getElementById('addPngFileBtn');
  const pngFileInput = document.getElementById('pngFileInput');

  
  const cropAspect = document.getElementById('cropAspect');

  const exportFormat = document.getElementById('exportFormat');
  const exportFpsInput = document.getElementById('exportFpsInput');
  const exportDurationInput = document.getElementById('exportDurationInput');
  const exportBitrateInput = document.getElementById('exportBitrateInput');
  const exportDeterministic = document.getElementById('exportDeterministic');
  const startExportBtn = document.getElementById('startExportBtn');
  const stopExportBtn = document.getElementById('stopExportBtn');
  const exportStatus = document.getElementById('exportStatus');
  const exportProgress = document.getElementById('exportProgress');

  const STAGE_WIDTH = 1880;
  const STAGE_HEIGHT = 980;
  let viewScale = 1;
  /** @type {{url:string,label:string,source:'session'|'manifest'}[]} */
  let sessionVideoItems = [];
  /** @type {{url:string,label:string,source:'session'|'manifest'}[]} */
  let sessionPngItems = [];
  /** @type {Record<string,string>} url->dataURL */
  let sessionThumbs = {};

  /** @typedef {{ id: string, el: HTMLElement, type: 'video'|'image', x: number, y: number, scale: number, naturalWidth: number, naturalHeight: number }} Layer */

  /** @type {Layer[]} */
  let layers = [];
  /** @type {Layer|null} */
  let selectedLayer = null;

  function generateId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function createLayerElement(innerEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'layer';
    wrapper.appendChild(innerEl);
    return wrapper;
  }

  function addLayerToList(layer) {
    const item = document.createElement('li');
    item.dataset.id = layer.id;
    const name = document.createElement('span');
    name.textContent = layer.type === 'video' ? 'Video' : 'PNG';
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = `${Math.round(layer.naturalWidth)}×${Math.round(layer.naturalHeight)}`;
    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';
    left.appendChild(name);
    left.appendChild(meta);
    const actions = document.createElement('div');
    actions.className = 'layer-actions';
    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.title = 'Delete layer';
    del.textContent = '🗑';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteLayer(layer.id); });
    actions.appendChild(del);
    item.appendChild(left);
    item.appendChild(actions);
    item.addEventListener('click', () => selectLayer(layer.id));
    // drag handle
    item.draggable = true;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', layer.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      showDropIndicator(item, e.clientY);
      previewReorder(item, e.clientY);
    });
    item.addEventListener('dragleave', () => hideDropIndicator());
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      commitPreviewReorder(draggedId, item, e.clientY);
      hideDropIndicator();
    });
    layerList.appendChild(item);
  }

  function deleteLayer(id) {
    const idx = layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const [removed] = layers.splice(idx, 1);
    if (removed && removed.el && removed.el.parentNode) removed.el.parentNode.removeChild(removed.el);
    if (selectedLayer && selectedLayer.id === id) selectedLayer = null;
    redrawLayerList();
    updateSelectedInfo();
  }

  function reorderLayer(draggedId, targetId) {
    if (draggedId === targetId) return;
    const from = layers.findIndex(l => l.id === draggedId);
    const to = layers.findIndex(l => l.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = layers.splice(from, 1);
    layers.splice(to, 0, moved);
    // reflect DOM order: append in sequence
    layers.forEach(l => stage.appendChild(l.el));
    redrawLayerList();
  }

  // DnD indicator and live preview
  let dropIndicatorEl = null;
  function ensureDropIndicator() {
    if (!dropIndicatorEl) {
      dropIndicatorEl = document.createElement('div');
      dropIndicatorEl.className = 'drop-indicator';
    }
    return dropIndicatorEl;
  }
  function showDropIndicator(targetItem, clientY) {
    const ind = ensureDropIndicator();
    const rect = targetItem.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    ind.remove();
    if (before) targetItem.parentNode.insertBefore(ind, targetItem);
    else targetItem.parentNode.insertBefore(ind, targetItem.nextSibling);
  }
  function hideDropIndicator() {
    if (dropIndicatorEl && dropIndicatorEl.parentNode) dropIndicatorEl.parentNode.removeChild(dropIndicatorEl);
  }

  let previewOrder = null;
  function previewReorder(targetItem, clientY) {
    if (!selectedLayer) return;
    const targetId = targetItem.dataset.id;
    if (!targetId) return;
    const rect = targetItem.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    const order = layers.slice();
    const from = order.findIndex(l => l.id === selectedLayer.id);
    const to = order.findIndex(l => l.id === targetId) + (before ? 0 : 1);
    if (from === -1 || to === -1) return;
    const [moved] = order.splice(from, 1);
    order.splice(to > from ? to - 1 : to, 0, moved);
    if (!arraysEqualOrder(previewOrder, order)) {
      previewOrder = order;
      // reflect DOM order immediately for preview
      order.forEach(l => stage.appendChild(l.el));
      // update list without committing
      layerList.innerHTML = '';
      for (let i = order.length - 1; i >= 0; i--) addLayerToList(order[i]);
      refreshLayerListSelection();
    }
  }
  function commitPreviewReorder(draggedId, targetItem, clientY) {
    const targetId = targetItem.dataset.id;
    if (!targetId) return;
    const rect = targetItem.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    const from = layers.findIndex(l => l.id === draggedId);
    let to = layers.findIndex(l => l.id === targetId) + (before ? 0 : 1);
    if (from === -1 || to === -1) return;
    const [moved] = layers.splice(from, 1);
    layers.splice(to > from ? to - 1 : to, 0, moved);
    layers.forEach(l => stage.appendChild(l.el));
    redrawLayerList();
    previewOrder = null;
  }
  function arraysEqualOrder(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
    return true;
  }

  function refreshLayerListSelection() {
    const items = layerList.querySelectorAll('li');
    items.forEach((li) => {
      const isSelected = selectedLayer && li.dataset.id === selectedLayer.id;
      li.classList.toggle('selected', Boolean(isSelected));
    });
  }

  function updateSelectedInfo() {
    if (!selectedLayer) {
      selectedInfo.textContent = 'None';
      return;
    }
    selectedInfo.textContent = `${selectedLayer.type.toUpperCase()} — x:${Math.round(selectedLayer.x)} y:${Math.round(selectedLayer.y)} scale:${Math.round(selectedLayer.scale)}%`;
  }

  function layoutLayer(layer) {
    layer.el.style.transform = `translate(${layer.x}px, ${layer.y}px) scale(${layer.scale / 100})`;
  }

  function selectLayer(id) {
    selectedLayer = layers.find((l) => l.id === id) || null;
    const layerEls = stage.querySelectorAll('.layer');
    layerEls.forEach((el) => el.classList.remove('selected'));
    if (selectedLayer) {
      selectedLayer.el.classList.add('selected');
      scaleRange.value = String(selectedLayer.scale);
      scalePct.value = String(selectedLayer.scale);
    }
    refreshLayerListSelection();
    updateSelectedInfo();
  }

  function centerLayer(layer, axis) {
    const width = layer.naturalWidth * (layer.scale / 100);
    const height = layer.naturalHeight * (layer.scale / 100);
    if (axis === 'x' || axis === 'both') {
      layer.x = Math.round((STAGE_WIDTH - width) / 2);
    }
    if (axis === 'y' || axis === 'both') {
      layer.y = Math.round((STAGE_HEIGHT - height) / 2);
    }
    layoutLayer(layer);
    updateSelectedInfo();
  }

  function attachDragHandlers(layer) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      isDragging = true;
      const rect = stage.getBoundingClientRect();
      startX = (e.clientX - rect.left) / viewScale;
      startY = (e.clientY - rect.top) / viewScale;
      originX = layer.x;
      originY = layer.y;
      selectLayer(layer.id);
      layer.el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const rect = stage.getBoundingClientRect();
      const curX = (e.clientX - rect.left) / viewScale;
      const curY = (e.clientY - rect.top) / viewScale;
      const dx = curX - startX;
      const dy = curY - startY;
      layer.x = originX + dx;
      layer.y = originY + dy;
      layoutLayer(layer);
      updateSelectedInfo();
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      layer.el.releasePointerCapture(e.pointerId);
    }

    layer.el.addEventListener('pointerdown', onPointerDown);
    layer.el.addEventListener('pointermove', onPointerMove);
    layer.el.addEventListener('pointerup', onPointerUp);
    layer.el.addEventListener('pointercancel', onPointerUp);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function detectFormats() {
    const options = [];
    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
    if (MediaRecorder && MediaRecorder.isTypeSupported) {
      if (!isFirefox && (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a') || MediaRecorder.isTypeSupported('video/mp4'))) {
        options.push({ mime: 'video/mp4', label: 'MP4 (if supported)' });
      }
      if (isFirefox) {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          options.push({ mime: 'video/webm;codecs=vp8', label: 'WebM VP8' });
        }
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          options.push({ mime: 'video/webm;codecs=vp8,opus', label: 'WebM VP8+Opus (audio)' });
        }
        if (MediaRecorder.isTypeSupported('video/webm')) {
          options.push({ mime: 'video/webm', label: 'WebM' });
        }
      } else {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          options.push({ mime: 'video/webm;codecs=vp9,opus', label: 'WebM VP9' });
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          options.push({ mime: 'video/webm;codecs=vp8,opus', label: 'WebM VP8' });
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options.push({ mime: 'video/webm', label: 'WebM' });
        }
      }
    }
    if (!options.length) {
      options.push({ mime: 'video/webm', label: 'WebM (fallback)' });
    }
    exportFormat.innerHTML = '';
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.mime;
      el.textContent = opt.label;
      exportFormat.appendChild(el);
    }
  }

  function addVideoFromSource(src, isLocalFile, keepObjectUrl = false) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.controls = false;
      video.addEventListener('loadedmetadata', () => {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        const wrapper = createLayerElement(video);
        stage.appendChild(wrapper);
        const layer = {
          id: generateId('video'),
          el: wrapper,
          type: 'video',
          x: 0,
          y: 0,
          scale: 100,
          naturalWidth: width,
          naturalHeight: height,
        };
        layers.push(layer);
        attachDragHandlers(layer);
        centerLayer(layer, 'both');
        addLayerToList(layer);
        selectLayer(layer.id);
        resolve(layer);
      });
      video.addEventListener('error', () => reject(new Error('Failed to load video.')));
      if (isLocalFile && !keepObjectUrl) {
        // Ensure revoke after metadata
        video.addEventListener('loadeddata', () => URL.revokeObjectURL(src), { once: true });
      }
    });
  }

  function addImageFromSource(src, isLocalFile, keepObjectUrl = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const width = img.naturalWidth || 512;
        const height = img.naturalHeight || 512;
        const wrapper = createLayerElement(img);
        stage.appendChild(wrapper);
        const layer = {
          id: generateId('image'),
          el: wrapper,
          type: 'image',
          x: 0,
          y: 0,
          scale: 100,
          naturalWidth: width,
          naturalHeight: height,
        };
        layers.push(layer);
        attachDragHandlers(layer);
        centerLayer(layer, 'both');
        addLayerToList(layer);
        selectLayer(layer.id);
        resolve(layer);
      };
      img.onerror = () => reject(new Error('Failed to load PNG.'));
      img.src = src;
      if (isLocalFile && !keepObjectUrl) {
        img.addEventListener('load', () => URL.revokeObjectURL(src), { once: true });
      }
    });
  }

  function wireInputs() {
    addVideoFileBtn.addEventListener('click', () => videoFileInput.click());
    addPngFileBtn.addEventListener('click', () => pngFileInput.click());

    videoFileInput.addEventListener('change', async () => {
      const file = videoFileInput.files && videoFileInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      // keep object URL alive for session use
      sessionVideoItems.push({ url, label: `${file.name} (uploaded)`, source: 'session' });
      loadAssetSelects();
      addVideoFromSource(url, true, true).catch((e) => alert(e.message));
      
      videoFileInput.value = '';
    });

    pngFileInput.addEventListener('change', async () => {
      const file = pngFileInput.files && pngFileInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      sessionPngItems.push({ url, label: `${file.name} (uploaded)`, source: 'session' });
      loadAssetSelects();
      addImageFromSource(url, true, true).catch((e) => alert(e.message));
      
      pngFileInput.value = '';
    });

    if (reloadManifestsBtn) reloadManifestsBtn.addEventListener('click', () => {
      loadAssetSelects();
    });
    if (generateThumbsBtn) generateThumbsBtn.addEventListener('click', generateAllThumbnails);
    if (bringForwardBtn) bringForwardBtn.addEventListener('click', () => {
      if (!selectedLayer) return;
      const idx = layers.findIndex(l => l.id === selectedLayer.id);
      if (idx === -1 || idx === layers.length - 1) return;
      const [moved] = layers.splice(idx, 1);
      layers.splice(idx + 1, 0, moved);
      layers.forEach(l => stage.appendChild(l.el));
      redrawLayerList();
    });
    if (sendBackwardBtn) sendBackwardBtn.addEventListener('click', () => {
      if (!selectedLayer) return;
      const idx = layers.findIndex(l => l.id === selectedLayer.id);
      if (idx <= 0) return;
      const [moved] = layers.splice(idx, 1);
      layers.splice(idx - 1, 0, moved);
      layers.forEach(l => stage.appendChild(l.el));
      redrawLayerList();
    });

    scaleRange.addEventListener('input', () => {
      if (!selectedLayer) return;
      const val = clamp(Number(scaleRange.value) || 100, 10, 300);
      const prev = selectedLayer.scale;
      if (prev !== val) {
        const w0 = selectedLayer.naturalWidth * (prev / 100);
        const h0 = selectedLayer.naturalHeight * (prev / 100);
        const w1 = selectedLayer.naturalWidth * (val / 100);
        const h1 = selectedLayer.naturalHeight * (val / 100);
        selectedLayer.x += (w0 - w1) / 2;
        selectedLayer.y += (h0 - h1) / 2;
      }
      selectedLayer.scale = val;
      scalePct.value = String(val);
      layoutLayer(selectedLayer);
      updateSelectedInfo();
    });

    scalePct.addEventListener('input', () => {
      if (!selectedLayer) return;
      const val = clamp(Number(scalePct.value) || 100, 10, 300);
      const prev = selectedLayer.scale;
      if (prev !== val) {
        const w0 = selectedLayer.naturalWidth * (prev / 100);
        const h0 = selectedLayer.naturalHeight * (prev / 100);
        const w1 = selectedLayer.naturalWidth * (val / 100);
        const h1 = selectedLayer.naturalHeight * (val / 100);
        selectedLayer.x += (w0 - w1) / 2;
        selectedLayer.y += (h0 - h1) / 2;
      }
      selectedLayer.scale = val;
      scaleRange.value = String(val);
      layoutLayer(selectedLayer);
      updateSelectedInfo();
    });

    centerHBtn.addEventListener('click', () => {
      if (!selectedLayer) return;
      centerLayer(selectedLayer, 'x');
    });
    centerVBtn.addEventListener('click', () => {
      if (!selectedLayer) return;
      centerLayer(selectedLayer, 'y');
    });

    // no-op: buttons removed; reordering via drag/drop

    // video controls toggle removed

    // Keyboard nudge arrows
    stage.addEventListener('keydown', (e) => {
      if (!selectedLayer) return;
      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'ArrowLeft':
          selectedLayer.x -= step; layoutLayer(selectedLayer); e.preventDefault(); break;
        case 'ArrowRight':
          selectedLayer.x += step; layoutLayer(selectedLayer); e.preventDefault(); break;
        case 'ArrowUp':
          selectedLayer.y -= step; layoutLayer(selectedLayer); e.preventDefault(); break;
        case 'ArrowDown':
          selectedLayer.y += step; layoutLayer(selectedLayer); e.preventDefault(); break;
        default:
          break;
      }
      updateSelectedInfo();
    });
  }

  function redrawLayerList() {
    layerList.innerHTML = '';
    for (let i = layers.length - 1; i >= 0; i--) {
      addLayerToList(layers[i]);
    }
    refreshLayerListSelection();
  }

  // Initialize
  wireInputs();
  detectFormats();
  // --------- Crop overlay ---------
  function parseAspect(value) {
    if (!value || value === 'none') return null;
    const [w, h] = value.split(':').map(Number);
    if (!w || !h) return null;
    return w / h;
  }

  function updateCropRect() {
    const ratio = parseAspect(cropAspect.value);
    if (!ratio) {
      cropOverlay.setAttribute('aria-hidden', 'true');
      cropRect.style.display = 'none';
      return;
    }
    cropOverlay.setAttribute('aria-hidden', 'false');
    cropRect.style.display = 'block';
    // fit aspect inside stage center
    const stageW = STAGE_WIDTH;
    const stageH = STAGE_HEIGHT;
    let w = stageW;
    let h = w / ratio;
    if (h > stageH) {
      h = stageH;
      w = h * ratio;
    }
    const x = Math.round((stageW - w) / 2);
    const y = Math.round((stageH - h) / 2);
    cropRect.style.width = `${Math.round(w)}px`;
    cropRect.style.height = `${Math.round(h)}px`;
    cropRect.style.left = `${x}px`;
    cropRect.style.top = `${y}px`;
  }

  cropAspect.addEventListener('change', updateCropRect);
  updateCropRect();

  async function fetchManifest(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.files)) return data.files;
      return [];
    } catch (e) {
      return [];
    }
  }

  function populateSelect(select, items) {
    select.innerHTML = '';
    if (!items.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No assets found';
      select.appendChild(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    for (const item of items) {
      const url = typeof item === 'string' ? item : item.url;
      const label = typeof item === 'string' ? item.split('/').pop() : item.label || url.split('/').pop();
      const source = typeof item === 'string' ? 'manifest' : (item.source || 'manifest');
      const opt = document.createElement('option');
      opt.value = url;
      opt.textContent = label;
      opt.dataset.source = source;
      select.appendChild(opt);
    }
  }

  async function loadAssetSelects() {
    const [videoManifest, pngs] = await Promise.all([
      (async () => {
        const data = await fetchManifest('/public/video/_manifest.json');
        // fetchManifest returns either array or {files}. Use fetch directly for thumbs
        try {
          const res = await fetch('/public/video/_manifest.json', { cache: 'no-store' });
          const json = await res.json();
          return json;
        } catch (_) { return { files: Array.isArray(data) ? data : [], thumbnails: {} }; }
      })(),
      fetchManifest('/public/png/_manifest.json'),
    ]);
    const videos = Array.isArray(videoManifest) ? videoManifest : (videoManifest.files || []);
    const thumbsMap = videoManifest.thumbnails || {};
    const videoItems = [
      ...videos.map((u) => ({ url: u, label: u.split('/').pop(), source: 'manifest', thumb: sessionThumbs[u] || thumbsMap[(u.split('/').pop() || '')] })),
      ...sessionVideoItems,
    ];
    const pngItems = [
      ...pngs.map((u) => ({ url: u, label: u.split('/').pop(), source: 'manifest' })),
      ...sessionPngItems,
    ];
    if (videoSelect) populateSelect(videoSelect, videoItems);
    if (pngSelect) populateSelect(pngSelect, pngItems);
    buildAssetGrid(videoItems);
  }

  async function generateAllThumbnails() {
    try {
      const res = await fetch('/public/video/_manifest.json', { cache: 'no-store' });
      const manifest = await res.json();
      const files = Array.isArray(manifest) ? manifest : (manifest.files || []);
      for (const url of files) {
        try {
          const dataUrl = await clientGenerateThumb(url, 0.5);
          if (dataUrl) {
            sessionThumbs[url] = dataUrl;
            // Try to persist to repo if upload function is configured
            try {
              const base64 = dataUrl.split(',')[1];
              const name = (url.split('/').pop() || '').replace(/\.[^.]+$/, '');
              await fetch('/.netlify/functions/upload', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `public/video/${name}.png`, contentType: 'image/png', dataBase64: base64, message: `feat(thumb): ${name}.png` })
              });
            } catch (_) { /* ignore if not configured */ }
          }
        } catch (e) { /* ignore per-file errors */ }
      }
      // Rebuild modal grid with session thumbs immediately
      await loadAssetSelects();
      alert('Thumbnails generated in-session. If uploads are configured, they will persist.');
    } catch (e) {
      alert('Failed to request thumbnails');
    }
  }

  function clientGenerateThumb(url, seconds) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = 'anonymous';
      v.addEventListener('loadedmetadata', async () => {
        try {
          const t = Math.min(Math.max(seconds || 0.5, 0.1), (v.duration || 1) - 0.1);
          await seekVideo(v, t);
          const canvas = document.createElement('canvas');
          const maxW = 640;
          const scale = Math.min(1, maxW / (v.videoWidth || 640));
          canvas.width = Math.round((v.videoWidth || 640) * scale);
          canvas.height = Math.round((v.videoHeight || 360) * scale);
          const c = canvas.getContext('2d');
          if (!c) return resolve('');
          c.drawImage(v, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) { resolve(''); }
      }, { once: true });
      v.addEventListener('error', () => resolve(''), { once: true });
    });
  }

  async function reloadManifests() {
    // regenerate manifests if function exists, else just refetch
    try {
      await fetch('/.netlify/functions/manifest', { method: 'POST' });
    } catch (_) {}
    await loadAssetSelects();
  }

  async function persistToGitHub(file, destPath) {
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetch('/.netlify/functions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: destPath, contentType: file.type, dataBase64: base64, message: `feat(upload): ${destPath}` }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Upload failed: ${text}`);
      }
    } catch (e) {
      alert(`Upload error: ${e.message || e}`);
    }
  }

  // Dropdown add buttons removed

  // Asset modal (video browser)
  const assetModal = document.getElementById('assetModal');
  const assetGrid = document.getElementById('assetGrid');
  const browseVideosBtn = document.getElementById('browseVideosBtn');
  const browseImagesBtn = document.getElementById('browseImagesBtn');
  const closeAssetModal = document.getElementById('closeAssetModal');
  const assetModalTitle = document.getElementById('assetModalTitle');

  function buildAssetGrid(items) {
    if (!assetGrid) return;
    assetGrid.innerHTML = '';
    items.filter(i => i.source === 'manifest').forEach((item) => {
      const card = document.createElement('div');
      card.className = 'asset-card';
      const img = document.createElement('img');
      img.className = 'asset-thumb';
      img.alt = item.label;
      img.loading = 'lazy';
      if (item.thumb) img.src = item.thumb; else img.src = '/public/png/placeholder.svg';
      const meta = document.createElement('div');
      meta.className = 'asset-meta';
      meta.textContent = item.label;
      card.appendChild(img);
      card.appendChild(meta);
      card.addEventListener('click', () => {
        if (assetModalTitle && /image/i.test(assetModalTitle.textContent || '')) {
          addImageFromSource(item.url, false).catch((e) => alert(e.message));
        } else {
          addVideoFromSource(item.url, false).catch((e) => alert(e.message));
        }
        hideAssetModal();
      });
      assetGrid.appendChild(card);
    });
  }

  function showAssetModal() { assetModal.setAttribute('aria-hidden', 'false'); }
  function hideAssetModal() { assetModal.setAttribute('aria-hidden', 'true'); }
  if (browseVideosBtn) browseVideosBtn.addEventListener('click', async () => {
    if (assetModalTitle) assetModalTitle.textContent = 'Select Video';
    await loadAssetSelects();
    showAssetModal();
  });
  if (browseImagesBtn) browseImagesBtn.addEventListener('click', async () => {
    if (assetModalTitle) assetModalTitle.textContent = 'Select Image';
    // build grid for images
    const pngs = await fetchManifest('/public/png/_manifest.json');
    const items = pngs.map((u) => ({ url: u, label: u.split('/').pop(), source: 'manifest', thumb: u }));
    buildAssetGrid(items);
    showAssetModal();
  });
  if (closeAssetModal) closeAssetModal.addEventListener('click', hideAssetModal);
  if (assetModal) assetModal.addEventListener('click', (e) => { if (e.target === assetModal) hideAssetModal(); });

  loadAssetSelects();

  // --------- Fit to window scaling ---------
  function updateViewScale() {
    const wrap = document.querySelector('.stage-wrap');
    const rect = wrap.getBoundingClientRect();
    const maxWidth = rect.width - 16; // some padding
    const maxHeight = rect.height - 16;
    const scaleX = maxWidth / STAGE_WIDTH;
    const scaleY = maxHeight / STAGE_HEIGHT;
    const scale = Math.min(1, Math.max(0.1, Math.min(scaleX, scaleY)));
    viewScale = scale;
    stageScaler.style.transform = `scale(${scale})`;
  }

  window.addEventListener('resize', updateViewScale);
  // delay to allow layout
  setTimeout(updateViewScale, 0);

  // --------- Export logic ---------
  let exportState = {
    recorder: null,
    chunks: [],
    canvas: null,
    ctx: null,
    running: false,
    rafId: 0,
    intervalId: 0,
    endTime: 0,
    compositeStream: null,
    totalFrames: 0,
    framesRendered: 0,
    forceStopTimer: 0,
    finalized: false,
  };
  const FORCE_STOP_SLACK_MS = 4000;

  function getSelectedVideoElement() {
    if (selectedLayer && selectedLayer.type === 'video') {
      return selectedLayer.el.querySelector('video');
    }
    // fallback to first video layer
    const firstVideo = layers.find(l => l.type === 'video');
    return firstVideo ? firstVideo.el.querySelector('video') : null;
  }

  function drawCompositeFrame(ctx) {
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    for (const layer of layers) {
      const x = layer.x;
      const y = layer.y;
      const scale = layer.scale / 100;
      const w = layer.naturalWidth * scale;
      const h = layer.naturalHeight * scale;
      if (layer.type === 'video') {
        const v = layer.el.querySelector('video');
        if (v && v.readyState >= 2) {
          ctx.drawImage(v, x, y, w, h);
        }
      } else if (layer.type === 'image') {
        const img = layer.el.querySelector('img');
        if (img && img.complete) {
          ctx.drawImage(img, x, y, w, h);
        }
      }
    }
  }

  async function startCompositing() {
    if (exportState.running) return;
    // Enforce defaults explicitly in case browser resets inputs
    if (!exportFpsInput.value) exportFpsInput.value = '30';
    if (!exportDurationInput.value) exportDurationInput.value = '10';
    const fps = clamp(Number(exportFpsInput.value) || 30, 1, 60);
    const durationSec = clamp(Number(exportDurationInput.value) || 10, 1, 600);
    const mimeType = exportFormat.value || 'video/webm';
    const mbps = clamp(Number(exportBitrateInput.value) || 12, 1, 50);
    const bitsPerSecond = Math.round(mbps * 1_000_000);

    const canvas = document.createElement('canvas');
    // If cropping is selected, set canvas to crop area; otherwise full stage
    const ratio = parseAspect(cropAspect.value);
    if (ratio) {
      // compute crop rect same as overlay
      const stageW = STAGE_WIDTH;
      const stageH = STAGE_HEIGHT;
      let w = stageW;
      let h = w / ratio;
      if (h > stageH) { h = stageH; w = h * ratio; }
      const x = Math.round((stageW - w) / 2);
      const y = Math.round((stageH - h) / 2);
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      // wrap draw to clip crop region
      const baseDraw = drawCompositeFrame;
      drawCompositeFrame = function(ctx2) {
        // draw into an offscreen then copy crop region
        baseDraw(ctx2);
        // copy portion into itself by translating: we will render to temp
      };
      // We'll implement draw by drawing to a temp and copying region
    } else {
      canvas.width = STAGE_WIDTH;
      canvas.height = STAGE_HEIGHT;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) { alert('Canvas 2D not supported.'); return; }

    const stream = canvas.captureStream(fps);
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.applyConstraints) {
      try { videoTrack.applyConstraints({ frameRate: fps }); } catch (_) {}
    }
    exportProgress.value = 0;
    exportStatus.textContent = 'Preparing export...';
    console.log('[export] start', { fps, durationSec, mimeType });

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsPerSecond, bitsPerSecond });
    } catch (e) {
      try { recorder = new MediaRecorder(stream, { videoBitsPerSecond: bitsPerSecond, bitsPerSecond }); } catch (e2) {
        try { recorder = new MediaRecorder(stream); } catch (e3) { alert('MediaRecorder not supported.'); return; }
      }
    }

    exportState = { recorder, chunks: [], canvas, ctx, running: true, rafId: 0, intervalId: 0, endTime: performance.now() + durationSec * 1000, compositeStream: stream, totalFrames: Math.round(fps * durationSec), framesRendered: 0, forceStopTimer: 0, finalized: false };

    recorder.onstart = () => { console.log('[export] recorder started', { mimeType: recorder.mimeType }); };
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        exportState.chunks.push(e.data);
        //console.log('[export] chunk', e.data.size);
      }
    };
    recorder.onerror = (e) => { console.error('[export] recorder error', e); };
    recorder.onstop = () => {
      console.log('[export] recorder stopped, chunks:', exportState.chunks.length);
      if (!exportState.finalized) {
        finalizeAndDownload(recorder.mimeType || mimeType);
      }
      exportStatus.textContent = 'Export complete.';
      exportProgress.value = 100;
      startExportBtn.disabled = false;
      stopExportBtn.disabled = true;
    };

    // Ensure all videos play to render frames
    layers.forEach(l => {
      if (l.type === 'video') {
        const v = l.el.querySelector('video');
        if (v && v.paused) { v.muted = true; v.play().catch(() => {}); }
      }
    });

    async function tick() {
      if (!exportState.running) return;
      if (exportDeterministic.checked) {
        // Pause all videos and seek deterministically
        for (const l of layers) {
          if (l.type === 'video') {
            const v = l.el.querySelector('video');
            if (!v) continue;
            try { if (!v.paused) await v.pause(); } catch (_) {}
            const delta = 1 / fps;
            const nextTime = (v.currentTime || 0) + delta;
            await seekVideo(v, nextTime);
          }
        }
      }
      if (ratio) {
        // draw to temp full-size and then blit crop region into export canvas
        if (!startCompositing._tempCanvas) {
          const t = document.createElement('canvas');
          t.width = STAGE_WIDTH;
          t.height = STAGE_HEIGHT;
          startCompositing._tempCanvas = t;
          startCompositing._tempCtx = t.getContext('2d');
          // compute crop again
          const stageW = STAGE_WIDTH;
          const stageH = STAGE_HEIGHT;
          let w = stageW; let h = w / ratio; if (h > stageH) { h = stageH; w = h * ratio; }
          startCompositing._crop = {
            w: Math.round(w), h: Math.round(h),
            x: Math.round((stageW - w) / 2), y: Math.round((stageH - h) / 2)
          };
        }
        const tctx = startCompositing._tempCtx;
        tctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
        // draw full scene
        // reuse existing logic by temporarily targeting temp ctx
        // manual draw loop (copy of drawCompositeFrame for speed)
        for (const layer of layers) {
          const x = layer.x;
          const y = layer.y;
          const scale = layer.scale / 100;
          const w = layer.naturalWidth * scale;
          const h = layer.naturalHeight * scale;
          if (layer.type === 'video') {
            const v = layer.el.querySelector('video');
            if (v && v.readyState >= 2) tctx.drawImage(v, x, y, w, h);
          } else if (layer.type === 'image') {
            const img = layer.el.querySelector('img');
            if (img && img.complete) tctx.drawImage(img, x, y, w, h);
          }
        }
        const c = startCompositing._crop;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(startCompositing._tempCanvas, c.x, c.y, c.w, c.h, 0, 0, canvas.width, canvas.height);
      } else {
        drawCompositeFrame(ctx);
      }
      try {
        const track = exportState.compositeStream && exportState.compositeStream.getVideoTracks()[0];
        if (track && typeof track.requestFrame === 'function') track.requestFrame();
      } catch (_) {}
      exportState.framesRendered += 1;
      const pct = Math.min(100, Math.floor((exportState.framesRendered / exportState.totalFrames) * 100));
      exportProgress.value = pct;
      exportStatus.textContent = `Exporting... ${pct}% (${exportState.framesRendered}/${exportState.totalFrames})`;
      if (exportState.framesRendered % 30 === 0) {
        console.log('[export] tick', exportState.framesRendered, '/', exportState.totalFrames, pct + '%');
      }
      if (exportState.framesRendered >= exportState.totalFrames || performance.now() >= exportState.endTime) {
        stopCompositing();
      }
    }

    // Use fixed interval to ensure frame pacing regardless of tab throttling
    recorder.start(Math.max(1000 / fps, 100));
    exportStatus.textContent = 'Exporting...';
    startExportBtn.disabled = true;
    stopExportBtn.disabled = false;
    const intervalMs = Math.round(1000 / fps);
    exportState.intervalId = setInterval(tick, intervalMs);

    // Watchdog: force finalize if no stop after slack time
    if (exportState.forceStopTimer) clearTimeout(exportState.forceStopTimer);
    exportState.forceStopTimer = setTimeout(() => {
      if (!exportState.finalized) {
        console.warn('[export] watchdog forcing stop');
        stopCompositing(true);
      }
    }, (exportState.endTime - performance.now()) + FORCE_STOP_SLACK_MS);
  }

  function stopCompositing(forceFinalize = false) {
    if (!exportState.running) return;
    exportState.running = false;
    if (exportState.rafId) cancelAnimationFrame(exportState.rafId);
    if (exportState.intervalId) clearInterval(exportState.intervalId);
    try { if (exportState.recorder && exportState.recorder.state === 'recording') exportState.recorder.requestData(); } catch (_) {}
    if (exportState.recorder && exportState.recorder.state !== 'inactive') {
      exportState.recorder.stop();
    }
    if (exportState.compositeStream) {
      exportState.compositeStream.getTracks().forEach(t => t.stop());
    }
    if (forceFinalize && !exportState.finalized) {
      // Fallback finalize in case onstop never fires
      const hinted = (exportState.recorder && exportState.recorder.mimeType) || exportFormat.value || 'video/webm';
      finalizeAndDownload(hinted);
      startExportBtn.disabled = false;
      stopExportBtn.disabled = true;
      exportStatus.textContent = 'Export complete (forced).';
      exportProgress.value = 100;
    }
  }

  function seekVideo(video, time) {
    return new Promise((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
      video.addEventListener('seeked', onSeeked);
      try { video.currentTime = time; } catch (_) { resolve(); }
    });
  }

  function finalizeAndDownload(mimeType) {
    if (exportState.finalized) return;
    const blob = new Blob(exportState.chunks, { type: mimeType });
    const ext = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    exportState.finalized = true;
  }

  startExportBtn.addEventListener('click', startCompositing);
  stopExportBtn.addEventListener('click', stopCompositing);

  // Ensure defaults on init
  if (!exportFpsInput.value) exportFpsInput.value = '60';
  if (!exportDurationInput.value) exportDurationInput.value = '10';
})();


