const text = (partial) => ({
  type: 'text',
  text: 'TEXT',
  font: 'Impact, "Arial Black", sans-serif',
  size: 0.078,
  color: '#fffaf0',
  outline: 0.012,
  outlineColor: '#1a120c',
  shadow: 0.01,
  shadowColor: '#140c08',
  align: 'center',
  upper: true,
  appear: 0,
  anim: 'pop',
  x: 0.5,
  y: 0.12,
  w: 0.9,
  h: 0.16,
  rot: 0,
  opacity: 1,
  flip: false,
  lockAspect: false,
  ...partial
});

const cast = (sprite, partial) => ({
  type: 'sprite',
  kind: 'character',
  sprite,
  x: 0.68,
  y: 0.58,
  h: 0.82,
  rot: 0,
  opacity: 1,
  flip: false,
  lockAspect: true,
  appear: 0,
  anim: 'none',
  ...partial
});

const prop = (sprite, partial) => ({
  type: 'sprite',
  kind: 'sticker',
  sprite,
  x: 0.18,
  y: 0.22,
  h: 0.16,
  rot: 0,
  opacity: 1,
  flip: false,
  lockAspect: true,
  appear: 0.2,
  anim: 'pop',
  ...partial
});

export const FX_PRESETS = {
  clean: { brightness: 1, contrast: 1.04, saturate: 1.05, hue: 0, blur: 0, sepia: 0, vignette: 0.22, glow: 0, grain: 0.05, fry: 0, halftone: 0 },
  bright: { brightness: 1.12, contrast: 1.05, saturate: 1.18, hue: 0, blur: 0, sepia: 0, vignette: 0.05, glow: 0.18, grain: 0, fry: 0, halftone: 0 },
  moody: { brightness: 0.92, contrast: 1.12, saturate: 0.86, hue: 0, blur: 0, sepia: 0.12, vignette: 0.55, glow: 0, grain: 0.08, fry: 0, halftone: 0 },
  glow: { brightness: 1.05, contrast: 1.06, saturate: 1.2, hue: 0, blur: 0, sepia: 0, vignette: 0.2, glow: 0.48, grain: 0, fry: 0, halftone: 0 },
  fry: { brightness: 1.22, contrast: 1.65, saturate: 2.15, hue: -10, blur: 0, sepia: 0, vignette: 0.18, glow: 0, grain: 0.2, fry: 0.75, halftone: 0 },
  retro: { brightness: 1.02, contrast: 0.96, saturate: 0.72, hue: 14, blur: 0, sepia: 0.42, vignette: 0.5, glow: 0, grain: 0.16, fry: 0, halftone: 0 },
  comic: { brightness: 1.06, contrast: 1.2, saturate: 1.25, hue: 0, blur: 0, sepia: 0, vignette: 0.08, glow: 0, grain: 0, fry: 0, halftone: 9 },
  noir: { brightness: 0.96, contrast: 1.28, saturate: 0, hue: 0, blur: 0, sepia: 0.05, vignette: 0.62, glow: 0, grain: 0.12, fry: 0, halftone: 0 }
};

export const TEMPLATES = [
  {
    id: 'classic',
    name: 'Forge caption',
    aspect: 'square',
    bg: 'forge',
    frame: 'gold',
    fx: 'clean',
    layers: [
      cast('questo', { x: 0.72, y: 0.6, h: 0.86 }),
      text({ text: 'WHEN THE CRUCIBLE', y: 0.1, size: 0.07 }),
      text({ text: 'HITS DIFFERENT', y: 0.9, size: 0.078, appear: 0.45 }),
      prop('spark', { x: 0.16, y: 0.24, h: 0.18, appear: 0.7 })
    ]
  },
  {
    id: 'reacts',
    name: 'Questo reacts',
    aspect: 'square',
    bg: 'forge',
    frame: 'thin',
    fx: 'bright',
    layers: [
      cast('questo', { x: 0.3, y: 0.62, h: 0.8, flip: true }),
      text({ text: 'HOLD MY\nCRUCIBLE', x: 0.68, y: 0.38, w: 0.5, h: 0.36, size: 0.08, align: 'center', appear: 0.2 })
    ]
  },
  {
    id: 'story',
    name: 'Tall tale',
    aspect: 'story',
    bg: 'story',
    frame: 'ember',
    fx: 'moody',
    layers: [
      cast('questo', { x: 0.5, y: 0.72, h: 0.52 }),
      text({ text: 'THE FIRE\nKEEPS THE HOURS', y: 0.18, size: 0.075, font: '"Pirata One", serif', appear: 0.15 }),
      text({ text: '— QUESTO', y: 0.34, size: 0.04, outline: 0.006, appear: 0.7, anim: 'fade' })
    ]
  },
  {
    id: 'xpost',
    name: 'X post',
    aspect: 'xpost',
    bg: 'dawn',
    frame: 'thin',
    fx: 'bright',
    layers: [
      cast('questo', { x: 0.84, y: 0.62, h: 0.9 }),
      text({ text: 'DAWN SHIFT\nAT THE FORGE', x: 0.36, y: 0.42, w: 0.62, h: 0.42, size: 0.09, align: 'left' }),
      prop('comet', { x: 0.14, y: 0.18, h: 0.2 })
    ]
  },
  {
    id: 'fox',
    name: 'Cinder knows',
    aspect: 'square',
    bg: 'workshop',
    frame: 'gold',
    fx: 'moody',
    layers: [
      cast('fox', { x: 0.62, y: 0.58, h: 0.7 }),
      text({ text: 'CINDER\nALREADY KNOWS', y: 0.2, x: 0.34, w: 0.55, size: 0.07, align: 'left' }),
      prop('moon', { x: 0.16, y: 0.78, h: 0.16 })
    ]
  },
  {
    id: 'soot',
    name: "Soot's turn",
    aspect: 'square',
    bg: 'cavern',
    frame: 'thin',
    fx: 'glow',
    layers: [
      cast('apprentice', { x: 0.5, y: 0.58, h: 0.78 }),
      text({ text: 'FIRST DAY', y: 0.1, size: 0.08 }),
      text({ text: 'STILL SMILING', y: 0.9, size: 0.07, appear: 0.5 })
    ]
  },
  {
    id: 'beetle',
    name: 'Little kindle',
    aspect: 'square',
    bg: 'cosmos',
    frame: 'ember',
    fx: 'glow',
    layers: [
      cast('beetle', { x: 0.5, y: 0.58, h: 0.46 }),
      text({ text: 'TINY FORGE', y: 0.16, size: 0.08 }),
      text({ text: 'BIG OPINIONS', y: 0.84, size: 0.07, appear: 0.4 }),
      prop('star', { x: 0.18, y: 0.3, h: 0.14 }),
      prop('star', { x: 0.82, y: 0.28, h: 0.12, appear: 0.6 })
    ]
  },
  {
    id: 'fry',
    name: 'Overfired',
    aspect: 'square',
    bg: 'forge',
    frame: 'comic',
    fx: 'fry',
    layers: [
      cast('questo', { x: 0.5, y: 0.56, h: 0.75 }),
      text({ text: 'TOO MUCH HEAT', y: 0.12, size: 0.075, color: '#ffe14a', outlineColor: '#3a0010' }),
      text({ text: 'SEND IT', y: 0.88, size: 0.09, appear: 0.35, color: '#fff' })
    ]
  },
  {
    id: 'retro',
    name: 'Old poster',
    aspect: 'wide',
    bg: 'dawn',
    frame: 'polaroid',
    fx: 'retro',
    layers: [
      cast('questo', { x: 0.78, y: 0.58, h: 0.7 }),
      text({ text: 'QUESTO', x: 0.32, y: 0.32, w: 0.5, size: 0.12, font: '"Pirata One", serif', color: '#3a2412', outline: 0, shadow: 0.02 }),
      text({ text: 'EVERY QUEST NEEDS A WIZARD', x: 0.32, y: 0.52, w: 0.5, size: 0.045, font: 'MedievalSharp, serif', color: '#5c3b16', outline: 0, appear: 0.4, anim: 'fade' })
    ]
  },
  {
    id: 'comic',
    name: 'Print day',
    aspect: 'square',
    bg: 'bench',
    frame: 'comic',
    fx: 'comic',
    layers: [
      cast('apprentice', { x: 0.62, y: 0.6, h: 0.72 }),
      prop('speech', { x: 0.28, y: 0.28, h: 0.32 }),
      text({ text: 'WHO LEFT\nTHE BELLOWS ON', x: 0.28, y: 0.26, w: 0.34, h: 0.22, size: 0.038, color: '#2a2118', outline: 0, shadow: 0, upper: true, appear: 0.25 })
    ]
  },
  {
    id: 'bench',
    name: 'On the bench',
    aspect: 'wide',
    bg: 'bench',
    frame: 'none',
    fx: 'clean',
    layers: [
      text({ text: 'SIGN HERE\nIF YOU FORGED IT', x: 0.55, y: 0.42, w: 0.42, h: 0.28, size: 0.055, color: '#4a2c12', outline: 0, shadow: 0, font: 'MedievalSharp, serif' })
    ]
  },
  {
    id: 'blank',
    name: 'Empty crucible',
    aspect: 'square',
    bg: 'void',
    frame: 'thin',
    fx: 'clean',
    layers: [
      text({ text: 'YOUR LINE', y: 0.5, size: 0.09 })
    ]
  }
];

export function presetById(id) {
  return { ...(FX_PRESETS[id] || FX_PRESETS.clean) };
}
