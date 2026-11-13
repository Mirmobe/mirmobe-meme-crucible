# Meme Crucible

A static meme forge for pictures and short clips. Original wizard-and-forge art, no account, no server. It is an app for making images. **Apps, not investments.**

Live site: [mirmobe.github.io/mirmobe-meme-crucible](https://mirmobe.github.io/mirmobe-meme-crucible/)

## What you can do

- Drag, resize, and rotate every layer. Reorder, duplicate, flip, undo, and redo.
- Several text boxes, each with font, size, color, outline, shadow, and alignment.
- Cast: Questo, Soot, Cinder, and Kindle. A sticker shelf of forge props. Scene plates and a few generated backdrops.
- Filters and frames: brightness and contrast, glow, vignette, deep-fry, retro, comic halftone, and others.
- Aspect presets: square, 16:9, 9:16 story, and an X post frame.
- Template gallery.
- Upload from the file picker, drag-and-drop, or paste (when the browser exposes an image on the clipboard). Use it as the base or as its own layer. A short video can be the base of a video meme.
- Download PNG or JPG, or share the PNG when the browser allows file sharing.
- Video memes, entirely on device: zoom, pan, shake, text pop-in, sparks, and embers. Caption timing per text layer. Export WebM, MP4, or GIF, with a progress bar and cancel.
- Generate with AI: a prompt and a style (cartoon realistic, comic, pixel art, anime, oil painting, or 3D render). The picture comes from Pollinations' free classic image endpoint, with no API key. Use it as the base or as a layer, or roll a new seed. Suggest captions uses their free text endpoint. The trial gates this the same way as the rest of the app.

The free image service draws at most a 768×768 area, keeps the current frame's aspect ratio, allows about one image every 45 seconds and one caption request every 30 seconds, and may stamp a small Pollinations mark even when `nologo=true` is sent. It is best-effort, with no uptime promise. Prompts are sent to that service and the same URL can be cached publicly. A client-side filter blocks obvious sexual content, sexual or exploitative content involving minors, real-person deepfake requests, and hate. Pollinations applies its own filter as well (`safe=true`).

Heavy pieces (the other scenes, the cast, the sticker raster, and the video encoder) load after the first picture is on screen.

## Trial and unlock

The five-minute sample, the one-time share bonus of five more minutes, and the 0.05 SOL unlock are the same rules as before.

- Time counts only while the tab is visible.
- A signature can be used once in that browser.
- The transaction must have succeeded, be newer than seven days, and show at least 0.05 SOL gained by `5P1ArCLapXPjSEaNauVYAmtLKxEwoELcttQvPqmF1VYP`, including addresses loaded into the transaction.

The unlock buys use of the app. It is not an investment and the page does not make claims about price.

## Browser notes

- PNG, JPG, text, stickers, and uploads work in current Chrome, Edge, Firefox, and Safari.
- WebM prefers WebCodecs (VP9 or VP8) and falls back to `MediaRecorder` plus `canvas.captureStream`. The fallback records in real time, so a slow device drops frames. Chrome, Edge, and Firefox support one of these paths. Safari usually has no WebM encoder; use MP4 or GIF there.
- MP4 prefers WebCodecs (H.264) and falls back to a browser that can record `video/mp4` (Safari 14.5 and newer). Headless or software-only GPUs may only expose a software H.264 encoder, which is slower.
- GIF is encoded in JavaScript at a smaller size and about 10 frames a second, so long clips take longer and look softer.
- Paste of images depends on the browser. iOS often only pastes images in some fields; the file picker is the reliable path.
- The share button sends a file only when `navigator.canShare({ files })` is true. Otherwise it downloads the PNG.
- Very old browsers without canvas capture or WebCodecs can still export a GIF.
- AI pictures need the browser to reach `image.pollinations.ai` and `text.pollinations.ai`. The picture is fetched as a blob and copied onto a canvas before it is used, so PNG, JPG, and video export stay untainted. If the service is slow, down, or asking for a short wait, the panel shows an error and a Retry button.

## Hosting

GitHub Pages, from the repository root. Paths are relative, so the project site works without a build step.

```bash
npx serve .
```
