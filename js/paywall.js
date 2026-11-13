// Trial, share bonus, and on-chain unlock.
// Payment checks are unchanged from the previous crucible: a signature can be
// used once in this browser, the transaction must have succeeded, it must be
// newer than 7 days, and the unlock address must have gained at least 0.05 SOL.

const UNLOCK_PRICE_SOL = 0.05;
const PAYMENT_ADDRESS = '5P1ArCLapXPjSEaNauVYAmtLKxEwoELcttQvPqmF1VYP';
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const TRIAL_MS = 5 * 60 * 1000;
const SHARE_BONUS_MS = 5 * 60 * 1000;
const PAYMENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SITE_URL = 'https://mirmobe.github.io/mirmobe-meme-crucible/';
const LS_USED_MS = 'mmc_v1_used_ms';
const LS_UNLOCKED = 'mmc_v1_unlocked';
const LS_USED_SIGS = 'mmc_v1_used_sigs';
const LS_SHARED = 'mmc_v1_shared';
const LAMPORTS_PER_SOL = 1_000_000_000;
const MIN_LAMPORTS = Math.round(UNLOCK_PRICE_SOL * LAMPORTS_PER_SOL);
const SOLANA_PAY_URL = `solana:${PAYMENT_ADDRESS}?amount=${UNLOCK_PRICE_SOL}&label=Mirmobe%20Meme%20Crucible`;
const SHARE_TEXT = "I just forged a meme in Mirmobe's Meme Crucible. Try the 5-minute sample:";

function readNumber(key) {
  const raw = localStorage.getItem(key);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function isUnlocked() {
  return localStorage.getItem(LS_UNLOCKED) === '1';
}

function hasShared() {
  return localStorage.getItem(LS_SHARED) === '1';
}

function allowedMs() {
  return TRIAL_MS + (hasShared() ? SHARE_BONUS_MS : 0);
}

function usedMs() {
  return Math.min(readNumber(LS_USED_MS), allowedMs() + 1000);
}

function remainingMs() {
  if (isUnlocked()) return Infinity;
  return Math.max(0, allowedMs() - usedMs());
}

function getUsedSignatures() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_USED_SIGS) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function setPaywallStatus(message, kind) {
  const el = document.getElementById('paywallStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'paywall-status' + (kind ? ' is-' + kind : '');
}

function updateTrialBadge() {
  const badge = document.getElementById('trialBadge');
  if (!badge) return;
  badge.classList.remove('is-low', 'is-unlocked');
  if (isUnlocked()) {
    badge.classList.add('is-unlocked');
    badge.textContent = 'Unlocked';
    return;
  }
  const left = remainingMs();
  badge.textContent = formatCountdown(left) + ' left';
  if (left <= 60 * 1000) badge.classList.add('is-low');
}

function showPaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  overlay.hidden = false;
  document.body.classList.add('paywalled');
  updateTrialBadge();
}

function hidePaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.hidden = true;
  document.body.classList.remove('paywalled');
  updateTrialBadge();
}

function persistUsed(ms) {
  localStorage.setItem(LS_USED_MS, String(Math.max(0, Math.floor(ms))));
}

let lastTick = Date.now();

function tickTrial() {
  const now = Date.now();
  const delta = now - lastTick;
  lastTick = now;
  if (isUnlocked()) {
    updateTrialBadge();
    return;
  }
  if (document.visibilityState === 'visible' && remainingMs() > 0 && delta > 0 && delta < 5000) {
    persistUsed(usedMs() + delta);
  }
  updateTrialBadge();
  if (remainingMs() <= 0) showPaywall();
  else hidePaywall();
}

function extractSignature(raw) {
  const text = (raw || '').trim();
  if (!text) return '';
  const urlMatch = text.match(/(?:solscan\.io|solana\.fm|explorer\.solana\.com)\/(?:tx|transaction)\/([1-9A-HJ-NP-Za-km-z]+)/i);
  if (urlMatch) return urlMatch[1];
  const sigMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{80,90}/);
  return sigMatch ? sigMatch[0] : '';
}

function collectAccountKeys(tx) {
  const keys = [];
  const accountKeys = (tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys) || [];
  accountKeys.forEach((key) => {
    keys.push(typeof key === 'string' ? key : key.pubkey);
  });
  const loaded = tx.meta && tx.meta.loadedAddresses;
  if (loaded) {
    (loaded.writable || []).forEach((key) => keys.push(key));
    (loaded.readonly || []).forEach((key) => keys.push(key));
  }
  return keys;
}

function recipientGainLamports(tx, address) {
  const keys = collectAccountKeys(tx);
  const index = keys.indexOf(address);
  if (index === -1) return 0;
  const pre = (tx.meta.preBalances || [])[index];
  const post = (tx.meta.postBalances || [])[index];
  if (!Number.isFinite(pre) || !Number.isFinite(post)) return 0;
  return post - pre;
}

async function verifyPaymentSignature(signature) {
  const used = getUsedSignatures();
  if (used.includes(signature)) {
    throw new Error('This signature has already been used in this browser.');
  }

  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        signature,
        {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        }
      ]
    })
  });

  if (!res.ok) {
    throw new Error('The Solana network could not be reached. Please try again in a moment.');
  }

  const body = await res.json();
  if (body.error) {
    throw new Error(body.error.message || 'The Solana network rejected that lookup.');
  }

  const tx = body.result;
  if (!tx) {
    throw new Error('That transaction was not found yet. Wait a few seconds, then try again.');
  }
  if (tx.meta == null || tx.meta.err) {
    throw new Error('That transaction did not succeed on-chain.');
  }

  const ageMs = Date.now() - ((tx.blockTime || 0) * 1000);
  if (!tx.blockTime || ageMs > PAYMENT_MAX_AGE_MS || ageMs < -60 * 1000) {
    throw new Error('That payment is older than 7 days, or has no timestamp.');
  }

  const gain = recipientGainLamports(tx, PAYMENT_ADDRESS);
  if (gain < MIN_LAMPORTS) {
    throw new Error('That transaction did not send at least ' + UNLOCK_PRICE_SOL + ' SOL to the unlock address.');
  }

  const latestUsed = getUsedSignatures();
  if (latestUsed.includes(signature)) {
    throw new Error('This signature has already been used in this browser.');
  }
  latestUsed.push(signature);
  localStorage.setItem(LS_USED_SIGS, JSON.stringify(latestUsed));
  localStorage.setItem(LS_UNLOCKED, '1');
}

async function grantShareBonus() {
  if (hasShared()) return false;
  const text = SHARE_TEXT;
  const url = SITE_URL;
  let shared = false;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Mirmobe's Meme Crucible", text, url });
      shared = true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
    }
  }
  if (!shared) {
    const intent = 'https://x.com/intent/post?text=' + encodeURIComponent(text + ' ' + url);
    window.open(intent, '_blank', 'noopener,noreferrer');
  }
  localStorage.setItem(LS_SHARED, '1');
  lastTick = Date.now();
  updateShareButton();
  updateTrialBadge();
  if (remainingMs() > 0) hidePaywall();
  return true;
}

function updateShareButton() {
  const btn = document.getElementById('shareBonusBtn');
  if (!btn) return;
  if (hasShared()) {
    btn.disabled = true;
    btn.textContent = 'Bonus claimed — enjoy your extra 5 minutes';
  }
}

function setupPaywallUi() {
  const amountText = UNLOCK_PRICE_SOL + ' SOL';
  const amountLabel = document.getElementById('payAmountLabel');
  const amountHero = document.getElementById('payAmountHero');
  const addressEl = document.getElementById('payAddressDisplay');
  const qr = document.getElementById('payQr');
  const payLink = document.getElementById('phantomPayLink');
  if (amountLabel) amountLabel.textContent = amountText;
  if (amountHero) amountHero.textContent = amountText;
  if (addressEl) addressEl.textContent = PAYMENT_ADDRESS;
  if (payLink) payLink.href = SOLANA_PAY_URL;
  if (qr) {
    qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(SOLANA_PAY_URL);
  }

  document.getElementById('copyPayAddressBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_ADDRESS);
      document.getElementById('copyPayAddressBtn').textContent = 'Copied';
      setTimeout(() => { document.getElementById('copyPayAddressBtn').textContent = 'Copy'; }, 1600);
    } catch (err) {
      setPaywallStatus('Copy failed. Select the address and copy it manually.', 'error');
    }
  });

  document.getElementById('shareBonusBtn').addEventListener('click', () => {
    grantShareBonus();
  });

  document.getElementById('verifyPayBtn').addEventListener('click', async () => {
    const signature = extractSignature(document.getElementById('txSigInput').value);
    if (!signature) {
      setPaywallStatus('Paste a valid Solana transaction signature first.', 'error');
      return;
    }
    const btn = document.getElementById('verifyPayBtn');
    btn.disabled = true;
    setPaywallStatus('Checking the chain…', 'pending');
    try {
      await verifyPaymentSignature(signature);
      setPaywallStatus('Payment confirmed. The Crucible is unlocked!', 'ok');
      hidePaywall();
      updateTrialBadge();
    } catch (err) {
      setPaywallStatus(err && err.message ? err.message : 'Could not verify that payment.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  updateShareButton();
}

export function initTrialPaywall() {
  setupPaywallUi();
  lastTick = Date.now();
  document.addEventListener('visibilitychange', () => {
    lastTick = Date.now();
    tickTrial();
  });
  setInterval(tickTrial, 250);
  tickTrial();
}
