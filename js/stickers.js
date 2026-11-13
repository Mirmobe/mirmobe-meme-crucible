const STICKERS = [];

function add(id, name, draw) {
  STICKERS.push({ id, name, draw });
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

function rad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

function shadow(ctx, s, fn) {
  ctx.save();
  ctx.shadowColor = 'rgba(20, 10, 6, 0.45)';
  ctx.shadowBlur = s * 0.05;
  ctx.shadowOffsetY = s * 0.03;
  fn();
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

add('hammer', 'Hammer', (ctx, s) => {
  const u = s / 100;
  shadow(ctx, s, () => {
    ctx.fillStyle = grad(ctx, 46 * u, 0, 70 * u, 0, [[0, '#6b4428'], [0.45, '#e6c39a'], [1, '#4a2c18']]);
    rr(ctx, 46 * u, 28 * u, 16 * u, 62 * u, 6 * u);
    ctx.fill();
  });
  ctx.fillStyle = grad(ctx, 18 * u, 16 * u, 18 * u, 40 * u, [[0, '#f4f7fb'], [0.45, '#9aa3b2'], [1, '#4c5566']]);
  rr(ctx, 18 * u, 14 * u, 64 * u, 22 * u, 5 * u);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  rr(ctx, 24 * u, 17 * u, 40 * u, 5 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = '#2c3340';
  ctx.fillRect(48 * u, 18 * u, 8 * u, 14 * u);
});

add('tongs', 'Tongs', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = grad(ctx, 0, 0, s, s, [[0, '#d7dde8'], [0.5, '#8b93a3'], [1, '#3e4654']]);
  ctx.lineWidth = 7 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(30 * u, 78 * u);
  ctx.quadraticCurveTo(48 * u, 40 * u, 34 * u, 18 * u);
  ctx.moveTo(70 * u, 78 * u);
  ctx.quadraticCurveTo(52 * u, 40 * u, 66 * u, 18 * u);
  ctx.stroke();
  ctx.fillStyle = '#c4552a';
  ctx.beginPath();
  ctx.arc(50 * u, 48 * u, 5 * u, 0, Math.PI * 2);
  ctx.fill();
});

add('anvil', 'Anvil', (ctx, s) => {
  const u = s / 100;
  shadow(ctx, s, () => {
    ctx.fillStyle = grad(ctx, 10 * u, 30 * u, 10 * u, 70 * u, [[0, '#f7f8fb'], [0.35, '#b7c0ce'], [0.7, '#667181'], [1, '#2c333e']]);
    ctx.beginPath();
    ctx.moveTo(12 * u, 38 * u);
    ctx.lineTo(78 * u, 34 * u);
    ctx.lineTo(86 * u, 46 * u);
    ctx.lineTo(62 * u, 50 * u);
    ctx.lineTo(66 * u, 68 * u);
    ctx.lineTo(28 * u, 72 * u);
    ctx.lineTo(22 * u, 52 * u);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.moveTo(18 * u, 40 * u);
  ctx.lineTo(70 * u, 37 * u);
  ctx.lineTo(66 * u, 42 * u);
  ctx.lineTo(20 * u, 45 * u);
  ctx.fill();
});

add('crucible', 'Crucible', (ctx, s) => {
  const u = s / 100;
  shadow(ctx, s, () => {
    ctx.fillStyle = grad(ctx, 30 * u, 20 * u, 80 * u, 80 * u, [[0, '#f0a36a'], [0.4, '#b4532a'], [1, '#6a2c16']]);
    ctx.beginPath();
    ctx.moveTo(28 * u, 38 * u);
    ctx.quadraticCurveTo(22 * u, 78 * u, 50 * u, 84 * u);
    ctx.quadraticCurveTo(78 * u, 78 * u, 72 * u, 38 * u);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = rad(ctx, 50 * u, 42 * u, 2 * u, 22 * u, [[0, '#fff1b0'], [0.5, '#ffb03a'], [1, '#e07020']]);
  ctx.beginPath();
  ctx.ellipse(50 * u, 40 * u, 20 * u, 8 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a3a1c';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.arc(22 * u, 36 * u, 7 * u, 0.4, Math.PI * 1.2);
  ctx.stroke();
});

add('flame', 'Flame', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = rad(ctx, 50 * u, 60 * u, 4 * u, 40 * u, [[0, 'rgba(255,220,140,.9)'], [1, 'rgba(255,120,20,0)']]);
  ctx.beginPath();
  ctx.arc(50 * u, 58 * u, 36 * u, 0, Math.PI * 2);
  ctx.fill();
  const flame = () => {
    ctx.beginPath();
    ctx.moveTo(50 * u, 12 * u);
    ctx.bezierCurveTo(78 * u, 40 * u, 74 * u, 70 * u, 50 * u, 86 * u);
    ctx.bezierCurveTo(26 * u, 70 * u, 22 * u, 40 * u, 50 * u, 12 * u);
    ctx.closePath();
  };
  flame();
  ctx.fillStyle = grad(ctx, 50 * u, 12 * u, 50 * u, 86 * u, [[0, '#fff4c4'], [0.35, '#ffb03a'], [1, '#d23a12']]);
  ctx.fill();
  ctx.save();
  ctx.scale(0.55, 0.62);
  ctx.translate(40 * u, 28 * u);
  flame();
  ctx.fillStyle = grad(ctx, 50 * u, 20 * u, 50 * u, 80 * u, [[0, '#fff'], [1, '#ffe08a']]);
  ctx.fill();
  ctx.restore();
});

add('spark', 'Sparks', (ctx, s) => {
  const u = s / 100;
  const pts = [[50, 18], [22, 40], [78, 42], [32, 72], [68, 74], [50, 50]];
  pts.forEach(([x, y], i) => {
    ctx.fillStyle = rad(ctx, x * u, y * u, 0, 10 * u, [[0, '#fff7d6'], [0.4, '#ffc14a'], [1, 'rgba(255,120,20,0)']]);
    ctx.beginPath();
    ctx.arc(x * u, y * u, (8 + (i % 3) * 3) * u, 0, Math.PI * 2);
    ctx.fill();
  });
});

add('star', 'Star', (ctx, s) => {
  const u = s / 100;
  ctx.save();
  ctx.translate(50 * u, 50 * u);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 16 * u : 38 * u;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = grad(ctx, -20 * u, -30 * u, 20 * u, 36 * u, [[0, '#fff6c8'], [0.45, '#f0b429'], [1, '#a16207']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.ellipse(-8 * u, -10 * u, 8 * u, 4 * u, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
});

add('moon', 'Moon', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = rad(ctx, 42 * u, 48 * u, 8 * u, 36 * u, [[0, '#fff8e4'], [0.6, '#f0d48a'], [1, '#c4923a']]);
  ctx.beginPath();
  ctx.arc(46 * u, 50 * u, 30 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(60 * u, 42 * u, 24 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
});

add('scroll', 'Scroll', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 20 * u, 80 * u, 80 * u, [[0, '#fff6df'], [0.5, '#f0ddb4'], [1, '#c9a56a']]);
  rr(ctx, 22 * u, 24 * u, 56 * u, 52 * u, 6 * u);
  ctx.fill();
  ctx.fillStyle = '#e7d2a4';
  ctx.beginPath();
  ctx.ellipse(22 * u, 50 * u, 8 * u, 26 * u, 0, 0, Math.PI * 2);
  ctx.ellipse(78 * u, 50 * u, 8 * u, 26 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 72, 28, .35)';
  ctx.lineWidth = 1.5 * u;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(34 * u, (36 + i * 9) * u);
    ctx.lineTo(66 * u, (36 + i * 9) * u);
    ctx.stroke();
  }
});

add('quill', 'Quill', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = grad(ctx, 20 * u, 20 * u, 80 * u, 80 * u, [[0, '#f7f1e4'], [1, '#8d6a3a']]);
  ctx.lineWidth = 4 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28 * u, 74 * u);
  ctx.quadraticCurveTo(40 * u, 40 * u, 72 * u, 18 * u);
  ctx.stroke();
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath();
  ctx.moveTo(72 * u, 18 * u);
  ctx.quadraticCurveTo(48 * u, 28 * u, 58 * u, 48 * u);
  ctx.quadraticCurveTo(70 * u, 30 * u, 72 * u, 18 * u);
  ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.beginPath();
  ctx.moveTo(26 * u, 78 * u);
  ctx.lineTo(34 * u, 70 * u);
  ctx.lineTo(22 * u, 72 * u);
  ctx.fill();
});

add('potion', 'Phial', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 40 * u, 10 * u, 60 * u, 30 * u, [[0, '#efe7da'], [1, '#b7aa98']]);
  rr(ctx, 42 * u, 12 * u, 16 * u, 16 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = grad(ctx, 30 * u, 30 * u, 70 * u, 90 * u, [[0, 'rgba(255,255,255,.7)'], [0.3, 'rgba(190,230,255,.35)'], [1, 'rgba(120,170,190,.2)']]);
  ctx.beginPath();
  ctx.moveTo(40 * u, 32 * u);
  ctx.lineTo(60 * u, 32 * u);
  ctx.quadraticCurveTo(78 * u, 78 * u, 50 * u, 88 * u);
  ctx.quadraticCurveTo(22 * u, 78 * u, 40 * u, 32 * u);
  ctx.fill();
  ctx.fillStyle = rad(ctx, 48 * u, 62 * u, 2 * u, 20 * u, [[0, '#7d2ae8'], [1, '#3a146e']]);
  ctx.beginPath();
  ctx.ellipse(50 * u, 68 * u, 16 * u, 14 * u, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(42 * u, 40 * u);
  ctx.quadraticCurveTo(46 * u, 60 * u, 44 * u, 74 * u);
  ctx.stroke();
});

add('coin', 'Q coin', (ctx, s) => {
  const u = s / 100;
  shadow(ctx, s, () => {
    ctx.fillStyle = rad(ctx, 42 * u, 42 * u, 4 * u, 34 * u, [[0, '#fff1b8'], [0.55, '#e2b03a'], [1, '#8a5a10']]);
    ctx.beginPath();
    ctx.arc(50 * u, 50 * u, 32 * u, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = '#7a4e0c';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.arc(50 * u, 50 * u, 24 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#6b3e0c';
  ctx.font = `700 ${28 * u}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q', 50 * u, 52 * u);
});

add('gem', 'Gem', (ctx, s) => {
  const u = s / 100;
  ctx.beginPath();
  ctx.moveTo(50 * u, 14 * u);
  ctx.lineTo(80 * u, 40 * u);
  ctx.lineTo(50 * u, 88 * u);
  ctx.lineTo(20 * u, 40 * u);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 20 * u, 14 * u, 80 * u, 88 * u, [[0, '#d7fff8'], [0.4, '#3ecfb8'], [1, '#0e6b62']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(50 * u, 14 * u);
  ctx.lineTo(50 * u, 88 * u);
  ctx.moveTo(20 * u, 40 * u);
  ctx.lineTo(80 * u, 40 * u);
  ctx.stroke();
});

add('gear', 'Gear', (ctx, s) => {
  const u = s / 100;
  ctx.save();
  ctx.translate(50 * u, 50 * u);
  ctx.fillStyle = grad(ctx, -30 * u, -30 * u, 30 * u, 30 * u, [[0, '#f3f5f8'], [0.5, '#9aa4b5'], [1, '#3d4656']]);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = a0 + Math.PI / 18;
    const a2 = a0 + Math.PI / 12;
    const inner = 22 * u;
    const outer = i % 2 ? 34 * u : 26 * u;
    ctx.lineTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
    ctx.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer);
    ctx.lineTo(Math.cos(a2) * outer, Math.sin(a2) * outer);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, 10 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
});

add('chain', 'Chain', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = grad(ctx, 0, 0, s, 0, [[0, '#eceff5'], [0.5, '#8e97a8'], [1, '#3c4452']]);
  ctx.lineWidth = 6 * u;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse((28 + i * 16) * u, 50 * u, 10 * u, 16 * u, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
});

add('key', 'Key', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = grad(ctx, 0, 0, s, s, [[0, '#fff1c2'], [1, '#b8860b']]);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 6 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(34 * u, 36 * u, 14 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(46 * u, 44 * u);
  ctx.lineTo(78 * u, 76 * u);
  ctx.moveTo(64 * u, 64 * u);
  ctx.lineTo(74 * u, 58 * u);
  ctx.moveTo(72 * u, 72 * u);
  ctx.lineTo(82 * u, 66 * u);
  ctx.stroke();
});

add('shield', 'Shield', (ctx, s) => {
  const u = s / 100;
  ctx.beginPath();
  ctx.moveTo(50 * u, 12 * u);
  ctx.quadraticCurveTo(82 * u, 20 * u, 78 * u, 48 * u);
  ctx.quadraticCurveTo(72 * u, 78 * u, 50 * u, 90 * u);
  ctx.quadraticCurveTo(28 * u, 78 * u, 22 * u, 48 * u);
  ctx.quadraticCurveTo(18 * u, 20 * u, 50 * u, 12 * u);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 22 * u, 12 * u, 78 * u, 90 * u, [[0, '#f4d48a'], [0.4, '#c47a2c'], [1, '#6b3414']]);
  ctx.fill();
  ctx.fillStyle = '#f6e7c4';
  ctx.beginPath();
  ctx.arc(50 * u, 46 * u, 10 * u, 0, Math.PI * 2);
  ctx.fill();
});

add('banner', 'Banner', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 20 * u, 80 * u, 40 * u, [[0, '#8f1d2c'], [0.5, '#d64545'], [1, '#6e1422']]);
  ctx.beginPath();
  ctx.moveTo(18 * u, 28 * u);
  ctx.lineTo(82 * u, 28 * u);
  ctx.lineTo(82 * u, 62 * u);
  ctx.lineTo(50 * u, 50 * u);
  ctx.lineTo(18 * u, 62 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(24 * u, 34 * u, 40 * u, 4 * u);
});

add('heart', 'Heart', (ctx, s) => {
  const u = s / 100;
  ctx.save();
  ctx.translate(50 * u, 54 * u);
  ctx.fillStyle = rad(ctx, -8 * u, -10 * u, 2 * u, 40 * u, [[0, '#ffd0d0'], [0.4, '#e23b4a'], [1, '#8e1024']]);
  ctx.beginPath();
  ctx.moveTo(0, 22 * u);
  ctx.bezierCurveTo(-36 * u, 4 * u, -28 * u, -28 * u, 0, -12 * u);
  ctx.bezierCurveTo(28 * u, -28 * u, 36 * u, 4 * u, 0, 22 * u);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(-10 * u, -8 * u, 6 * u, 3 * u, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
});

add('bolt', 'Bolt', (ctx, s) => {
  const u = s / 100;
  ctx.beginPath();
  ctx.moveTo(58 * u, 8 * u);
  ctx.lineTo(28 * u, 52 * u);
  ctx.lineTo(48 * u, 52 * u);
  ctx.lineTo(40 * u, 92 * u);
  ctx.lineTo(76 * u, 42 * u);
  ctx.lineTo(54 * u, 42 * u);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 30 * u, 8 * u, 70 * u, 92 * u, [[0, '#fff7c8'], [0.5, '#ffd23a'], [1, '#e07a12']]);
  ctx.fill();
});

add('book', 'Ledger', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 20 * u, 30 * u, 80 * u, [[0, '#8d3b2a'], [1, '#4a1c14']]);
  rr(ctx, 22 * u, 18 * u, 56 * u, 64 * u, 4 * u);
  ctx.fill();
  ctx.fillStyle = '#f6edd8';
  ctx.fillRect(34 * u, 24 * u, 38 * u, 52 * u);
  ctx.strokeStyle = 'rgba(90,50,20,.35)';
  ctx.lineWidth = 1.4 * u;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(40 * u, (34 + i * 8) * u);
    ctx.lineTo(66 * u, (34 + i * 8) * u);
    ctx.stroke();
  }
});

add('goggles', 'Goggles', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(18 * u, 40 * u);
  ctx.quadraticCurveTo(50 * u, 28 * u, 82 * u, 40 * u);
  ctx.stroke();
  ctx.fillStyle = grad(ctx, 20 * u, 40 * u, 40 * u, 70 * u, [[0, '#d9f6ff'], [1, '#6e8d99']]);
  ctx.strokeStyle = '#c08a3e';
  ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.arc(36 * u, 56 * u, 14 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64 * u, 56 * u, 14 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50 * u, 56 * u);
  ctx.lineTo(50 * u, 56 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50 * u, 52 * u);
  ctx.lineTo(50 * u, 60 * u);
  ctx.stroke();
});

add('crown', 'Circlet', (ctx, s) => {
  const u = s / 100;
  ctx.beginPath();
  ctx.moveTo(16 * u, 68 * u);
  ctx.lineTo(16 * u, 40 * u);
  ctx.lineTo(32 * u, 54 * u);
  ctx.lineTo(50 * u, 28 * u);
  ctx.lineTo(68 * u, 54 * u);
  ctx.lineTo(84 * u, 40 * u);
  ctx.lineTo(84 * u, 68 * u);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 16 * u, 28 * u, 84 * u, 68 * u, [[0, '#fff4c4'], [0.5, '#e6b23c'], [1, '#8d5d0e']]);
  ctx.fill();
  ctx.fillStyle = '#9b1c3c';
  ctx.beginPath();
  ctx.arc(50 * u, 48 * u, 5 * u, 0, Math.PI * 2);
  ctx.fill();
});

add('gauntlet', 'Gauntlet', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 30 * u, 20 * u, 70 * u, 90 * u, [[0, '#e7ebf2'], [0.5, '#8b95a6'], [1, '#3a4250']]);
  rr(ctx, 34 * u, 28 * u, 32 * u, 48 * u, 12 * u);
  ctx.fill();
  ctx.fillStyle = '#5c6574';
  for (let i = 0; i < 4; i++) rr(ctx, (30 + i * 10) * u, 18 * u, 8 * u, 18 * u, 3 * u), ctx.fill();
  ctx.fillStyle = '#d4a24a';
  ctx.fillRect(36 * u, 48 * u, 28 * u, 5 * u);
});

add('ingot', 'Ingot', (ctx, s) => {
  const u = s / 100;
  ctx.beginPath();
  ctx.moveTo(22 * u, 40 * u);
  ctx.lineTo(78 * u, 40 * u);
  ctx.lineTo(88 * u, 58 * u);
  ctx.lineTo(68 * u, 74 * u);
  ctx.lineTo(32 * u, 74 * u);
  ctx.lineTo(12 * u, 58 * u);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 20 * u, 40 * u, 80 * u, 74 * u, [[0, '#fff6d0'], [0.45, '#e0b44a'], [1, '#8a5a12']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.moveTo(28 * u, 46 * u);
  ctx.lineTo(70 * u, 46 * u);
  ctx.lineTo(74 * u, 52 * u);
  ctx.lineTo(30 * u, 52 * u);
  ctx.fill();
});

add('bellows', 'Bellows', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 30 * u, 80 * u, 70 * u, [[0, '#a24b32'], [1, '#5c2418']]);
  ctx.beginPath();
  ctx.moveTo(24 * u, 30 * u);
  ctx.lineTo(70 * u, 46 * u);
  ctx.lineTo(70 * u, 70 * u);
  ctx.lineTo(24 * u, 78 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e6d2b0';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(36 * u, 40 * u);
  ctx.lineTo(36 * u, 70 * u);
  ctx.moveTo(50 * u, 44 * u);
  ctx.lineTo(50 * u, 68 * u);
  ctx.stroke();
  ctx.fillStyle = '#cfc6bc';
  ctx.fillRect(70 * u, 50 * u, 16 * u, 12 * u);
});

add('smoke', 'Smoke', (ctx, s) => {
  const u = s / 100;
  const puffs = [[50, 70, 18], [40, 50, 16], [58, 36, 14], [46, 22, 10]];
  puffs.forEach(([x, y, r], i) => {
    ctx.fillStyle = `rgba(230, 224, 216, ${0.35 + i * 0.12})`;
    ctx.beginPath();
    ctx.arc(x * u, y * u, r * u, 0, Math.PI * 2);
    ctx.fill();
  });
});

add('arrow', 'Arrow', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 10 * u, 50 * u, 90 * u, 50 * u, [[0, '#fff'], [1, '#d7dde8']]);
  ctx.beginPath();
  ctx.moveTo(78 * u, 50 * u);
  ctx.lineTo(48 * u, 28 * u);
  ctx.lineTo(48 * u, 42 * u);
  ctx.lineTo(18 * u, 42 * u);
  ctx.lineTo(18 * u, 58 * u);
  ctx.lineTo(48 * u, 58 * u);
  ctx.lineTo(48 * u, 72 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c3340';
  ctx.lineWidth = 2 * u;
  ctx.stroke();
});

add('medal', 'Medal', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = '#8f1d2c';
  ctx.beginPath();
  ctx.moveTo(36 * u, 12 * u);
  ctx.lineTo(50 * u, 40 * u);
  ctx.lineTo(28 * u, 40 * u);
  ctx.fill();
  ctx.fillStyle = '#1d4e89';
  ctx.beginPath();
  ctx.moveTo(64 * u, 12 * u);
  ctx.lineTo(72 * u, 40 * u);
  ctx.lineTo(50 * u, 40 * u);
  ctx.fill();
  ctx.fillStyle = rad(ctx, 46 * u, 58 * u, 4 * u, 24 * u, [[0, '#fff6d0'], [0.6, '#e2b13a'], [1, '#8a5a10']]);
  ctx.beginPath();
  ctx.arc(50 * u, 62 * u, 22 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b3e0c';
  ctx.font = `700 ${16 * u}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q', 50 * u, 63 * u);
});

add('speech', 'Bubble', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 16 * u, 80 * u, 70 * u, [[0, '#fff'], [1, '#efe6d6']]);
  rr(ctx, 14 * u, 14 * u, 72 * u, 48 * u, 16 * u);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32 * u, 60 * u);
  ctx.lineTo(28 * u, 84 * u);
  ctx.lineTo(52 * u, 62 * u);
  ctx.fill();
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 3 * u;
  rr(ctx, 14 * u, 14 * u, 72 * u, 48 * u, 16 * u);
  ctx.stroke();
});

add('crystal', 'Crystal', (ctx, s) => {
  const u = s / 100;
  ctx.beginPath();
  ctx.moveTo(50 * u, 8 * u);
  ctx.lineTo(78 * u, 36 * u);
  ctx.lineTo(64 * u, 90 * u);
  ctx.lineTo(36 * u, 90 * u);
  ctx.lineTo(22 * u, 36 * u);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 22 * u, 8 * u, 78 * u, 90 * u, [[0, '#f2e9ff'], [0.45, '#8b6ad8'], [1, '#3a2470']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.beginPath();
  ctx.moveTo(50 * u, 12 * u);
  ctx.lineTo(62 * u, 36 * u);
  ctx.lineTo(50 * u, 84 * u);
  ctx.lineTo(42 * u, 36 * u);
  ctx.fill();
});

add('mushroom', 'Cap', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 40 * u, 80 * u, 70 * u, [[0, '#f3e2c8'], [1, '#c9a37a']]);
  rr(ctx, 42 * u, 48 * u, 16 * u, 32 * u, 6 * u);
  ctx.fill();
  ctx.fillStyle = rad(ctx, 40 * u, 40 * u, 4 * u, 40 * u, [[0, '#ffb0a8'], [0.6, '#d23a3a'], [1, '#7a1420']]);
  ctx.beginPath();
  ctx.ellipse(50 * u, 46 * u, 34 * u, 22 * u, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f6e7c2';
  [[38, 40], [52, 34], [64, 44]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.ellipse(x * u, y * u, 4 * u, 3 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  });
});

add('comet', 'Comet', (ctx, s) => {
  const u = s / 100;
  const g = ctx.createLinearGradient(10 * u, 70 * u, 80 * u, 20 * u);
  g.addColorStop(0, 'rgba(255,180,80,0)');
  g.addColorStop(1, 'rgba(255,220,150,.8)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 10 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(16 * u, 78 * u);
  ctx.lineTo(62 * u, 32 * u);
  ctx.stroke();
  ctx.fillStyle = rad(ctx, 66 * u, 28 * u, 2 * u, 16 * u, [[0, '#fff'], [0.5, '#ffe08a'], [1, 'rgba(255,160,40,0)']]);
  ctx.beginPath();
  ctx.arc(66 * u, 28 * u, 14 * u, 0, Math.PI * 2);
  ctx.fill();
});

add('mug', 'Mug', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 24 * u, 30 * u, 70 * u, 80 * u, [[0, '#f3d2b0'], [0.4, '#c47a45'], [1, '#6b3a22']]);
  rr(ctx, 26 * u, 32 * u, 40 * u, 44 * u, 8 * u);
  ctx.fill();
  ctx.strokeStyle = '#8a4b28';
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.arc(70 * u, 52 * u, 12 * u, -1.2, 1.2);
  ctx.stroke();
  ctx.fillStyle = '#5c2e18';
  ctx.beginPath();
  ctx.ellipse(46 * u, 34 * u, 16 * u, 5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
});

add('leaf', 'Leaf', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 30 * u, 20 * u, 70 * u, 80 * u, [[0, '#d8f5b0'], [0.5, '#4f9a3a'], [1, '#1f5a28']]);
  ctx.beginPath();
  ctx.moveTo(50 * u, 14 * u);
  ctx.bezierCurveTo(90 * u, 30 * u, 80 * u, 80 * u, 50 * u, 88 * u);
  ctx.bezierCurveTo(20 * u, 80 * u, 10 * u, 30 * u, 50 * u, 14 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,50,20,.55)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(50 * u, 20 * u);
  ctx.lineTo(50 * u, 82 * u);
  ctx.stroke();
});

add('horseshoe', 'Shoe', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = grad(ctx, 20 * u, 20 * u, 80 * u, 90 * u, [[0, '#f3d7ad'], [0.5, '#c47a3a'], [1, '#6b3a16']]);
  ctx.lineWidth = 10 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(50 * u, 46 * u, 24 * u, 0.3, Math.PI - 0.3, true);
  ctx.stroke();
  ctx.fillStyle = '#3a2416';
  [[34, 62], [50, 70], [66, 62]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x * u, y * u, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
  });
});

add('rune', 'Rune', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 20 * u, 16 * u, 80 * u, 90 * u, [[0, '#d9d3c8'], [1, '#6d675e']]);
  ctx.beginPath();
  ctx.moveTo(50 * u, 10 * u);
  ctx.lineTo(86 * u, 32 * u);
  ctx.lineTo(74 * u, 86 * u);
  ctx.lineTo(26 * u, 86 * u);
  ctx.lineTo(14 * u, 32 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e7a23a';
  ctx.lineWidth = 4 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(50 * u, 28 * u);
  ctx.lineTo(50 * u, 70 * u);
  ctx.moveTo(36 * u, 46 * u);
  ctx.lineTo(64 * u, 46 * u);
  ctx.stroke();
});

add('bell', 'Bell', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 30 * u, 20 * u, 70 * u, 80 * u, [[0, '#fff6d2'], [0.5, '#e2b13c'], [1, '#8a5d10']]);
  ctx.beginPath();
  ctx.moveTo(50 * u, 16 * u);
  ctx.quadraticCurveTo(82 * u, 40 * u, 78 * u, 68 * u);
  ctx.lineTo(22 * u, 68 * u);
  ctx.quadraticCurveTo(18 * u, 40 * u, 50 * u, 16 * u);
  ctx.fill();
  ctx.fillStyle = '#6b3e0c';
  ctx.fillRect(28 * u, 66 * u, 44 * u, 6 * u);
  ctx.beginPath();
  ctx.arc(50 * u, 78 * u, 6 * u, 0, Math.PI * 2);
  ctx.fill();
});

add('lantern', 'Lantern', (ctx, s) => {
  const u = s / 100;
  ctx.strokeStyle = '#3a2a1c';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(50 * u, 10 * u);
  ctx.lineTo(50 * u, 22 * u);
  ctx.stroke();
  ctx.fillStyle = '#5c4632';
  rr(ctx, 36 * u, 20 * u, 28 * u, 8 * u, 2 * u);
  ctx.fill();
  ctx.fillStyle = rad(ctx, 50 * u, 52 * u, 4 * u, 28 * u, [[0, '#fff4c4'], [0.5, '#ffb03a'], [1, '#a85a12']]);
  rr(ctx, 32 * u, 30 * u, 36 * u, 42 * u, 6 * u);
  ctx.fill();
  ctx.strokeStyle = '#3a2a1c';
  ctx.strokeRect(32 * u, 30 * u, 36 * u, 42 * u);
});

add('sweat', 'Drop', (ctx, s) => {
  const u = s / 100;
  ctx.fillStyle = grad(ctx, 40 * u, 16 * u, 70 * u, 80 * u, [[0, '#f4fbff'], [0.5, '#8fd4f2'], [1, '#2f86b5']]);
  ctx.beginPath();
  ctx.moveTo(50 * u, 14 * u);
  ctx.bezierCurveTo(78 * u, 46 * u, 70 * u, 78 * u, 50 * u, 86 * u);
  ctx.bezierCurveTo(30 * u, 78 * u, 22 * u, 46 * u, 50 * u, 14 * u);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  ctx.ellipse(42 * u, 48 * u, 6 * u, 10 * u, -0.4, 0, Math.PI * 2);
  ctx.fill();
});

const cache = new Map();

export function stickerList() {
  return STICKERS.map(({ id, name }) => ({ id, name }));
}

export function stickerCanvas(id, size = 256) {
  const key = id + '@' + size;
  if (cache.has(key)) return cache.get(key);
  const found = STICKERS.find((s) => s.id === id);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  if (found) {
    const ctx = canvas.getContext('2d');
    found.draw(ctx, size);
  }
  cache.set(key, canvas);
  return canvas;
}

export function warmStickerThumbs() {
  STICKERS.forEach((s) => stickerCanvas(s.id, 128));
}
