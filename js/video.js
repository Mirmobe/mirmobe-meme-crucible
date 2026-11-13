import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.js';
import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.js';

export function evenSize(w, h, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  let W = Math.max(2, Math.round((w * scale) / 2) * 2);
  let H = Math.max(2, Math.round((h * scale) / 2) * 2);
  return { width: W, height: H };
}

function mime(kind) {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = kind === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find((item) => MediaRecorder.isTypeSupported(item)) || '';
}

export function formatSupport() {
  const webm = mime('webm');
  const mp4Recorder = mime('mp4');
  const mp4Encoder = typeof VideoEncoder !== 'undefined';
  const capture = typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  const webmOk = Boolean((webm && capture) || mp4Encoder);
  const mp4Ok = Boolean(mp4Encoder || (mp4Recorder && capture));
  return {
    webm: webmOk,
    mp4: mp4Ok,
    gif: true,
    webmMime: webm,
    mp4Mime: mp4Recorder,
    mp4Encoder,
    capture,
    note: supportNote({ webm: webmOk, mp4: mp4Ok, capture, mp4Encoder })
  };
}

function supportNote(s) {
  const parts = [];
  parts.push('PNG and JPG work in current browsers.');
  if (s.webm) parts.push('WebM is encoded with WebCodecs when VP8 or VP9 is available, and otherwise with MediaRecorder.');
  else parts.push('WebM needs WebCodecs (VP8 or VP9) or MediaRecorder canvas capture.');
  if (s.mp4Encoder) parts.push('MP4 is encoded on this device with WebCodecs.');
  else if (s.mp4) parts.push('MP4 uses the browser recorder.');
  else parts.push('MP4 needs WebCodecs or a browser that records MP4 (Safari 14.5+).');
  parts.push('GIF is encoded here at a smaller size and lower frame rate. iOS share sheets only accept files when the system allows it.');
  if (!s.capture && !s.mp4Encoder) parts.push('This browser will still make a GIF if video recording is unavailable.');
  return parts.join(' ');
}

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function recordWithMediaRecorder({ canvas, mimeType, duration, drawAt, onProgress, signal, fps }) {
  if (!canvas.captureStream) {
    throw new Error('This browser cannot record a canvas stream.');
  }
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:4px;overflow:hidden;opacity:0.01;pointer-events:none';
  holder.appendChild(canvas);
  document.body.appendChild(holder);
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_500_000 });
  const chunks = [];
  rec.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve, reject) => {
    rec.addEventListener('stop', resolve, { once: true });
    rec.addEventListener('error', () => reject(new Error('The recorder stopped unexpectedly.')), { once: true });
  });
  await drawAt(0);
  rec.start(200);
  const frameMs = Math.max(16, Math.round(1000 / fps));
  const started = performance.now();
  while (!signal.aborted) {
    const t = (performance.now() - started) / 1000;
    if (t >= duration) break;
    await drawAt(Math.min(t, duration));
    onProgress(Math.min(0.96, t / duration));
    await new Promise((resolve) => setTimeout(resolve, frameMs));
  }
  await drawAt(duration);
  if (typeof rec.requestData === 'function' && rec.state === 'recording') rec.requestData();
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (rec.state !== 'inactive') rec.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  holder.remove();
  if (signal.aborted) {
    const error = new Error('Cancelled');
    error.name = 'AbortError';
    throw error;
  }
  if (!chunks.length) throw new Error('The recorder produced an empty file.');
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}

async function recordMp4WithWebCodecs({ canvas, fps, duration, drawAt, onProgress, signal }) {
  const width = canvas.width;
  const height = canvas.height;
  const codecs = ['avc1.42001f', 'avc1.42E01E', 'avc1.4d001f', 'avc1.640028'];
  const accelerations = ['prefer-software', 'prefer-hardware'];
  let chosen = null;
  for (const acceleration of accelerations) {
    for (const codec of codecs) {
      const withAvc = { codec, width, height, bitrate: 2_400_000, framerate: fps, hardwareAcceleration: acceleration, latencyMode: 'quality', avc: { format: 'avc' } };
      const plain = { codec, width, height, bitrate: 2_400_000, framerate: fps, hardwareAcceleration: acceleration, latencyMode: 'quality' };
      try {
        const a = await VideoEncoder.isConfigSupported(withAvc);
        if (a.supported) { chosen = withAvc; break; }
      } catch (err) { /* try the next config */ }
      try {
        const b = await VideoEncoder.isConfigSupported(plain);
        if (b.supported) { chosen = plain; break; }
      } catch (err) { /* try the next codec */ }
    }
    if (chosen) break;
  }
  if (!chosen) throw new Error('This device has no H.264 encoder.');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  });
  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => { encoderError = err; }
  });
  encoder.configure(chosen);
  const frames = Math.max(1, Math.round(duration * fps));
  const frameDuration = Math.round(1_000_000 / fps);
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      const error = new Error('Cancelled');
      error.name = 'AbortError';
      throw error;
    }
    if (encoderError) throw encoderError;
    await drawAt(i / fps);
    const frame = new VideoFrame(canvas, { timestamp: i * frameDuration, duration: frameDuration });
    encoder.encode(frame, { keyFrame: i % Math.max(1, fps) === 0 });
    frame.close();
    onProgress((i + 1) / frames);
    while (encoder.encodeQueueSize > 6) await yieldToUi();
    if (i % 2 === 0) await yieldToUi();
  }
  if (encoderError) throw encoderError;
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}

async function recordWebmWithWebCodecs({ canvas, fps, duration, drawAt, onProgress, signal }) {
  const { Muxer, ArrayBufferTarget } = await import('./vendor/webm-muxer.js');
  const width = canvas.width;
  const height = canvas.height;
  const candidates = [
    { codec: 'vp09.00.10.08', mux: 'V_VP9' },
    { codec: 'vp8', mux: 'V_VP8' },
    { codec: 'vp09.00.41.08', mux: 'V_VP9' }
  ];
  let chosen = null;
  let muxCodec = '';
  for (const acceleration of ['prefer-software', 'prefer-hardware']) {
    for (const item of candidates) {
      const cfg = {
        codec: item.codec,
        width,
        height,
        bitrate: 2_000_000,
        framerate: fps,
        hardwareAcceleration: acceleration,
        latencyMode: 'quality'
      };
      try {
        const supported = await VideoEncoder.isConfigSupported(cfg);
        if (supported.supported) {
          chosen = cfg;
          muxCodec = item.mux;
          break;
        }
      } catch (err) { /* try the next config */ }
    }
    if (chosen) break;
  }
  if (!chosen) throw new Error('This device has no VP8 or VP9 encoder.');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: muxCodec, width, height, frameRate: fps },
    firstTimestampBehavior: 'offset'
  });
  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => { encoderError = err; }
  });
  encoder.configure(chosen);
  const frames = Math.max(1, Math.round(duration * fps));
  const frameDuration = Math.round(1_000_000 / fps);
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      const error = new Error('Cancelled');
      error.name = 'AbortError';
      throw error;
    }
    if (encoderError) throw encoderError;
    await drawAt(i / fps);
    const frame = new VideoFrame(canvas, { timestamp: i * frameDuration, duration: frameDuration });
    encoder.encode(frame, { keyFrame: i % Math.max(1, fps) === 0 });
    frame.close();
    onProgress((i + 1) / frames);
    while (encoder.encodeQueueSize > 6) await yieldToUi();
    if (i % 2 === 0) await yieldToUi();
  }
  if (encoderError) throw encoderError;
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/webm' });
}

async function recordGif({ canvas, fps, duration, drawAt, onProgress, signal }) {
  const gif = GIFEncoder({ auto: true });
  const frames = Math.max(1, Math.round(duration * fps));
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      const error = new Error('Cancelled');
      error.name = 'AbortError';
      throw error;
    }
    await drawAt(i / fps);
    const image = ctx.getImageData(0, 0, width, height);
    const palette = quantize(image.data, 64, { format: 'rgb565' });
    const index = applyPalette(image.data, palette, 'rgb565');
    gif.writeFrame(index, width, height, { palette, delay: Math.round(1000 / fps), repeat: 0 });
    onProgress((i + 1) / frames);
    await yieldToUi();
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

export async function exportAnimation(options) {
  const { format, fullWidth, fullHeight, duration, drawAt, onProgress, signal } = options;
  const support = formatSupport();
  const maxEdge = format === 'gif' ? 480 : 960;
  const fps = format === 'gif' ? 10 : 24;
  const size = evenSize(fullWidth, fullHeight, maxEdge);
  const plate = document.createElement('canvas');
  plate.width = size.width;
  plate.height = size.height;
  const paint = async (t) => { await drawAt(plate, t); };

  if (format === 'gif') {
    return recordGif({ canvas: plate, fps, duration, drawAt: paint, onProgress, signal });
  }
  let codecError = null;
  if (format === 'mp4' && support.mp4Encoder) {
    try {
      return await recordMp4WithWebCodecs({ canvas: plate, fps, duration, drawAt: paint, onProgress, signal });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      codecError = err;
      if (!support.mp4Mime) throw err;
    }
  }
  if (format === 'mp4' && support.mp4Mime) {
    try {
      return await recordWithMediaRecorder({ canvas: plate, mimeType: support.mp4Mime, duration, fps, drawAt: paint, onProgress, signal });
    } catch (err) {
      if (codecError) {
        const wrapped = new Error(codecError.message + ' Recorder fallback: ' + err.message);
        wrapped.name = err.name || 'Error';
        throw wrapped;
      }
      throw err;
    }
  }
  if (format === 'webm' && support.mp4Encoder) {
    try {
      return await recordWebmWithWebCodecs({ canvas: plate, fps, duration, drawAt: paint, onProgress, signal });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      if (!support.webmMime) throw err;
    }
  }
  if (format === 'webm' && support.webmMime) {
    return recordWithMediaRecorder({ canvas: plate, mimeType: support.webmMime, duration, fps, drawAt: paint, onProgress, signal });
  }
  throw new Error(format.toUpperCase() + ' is not available in this browser. Try GIF.');
}
