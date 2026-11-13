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

export function imageRequestUrl(prompt, styleId, width, height, seed) {
  const style = AI_STYLES.find((item) => item.id === styleId) || AI_STYLES[0];
  const full = prompt + ', ' + style.suffix;
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

export async function generateImage({ prompt, styleId, width, height, seed, signal }) {
  const review = reviewPrompt(prompt);
  if (!review.ok) throw new GenerateError(review.reason, 'blocked');
  const gap = waitLeft(nextImageAt);
  if (gap > 0) {
    throw new GenerateError('The free image service allows about one picture every 45 seconds.', 'wait', gap);
  }
  const size = fitServiceSize(width, height);
  const url = imageRequestUrl(review.text, styleId, size.width, size.height, seed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  nextImageAt = Date.now() + IMAGE_GAP_MS;
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
    if (!res.ok) throw new GenerateError('The free image service refused that request. Try again, or change the prompt.', 'down');
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('image/')) {
      throw new GenerateError('The free image service did not return a picture. It may be busy. Retry in a moment.', 'down');
    }
    const blob = await res.blob();
    if (!blob.size) throw new GenerateError('The free image service sent an empty picture. Retry in a moment.', 'down');
    const bitmap = await ownedBitmap(blob);
    return { bitmap, width: size.width, height: size.height, seed };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new GenerateError('The free image service is slow or unavailable. Retry in a moment.', 'down');
    }
    if (err && err.name === 'SecurityError') {
      throw new GenerateError('That picture could not be copied onto the canvas. Retry in a moment.', 'taint');
    }
    if (err instanceof GenerateError) throw err;
    throw new GenerateError('The free image service could not be reached. Retry in a moment.', 'down');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
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

  async function runGenerate() {
    if (!trialOpen() || busy) return;
    stopWait();
    const controller = new AbortController();
    requestAbort = controller;
    busy = true;
    generateBtn.disabled = true;
    seedBtn.disabled = true;
    retryBtn.hidden = true;
    setStatus('Asking the free image service… ' + seedLine(), false);
    try {
      const result = await generateImage({
        prompt: promptEl.value,
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
      if (err && err.retryAfterMs) armWait(err.retryAfterMs, message);
      editor.toast(message);
    } finally {
      busy = false;
      generateBtn.disabled = false;
      seedBtn.disabled = false;
      requestAbort = null;
    }
  }

  generateBtn.addEventListener('click', () => { runGenerate(); });
  retryBtn.addEventListener('click', () => { runGenerate(); });
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
