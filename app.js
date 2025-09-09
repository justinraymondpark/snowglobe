// Snowglobe Layering App - Client-side only
(function () {
  /** @type {HTMLElement} */
  const stage = document.getElementById('stage');
  const layerList = document.getElementById('layerList');
  const selectedInfo = document.getElementById('selectedInfo');
  const scaleRange = document.getElementById('scaleRange');
  const scalePct = document.getElementById('scalePct');
  const centerHBtn = document.getElementById('centerHBtn');
  const centerVBtn = document.getElementById('centerVBtn');
  const toggleVideoControls = document.getElementById('toggleVideoControls');

  const addVideoFileBtn = document.getElementById('addVideoFileBtn');
  const videoFileInput = document.getElementById('videoFileInput');
  const addVideoUrlBtn = document.getElementById('addVideoUrlBtn');
  const videoUrlInput = document.getElementById('videoUrlInput');
  const videoSelect = document.getElementById('videoSelect');
  const addVideoSelectedBtn = document.getElementById('addVideoSelectedBtn');

  const addPngFileBtn = document.getElementById('addPngFileBtn');
  const pngFileInput = document.getElementById('pngFileInput');
  const addPngUrlBtn = document.getElementById('addPngUrlBtn');
  const pngUrlInput = document.getElementById('pngUrlInput');
  const pngSelect = document.getElementById('pngSelect');
  const addPngSelectedBtn = document.getElementById('addPngSelectedBtn');

  const bringForwardBtn = document.getElementById('bringForwardBtn');
  const sendBackwardBtn = document.getElementById('sendBackwardBtn');

  const STAGE_WIDTH = 1880;
  const STAGE_HEIGHT = 980;

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
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      originX = layer.x;
      originY = layer.y;
      selectLayer(layer.id);
      layer.el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const rect = stage.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
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

  function addVideoFromSource(src, isLocalFile) {
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
      if (isLocalFile) {
        // Ensure revoke after metadata
        video.addEventListener('loadeddata', () => URL.revokeObjectURL(src), { once: true });
      }
    });
  }

  function addImageFromSource(src, isLocalFile) {
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
      if (isLocalFile) {
        img.addEventListener('load', () => URL.revokeObjectURL(src), { once: true });
      }
    });
  }

  function wireInputs() {
    addVideoFileBtn.addEventListener('click', () => videoFileInput.click());
    addPngFileBtn.addEventListener('click', () => pngFileInput.click());

    videoFileInput.addEventListener('change', () => {
      const file = videoFileInput.files && videoFileInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      addVideoFromSource(url, true).catch((e) => alert(e.message));
      videoFileInput.value = '';
    });

    pngFileInput.addEventListener('change', () => {
      const file = pngFileInput.files && pngFileInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      addImageFromSource(url, true).catch((e) => alert(e.message));
      pngFileInput.value = '';
    });

    addVideoUrlBtn.addEventListener('click', () => {
      const url = (videoUrlInput.value || '').trim();
      if (!url) return alert('Enter a video URL');
      addVideoFromSource(url, false).catch((e) => alert(e.message));
    });

    addPngUrlBtn.addEventListener('click', () => {
      const url = (pngUrlInput.value || '').trim();
      if (!url) return alert('Enter a PNG URL');
      addImageFromSource(url, false).catch((e) => alert(e.message));
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
    for (const url of items) {
      const opt = document.createElement('option');
      opt.value = url;
      opt.textContent = url.split('/').pop();
      select.appendChild(opt);
    }
  }

  async function loadAssetSelects() {
    const [videos, pngs] = await Promise.all([
      fetchManifest('/public/video/_manifest.json'),
      fetchManifest('/public/png/_manifest.json'),
    ]);
    populateSelect(videoSelect, videos);
    populateSelect(pngSelect, pngs);
  }

  // Dropdown add buttons
  addVideoSelectedBtn.addEventListener('click', () => {
    const url = videoSelect.value;
    if (!url) return;
    addVideoFromSource(url, false).catch((e) => alert(e.message));
  });
  addPngSelectedBtn.addEventListener('click', () => {
    const url = pngSelect.value;
    if (!url) return;
    addImageFromSource(url, false).catch((e) => alert(e.message));
  });

  loadAssetSelects();
})();


