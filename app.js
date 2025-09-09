// Snowglobe Layering App - Client-side only
(function () {
  /** @type {HTMLElement} */
  const stage = document.getElementById('stage');
  const layerList = document.getElementById('layerList');
  const stageScaler = document.getElementById('stageScaler');
  const selectedInfo = document.getElementById('selectedInfo');
  const scaleRange = document.getElementById('scaleRange');
  const scalePct = document.getElementById('scalePct');
  const centerHBtn = document.getElementById('centerHBtn');
  const centerVBtn = document.getElementById('centerVBtn');
  const toggleVideoControls = document.getElementById('toggleVideoControls');

  const addVideoFileBtn = document.getElementById('addVideoFileBtn');
  const videoFileInput = document.getElementById('videoFileInput');
  const reloadManifestsBtn = document.getElementById('reloadManifestsBtn');
  const videoSelect = document.getElementById('videoSelect');
  const addVideoSelectedBtn = document.getElementById('addVideoSelectedBtn');

  const addPngFileBtn = document.getElementById('addPngFileBtn');
  const pngFileInput = document.getElementById('pngFileInput');
  
  const pngSelect = document.getElementById('pngSelect');
  const addPngSelectedBtn = document.getElementById('addPngSelectedBtn');

  const bringForwardBtn = document.getElementById('bringForwardBtn');
  const sendBackwardBtn = document.getElementById('sendBackwardBtn');
  const persistUploads = document.getElementById('persistUploads');

  const exportFormat = document.getElementById('exportFormat');
  const exportFpsInput = document.getElementById('exportFpsInput');
  const exportDurationInput = document.getElementById('exportDurationInput');
  const exportIncludeAudio = document.getElementById('exportIncludeAudio');
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
    item.appendChild(name);
    item.appendChild(meta);
    item.addEventListener('click', () => selectLayer(layer.id));
    layerList.appendChild(item);
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
      video.controls = toggleVideoControls.checked;
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
      if (persistUploads.checked) {
        await persistToGitHub(file, `public/video/${file.name}`);
        await reloadManifests();
      }
      videoFileInput.value = '';
    });

    pngFileInput.addEventListener('change', async () => {
      const file = pngFileInput.files && pngFileInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      sessionPngItems.push({ url, label: `${file.name} (uploaded)`, source: 'session' });
      loadAssetSelects();
      addImageFromSource(url, true, true).catch((e) => alert(e.message));
      if (persistUploads.checked) {
        await persistToGitHub(file, `public/png/${file.name}`);
        await reloadManifests();
      }
      pngFileInput.value = '';
    });

    reloadManifestsBtn.addEventListener('click', () => {
      loadAssetSelects();
    });

    scaleRange.addEventListener('input', () => {
      if (!selectedLayer) return;
      const val = clamp(Number(scaleRange.value) || 100, 10, 300);
      selectedLayer.scale = val;
      scalePct.value = String(val);
      layoutLayer(selectedLayer);
      updateSelectedInfo();
    });

    scalePct.addEventListener('input', () => {
      if (!selectedLayer) return;
      const val = clamp(Number(scalePct.value) || 100, 10, 300);
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

    bringForwardBtn.addEventListener('click', () => {
      if (!selectedLayer) return;
      const idx = layers.findIndex((l) => l.id === selectedLayer.id);
      if (idx === -1 || idx === layers.length - 1) return;
      const [moved] = layers.splice(idx, 1);
      layers.splice(idx + 1, 0, moved);
      stage.appendChild(moved.el);
      // reorder list visually by re-creating list
      redrawLayerList();
    });

    sendBackwardBtn.addEventListener('click', () => {
      if (!selectedLayer) return;
      const idx = layers.findIndex((l) => l.id === selectedLayer.id);
      if (idx <= 0) return;
      const [moved] = layers.splice(idx, 1);
      layers.splice(idx - 1, 0, moved);
      stage.insertBefore(moved.el, stage.children[idx - 1] || stage.firstChild);
      redrawLayerList();
    });

    toggleVideoControls.addEventListener('change', () => {
      // apply to selected if video
      if (selectedLayer && selectedLayer.type === 'video') {
        const video = selectedLayer.el.querySelector('video');
        if (video) video.controls = toggleVideoControls.checked;
      }
      // also apply to all videos
      layers.forEach((l) => {
        if (l.type === 'video') {
          const v = l.el.querySelector('video');
          if (v) v.controls = toggleVideoControls.checked;
        }
      });
    });

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
    layers.forEach((l) => addLayerToList(l));
    refreshLayerListSelection();
  }

  // Initialize
  wireInputs();
  detectFormats();

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
    const [videos, pngs] = await Promise.all([
      fetchManifest('/public/video/_manifest.json'),
      fetchManifest('/public/png/_manifest.json'),
    ]);
    const videoItems = [
      ...videos.map((u) => ({ url: u, label: u.split('/').pop(), source: 'manifest' })),
      ...sessionVideoItems,
    ];
    const pngItems = [
      ...pngs.map((u) => ({ url: u, label: u.split('/').pop(), source: 'manifest' })),
      ...sessionPngItems,
    ];
    populateSelect(videoSelect, videoItems);
    populateSelect(pngSelect, pngItems);
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

  // Dropdown add buttons
  addVideoSelectedBtn.addEventListener('click', () => {
    const url = videoSelect.value;
    if (!url) return;
    const source = videoSelect.selectedOptions[0]?.dataset?.source || 'manifest';
    const isBlob = url.startsWith('blob:');
    if (source === 'session' || isBlob) {
      addVideoFromSource(url, true, true).catch((e) => alert(e.message));
    } else {
      addVideoFromSource(url, false).catch((e) => alert(e.message));
    }
  });
  addPngSelectedBtn.addEventListener('click', () => {
    const url = pngSelect.value;
    if (!url) return;
    const source = pngSelect.selectedOptions[0]?.dataset?.source || 'manifest';
    const isBlob = url.startsWith('blob:');
    if (source === 'session' || isBlob) {
      addImageFromSource(url, true, true).catch((e) => alert(e.message));
    } else {
      addImageFromSource(url, false).catch((e) => alert(e.message));
    }
  });

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
    if (!exportFpsInput.value) exportFpsInput.value = '60';
    if (!exportDurationInput.value) exportDurationInput.value = '10';
    const fps = clamp(Number(exportFpsInput.value) || 60, 1, 60);
    const durationSec = clamp(Number(exportDurationInput.value) || 10, 1, 600);
    const mimeType = exportFormat.value || 'video/webm';

    const canvas = document.createElement('canvas');
    canvas.width = STAGE_WIDTH;
    canvas.height = STAGE_HEIGHT;
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
    if (exportIncludeAudio.checked) {
      const v = getSelectedVideoElement();
      if (v) {
        try {
          const audioStream = v.captureStream ? v.captureStream() : null;
          if (audioStream) {
            const audioTracks = audioStream.getAudioTracks();
            for (const t of audioTracks) stream.addTrack(t);
          }
        } catch (e) {
          // ignore if not supported
        }
      }
    }

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (e) {
      try { recorder = new MediaRecorder(stream); } catch (e2) { alert('MediaRecorder not supported.'); return; }
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
      drawCompositeFrame(ctx);
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


