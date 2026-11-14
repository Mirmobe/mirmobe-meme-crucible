import { reviewPrompt } from './safety.js';

const IMAGE_ORIGIN = 'https://image.pollinations.ai/prompt/';
const TEXT_URL = 'https://text.pollinations.ai/openai';
const MAX_AREA = 768 * 768;
const IMAGE_GAP_MS = 45000;
const TEXT_GAP_MS = 30000;
const IMAGE_TIMEOUT_MS = 70000;
const TEXT_TIMEOUT_MS = 30000;

export const AI_STYLES = [
  { id: 'cartoon', name: 'Cartoon realistic', suffix: 'polished semi-realistic cartoon illustration, soft lighting, depth, painterly texture, original design, not a copy of any existing character' },
  { id: 'comic', name: 'Comic', suffix: 'original comic illustration, bold ink lines, halftone shading, printed paper texture' },
  { id: 'pixel', name: 'Pixel art', suffix: 'detailed original pixel art, crisp pixels, limited palette' },
  { id: 'anime', name: 'Anime', suffix: 'original anime illustration, clean linework, soft cel shading, not based on any existing series or character' },
  { id: 'oil', name: 'Oil painting', suffix: 'traditional oil painting, visible brushstrokes, warm light, canvas texture' },
  { id: 'render', name: '3D render', suffix: 'stylized original 3D render, soft studio lighting, gentle depth of field' }
];

let nextImageAt = 0;
let nextTextAt = 0;

export function fitServiceSize(width, height) {
  const w = Math.max(2, width);
  const h = Math.max(2, height);
  const scale = Math.min(1, Math.sqrt(MAX_AREA / (w * h)));
  let outW = Math.max(64, Math.round((w * scale) / 8) * 8);
  let outH = Math.max(64, Math.round((h * scale) / 8) * 8);
  while (outW * outH > MAX_AREA && (outW > 64 || outH > 64)) {
    if (outW >= outH) outW -= 8;
    else outH -= 8;
  }
  return { width: outW, height: outH };
}

export function imageRequestUrl(prompt, styleId, width, height, seed, bare) {
  const style = AI_STYLES.find((item) => item.id === styleId) || AI_STYLES[0];
  const full = bare ? prompt : prompt + ', ' + style.suffix;
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: 'true',
    safe: 'true'
  });
  return IMAGE_ORIGIN + encodeURIComponent(full) + '?' + params.toString();
}

function waitLeft(until) {
  return Math.max(0, until - Date.now());
}

export class GenerateError extends Error {
  constructor(message, code, retryAfterMs) {
    super(message);
    this.name = 'GenerateError';
    this.code = code;
    this.retryAfterMs = retryAfterMs || 0;
  }
}

async function ownedBitmap(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new GenerateError('The picture arrived damaged. Retry in a moment.', 'bad-image'));
    });
    image.src = url;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    ctx.getImageData(0, 0, 1, 1);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const OBJECT_SUFFIX = 'single object centered, isolated on a plain white background, sticker, no text, no scenery, no cast shadow, original design';

async function fetchPicture(url, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'image/jpeg,image/png,image/*' },
      signal: controller.signal
    });
    if (res.status === 402) {
      const retrySec = Number(res.headers.get('retry-after')) || 45;
      const retryMs = Math.max(IMAGE_GAP_MS, retrySec * 1000);
      nextImageAt = Date.now() + retryMs;
      throw new GenerateError('The free image service needs a short rest before the next picture.', 'wait', retryMs);
    }
    if (!res.ok) throw new GenerateError('The free image service refused that request. Try again, or use the local stand-in.', 'down');
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('image/')) {
      throw new GenerateError('The free image service did not return a picture. It may be busy. Retry, or use the local stand-in.', 'down');
    }
    const blob = await res.blob();
    if (!blob.size) throw new GenerateError('The free image service sent an empty picture. Retry, or use the local stand-in.', 'down');
    return ownedBitmap(blob);
  } catch (err) {
    if (err instanceof GenerateError) throw err;
    if (err && err.name === 'AbortError') {
      throw new GenerateError('The free image service is slow or unavailable. Retry, or use the local stand-in.', 'down');
    }
    if (err && err.name === 'SecurityError') {
      throw new GenerateError('That picture could not be copied onto the canvas. Retry, or use the local stand-in.', 'taint');
    }
    throw new GenerateError('The free image service could not be reached. Retry, or use the local stand-in.', 'down');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function generateImage({ prompt, styleId, width, height, seed, signal, bare, skipReview }) {
  const review = skipReview ? { ok: true, text: String(prompt || '').trim() } : reviewPrompt(prompt);
  if (!review.ok) throw new GenerateError(review.reason, 'blocked');
  const gap = waitLeft(nextImageAt);
  if (gap > 0) {
    throw new GenerateError('The free image service allows about one picture every 45 seconds.', 'wait', gap);
  }
  const size = fitServiceSize(width, height);
  const primary = imageRequestUrl(review.text, styleId, size.width, size.height, seed, bare);
  const smaller = fitServiceSize(Math.round(size.width * 0.67), Math.round(size.height * 0.67));
  const backup = imageRequestUrl(review.text, styleId, smaller.width, smaller.height, Number(seed) + 1, bare);
  nextImageAt = Date.now() + 4000;
  try {
    let bitmap;
    try {
      bitmap = await fetchPicture(primary, signal);
    } catch (err) {
      if (err instanceof GenerateError && (err.code === 'wait' || err.code === 'blocked')) throw err;
      bitmap = await fetchPicture(backup, signal);
    }
    nextImageAt = Date.now() + IMAGE_GAP_MS;
    return { bitmap, width: bitmap.width || size.width, height: bitmap.height || size.height, seed, source: 'service' };
  } catch (err) {
    if (!(err instanceof GenerateError) || err.code !== 'wait') nextImageAt = Date.now();
    throw err;
  }
}

export function knockOutBackground(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width || source.naturalWidth;
  canvas.height = source.height || source.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  const w = canvas.width;
  const h = canvas.height;
  const samples = [];
  const stepX = Math.max(1, Math.floor(w / 24));
  const stepY = Math.max(1, Math.floor(h / 24));
  for (let x = 0; x < w; x += stepX) samples.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2]], [data[((h - 1) * w + x) * 4], data[((h - 1) * w + x) * 4 + 1], data[((h - 1) * w + x) * 4 + 2]]);
  for (let y = 0; y < h; y += stepY) samples.push([data[y * w * 4], data[y * w * 4 + 1], data[y * w * 4 + 2]], [data[(y * w + w - 1) * 4], data[(y * w + w - 1) * 4 + 1], data[(y * w + w - 1) * 4 + 2]]);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  samples.forEach((sample) => { sr += sample[0]; sg += sample[1]; sb += sample[2]; });
  sr /= samples.length;
  sg /= samples.length;
  sb /= samples.length;
  const tol = 46 * 46;
  const seen = new Uint8Array(w * h);
  const stack = [];
  function consider(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (data[i + 3] < 12) {
      stack.push(p);
      return;
    }
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    if (dr * dr + dg * dg + db * db <= tol) stack.push(p);
  }
  for (let x = 0; x < w; x += 1) { consider(x, 0); consider(x, h - 1); }
  for (let y = 0; y < h; y += 1) { consider(0, y); consider(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function paintShape(ctx, kind, w, h) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  if (kind === 'sword') {
    ctx.fillStyle = '#f3d48a';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.42);
    ctx.lineTo(w * 0.07, h * 0.16);
    ctx.lineTo(0, h * 0.24);
    ctx.lineTo(-w * 0.07, h * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect(-w * 0.015, -h * 0.34, w * 0.03, h * 0.5);
    ctx.fillStyle = '#6b3a12';
    ctx.fillRect(-w * 0.14, h * 0.2, w * 0.28, h * 0.045);
    ctx.fillStyle = '#3a2414';
    ctx.fillRect(-w * 0.03, h * 0.24, w * 0.06, h * 0.16);
  } else if (kind === 'hat') {
    ctx.fillStyle = '#3d2a86';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.38);
    ctx.lineTo(w * 0.22, h * 0.12);
    ctx.lineTo(-w * 0.22, h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c14b';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.14, w * 0.34, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4c8';
    ctx.beginPath();
    ctx.arc(0, -h * 0.02, w * 0.035, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'star') {
    ctx.fillStyle = '#f2c14b';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? Math.min(w, h) * 0.38 : Math.min(w, h) * 0.16;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'cup') {
    ctx.fillStyle = '#d8d2c8';
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, -h * 0.12);
    ctx.lineTo(-w * 0.14, h * 0.22);
    ctx.quadraticCurveTo(0, h * 0.34, w * 0.14, h * 0.22);
    ctx.lineTo(w * 0.18, -h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8d8680';
    ctx.lineWidth = Math.max(4, w * 0.03);
    ctx.beginPath();
    ctx.arc(w * 0.22, h * 0.02, w * 0.1, -1.2, 1.2);
    ctx.stroke();
  } else if (kind === 'shield') {
    ctx.fillStyle = '#8f2d22';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.34);
    ctx.lineTo(w * 0.28, -h * 0.18);
    ctx.lineTo(w * 0.22, h * 0.16);
    ctx.quadraticCurveTo(0, h * 0.4, -w * 0.22, h * 0.16);
    ctx.lineTo(-w * 0.28, -h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c14b';
    ctx.beginPath();
    ctx.arc(0, -h * 0.02, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'flame') {
    ctx.fillStyle = '#e25822';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.bezierCurveTo(w * 0.28, -h * 0.05, w * 0.18, h * 0.28, 0, h * 0.36);
    ctx.bezierCurveTo(-w * 0.18, h * 0.28, -w * 0.28, -h * 0.05, 0, -h * 0.4);
    ctx.fill();
    ctx.fillStyle = '#f6d36b';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.08);
    ctx.bezierCurveTo(w * 0.1, h * 0.08, w * 0.06, h * 0.24, 0, h * 0.28);
    ctx.bezierCurveTo(-w * 0.06, h * 0.24, -w * 0.1, h * 0.08, 0, -h * 0.08);
    ctx.fill();
  } else {
    ctx.fillStyle = '#3d7a78';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.34);
    ctx.lineTo(w * 0.24, 0);
    ctx.lineTo(0, h * 0.34);
    ctx.lineTo(-w * 0.24, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d7fff8';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.16);
    ctx.lineTo(w * 0.1, 0);
    ctx.lineTo(0, h * 0.16);
    ctx.lineTo(-w * 0.1, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function objectKind(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (/sword|blade|dagger|knife/.test(text)) return 'sword';
  if (/hat|hood|cap|wizard/.test(text)) return 'hat';
  if (/star/.test(text)) return 'star';
  if (/cup|mug|chalice|goblet/.test(text)) return 'cup';
  if (/shield/.test(text)) return 'shield';
  if (/flame|fire|ember/.test(text)) return 'flame';
  return 'gem';
}

export function localStandIn(prompt, width, height, mode) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, width);
  canvas.height = Math.max(64, height);
  const ctx = canvas.getContext('2d');
  if (mode === 'object') {
    paintShape(ctx, objectKind(prompt), canvas.width, canvas.height);
    return canvas;
  }
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#2a2144');
  sky.addColorStop(0.55, '#6a3a28');
  sky.addColorStop(1, '#1a120c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3a2414';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.78, canvas.width * 0.46, canvas.height * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a4b22';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.58, canvas.width * 0.16, canvas.height * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e6b23c';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.5, canvas.height * 0.56, canvas.width * 0.08, canvas.height * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6edd8';
  ctx.font = '700 ' + Math.max(18, Math.round(canvas.width * 0.045)) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(prompt || 'A forge picture').slice(0, 42), canvas.width / 2, canvas.height * 0.16);
  ctx.font = '700 ' + Math.max(14, Math.round(canvas.width * 0.03)) + 'px sans-serif';
  ctx.fillText('Local stand-in', canvas.width / 2, canvas.height * 0.9);
  return canvas;
}

export const recentObjects = [];

export function rememberObject(canvas, name) {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d').drawImage(canvas, 0, 0);
  recentObjects.unshift({ canvas: copy, name: name || 'Object' });
  if (recentObjects.length > 8) recentObjects.pop();
  document.dispatchEvent(new CustomEvent('mmc-object'));
  return copy;
}

export async function generateSticker(prompt, seed, signal) {
  const review = reviewPrompt(prompt);
  if (!review.ok) throw new GenerateError(review.reason, 'blocked');
  const result = await generateImage({
    prompt: review.text + ', ' + OBJECT_SUFFIX,
    styleId: 'cartoon',
    width: 512,
    height: 512,
    seed,
    signal,
    bare: true,
    skipReview: true
  });
  return { bitmap: knockOutBackground(result.bitmap), seed: result.seed, source: 'service' };
}

function collectStrings(value, into) {
  if (!value) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { collectStrings(JSON.parse(trimmed), into); return; } catch (err) { /* keep the raw line */ }
    }
    trimmed.split(/\n+/).forEach((line) => {
      const clean = line.replace(/^[\s\-"'\d\.\)\]]+/, '').trim();
      if (clean.length >= 2 && clean.length <= 80) into.push(clean);
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, into));
    return;
  }
  if (typeof value === 'object') {
    ['captions', 'lines', 'suggestions', 'content', 'text'].forEach((key) => {
      if (value[key]) collectStrings(value[key], into);
    });
  }
}

export function captionsFromPayload(payload) {
  const bag = [];
  let data = payload;
  if (data && data.choices && data.choices[0] && data.choices[0].message) {
    data = data.choices[0].message.content;
  }
  collectStrings(data, bag);
  const unique = [];
  bag.forEach((line) => {
    if (unique.some((item) => item.toLowerCase() === line.toLowerCase())) return;
    if (!reviewPrompt(line).ok && reviewPrompt(line).reason.indexOf('Describe') !== 0) return;
    unique.push(line);
  });
  return unique.slice(0, 5);
}

export async function suggestCaptions(prompt, signal) {
  const review = reviewPrompt(prompt);
  if (!review.ok) throw new GenerateError(review.reason, 'blocked');
  const gap = waitLeft(nextTextAt);
  if (gap > 0) {
    throw new GenerateError('The free caption service allows about one request every 30 seconds.', 'wait', gap);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEXT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  nextTextAt = Date.now() + TEXT_GAP_MS;
  try {
    const res = await fetch(TEXT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'Return only a JSON array of 4 short original meme captions. Each caption is under 42 characters. No sexual content, no minors, no real people, no slurs.'
          },
          { role: 'user', content: 'Meme idea: ' + review.text }
        ]
      }),
      signal: controller.signal
    });
    if (res.status === 402) {
      const retrySec = Number(res.headers.get('retry-after')) || 30;
      const retryMs = Math.max(TEXT_GAP_MS, retrySec * 1000);
      nextTextAt = Date.now() + retryMs;
      throw new GenerateError('The free caption service needs a short rest.', 'wait', retryMs);
    }
    if (!res.ok) throw new GenerateError('Caption suggestions are unavailable right now. Retry in a moment.', 'down');
    const payload = await res.json();
    const lines = captionsFromPayload(payload);
    if (lines.length < 3) throw new GenerateError('The caption service sent nothing usable. Retry in a moment.', 'down');
    return lines;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new GenerateError('Caption suggestions timed out. Retry in a moment.', 'down');
    }
    if (err instanceof GenerateError) throw err;
    throw new GenerateError('Caption suggestions could not be reached. Retry in a moment.', 'down');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

function byId(id) {
  return document.getElementById(id);
}

export function mountAi(editor) {
  const promptEl = byId('aiPrompt');
  const styleEl = byId('aiStyle');
  const generateBtn = byId('aiGenerate');
  const retryBtn = byId('aiRetry');
  const seedBtn = byId('aiSeed');
  const statusEl = byId('aiStatus');
  const preview = byId('aiPreview');
  const place = byId('aiPlace');
  const baseBtn = byId('aiBase');
  const layerBtn = byId('aiLayer');
  const captionBtn = byId('aiCaptions');
  const captionList = byId('aiCaptionList');
  const sizeNote = byId('aiSizeNote');
  const busyBar = byId('aiBusy');
  const standInBtn = byId('aiStandIn');
  const objectPrompt = byId('aiObjectPrompt');
  const objectBtn = byId('aiObject');
  if (!promptEl || !generateBtn) return;

  styleEl.innerHTML = AI_STYLES.map((style) => `<option value="${style.id}">${style.name}</option>`).join('');

  let seed = Math.floor(Math.random() * 1e9);
  let bitmap = null;
  let busy = false;
  let waitTimer = 0;
  let requestAbort = null;

  function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', Boolean(isError));
    statusEl.classList.toggle('is-busy', false);
  }

  function setBusy(on, label) {
    busy = on;
    generateBtn.disabled = on;
    seedBtn.disabled = on;
    if (objectBtn) objectBtn.disabled = on;
    generateBtn.textContent = on ? 'Generating…' : 'Generate';
    generateBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    if (busyBar) busyBar.hidden = !on;
    if (on) {
      statusEl.classList.add('is-busy');
      statusEl.classList.remove('is-error');
      statusEl.textContent = label || 'Making the picture…';
    }
  }

  function promptText() {
    const typed = promptEl.value.trim();
    if (typed) return typed;
    const example = (promptEl.getAttribute('placeholder') || '').trim();
    if (!example) return '';
    promptEl.value = example;
    return example;
  }

  function seedLine() {
    const size = fitServiceSize(editor.w, editor.h);
    return 'Seed ' + seed + ' · requested ' + size.width + '×' + size.height;
  }

  function refreshSize() {
    const size = fitServiceSize(editor.w, editor.h);
    sizeNote.textContent = 'Matched to this frame, within the free service limit of a 768×768 area: ' + size.width + '×' + size.height + '.';
  }

  function showPreview(canvas) {
    preview.src = canvas.toDataURL('image/jpeg', 0.86);
    preview.hidden = false;
    preview.alt = 'Generated picture';
    place.hidden = false;
    const panel = document.querySelector('.panel');
    if (panel) {
      const delta = promptEl.getBoundingClientRect().top - panel.getBoundingClientRect().top;
      panel.scrollTop += delta - 8;
    }
  }

  function stopWait() {
    clearInterval(waitTimer);
    waitTimer = 0;
  }

  function armWait(ms, prefix) {
    const until = Date.now() + ms;
    stopWait();
    retryBtn.hidden = false;
    const tick = () => {
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left <= 0) {
        stopWait();
        setStatus('Ready to try again.', false);
        return;
      }
      setStatus(prefix + ' Retry in ' + left + 's.', true);
    };
    tick();
    waitTimer = setInterval(tick, 400);
  }

  function trialOpen() {
    if (!document.body.classList.contains('paywalled')) return true;
    editor.toast('The trial is paused. Share or unlock to keep generating.');
    return false;
  }

  function useStandIn() {
    const text = promptText();
    if (!text) {
      setStatus('Describe a picture first.', true);
      return;
    }
    bitmap = localStandIn(text, fitServiceSize(editor.w, editor.h).width, fitServiceSize(editor.w, editor.h).height, 'scene');
    showPreview(bitmap);
    setStatus('Local stand-in is ready. It was drawn in this browser because the free service did not return a picture. Retry tries the service again.', true);
    editor.toast('Local stand-in ready. Set it as the base or add it as a layer.');
  }

  async function runGenerate() {
    if (!trialOpen() || busy) return;
    const text = promptText();
    if (!text) {
      setStatus('Describe a picture first.', true);
      editor.toast('Describe a picture first.');
      return;
    }
    stopWait();
    if (standInBtn) standInBtn.hidden = true;
    const controller = new AbortController();
    requestAbort = controller;
    setBusy(true, 'Making the picture… ' + seedLine());
    statusEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    retryBtn.hidden = true;
    try {
      const result = await generateImage({
        prompt: text,
        styleId: styleEl.value,
        width: editor.w,
        height: editor.h,
        seed,
        signal: controller.signal
      });
      bitmap = result.bitmap;
      showPreview(bitmap);
      setStatus('Picture ready. ' + seedLine() + '. The free service may still show a small mark.', false);
      editor.toast('Picture ready. Set it as the base or add it as a layer.');
    } catch (err) {
      const message = err && err.message ? err.message : 'The free image service is unavailable.';
      setStatus(message, true);
      retryBtn.hidden = false;
      if (standInBtn && (!err || err.code !== 'blocked')) standInBtn.hidden = false;
      if (err && err.retryAfterMs) armWait(err.retryAfterMs, message);
      editor.toast(message);
    } finally {
      setBusy(false);
      requestAbort = null;
    }
  }

  async function runObject() {
    if (!trialOpen() || busy) return;
    const text = (objectPrompt && objectPrompt.value.trim()) || '';
    if (!text) {
      setStatus('Name an object first, such as a golden sword or a wizard hat.', true);
      if (objectPrompt) objectPrompt.focus();
      return;
    }
    stopWait();
    const controller = new AbortController();
    requestAbort = controller;
    setBusy(true, 'Making “' + text + '”…');
    if (objectBtn) objectBtn.textContent = 'Making…';
    try {
      let sticker;
      try {
        const result = await generateSticker(text, seed, controller.signal);
        sticker = result.bitmap;
        setStatus('Object ready. It is a layer you can drag, resize, and rotate. The plain background was removed in the browser.', false);
      } catch (err) {
        if (err && err.code === 'blocked') throw err;
        sticker = localStandIn(text, 512, 512, 'object');
        const message = err && err.message ? err.message : 'The free service did not answer.';
        setStatus(message + ' A local object was placed instead. Retry the picture service from Generate when you want a service image.', true);
      }
      rememberObject(sticker, text);
      editor.addImageLayer(sticker, text, 0.34);
      editor.toast('Object added. Drag, resize, or rotate it.');
    } catch (err) {
      const message = err && err.message ? err.message : 'That object could not be made.';
      setStatus(message, true);
      editor.toast(message);
    } finally {
      setBusy(false);
      if (objectBtn) objectBtn.textContent = 'Make object';
      requestAbort = null;
    }
  }

  generateBtn.addEventListener('click', () => { runGenerate(); });
  retryBtn.addEventListener('click', () => { runGenerate(); });
  if (standInBtn) standInBtn.addEventListener('click', () => useStandIn());
  if (objectBtn) objectBtn.addEventListener('click', () => { runObject(); });
  seedBtn.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1e9);
    setStatus('New seed. ' + seedLine(), false);
    if (promptEl.value.trim()) runGenerate();
  });
  baseBtn.addEventListener('click', () => {
    if (!bitmap || !trialOpen()) return;
    editor.setBaseImage(bitmap, 'AI picture');
    editor.toast('AI picture set as the base.');
  });
  layerBtn.addEventListener('click', () => {
    if (!bitmap || !trialOpen()) return;
    editor.addImageLayer(bitmap, 'AI picture');
    editor.toast('AI picture added as a layer.');
  });
  captionBtn.addEventListener('click', async () => {
    if (!trialOpen() || busy) return;
    busy = true;
    captionBtn.disabled = true;
    setStatus('Asking for short captions…', false);
    try {
      const lines = await suggestCaptions(promptEl.value);
      captionList.innerHTML = '';
      lines.forEach((line) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip';
        button.textContent = line;
        button.addEventListener('click', () => {
          if (!trialOpen()) return;
          editor.addCaption(line);
        });
        captionList.appendChild(button);
      });
      setStatus('Tap a caption to drop it on the canvas.', false);
    } catch (err) {
      const message = err && err.message ? err.message : 'Caption suggestions are unavailable.';
      setStatus(message, true);
      retryBtn.hidden = false;
      if (err && err.retryAfterMs) armWait(err.retryAfterMs, message);
    } finally {
      busy = false;
      captionBtn.disabled = false;
    }
  });

  document.querySelectorAll('[data-aspect]').forEach((button) => {
    button.addEventListener('click', () => refreshSize());
  });
  refreshSize();
  setStatus(seedLine(), false);
}
