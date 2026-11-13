export const ASPECTS = {
  square: { w: 1080, h: 1080, label: 'Square' },
  wide: { w: 1280, h: 720, label: '16:9' },
  story: { w: 720, h: 1280, label: 'Story' },
  xpost: { w: 1200, h: 675, label: 'X post' }
};

export const FONTS = [
  { id: 'Impact, "Arial Black", sans-serif', label: 'Impact' },
  { id: '"Arial Black", Impact, sans-serif', label: 'Black' },
  { id: '"Lilita One", Impact, sans-serif', label: 'Lilita' },
  { id: 'Bangers, Impact, cursive', label: 'Bangers' },
  { id: '"Pirata One", serif', label: 'Pirata' },
  { id: 'MedievalSharp, serif', label: 'Medieval' },
  { id: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  { id: 'Quicksand, "Segoe UI", sans-serif', label: 'Quicksand' }
];

export const BACKGROUNDS = [
  { id: 'forge', name: 'Hearth hall', src: 'assets/bg-forge.jpg' },
  { id: 'story', name: 'Hung crucible', src: 'assets/bg-story.jpg' },
  { id: 'workshop', name: 'Moon workshop', src: 'assets/bg-workshop.jpg' },
  { id: 'cavern', name: 'Gold cavern', src: 'assets/bg-cavern.jpg' },
  { id: 'dawn', name: 'Dawn cottage', src: 'assets/bg-dawn.jpg' },
  { id: 'cosmos', name: 'Bowl of stars', src: 'assets/bg-cosmos.jpg' },
  { id: 'bench', name: 'Night bench', src: 'assets/bg-bench.jpg' },
  { id: 'void', name: 'Night ink', procedural: true },
  { id: 'embers', name: 'Coal glow', procedural: true }
];

export const CHARACTERS = [
  { id: 'questo', name: 'Questo', src: 'assets/questo.webp', note: 'Ash hood, crucible, short hammer' },
  { id: 'apprentice', name: 'Soot', src: 'assets/apprentice.webp', note: 'Apprentice with goggles' },
  { id: 'fox', name: 'Cinder', src: 'assets/cinder-fox.webp', note: 'Charcoal fox' },
  { id: 'beetle', name: 'Kindle', src: 'assets/ember-beetle.webp', note: 'Copper-seam beetle' }
];

const imageCache = new Map();

export function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const pending = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + src));
    img.src = src;
  });
  imageCache.set(src, pending);
  return pending;
}

export function drawProceduralBackground(ctx, w, h, id) {
  if (id === 'embers') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a120e');
    g.addColorStop(0.55, '#2a140f');
    g.addColorStop(1, '#0c0908');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.72, 10, w * 0.5, h * 0.78, w * 0.55);
    glow.addColorStop(0, 'rgba(255, 150, 40, 0.85)');
    glow.addColorStop(0.35, 'rgba(180, 50, 12, 0.45)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const x = ((i * 97) % 1000) / 1000 * w;
      const y = h * 0.62 + ((i * 53) % 100) / 100 * h * 0.32;
      const r = 4 + (i % 7) * 2;
      const coal = ctx.createRadialGradient(x, y, 1, x, y, r);
      coal.addColorStop(0, i % 4 === 0 ? '#ffe08a' : '#ff7a2a');
      coal.addColorStop(1, 'rgba(40,8,4,0)');
      ctx.fillStyle = coal;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  g.addColorStop(0, '#2a2150');
  g.addColorStop(0.55, '#140e22');
  g.addColorStop(1, '#07060d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 214, 140, 0.8)';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 131) % 997) / 997 * w;
    const y = ((i * 79) % 991) / 991 * h;
    ctx.globalAlpha = 0.25 + (i % 5) * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, (i % 3) + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function coverImage(ctx, img, w, h) {
  const ir = img.width / img.height;
  const r = w / h;
  let dw;
  let dh;
  let dx;
  let dy;
  if (ir > r) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    dw = w;
    dh = w / ir;
    dx = 0;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}
