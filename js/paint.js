import { stickerList, stickerCanvas } from './stickers.js';
import { generateSticker, localStandIn, recentObjects, rememberObject, GenerateError } from './generate.js';

function cloneCanvas(source) {
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d').drawImage(source, 0, 0);
  return copy;
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

export function mountPaint(editor) {
  const modal = document.getElementById('paintModal');
  const view = document.getElementById('paintView');
  const wrap = document.getElementById('paintCanvasWrap');
  if (!modal || !view || !wrap) return;

  const studio = new PaintStudio(editor, modal, view, wrap);
  editor.paintStudio = studio;
  document.getElementById('paintClose').addEventListener('click', () => studio.close());
  document.getElementById('paintBrush').addEventListener('click', () => studio.setTool('brush'));
  document.getElementById('paintEraser').addEventListener('click', () => studio.setTool('eraser'));
  document.getElementById('paintMove').addEventListener('click', () => studio.setTool('move'));
  document.getElementById('paintUndo').addEventListener('click', () => studio.undo());
  document.getElementById('paintColor').addEventListener('input', (event) => { studio.color = event.target.value; });
  document.getElementById('paintSize').addEventListener('input', (event) => {
    studio.size = Number(event.target.value);
    document.getElementById('paintSizeLabel').textContent = String(studio.size);
  });
  document.getElementById('paintUpload').addEventListener('click', () => document.getElementById('paintFile').click());
  document.getElementById('paintFile').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (file) studio.usePhoto(file);
  });
  document.getElementById('paintMakeObject').addEventListener('click', () => studio.makeObject());
  document.getElementById('paintBigger').addEventListener('click', () => studio.scaleSelected(1.12));
  document.getElementById('paintSmaller').addEventListener('click', () => studio.scaleSelected(0.88));
  document.getElementById('paintRotate').addEventListener('click', () => studio.rotateSelected(15));
  document.getElementById('paintDelete').addEventListener('click', () => studio.deleteSelected());
  document.getElementById('paintPng').addEventListener('click', () => studio.savePng());
  document.getElementById('paintToMeme').addEventListener('click', () => studio.sendToMeme('layer'));
  document.getElementById('paintAsBase').addEventListener('click', () => studio.sendToMeme('base'));
  document.addEventListener('mmc-object', () => studio.renderObjectShelf());
  window.addEventListener('keydown', (event) => {
    if (modal.hidden) return;
    const typing = event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA');
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      studio.undo();
    } else if (!typing && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      studio.deleteSelected();
    }
  }, true);
  view.addEventListener('pointerdown', (event) => studio.pointerDown(event));
  view.addEventListener('pointermove', (event) => studio.pointerMove(event));
  view.addEventListener('pointerup', (event) => studio.pointerUp(event));
  view.addEventListener('pointercancel', (event) => studio.pointerUp(event));
  studio.buildStickerShelf();
  studio.renderObjectShelf();
  if (typeof ResizeObserver !== 'undefined') {
    studio.observer = new ResizeObserver(() => { if (!modal.hidden) studio.layout(); });
    studio.observer.observe(wrap);
  }
}

class PaintStudio {
  constructor(editor, modal, view, wrap) {
    this.editor = editor;
    this.modal = modal;
    this.view = view;
    this.wrap = wrap;
    this.tool = 'brush';
    this.color = '#1a120c';
    this.size = 18;
    this.base = null;
    this.ink = null;
    this.items = [];
    this.selectedId = null;
    this.undoStack = [];
    this.drag = null;
    this.seq = 1;
    this.objectSeed = Math.floor(Math.random() * 1e9);
  }

  trialOpen() {
    if (!document.body.classList.contains('paywalled')) return true;
    this.editor.toast('The trial is paused. Share or unlock to keep painting.');
    return false;
  }

  open() {
    if (!this.trialOpen()) return;
    this.modal.hidden = false;
    document.body.classList.add('painting');
    requestAnimationFrame(() => this.layout());
  }

  close() {
    this.modal.hidden = true;
    document.body.classList.remove('painting');
    this.drag = null;
  }

  setStatus(message, isError) {
    const el = document.getElementById('paintStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', Boolean(isError));
  }

  setTool(tool) {
    this.tool = tool;
    ['brush', 'eraser', 'move'].forEach((name) => {
      const button = document.getElementById('paint' + name.charAt(0).toUpperCase() + name.slice(1));
      if (button) button.classList.toggle('is-on', name === tool);
    });
    this.view.style.cursor = tool === 'move' ? 'grab' : 'crosshair';
    this.render();
  }

  layout() {
    const rect = this.wrap.getBoundingClientRect();
    const cssW = Math.max(240, Math.floor(rect.width));
    const cssH = Math.max(240, Math.floor(rect.height));
    const ratio = window.devicePixelRatio || 1;
    const cap = 1400 / Math.max(cssW, cssH);
    const scale = Math.min(ratio, cap);
    const w = Math.max(32, Math.round(cssW * scale));
    const h = Math.max(32, Math.round(cssH * scale));
    if (this.base && this.base.width === w && this.base.height === h) {
      this.render();
      return;
    }
    const nextBase = document.createElement('canvas');
    const nextInk = document.createElement('canvas');
    nextBase.width = nextInk.width = w;
    nextBase.height = nextInk.height = h;
    const bctx = nextBase.getContext('2d');
    bctx.fillStyle = '#f4e7cf';
    bctx.fillRect(0, 0, w, h);
    if (this.base) bctx.drawImage(this.base, 0, 0, w, h);
    if (this.ink) nextInk.getContext('2d').drawImage(this.ink, 0, 0, w, h);
    if (this.base) {
      const sx = w / this.base.width;
      const sy = h / this.base.height;
      this.items.forEach((item) => {
        item.x *= sx;
        item.y *= sy;
        item.w *= sx;
        item.h *= sy;
      });
    }
    this.base = nextBase;
    this.ink = nextInk;
    this.view.width = w;
    this.view.height = h;
    this.render();
  }

  snapshot() {
    return {
      base: cloneCanvas(this.base),
      ink: cloneCanvas(this.ink),
      items: this.items.map((item) => ({ ...item })),
      selectedId: this.selectedId
    };
  }

  pushUndo() {
    if (!this.base) return;
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 20) this.undoStack.shift();
    this.syncUndo();
  }

  restore(shot) {
    this.base = shot.base;
    this.ink = shot.ink;
    this.items = shot.items;
    this.selectedId = shot.selectedId;
    this.view.width = this.base.width;
    this.view.height = this.base.height;
    this.render();
    this.syncUndo();
  }

  undo() {
    const shot = this.undoStack.pop();
    if (!shot) return;
    this.restore(shot);
    this.setStatus('Undid the last paint step.', false);
  }

  syncUndo() {
    const button = document.getElementById('paintUndo');
    if (button) button.disabled = this.undoStack.length === 0;
  }

  point(event) {
    const rect = this.view.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.view.width / rect.width),
      y: (event.clientY - rect.top) * (this.view.height / rect.height)
    };
  }

  brushWidth() {
    const rect = this.view.getBoundingClientRect();
    return this.size * (this.view.width / Math.max(1, rect.width));
  }

  pointerDown(event) {
    if (!this.trialOpen() || !this.base) return;
    if (event.button != null && event.button !== 0) return;
    const p = this.point(event);
    if (this.tool === 'move') {
      const hit = this.hitItem(p.x, p.y);
      this.selectedId = hit ? hit.id : null;
      if (hit) {
        this.pushUndo();
        this.drag = { kind: 'move', id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y };
      }
      this.render();
      this.capture(event);
      return;
    }
    this.pushUndo();
    this.drag = { kind: 'draw', x: p.x, y: p.y };
    this.stroke(p.x, p.y, p.x, p.y);
    this.capture(event);
  }

  pointerMove(event) {
    if (!this.drag) return;
    const p = this.point(event);
    if (this.drag.kind === 'draw') {
      this.stroke(this.drag.x, this.drag.y, p.x, p.y);
      this.drag.x = p.x;
      this.drag.y = p.y;
      return;
    }
    const item = this.items.find((entry) => entry.id === this.drag.id);
    if (!item) return;
    item.x = p.x - this.drag.dx;
    item.y = p.y - this.drag.dy;
    this.render();
  }

  capture(event) {
    try { this.view.setPointerCapture(event.pointerId); } catch (err) { /* already released or unsupported */ }
  }

  pointerUp(event) {
    if (!this.drag) return;
    this.drag = null;
    if (this.view.hasPointerCapture(event.pointerId)) this.view.releasePointerCapture(event.pointerId);
  }

  stroke(x0, y0, x1, y1) {
    const ctx = this.ink.getContext('2d');
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.brushWidth();
    if (this.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.color;
      ctx.fillStyle = this.color;
    }
    ctx.beginPath();
    if (Math.hypot(x1 - x0, y1 - y0) < 0.8) {
      ctx.arc(x1, y1, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
    this.render();
  }

  hitItem(x, y) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      const dx = x - item.x;
      const dy = y - item.y;
      const c = Math.cos(-(item.rot || 0));
      const s = Math.sin(-(item.rot || 0));
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      if (Math.abs(lx) <= item.w / 2 && Math.abs(ly) <= item.h / 2) return item;
    }
    return null;
  }

  selected() {
    return this.items.find((item) => item.id === this.selectedId) || null;
  }

  addItem(image, name) {
    if (!this.base) this.layout();
    this.pushUndo();
    const ratio = image.width / image.height;
    const h = this.base.height * 0.34;
    const item = {
      id: 'p' + (this.seq++),
      name: name || 'Object',
      image,
      x: this.base.width * 0.5,
      y: this.base.height * 0.45,
      w: h * ratio,
      h,
      rot: 0
    };
    this.items.push(item);
    this.selectedId = item.id;
    this.setTool('move');
    this.setStatus(item.name + ' is on the painting. Drag it, then use the brush to paint over it.', false);
  }

  scaleSelected(factor) {
    const item = this.selected();
    if (!item) return;
    this.pushUndo();
    item.w *= factor;
    item.h *= factor;
    this.render();
  }

  rotateSelected(degrees) {
    const item = this.selected();
    if (!item) return;
    this.pushUndo();
    item.rot = (item.rot || 0) + degrees * Math.PI / 180;
    this.render();
  }

  deleteSelected() {
    const item = this.selected();
    if (!item) return;
    this.pushUndo();
    this.items = this.items.filter((entry) => entry.id !== item.id);
    this.selectedId = null;
    this.render();
  }

  async usePhoto(file) {
    if (!this.trialOpen()) return;
    if (!file.type.startsWith('image/')) {
      this.setStatus('Choose an image file.', true);
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (!this.base) this.layout();
      this.pushUndo();
      const ctx = this.base.getContext('2d');
      ctx.fillStyle = '#f4e7cf';
      ctx.fillRect(0, 0, this.base.width, this.base.height);
      const scale = Math.min(this.base.width / image.width, this.base.height / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      ctx.drawImage(image, (this.base.width - dw) / 2, (this.base.height - dh) / 2, dw, dh);
      this.render();
      this.setStatus('Photo is the base. Paint over it with the brush.', false);
    } catch (err) {
      this.setStatus('That photo could not be opened.', true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async makeObject() {
    if (!this.trialOpen()) return;
    const input = document.getElementById('paintObjectPrompt');
    const button = document.getElementById('paintMakeObject');
    const text = (input && input.value.trim()) || '';
    if (!text) {
      this.setStatus('Name an object first, such as a golden sword or a wizard hat.', true);
      if (input) input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'Making…';
    this.setStatus('Making “' + text + '”…', false);
    try {
      let canvas;
      try {
        const result = await generateSticker(text, this.objectSeed);
        canvas = result.bitmap;
        this.objectSeed += 1;
        this.setStatus('Object ready. Drag it into place, then paint over it.', false);
      } catch (err) {
        if (err instanceof GenerateError && err.code === 'blocked') throw err;
        canvas = localStandIn(text, 512, 512, 'object');
        const message = err && err.message ? err.message : 'The free service did not answer.';
        this.setStatus(message + ' A local object was placed instead.', true);
      }
      rememberObject(canvas, text);
      this.addItem(canvas, text);
    } catch (err) {
      this.setStatus(err && err.message ? err.message : 'That object could not be made.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Make object';
    }
  }

  renderObjectShelf() {
    const host = document.getElementById('paintObjects');
    if (!host) return;
    host.innerHTML = '';
    if (!recentObjects.length) {
      host.innerHTML = '<p class="hint">Objects you make show up here.</p>';
      return;
    }
    recentObjects.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'paint-thumb';
      button.title = entry.name;
      const thumb = document.createElement('canvas');
      thumb.width = 72;
      thumb.height = 72;
      thumb.getContext('2d').drawImage(entry.canvas, 0, 0, 72, 72);
      button.appendChild(thumb);
      button.addEventListener('click', () => this.addItem(entry.canvas, entry.name));
      host.appendChild(button);
    });
  }

  buildStickerShelf() {
    const host = document.getElementById('paintStickers');
    if (!host) return;
    host.innerHTML = '';
    stickerList().forEach((sticker) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'paint-thumb';
      button.title = sticker.name;
      const source = stickerCanvas(sticker.id, 72);
      const thumb = document.createElement('canvas');
      thumb.width = 72;
      thumb.height = 72;
      thumb.getContext('2d').drawImage(source, 0, 0);
      button.appendChild(thumb);
      button.addEventListener('click', () => {
        this.addItem(stickerCanvas(sticker.id, 384), sticker.name);
      });
      host.appendChild(button);
    });
  }

  render() {
    if (!this.base) return;
    const ctx = this.view.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    ctx.drawImage(this.base, 0, 0);
    this.items.forEach((item) => this.drawItem(ctx, item, false));
    ctx.drawImage(this.ink, 0, 0);
    if (this.tool === 'move') {
      const item = this.selected();
      if (item) this.strokeBounds(ctx, item);
    }
  }

  drawItem(ctx, item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot || 0);
    ctx.drawImage(item.image, -item.w / 2, -item.h / 2, item.w, item.h);
    ctx.restore();
  }

  strokeBounds(ctx, item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot || 0);
    ctx.strokeStyle = '#6b3e12';
    ctx.lineWidth = Math.max(2, this.view.width / 400);
    ctx.strokeRect(-item.w / 2, -item.h / 2, item.w, item.h);
    ctx.restore();
  }

  flatten() {
    const out = document.createElement('canvas');
    out.width = this.base.width;
    out.height = this.base.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(this.base, 0, 0);
    this.items.forEach((item) => this.drawItem(ctx, item, false));
    ctx.drawImage(this.ink, 0, 0);
    return out;
  }

  savePng() {
    if (!this.trialOpen() || !this.base) return;
    this.flatten().toBlob((blob) => {
      if (!blob) {
        this.setStatus('The PNG could not be saved.', true);
        return;
      }
      downloadBlob(blob, 'meme-crucible-painting.png');
      this.setStatus('PNG saved.', false);
    }, 'image/png');
  }

  sendToMeme(mode) {
    if (!this.trialOpen() || !this.base) return;
    const image = this.flatten();
    if (mode === 'base') this.editor.setBaseImage(image, 'Painting');
    else this.editor.addImageLayer(image, 'Painting', 0.72);
    this.close();
    this.editor.toast(mode === 'base' ? 'Painting is the meme base.' : 'Painting added to the meme.');
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = url;
  });
}
