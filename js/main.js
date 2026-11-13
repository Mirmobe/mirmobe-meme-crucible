import { initTrialPaywall } from './paywall.js';
import { Editor } from './editor.js';

const canvas = document.getElementById('stage');
const editor = new Editor(canvas);
window.CrucibleEditor = editor;

initTrialPaywall();
editor.boot().catch((err) => {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.hidden = false;
    toast.textContent = err && err.message ? err.message : 'The forge failed to start.';
  }
});
