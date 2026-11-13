import { ASPECTS, FONTS, BACKGROUNDS, CHARACTERS, loadImage, drawProceduralBackground, coverImage } from './library.js';
import { stickerList, stickerCanvas, warmStickerThumbs } from './stickers.js';
import { TEMPLATES, FX_PRESETS, presetById } from './templates.js';
import { mountAi } from './generate.js';

const uid = (() => {
  let n = 1;
  return () => 'l' + (n++);
})();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function esc(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function downloadBlob(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2500);
}

function readFileImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const edge = Math.max(img.width, img.height);
      if (edge <= 2048) {
        resolve({ image: img, url });
        return;
      }
      const scale = 2048 / edge;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ image: canvas, url: null });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

export class Editor {
  constructor(canvas) {
    this.canvas = canvas;
    this.aspect = 'square';
    this.w = ASPECTS.square.w;
    this.h = ASPECTS.square.h;
    this.bg = 'void';
    this.frame = 'gold';
    this.fx = presetById('clean');
    this.layers = [];
    this.selectedId = null;
    this.images = new Map();
    this.bgs = new Map();
    this.assets = new Map();
    this.baseId = null;
    this.undo = [];
    this.redo = [];
    this.historyOpen = false;
    this.drag = null;
    this.canvases = {};
    this.assetSeq = 1;
    this.motion = 'zoom-in';
    this.duration = 4;
    this.sparksOn = true;
    this.embersOn = true;
    this.playing = false;
    this.exportAbort = null;
    this.inspectorKey = '';
    this.tab = 'text';
  }

  async boot() {
    this.bindStatic();
    this.buildLibraries();
    try {
      await document.fonts.ready;
    } catch (err) { /* system fonts still draw */ }
    await this.applyTemplate(TEMPLATES[0], false);
    this.preloadRest();
    try { mountAi(this); } catch (err) { this.toast('The AI panel did not start.'); }
  }

  toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  preloadRest() {
    const run = () => {
      const jobs = [];
      BACKGROUNDS.forEach((bg) => { if (bg.src) jobs.push(this.ensureBg(bg.id)); });
      CHARACTERS.forEach((ch) => jobs.push(this.ensureCharacter(ch.id)));
      Promise.allSettled(jobs).then(() => warmStickerThumbs()).catch(() => {});
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 400);
  }

  async ensureBg(id) {
    if (this.bgs.has(id)) return this.bgs.get(id);
    const meta = BACKGROUNDS.find((bg) => bg.id === id);
    if (!meta || !meta.src) return null;
    const img = await loadImage(meta.src);
    this.bgs.set(id, img);
    return img;
  }

  async ensureCharacter(id) {
    if (this.images.has(id)) return this.images.get(id);
    const meta = CHARACTERS.find((ch) => ch.id === id);
    if (!meta) return null;
    const img = await loadImage(meta.src);
    this.images.set(id, img);
    return img;
  }

  snapshot() {
    return JSON.stringify({
      aspect: this.aspect,
      w: this.w,
      h: this.h,
      bg: this.bg,
      frame: this.frame,
      fx: this.fx,
      layers: this.layers,
      baseId: this.baseId,
      selectedId: this.selectedId,
      motion: this.motion,
      duration: this.duration,
      sparksOn: this.sparksOn,
      embersOn: this.embersOn
    });
  }

  pushHistory() {
    this.undo.push(this.snapshot());
    if (this.undo.length > 40) this.undo.shift();
    this.redo = [];
    this.updateHistoryButtons();
  }

  armHistory() {
    if (this.historyOpen) return;
    this.pushHistory();
    this.historyOpen = true;
  }

  closeHistory() {
    this.historyOpen = false;
  }

  restore(raw) {
    const data = JSON.parse(raw);
    this.aspect = data.aspect;
    this.w = data.w;
    this.h = data.h;
    this.bg = data.bg;
    this.frame = data.frame;
    this.fx = data.fx;
    this.layers = data.layers;
    this.baseId = data.baseId;
    this.selectedId = data.selectedId;
    this.motion = data.motion;
    this.duration = data.duration;
    this.sparksOn = data.sparksOn;
    this.embersOn = data.embersOn;
    this.syncCanvasSize();
    this.syncControls();
    this.refreshInspector(true);
    this.refreshLayers();
    this.render();
    this.updateHistoryButtons();
  }

  undoOnce() {
    if (!this.undo.length) return;
    this.redo.push(this.snapshot());
    this.restore(this.undo.pop());
  }

  redoOnce() {
    if (!this.redo.length) return;
    this.undo.push(this.snapshot());
    this.restore(this.redo.pop());
  }

  updateHistoryButtons() {
    const undo = document.getElementById('undoBtn');
    const redo = document.getElementById('redoBtn');
    if (undo) undo.disabled = this.undo.length === 0;
    if (redo) redo.disabled = this.redo.length === 0;
  }

  syncCanvasSize() {
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.aspectRatio = this.w + ' / ' + this.h;
  }

  setAspect(name) {
    const next = ASPECTS[name];
    if (!next || name === this.aspect) return;
    this.armHistory();
    const sx = next.w / this.w;
    const sy = next.h / this.h;
    this.aspect = name;
    this.layers.forEach((layer) => {
      layer.x *= sx;
      layer.y *= sy;
      layer.w *= sx;
      layer.h *= sy;
      if (layer.type === 'text') layer.size *= Math.min(sx, sy);
    });
    this.w = next.w;
    this.h = next.h;
    this.syncCanvasSize();
    this.syncAspectButtons();
    this.closeHistory();
    this.render();
  }

  selected() {
    return this.layers.find((layer) => layer.id === this.selectedId) || null;
  }

  select(id) {
    this.selectedId = id;
    this.refreshInspector(true);
    this.refreshLayers();
    this.render();
  }

  sourceFor(layer) {
    if (layer.type === 'image') {
      const asset = this.assets.get(layer.assetId);
      return asset ? asset.image : null;
    }
    if (layer.kind === 'sticker') return stickerCanvas(layer.sprite, 384);
    return this.images.get(layer.sprite) || null;
  }

  async applyTemplate(template, record = true) {
    if (record) this.pushHistory();
    const aspect = ASPECTS[template.aspect];
    this.aspect = template.aspect;
    this.w = aspect.w;
    this.h = aspect.h;
    this.bg = template.bg;
    this.frame = template.frame;
    this.fx = presetById(template.fx);
    this.baseId = null;
    const needed = new Set();
    template.layers.forEach((layer) => {
      if (layer.kind === 'character') needed.add(layer.sprite);
    });
    if (BACKGROUNDS.find((bg) => bg.id === template.bg && bg.src)) {
      try { await this.ensureBg(template.bg); } catch (err) { this.bg = 'void'; this.toast('A background did not load. Using night ink.'); }
    }
    await Promise.all([...needed].map((id) => this.ensureCharacter(id).catch(() => null)));
    this.layers = template.layers.map((layer) => this.materialize(layer)).filter(Boolean);
    this.selectedId = this.layers.find((layer) => layer.type === 'text')?.id || this.layers[0]?.id || null;
    this.syncCanvasSize();
    this.syncControls();
    this.refreshInspector(true);
    this.refreshLayers();
    this.render();
  }

  materialize(layer) {
    const min = Math.min(this.w, this.h);
    const made = {
      id: uid(),
      type: layer.type,
      kind: layer.kind || '',
      sprite: layer.sprite || '',
      assetId: layer.assetId || '',
      name: layer.name || '',
      text: layer.text || '',
      font: layer.font || FONTS[0].id,
      size: (layer.size || 0.07) * min,
      color: layer.color || '#fffaf0',
      outline: (layer.outline || 0) * min,
      outlineColor: layer.outlineColor || '#1a120c',
      shadow: (layer.shadow || 0) * min,
      shadowColor: layer.shadowColor || '#140c08',
      align: layer.align || 'center',
      upper: layer.upper !== false,
      appear: layer.appear || 0,
      anim: layer.anim || (layer.type === 'text' ? 'pop' : 'none'),
      x: layer.x * this.w,
      y: layer.y * this.h,
      w: (layer.w || 0.4) * this.w,
      h: (layer.h || 0.2) * this.h,
      rot: layer.rot || 0,
      opacity: layer.opacity == null ? 1 : layer.opacity,
      flip: Boolean(layer.flip),
      lockAspect: layer.lockAspect !== false
    };
    if (layer.type === 'sprite' || layer.type === 'image') {
      const img = layer.type === 'image' ? this.sourceFor(made) : (layer.kind === 'character' ? this.images.get(layer.sprite) : stickerCanvas(layer.sprite, 256));
      const ratio = img && img.width ? img.width / img.height : 0.8;
      made.h = (layer.h || 0.4) * this.h;
      made.w = made.h * ratio;
    }
    if (!made.name) {
      if (made.type === 'text') made.name = made.text.split('\n')[0].slice(0, 24) || 'Text';
      else if (made.kind === 'character') made.name = (CHARACTERS.find((c) => c.id === made.sprite) || {}).name || 'Cast';
      else if (made.kind === 'sticker') made.name = (stickerList().find((s) => s.id === made.sprite) || {}).name || 'Sticker';
      else made.name = 'Image';
    }
    return made;
  }

  addCaption(text) {
    const count = this.layers.filter((layer) => layer.type === 'text').length;
    this.pushHistory();
    const layer = this.materialize({
      type: 'text',
      text: String(text || 'CAPTION').slice(0, 80),
      x: 0.5,
      y: 0.16 + (count % 3) * 0.34,
      w: 0.9,
      h: 0.16,
      size: 0.062,
      outline: 0.012,
      shadow: 0.008,
      upper: true,
      anim: 'pop',
      lockAspect: false
    });
    this.layers.push(layer);
    this.select(layer.id);
  }

  addText() {
    this.pushHistory();
    const layer = this.materialize({
      type: 'text',
      text: 'NEW LINE',
      x: 0.5,
      y: 0.5,
      w: 0.86,
      h: 0.18,
      size: 0.07,
      outline: 0.012,
      shadow: 0.008,
      upper: true,
      anim: 'pop',
      lockAspect: false
    });
    this.layers.push(layer);
    this.select(layer.id);
    this.toast('Text added. Edit it in the panel.');
  }

  async addCharacter(id) {
    const img = await this.ensureCharacter(id);
    if (!img) { this.toast('That character is still loading.'); return; }
    this.pushHistory();
    const layer = this.materialize({
      type: 'sprite',
      kind: 'character',
      sprite: id,
      x: 0.5 + (Math.random() - 0.5) * 0.08,
      y: 0.58,
      h: 0.7,
      lockAspect: true
    });
    this.layers.push(layer);
    this.select(layer.id);
  }

  addSticker(id) {
    this.pushHistory();
    const layer = this.materialize({
      type: 'sprite',
      kind: 'sticker',
      sprite: id,
      x: 0.5 + (Math.random() - 0.5) * 0.2,
      y: 0.45 + (Math.random() - 0.5) * 0.1,
      h: 0.22,
      lockAspect: true,
      anim: 'pop',
      appear: 0.2
    });
    this.layers.push(layer);
    this.select(layer.id);
  }

  addImageLayer(image, name) {
    const id = 'up' + (this.assetSeq++);
    this.assets.set(id, { image, name: name || 'Upload' });
    this.pushHistory();
    const layer = this.materialize({
      type: 'image',
      assetId: id,
      name: name || 'Upload',
      x: 0.5,
      y: 0.5,
      h: 0.55,
      lockAspect: true
    });
    const ratio = image.width / image.height;
    layer.h = this.h * 0.55;
    layer.w = layer.h * ratio;
    this.layers.push(layer);
    this.select(layer.id);
  }

  setBaseImage(image, name) {
    const id = 'base' + (this.assetSeq++);
    this.assets.set(id, { image, name: name || 'Base' });
    this.pushHistory();
    this.baseId = id;
    this.render();
    this.toast('Base image set. Add text or stickers on top.');
  }

  async setBaseVideo(file) {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    await new Promise((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('That video could not be read.'));
    });
    const poster = document.createElement('canvas');
    poster.width = video.videoWidth || 640;
    poster.height = video.videoHeight || 360;
    poster.getContext('2d').drawImage(video, 0, 0, poster.width, poster.height);
    const id = 'vid' + (this.assetSeq++);
    this.assets.set(id, { image: poster, video, name: file.name || 'Video', duration: video.duration || 4 });
    this.pushHistory();
    this.baseId = id;
    const clip = Math.min(8, Math.max(2, video.duration || 4));
    this.duration = Math.round(clip * 2) / 2;
    if ((video.duration || 0) > 8) this.toast('Using the first 8 seconds of that video.');
    else this.toast('Video base ready. Set caption timing, then export.');
    this.syncControls();
    this.render();
  }

  baseAsset() {
    return this.baseId ? this.assets.get(this.baseId) : null;
  }

  clearBase() {
    if (!this.baseId) return;
    this.pushHistory();
    this.baseId = null;
    this.render();
  }

  deleteSelected() {
    const layer = this.selected();
    if (!layer) return;
    this.pushHistory();
    this.layers = this.layers.filter((item) => item.id !== layer.id);
    this.selectedId = this.layers[this.layers.length - 1]?.id || null;
    this.refreshInspector(true);
    this.refreshLayers();
    this.render();
  }

  duplicateSelected() {
    const layer = this.selected();
    if (!layer) return;
    this.pushHistory();
    const copy = clone(layer);
    copy.id = uid();
    copy.x += 24;
    copy.y += 24;
    copy.name = layer.name + ' copy';
    this.layers.push(copy);
    this.select(copy.id);
  }

  moveLayer(id, dir) {
    const index = this.layers.findIndex((layer) => layer.id === id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= this.layers.length) return;
    this.pushHistory();
    const [layer] = this.layers.splice(index, 1);
    this.layers.splice(next, 0, layer);
    this.refreshLayers();
    this.render();
  }

  scaleSelected(factor) {
    const layer = this.selected();
    if (!layer) return;
    this.armHistory();
    layer.w *= factor;
    layer.h *= factor;
    if (layer.type === 'text') layer.size = Math.max(10, layer.size * factor);
    this.render();
    this.closeHistory();
  }

  ensureCanvas(key, w, h) {
    let canvas = this.canvases[key];
    if (!canvas) {
      canvas = document.createElement('canvas');
      this.canvases[key] = canvas;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return canvas;
  }

  render(opts = {}) {
    this.paint(this.canvas, { showUi: true, time: null, ...opts });
  }

  paint(target, opts = {}) {
    const showUi = Boolean(opts.showUi);
    const time = opts.time == null ? null : opts.time;
    const w = this.w;
    const h = this.h;
    const scene = this.ensureCanvas('scene', w, h);
    const sctx = scene.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, w, h);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.save();
    if (time != null) this.applyCamera(sctx, time);
    sctx.save();
    sctx.translate(w / 2, h / 2);
    sctx.scale(1.3, 1.3);
    sctx.translate(-w / 2, -h / 2);
    this.drawBackground(sctx, w, h);
    sctx.restore();
    this.drawBase(sctx, w, h, time);
    this.layers.forEach((layer) => {
      if (layer.opacity <= 0) return;
      this.drawLayer(sctx, layer, time);
    });
    sctx.restore();
    if (time != null) this.drawParticles(sctx, time, w, h);

    const fxCanvas = this.ensureCanvas('fx', w, h);
    this.applyFx(scene, fxCanvas);

    const ctx = target.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fxCanvas, 0, 0, target.width, target.height);
    this.drawFrame(ctx, target.width, target.height, this.frame);
    if (showUi && target === this.canvas) this.drawSelection(ctx);
  }

  applyCamera(ctx, time) {
    const p = Math.max(0, Math.min(1, time / (this.duration || 1)));
    let z = 1;
    let x = 0;
    let y = 0;
    let rot = 0;
    if (this.motion === 'zoom-in') z = 1 + 0.12 * p;
    else if (this.motion === 'zoom-out') z = 1.12 - 0.12 * p;
    else if (this.motion === 'pan') { z = 1.08; x = (p - 0.5) * this.w * 0.1; }
    else if (this.motion === 'shake') {
      z = 1.04;
      x = Math.sin(time * 42) * 8;
      y = Math.cos(time * 36) * 5;
      rot = Math.sin(time * 28) * 0.012;
    }
    ctx.translate(this.w / 2, this.h / 2);
    ctx.rotate(rot);
    ctx.scale(z, z);
    ctx.translate(-this.w / 2 + x, -this.h / 2 + y);
  }

  drawBackground(ctx, w, h) {
    const img = this.bgs.get(this.bg);
    if (img) coverImage(ctx, img, w, h);
    else drawProceduralBackground(ctx, w, h, this.bg === 'embers' ? 'embers' : 'void');
  }

  drawBase(ctx, w, h, time) {
    const asset = this.baseAsset();
    if (!asset) return;
    const source = time != null && asset.video ? asset.video : asset.image;
    if (!source) return;
    ctx.save();
    coverImage(ctx, source, w, h);
    ctx.restore();
  }

  layerMotion(layer, time) {
    if (time == null || !layer.anim || layer.anim === 'none') {
      return { alpha: layer.opacity, scale: 1, dy: 0 };
    }
    const appear = layer.appear || 0;
    if (time < appear) return { alpha: 0, scale: 0.86, dy: 16 };
    const u = Math.min(1, (time - appear) / 0.38);
    const eased = 1 - Math.pow(1 - u, 3);
    if (layer.anim === 'slide') return { alpha: layer.opacity * eased, scale: 1, dy: (1 - eased) * 46 };
    if (layer.anim === 'fade') return { alpha: layer.opacity * eased, scale: 1, dy: 0 };
    return { alpha: layer.opacity, scale: 0.72 + 0.28 * eased + Math.sin(u * Math.PI) * 0.06, dy: (1 - eased) * 18 };
  }

  drawLayer(ctx, layer, time) {
    const motion = this.layerMotion(layer, time);
    if (motion.alpha <= 0.01) return;
    ctx.save();
    ctx.translate(layer.x, layer.y + motion.dy);
    ctx.rotate(layer.rot || 0);
    ctx.scale((layer.flip ? -1 : 1) * motion.scale, motion.scale);
    ctx.globalAlpha = motion.alpha;
    if (layer.type === 'text') this.drawText(ctx, layer);
    else {
      const img = this.sourceFor(layer);
      if (img) {
        if (layer.kind === 'character') {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.filter = 'blur(10px)';
          ctx.beginPath();
          ctx.ellipse(0, layer.h * 0.46, layer.w * 0.22, layer.h * 0.035, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.drawImage(img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
      }
    }
    ctx.restore();
  }

  drawText(ctx, layer) {
    const raw = layer.upper ? String(layer.text || '').toUpperCase() : String(layer.text || '');
    ctx.font = `700 ${Math.max(8, layer.size)}px ${layer.font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = layer.align || 'center';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    const maxWidth = Math.max(20, layer.w - 12);
    const lines = [];
    raw.split('\n').forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); return; }
      let line = '';
      words.forEach((word) => {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = test;
      });
      lines.push(line);
    });
    const lh = layer.size * 1.12;
    let y = -((lines.length - 1) * lh) / 2;
    const x = layer.align === 'left' ? -layer.w / 2 + 8 : layer.align === 'right' ? layer.w / 2 - 8 : 0;
    lines.forEach((line) => {
      if (layer.outline > 0) {
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = layer.outline;
        ctx.strokeStyle = layer.outlineColor || '#1a120c';
        ctx.strokeText(line, x, y);
      }
      ctx.shadowColor = layer.shadow > 0 ? (layer.shadowColor || '#000') : 'transparent';
      ctx.shadowBlur = layer.shadow || 0;
      ctx.shadowOffsetY = (layer.shadow || 0) * 0.35;
      ctx.fillStyle = layer.color || '#fff';
      ctx.fillText(line, x, y);
      y += lh;
    });
  }

  drawParticles(ctx, time, w, h) {
    if (this.sparksOn) {
      for (let i = 0; i < 26; i++) {
        const x = ((i * 97) % 1000) / 1000 * w;
        const speed = 28 + (i % 5) * 14;
        const y = (h - ((time * speed + i * 47) % (h + 40))) ;
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(time * 6 + i));
        ctx.save();
        ctx.globalAlpha = tw;
        ctx.fillStyle = i % 3 === 0 ? '#fff6d2' : '#ffc15a';
        ctx.shadowColor = '#ffb03a';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (this.embersOn) {
      for (let i = 0; i < 10; i++) {
        const x = ((i * 173) % 1000) / 1000 * w;
        const y = h * 0.15 + ((i * 89) % 700) / 700 * h * 0.7 - (time * 12) % 30;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(time * 2 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
        g.addColorStop(0, 'rgba(255,190,90,.9)');
        g.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  applyFx(scene, dest) {
    const ctx = dest.getContext('2d');
    const w = dest.width;
    const h = dest.height;
    const fx = this.fx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.filter = [
      `brightness(${fx.brightness})`,
      `contrast(${fx.contrast})`,
      `saturate(${fx.saturate})`,
      `hue-rotate(${fx.hue}deg)`,
      fx.blur ? `blur(${fx.blur}px)` : '',
      fx.sepia ? `sepia(${fx.sepia})` : ''
    ].filter(Boolean).join(' ');
    ctx.drawImage(scene, 0, 0);
    ctx.filter = 'none';
    if (fx.fry > 0) {
      const shift = Math.max(1, fx.fry * 5);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35 * fx.fry;
      ctx.drawImage(dest, shift, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.3 * fx.fry;
      ctx.drawImage(dest, -shift, 0);
      ctx.restore();
    }
    if (fx.glow > 0) {
      ctx.save();
      ctx.filter = 'blur(16px)';
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(0.85, fx.glow);
      ctx.drawImage(dest, 0, 0);
      ctx.restore();
    }
    if (fx.halftone > 0) this.halftone(dest, fx.halftone);
    if (fx.vignette > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.68);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, fx.vignette)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (fx.grain > 0) {
      const noise = this.noiseTile();
      ctx.save();
      ctx.globalAlpha = Math.min(0.45, fx.grain);
      ctx.globalCompositeOperation = 'overlay';
      const pat = ctx.createPattern(noise, 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  noiseTile() {
    if (this._noise) return this._noise;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this._noise = canvas;
    return canvas;
  }

  halftone(canvas, cell) {
    const w = canvas.width;
    const h = canvas.height;
    const step = Math.max(6, cell);
    const sw = Math.max(1, Math.round(w / step));
    const sh = Math.max(1, Math.round(h / step));
    const small = this.ensureCanvas('half', sw, sh);
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(canvas, 0, 0, sw, sh);
    const data = sctx.getImageData(0, 0, sw, sh).data;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3e2c4';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const lum = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
        const radius = Math.max(0.4, lum * step * 0.48);
        ctx.fillStyle = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
        ctx.beginPath();
        ctx.arc(x * step + step / 2, y * step + step / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawFrame(ctx, w, h, frame) {
    if (!frame || frame === 'none') return;
    const m = Math.max(8, Math.round(Math.min(w, h) * 0.025));
    ctx.save();
    if (frame === 'thin' || frame === 'gold' || frame === 'double') {
      ctx.strokeStyle = frame === 'thin' ? 'rgba(255,250,240,.85)' : '#e6b23c';
      ctx.lineWidth = frame === 'thin' ? Math.max(4, m * 0.45) : m;
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      if (frame === 'double' || frame === 'gold') {
        ctx.strokeStyle = frame === 'gold' ? 'rgba(90,50,10,.8)' : '#fffaf0';
        ctx.lineWidth = Math.max(2, m * 0.25);
        ctx.strokeRect(m * 1.4, m * 1.4, w - m * 2.8, h - m * 2.8);
      }
    } else if (frame === 'ember') {
      ctx.strokeStyle = '#ffb15a';
      ctx.shadowColor = '#ff7a18';
      ctx.shadowBlur = m * 1.4;
      ctx.lineWidth = Math.max(6, m * 0.7);
      ctx.strokeRect(m, m, w - m * 2, h - m * 2);
    } else if (frame === 'polaroid') {
      ctx.fillStyle = '#f7f1e6';
      ctx.fillRect(0, 0, w, h * 0.04);
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      ctx.fillRect(0, 0, w * 0.035, h);
      ctx.fillRect(w * 0.965, 0, w * 0.035, h);
    } else if (frame === 'film') {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, m * 1.3);
      ctx.fillRect(0, h - m * 1.3, w, m * 1.3);
      ctx.fillStyle = '#f4e2c0';
      const holes = Math.max(6, Math.round(w / (m * 2.2)));
      for (let i = 0; i < holes; i++) {
        const x = (i + 0.5) * (w / holes);
        ctx.fillRect(x - m * 0.28, m * 0.28, m * 0.56, m * 0.7);
        ctx.fillRect(x - m * 0.28, h - m * 1.05, m * 0.56, m * 0.7);
      }
    } else if (frame === 'comic') {
      ctx.strokeStyle = '#1a120c';
      ctx.lineWidth = m * 1.15;
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      ctx.strokeStyle = '#fffaf0';
      ctx.lineWidth = Math.max(2, m * 0.25);
      ctx.strokeRect(m * 1.2, m * 1.2, w - m * 2.4, h - m * 2.4);
    }
    ctx.restore();
  }

  drawSelection(ctx) {
    const layer = this.selected();
    if (!layer) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / Math.max(1, rect.width);
    const handle = 7 * scale;
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate(layer.rot || 0);
    if (layer.flip) ctx.scale(-1, 1);
    ctx.strokeStyle = '#f0c14a';
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.strokeRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, -layer.h / 2);
    ctx.lineTo(0, -layer.h / 2 - 22 * scale);
    ctx.stroke();
    const points = [
      [-layer.w / 2, -layer.h / 2],
      [layer.w / 2, -layer.h / 2],
      [layer.w / 2, layer.h / 2],
      [-layer.w / 2, layer.h / 2],
      [0, -layer.h / 2 - 22 * scale]
    ];
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#6b3e0c';
    ctx.lineWidth = 1.5 * scale;
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, handle, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  screenScale() {
    const rect = this.canvas.getBoundingClientRect();
    return this.canvas.width / Math.max(1, rect.width);
  }

  toLocal(layer, px, py) {
    const dx = px - layer.x;
    const dy = py - layer.y;
    const c = Math.cos(-(layer.rot || 0));
    const s = Math.sin(-(layer.rot || 0));
    let x = dx * c - dy * s;
    let y = dx * s + dy * c;
    if (layer.flip) x = -x;
    return { x, y };
  }

  hitHandle(layer, px, py) {
    const local = this.toLocal(layer, px, py);
    const reach = 14 * this.screenScale();
    const knobs = [
      ['nw', -layer.w / 2, -layer.h / 2],
      ['ne', layer.w / 2, -layer.h / 2],
      ['se', layer.w / 2, layer.h / 2],
      ['sw', -layer.w / 2, layer.h / 2],
      ['rot', 0, -layer.h / 2 - 22 * this.screenScale()]
    ];
    for (const [name, x, y] of knobs) {
      if (Math.hypot(local.x - x, local.y - y) <= reach) return name;
    }
    return '';
  }

  hitLayer(px, py) {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      const local = this.toLocal(layer, px, py);
      if (Math.abs(local.x) <= layer.w / 2 && Math.abs(local.y) <= layer.h / 2) return layer;
    }
    return null;
  }

  pointerDown(event) {
    if (document.body.classList.contains('paywalled')) return;
    if (event.button != null && event.button !== 0) return;
    const p = this.eventPoint(event);
    const current = this.selected();
    let mode = '';
    let layer = current && this.hitHandle(current, p.x, p.y) ? current : null;
    if (layer) mode = this.hitHandle(layer, p.x, p.y);
    if (!layer) {
      layer = this.hitLayer(p.x, p.y);
      mode = layer ? 'move' : '';
    }
    if (!layer) {
      if (this.selectedId) this.select(null);
      return;
    }
    if (layer.id !== this.selectedId) this.select(layer.id);
    this.armHistory();
    const opp = mode === 'se' ? 'nw' : mode === 'nw' ? 'se' : mode === 'ne' ? 'sw' : mode === 'sw' ? 'ne' : '';
    this.drag = {
      mode,
      id: layer.id,
      dx: p.x - layer.x,
      dy: p.y - layer.y,
      start: clone(layer),
      opp: opp ? this.worldPoint(layer, opp) : null
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  worldPoint(layer, corner) {
    const map = { nw: [-1, -1], ne: [1, -1], se: [1, 1], sw: [-1, 1] };
    const [sx, sy] = map[corner];
    const lx = sx * layer.w / 2;
    const ly = sy * layer.h / 2;
    const c = Math.cos(layer.rot || 0);
    const s = Math.sin(layer.rot || 0);
    const fx = layer.flip ? -1 : 1;
    return {
      x: layer.x + (fx * lx) * c - ly * s,
      y: layer.y + (fx * lx) * s + ly * c
    };
  }

  pointerMove(event) {
    if (!this.drag) return;
    const layer = this.layers.find((item) => item.id === this.drag.id);
    if (!layer) return;
    const p = this.eventPoint(event);
    if (this.drag.mode === 'move') {
      layer.x = p.x - this.drag.dx;
      layer.y = p.y - this.drag.dy;
    } else if (this.drag.mode === 'rot') {
      layer.rot = Math.atan2(p.y - layer.y, p.x - layer.x) + Math.PI / 2;
    } else {
      this.resizeLayer(layer, p);
    }
    this.render();
  }

  resizeLayer(layer, p) {
    const opp = this.drag.opp;
    const c = Math.cos(-(layer.rot || 0));
    const s = Math.sin(-(layer.rot || 0));
    const vx = p.x - opp.x;
    const vy = p.y - opp.y;
    let lx = vx * c - vy * s;
    let ly = vx * s + vy * c;
    if (layer.flip) lx = -lx;
    let nw = Math.max(28, Math.abs(lx));
    let nh = Math.max(28, Math.abs(ly));
    if (layer.lockAspect && this.drag.start.h) {
      const ar = this.drag.start.w / this.drag.start.h;
      if (nw / nh > ar) nw = nh * ar;
      else nh = nw / ar;
    }
    const signX = lx >= 0 ? 1 : -1;
    const signY = ly >= 0 ? 1 : -1;
    layer.w = nw;
    layer.h = nh;
    const hx = (layer.flip ? -1 : 1) * signX * nw / 2;
    const hy = signY * nh / 2;
    const rc = Math.cos(layer.rot || 0);
    const rs = Math.sin(layer.rot || 0);
    layer.x = opp.x + hx * rc - hy * rs;
    layer.y = opp.y + hx * rs + hy * rc;
    if (layer.type === 'text' && this.drag.start.h) {
      layer.size = Math.max(12, this.drag.start.size * (layer.h / this.drag.start.h));
    }
  }

  pointerUp() {
    if (!this.drag) return;
    this.drag = null;
    this.closeHistory();
    this.refreshInspector(true);
  }

  eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  bindStatic() {
    this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    this.canvas.addEventListener('pointerup', () => this.pointerUp());
    this.canvas.addEventListener('pointercancel', () => this.pointerUp());
    document.getElementById('undoBtn').addEventListener('click', () => this.undoOnce());
    document.getElementById('redoBtn').addEventListener('click', () => this.redoOnce());
    document.getElementById('surpriseBtn').addEventListener('click', () => this.surprise());
    document.getElementById('templatesBtn').addEventListener('click', () => this.openTemplates());
    document.getElementById('aiOpenBtn').addEventListener('click', () => this.showTab('ai'));
    document.getElementById('closeTemplates').addEventListener('click', () => this.closeTemplates());
    document.getElementById('pngBtn').addEventListener('click', () => this.exportStill('image/png', 'meme-crucible.png'));
    document.getElementById('jpgBtn').addEventListener('click', () => this.exportStill('image/jpeg', 'meme-crucible.jpg'));
    document.getElementById('shareBtn').addEventListener('click', () => this.shareStill());
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('filePick').click());
    document.getElementById('filePick').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (file) this.receiveFile(file, 'ask');
    });
    document.getElementById('useBaseBtn').addEventListener('click', () => this.confirmIntake('base'));
    document.getElementById('useLayerBtn').addEventListener('click', () => this.confirmIntake('layer'));
    document.getElementById('cancelIntake').addEventListener('click', () => this.closeIntake());
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => this.showTab(button.dataset.tab));
    });
    document.getElementById('addTextBtn').addEventListener('click', () => this.addText());
    const wrap = document.getElementById('stageWrap');
    ['dragenter', 'dragover'].forEach((type) => wrap.addEventListener(type, (event) => {
      event.preventDefault();
      wrap.classList.add('is-dropping');
    }));
    ['dragleave', 'drop'].forEach((type) => wrap.addEventListener(type, (event) => {
      if (type === 'dragleave' && wrap.contains(event.relatedTarget)) return;
      wrap.classList.remove('is-dropping');
    }));
    wrap.addEventListener('drop', (event) => {
      event.preventDefault();
      const file = [...(event.dataTransfer?.files || [])].find((item) => /^(image|video)\//.test(item.type));
      if (file) this.receiveFile(file, 'ask');
      else this.toast('Drop an image or a short video.');
    });
    window.addEventListener('paste', (event) => this.onPaste(event));
    window.addEventListener('keydown', (event) => this.onKey(event));
    this.bindVideoUi();
    this.syncAspectButtons();
    this.updateHistoryButtons();
    this.showTab('text');
  }

  bindVideoUi() {
    const duration = document.getElementById('vidDuration');
    const motion = document.getElementById('vidMotion');
    const sparks = document.getElementById('vidSpark');
    const embers = document.getElementById('vidEmber');
    duration.addEventListener('input', () => {
      this.duration = Number(duration.value);
      document.getElementById('vidDurationLabel').textContent = this.duration.toFixed(1) + 's';
    });
    motion.addEventListener('change', () => { this.motion = motion.value; });
    sparks.addEventListener('change', () => { this.sparksOn = sparks.checked; });
    embers.addEventListener('change', () => { this.embersOn = embers.checked; });
    document.getElementById('previewBtn').addEventListener('click', () => this.preview());
    document.getElementById('expWebm').addEventListener('click', () => this.exportVideo('webm'));
    document.getElementById('expMp4').addEventListener('click', () => this.exportVideo('mp4'));
    document.getElementById('expGif').addEventListener('click', () => this.exportVideo('gif'));
    document.getElementById('cancelExport').addEventListener('click', () => {
      if (this.exportAbort) this.exportAbort.abort();
    });
    document.getElementById('videoBtn').addEventListener('click', () => this.showTab('video'));
  }

  showTab(name) {
    this.tab = name;
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('is-on', button.dataset.tab === name);
    });
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
    const inspector = document.getElementById('inspector');
    if (inspector) inspector.hidden = name === 'ai';
    if (name === 'video') this.refreshCaptions();
    if (name === 'ai') {
      const panel = document.querySelector('.panel');
      const anchor = document.getElementById('aiPrompt');
      if (panel && anchor) {
        const delta = anchor.getBoundingClientRect().top - panel.getBoundingClientRect().top;
        panel.scrollTop += delta - 8;
      }
    }
    if (name === 'stickers' && !this.stickersReady) {
      this.stickersReady = true;
      warmStickerThumbs();
      this.buildStickerGrid();
    }
  }

  buildLibraries() {
    const aspects = document.getElementById('aspectRow');
    aspects.innerHTML = Object.entries(ASPECTS).map(([id, info]) =>
      `<button type="button" class="chip" data-aspect="${id}">${info.label}</button>`
    ).join('');
    aspects.querySelectorAll('[data-aspect]').forEach((button) => {
      button.addEventListener('click', () => this.setAspect(button.dataset.aspect));
    });

    document.getElementById('castGrid').innerHTML = CHARACTERS.map((ch) =>
      `<button type="button" class="card" data-cast="${ch.id}"><span class="thumb" data-thumb="cast-${ch.id}"></span><strong>${esc(ch.name)}</strong><small>${esc(ch.note)}</small></button>`
    ).join('');
    document.getElementById('castGrid').querySelectorAll('[data-cast]').forEach((button) => {
      button.addEventListener('click', () => this.addCharacter(button.dataset.cast));
    });

    document.getElementById('sceneGrid').innerHTML = BACKGROUNDS.map((bg) =>
      `<button type="button" class="card" data-bg="${bg.id}"><span class="thumb" data-thumb="bg-${bg.id}"></span><strong>${esc(bg.name)}</strong></button>`
    ).join('');
    document.getElementById('sceneGrid').querySelectorAll('[data-bg]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.bg;
        this.armHistory();
        try { await this.ensureBg(id); } catch (err) { this.closeHistory(); this.toast('That scene did not load.'); return; }
        this.bg = id;
        this.closeHistory();
        this.render();
      });
    });
    document.getElementById('clearBaseBtn').addEventListener('click', () => this.clearBase());

    const frames = ['none', 'thin', 'gold', 'double', 'ember', 'polaroid', 'film', 'comic'];
    document.getElementById('frameRow').innerHTML = frames.map((id) =>
      `<button type="button" class="chip" data-frame="${id}">${id}</button>`
    ).join('');
    document.getElementById('frameRow').querySelectorAll('[data-frame]').forEach((button) => {
      button.addEventListener('click', () => {
        this.armHistory();
        this.frame = button.dataset.frame;
        this.closeHistory();
        this.syncControls();
        this.render();
      });
    });

    const presets = Object.keys(FX_PRESETS);
    document.getElementById('presetRow').innerHTML = presets.map((id) =>
      `<button type="button" class="chip" data-preset="${id}">${id}</button>`
    ).join('');
    document.getElementById('presetRow').querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        this.armHistory();
        this.fx = presetById(button.dataset.preset);
        this.closeHistory();
        this.syncControls();
        this.render();
      });
    });
    document.querySelectorAll('[data-fx]').forEach((input) => {
      input.addEventListener('input', () => {
        this.armHistory();
        const key = input.dataset.fx;
        this.fx[key] = Number(input.value);
        const label = document.querySelector(`[data-fx-label="${key}"]`);
        if (label) label.textContent = this.formatFx(key, this.fx[key]);
        this.render();
      });
      input.addEventListener('change', () => this.closeHistory());
    });
    this.buildStickerGrid();
    this.prepareThumbs();
  }

  buildStickerGrid() {
    const grid = document.getElementById('stickerGrid');
    grid.innerHTML = stickerList().map((sticker) =>
      `<button type="button" class="sticker-btn" data-sticker="${sticker.id}" title="${esc(sticker.name)}"><canvas width="96" height="96" data-sticker-canvas="${sticker.id}"></canvas><span>${esc(sticker.name)}</span></button>`
    ).join('');
    grid.querySelectorAll('[data-sticker]').forEach((button) => {
      button.addEventListener('click', () => this.addSticker(button.dataset.sticker));
    });
    grid.querySelectorAll('canvas').forEach((canvas) => {
      const src = stickerCanvas(canvas.dataset.stickerCanvas, 128);
      canvas.getContext('2d').drawImage(src, 0, 0, 96, 96);
    });
  }

  async prepareThumbs() {
    for (const ch of CHARACTERS) {
      try {
        const img = await this.ensureCharacter(ch.id);
        const slot = document.querySelector(`[data-thumb="cast-${ch.id}"]`);
        if (slot && img) slot.style.backgroundImage = `url(${img.src})`;
      } catch (err) { /* thumb can stay empty */ }
    }
    for (const bg of BACKGROUNDS) {
      const slot = document.querySelector(`[data-thumb="bg-${bg.id}"]`);
      if (!slot) continue;
      if (!bg.src) {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        drawProceduralBackground(canvas.getContext('2d'), 160, 90, bg.id);
        slot.style.backgroundImage = `url(${canvas.toDataURL('image/jpeg', 0.7)})`;
      } else {
        try {
          const img = await this.ensureBg(bg.id);
          if (img) slot.style.backgroundImage = `url(${img.src})`;
        } catch (err) { /* ignore missing scene */ }
      }
    }
  }

  syncAspectButtons() {
    document.querySelectorAll('[data-aspect]').forEach((button) => {
      button.classList.toggle('is-on', button.dataset.aspect === this.aspect);
    });
  }

  syncControls() {
    this.syncAspectButtons();
    document.querySelectorAll('[data-frame]').forEach((button) => {
      button.classList.toggle('is-on', button.dataset.frame === this.frame);
    });
    document.querySelectorAll('[data-fx]').forEach((input) => {
      const key = input.dataset.fx;
      if (this.fx[key] == null) return;
      input.value = String(this.fx[key]);
      const label = document.querySelector(`[data-fx-label="${key}"]`);
      if (label) label.textContent = this.formatFx(key, this.fx[key]);
    });
    const duration = document.getElementById('vidDuration');
    if (duration) {
      duration.value = String(this.duration);
      document.getElementById('vidDurationLabel').textContent = Number(this.duration).toFixed(1) + 's';
    }
    const motion = document.getElementById('vidMotion');
    if (motion) motion.value = this.motion;
    document.getElementById('vidSpark').checked = this.sparksOn;
    document.getElementById('vidEmber').checked = this.embersOn;
    this.refreshFormatNote();
  }

  formatFx(key, value) {
    if (key === 'hue') return Math.round(value) + '°';
    if (key === 'halftone') return value ? Math.round(value) + 'px' : 'off';
    if (key === 'blur') return Math.round(value) + 'px';
    return Number(value).toFixed(2);
  }

  refreshInspector(force) {
    const layer = this.selected();
    const key = layer ? layer.id + ':' + layer.type : 'none';
    const host = document.getElementById('inspector');
    if (!force && key === this.inspectorKey) return;
    this.inspectorKey = key;
    if (!layer) {
      host.innerHTML = '<p class="hint">Select a layer on the canvas, or add text, a character, or a sticker.</p>';
      return;
    }
    const common = `
      <div class="insp-head"><strong>${esc(layer.name)}</strong>
        <span>
          <button type="button" data-act="dup">Duplicate</button>
          <button type="button" data-act="del">Delete</button>
        </span>
      </div>
      <div class="row-btns">
        <button type="button" data-act="back">Send back</button>
        <button type="button" data-act="fwd">Bring front</button>
        <button type="button" data-act="smaller">Smaller</button>
        <button type="button" data-act="bigger">Bigger</button>
        <button type="button" data-act="flip">Flip</button>
      </div>
      <label class="slider">Opacity <input data-prop="opacity" type="range" min="0.15" max="1" step="0.01" value="${layer.opacity}"></label>
      <label class="check"><input data-prop="lockAspect" type="checkbox" ${layer.lockAspect ? 'checked' : ''}> Keep proportions</label>`;
    let specific = '';
    if (layer.type === 'text') {
      const fontOptions = FONTS.map((font) => `<option value="${esc(font.id)}" ${font.id === layer.font ? 'selected' : ''}>${esc(font.label)}</option>`).join('');
      specific = `
        <label>Words<textarea data-prop="text" rows="3">${esc(layer.text)}</textarea></label>
        <label>Font<select data-prop="font">${fontOptions}</select></label>
        <label class="slider">Size <input data-prop="size" type="range" min="18" max="220" step="1" value="${Math.round(layer.size)}"></label>
        <div class="split">
          <label>Fill <input data-prop="color" type="color" value="${esc(this.hex(layer.color))}"></label>
          <label>Outline <input data-prop="outlineColor" type="color" value="${esc(this.hex(layer.outlineColor))}"></label>
        </div>
        <label class="slider">Outline width <input data-prop="outline" type="range" min="0" max="40" step="1" value="${Math.round(layer.outline)}"></label>
        <label class="slider">Shadow <input data-prop="shadow" type="range" min="0" max="40" step="1" value="${Math.round(layer.shadow)}"></label>
        <label>Shadow color <input data-prop="shadowColor" type="color" value="${esc(this.hex(layer.shadowColor))}"></label>
        <label>Align
          <select data-prop="align">
            ${['left', 'center', 'right'].map((align) => `<option ${align === layer.align ? 'selected' : ''}>${align}</option>`).join('')}
          </select>
        </label>
        <label class="check"><input data-prop="upper" type="checkbox" ${layer.upper ? 'checked' : ''}> Uppercase</label>
        <label>Entrance
          <select data-prop="anim">
            ${['pop', 'slide', 'fade', 'none'].map((anim) => `<option ${anim === layer.anim ? 'selected' : ''}>${anim}</option>`).join('')}
          </select>
        </label>
        <label class="slider">Appears at <input data-prop="appear" type="range" min="0" max="7" step="0.1" value="${layer.appear || 0}"> <span data-appear-label>${(layer.appear || 0).toFixed(1)}s</span></label>`;
    }
    host.innerHTML = common + specific;
    host.querySelectorAll('[data-act]').forEach((button) => {
      button.addEventListener('click', () => {
        const act = button.dataset.act;
        if (act === 'del') this.deleteSelected();
        else if (act === 'dup') this.duplicateSelected();
        else if (act === 'back') this.moveLayer(layer.id, -1);
        else if (act === 'fwd') this.moveLayer(layer.id, 1);
        else if (act === 'smaller') this.scaleSelected(0.9);
        else if (act === 'bigger') this.scaleSelected(1.1);
        else if (act === 'flip') {
          this.armHistory();
          layer.flip = !layer.flip;
          this.closeHistory();
          this.render();
        }
      });
    });
    host.querySelectorAll('[data-prop]').forEach((input) => {
      const eventName = input.type === 'range' ? 'input' : 'input';
      input.addEventListener(eventName, () => {
        this.armHistory();
        this.applyProp(layer, input);
        this.render();
      });
      input.addEventListener('change', () => this.closeHistory());
    });
  }

  hex(color) {
    const value = String(color || '');
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';
  }

  applyProp(layer, input) {
    const key = input.dataset.prop;
    if (input.type === 'checkbox') layer[key] = input.checked;
    else if (input.type === 'range') layer[key] = Number(input.value);
    else layer[key] = input.value;
    if (key === 'text') layer.name = String(layer.text).split('\n')[0].slice(0, 24) || 'Text';
    if (key === 'appear') {
      const label = document.querySelector('[data-appear-label]');
      if (label) label.textContent = Number(layer.appear).toFixed(1) + 's';
    }
    this.refreshLayers();
  }

  refreshLayers() {
    const list = document.getElementById('layerList');
    if (!list) return;
    if (!this.layers.length) {
      list.innerHTML = '<p class="hint">No layers yet.</p>';
      return;
    }
    const rows = [...this.layers].reverse();
    list.innerHTML = rows.map((layer) => `
      <div class="layer-row ${layer.id === this.selectedId ? 'is-on' : ''}" data-layer="${layer.id}">
        <button type="button" class="layer-name" data-pick="${layer.id}">${esc(layer.name)}</button>
        <button type="button" data-dir="1" data-id="${layer.id}" aria-label="Bring forward">↑</button>
        <button type="button" data-dir="-1" data-id="${layer.id}" aria-label="Send backward">↓</button>
      </div>`).join('');
    list.querySelectorAll('[data-pick]').forEach((button) => {
      button.addEventListener('click', () => this.select(button.dataset.pick));
    });
    list.querySelectorAll('[data-dir]').forEach((button) => {
      button.addEventListener('click', () => this.moveLayer(button.dataset.id, Number(button.dataset.dir)));
    });
  }

  refreshCaptions() {
    const host = document.getElementById('captionList');
    const texts = this.layers.filter((layer) => layer.type === 'text');
    if (!texts.length) {
      host.innerHTML = '<p class="hint">Add text, then set when each line appears.</p>';
      return;
    }
    host.innerHTML = texts.map((layer) => `
      <div class="caption-row">
        <span>${esc(layer.name)}</span>
        <input data-cap="${layer.id}" data-cap-key="appear" type="range" min="0" max="${this.duration}" step="0.1" value="${layer.appear || 0}">
        <select data-cap="${layer.id}" data-cap-key="anim">
          ${['pop', 'slide', 'fade', 'none'].map((anim) => `<option ${layer.anim === anim ? 'selected' : ''}>${anim}</option>`).join('')}
        </select>
      </div>`).join('');
    host.querySelectorAll('[data-cap]').forEach((input) => {
      input.addEventListener('input', () => {
        const layer = this.layers.find((item) => item.id === input.dataset.cap);
        if (!layer) return;
        layer[input.dataset.capKey] = input.type === 'range' ? Number(input.value) : input.value;
      });
    });
  }

  async refreshFormatNote() {
    const note = document.getElementById('formatNote');
    if (!note) return;
    try {
      const { formatSupport } = await import('./video.js');
      const support = formatSupport();
      note.textContent = support.note;
      document.getElementById('expWebm').disabled = !support.webm;
      document.getElementById('expMp4').disabled = !support.mp4;
    } catch (err) {
      note.textContent = 'Video tools will load when you export.';
    }
  }

  async openTemplates() {
    const modal = document.getElementById('templateModal');
    const grid = document.getElementById('templateGrid');
    modal.hidden = false;
    if (this.templatesBuilt) return;
    this.templatesBuilt = true;
    grid.innerHTML = '<p class="hint">Warming the gallery…</p>';
    const cards = [];
    for (const template of TEMPLATES) {
      const canvas = document.createElement('canvas');
      const aspect = ASPECTS[template.aspect];
      canvas.width = 240;
      canvas.height = Math.round(240 * aspect.h / aspect.w);
      cards.push(`<button type="button" class="template-card" data-template="${template.id}"><canvas id="thumb-${template.id}" width="${canvas.width}" height="${canvas.height}"></canvas><span>${esc(template.name)}</span></button>`);
    }
    grid.innerHTML = cards.join('');
    grid.querySelectorAll('[data-template]').forEach((button) => {
      button.addEventListener('click', async () => {
        const template = TEMPLATES.find((item) => item.id === button.dataset.template);
        await this.applyTemplate(template, true);
        this.closeTemplates();
      });
    });
    for (const template of TEMPLATES) {
      const canvas = document.getElementById('thumb-' + template.id);
      if (!canvas) continue;
      try {
        await this.paintTemplateThumb(canvas, template);
      } catch (err) {
        canvas.getContext('2d').fillStyle = '#24180f';
        canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  async paintTemplateThumb(canvas, template) {
    const saved = this.snapshot();
    await this.applyTemplate(template, false);
    this.paint(canvas, { showUi: false, time: null });
    this.restore(saved);
  }

  closeTemplates() {
    document.getElementById('templateModal').hidden = true;
  }

  surprise() {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const lines = [
      ['THE FORGE', 'IS AWAKE'],
      ['SOOT TRIED', 'THEIR BEST'],
      ['CINDER SAW', 'EVERYTHING'],
      ['ONE MORE', 'SPARK'],
      ['QUENCH IT', 'GENTLY'],
      ['BRING THE', 'BELLOW'],
      ['NOT A COIN', 'A CRUCIBLE']
    ];
    const pair = lines[Math.floor(Math.random() * lines.length)];
    this.applyTemplate(template, true).then(() => {
      const texts = this.layers.filter((layer) => layer.type === 'text');
      if (texts[0]) texts[0].text = pair[0];
      if (texts[1]) texts[1].text = pair[1];
      texts.forEach((layer) => { layer.name = layer.text.slice(0, 24); });
      this.refreshInspector(true);
      this.refreshLayers();
      this.render();
    });
  }

  async receiveFile(file, mode) {
    if (file.type.startsWith('video/')) {
      try { await this.setBaseVideo(file); }
      catch (err) { this.toast(err.message || 'Could not open that video.'); }
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.toast('Use an image or a short video.');
      return;
    }
    this.pendingFile = file;
    if (mode === 'base') return this.confirmIntake('base');
    if (mode === 'layer') return this.confirmIntake('layer');
    document.getElementById('intakeName').textContent = file.name || 'Pasted image';
    document.getElementById('intakeModal').hidden = false;
  }

  async confirmIntake(mode) {
    const file = this.pendingFile;
    this.closeIntake();
    if (!file) return;
    try {
      const { image } = await readFileImage(file);
      if (mode === 'base') this.setBaseImage(image, file.name);
      else this.addImageLayer(image, file.name);
    } catch (err) {
      this.toast(err.message || 'Could not open that image.');
    }
  }

  closeIntake() {
    this.pendingFile = null;
    document.getElementById('intakeModal').hidden = true;
  }

  onPaste(event) {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          this.receiveFile(file, 'ask');
        }
        return;
      }
    }
  }

  onKey(event) {
    if (document.body.classList.contains('paywalled')) return;
    const target = event.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redoOnce();
      else this.undoOnce();
      return;
    }
    if (meta && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redoOnce();
      return;
    }
    if (typing) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.deleteSelected();
      return;
    }
    const layer = this.selected();
    if (!layer) return;
    const step = event.shiftKey ? 10 : 2;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[event.key]) {
      event.preventDefault();
      this.armHistory();
      layer.x += map[event.key][0];
      layer.y += map[event.key][1];
      this.render();
    }
  }

  async exportStill(type, filename) {
    const plate = document.createElement('canvas');
    plate.width = this.w;
    plate.height = this.h;
    this.paint(plate, { showUi: false, time: null });
    const blob = await new Promise((resolve) => plate.toBlob(resolve, type, 0.92));
    if (!blob) { this.toast('Export failed.'); return; }
    downloadBlob(blob, filename);
    this.toast('Saved ' + filename);
  }

  async shareStill() {
    const plate = document.createElement('canvas');
    plate.width = this.w;
    plate.height = this.h;
    this.paint(plate, { showUi: false, time: null });
    const blob = await new Promise((resolve) => plate.toBlob(resolve, 'image/png'));
    if (!blob) { this.toast('Could not prepare the image.'); return; }
    const file = new File([blob], 'meme-crucible.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Meme Crucible' });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    downloadBlob(blob, file.name);
    this.toast('This browser cannot share image files, so the PNG was downloaded.');
  }

  async seekBase(time) {
    const asset = this.baseAsset();
    if (!asset || !asset.video) return;
    const duration = asset.video.duration || time;
    const next = Math.max(0, Math.min(time, Math.max(0, duration - 0.05)));
    if (Math.abs(asset.video.currentTime - next) < 0.04) return;
    asset.video.currentTime = next;
    await new Promise((resolve) => asset.video.addEventListener('seeked', resolve, { once: true }));
  }

  preview() {
    if (this.playing) return;
    this.playing = true;
    const started = performance.now();
    const step = async (now) => {
      const t = Math.min(this.duration, (now - started) / 1000);
      await this.seekBase(t);
      this.paint(this.canvas, { showUi: false, time: t });
      if (!this.playing || t >= this.duration) {
        this.playing = false;
        this.render();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async exportVideo(format) {
    if (this.exportAbort) return;
    const { exportAnimation, formatSupport } = await import('./video.js');
    const support = formatSupport();
    if (format === 'webm' && !support.webm) { this.toast('WebM recording is not available here. Try MP4 or GIF.'); return; }
    if (format === 'mp4' && !support.mp4) { this.toast('MP4 encoding is not available here. Try WebM or GIF.'); return; }
    const progress = document.getElementById('progressModal');
    const bar = document.getElementById('progressBar');
    const label = document.getElementById('progressLabel');
    progress.hidden = false;
    bar.style.width = '0%';
    label.textContent = 'Starting ' + format.toUpperCase() + '…';
    this.exportAbort = new AbortController();
    const ext = format === 'mp4' ? 'mp4' : format === 'gif' ? 'gif' : 'webm';
    try {
      const blob = await exportAnimation({
        format,
        fullWidth: this.w,
        fullHeight: this.h,
        duration: this.duration,
        signal: this.exportAbort.signal,
        onProgress: (value) => {
          const pct = Math.round(value * 100);
          bar.style.width = pct + '%';
          label.textContent = 'Encoding ' + format.toUpperCase() + '… ' + pct + '%';
        },
        drawAt: async (canvas, time) => {
          await this.seekBase(time);
          this.paint(canvas, { showUi: false, time });
        }
      });
      downloadBlob(blob, 'meme-crucible.' + ext);
      label.textContent = 'Saved meme-crucible.' + ext;
      this.toast('Saved meme-crucible.' + ext);
    } catch (err) {
      if (err && err.name === 'AbortError') this.toast('Export cancelled.');
      else this.toast(err.message || 'Export failed.');
      label.textContent = err && err.name === 'AbortError' ? 'Cancelled' : (err.message || 'Export failed');
    } finally {
      this.exportAbort = null;
      setTimeout(() => { progress.hidden = true; }, 700);
      this.render();
    }
  }
}
