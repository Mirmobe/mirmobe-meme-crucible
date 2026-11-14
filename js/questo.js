import { nacl } from './vendor/nacl.js';

// Whole tokens, not raw units. QUESTO has 6 decimals.
export const QUESTO_HOLDER_MIN = 1_000_000;
export const QUESTO_DECIMALS = 6;
export const QUESTO_MINT = '5eCknU1RcP4QwWXCYicE4VGG8KY69TTUL7YZTma4pump';
export const QUESTO_BUY_URL = 'https://pump.fun/coin/5eCknU1RcP4QwWXCYicE4VGG8KY69TTUL7YZTma4pump';
export const HOLDER_RECHECK_MS = 24 * 60 * 60 * 1000;

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const LS_HOLDER = 'mmc_v1_questo_holder';
const RETRY_MS = 15 * 60 * 1000;
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export const SOLANA_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana'
];

const standardWallets = [];
let standardListening = false;

function listenForStandardWallets() {
  if (standardListening || typeof window === 'undefined') return;
  standardListening = true;
  window.addEventListener('wallet-standard:register-wallet', (event) => {
    const api = event.detail;
    if (typeof api !== 'function') return;
    try {
      api({
        register(wallet) {
          const features = wallet && wallet.features;
          if (!features || !features['solana:signMessage']) return;
          if (standardWallets.some((item) => item === wallet)) return;
          standardWallets.push(wallet);
        }
      });
    } catch (err) { /* a wallet that fails to register is skipped */ }
  });
  try { window.dispatchEvent(new Event('wallet-standard:app-ready')); } catch (err) { /* ignore */ }
}

if (typeof window !== 'undefined') listenForStandardWallets();

export function encodeBase58(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros += 1;
  const size = (((input.length - zeros) * 138) / 100 + 1) | 0;
  const bins = new Uint8Array(size);
  let length = 0;
  for (let i = zeros; i < input.length; i += 1) {
    let carry = input[i];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length) && k >= 0; k -= 1, j += 1) {
      carry += 256 * bins[k];
      bins[k] = carry % 58;
      carry = (carry / 58) | 0;
    }
    length = j;
  }
  let it = size - length;
  while (it < size && bins[it] === 0) it += 1;
  let out = '1'.repeat(zeros);
  for (; it < size; it += 1) out += B58[bins[it]];
  return out || '1';
}

export function decodeBase58(text) {
  const value = String(text || '');
  if (!value) return new Uint8Array();
  const bytes = [0];
  for (let i = 0; i < value.length; i += 1) {
    const index = B58.indexOf(value[i]);
    if (index < 0) throw new Error('That address is not valid.');
    let carry = index;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < value.length && value[i] === '1'; i += 1) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

export function holderMessage(owner, nonce) {
  return [
    'Meme Crucible holder unlock',
    '',
    'Sign this message to prove you control this wallet.',
    'The app will then read the public $QUESTO balance for this address.',
    'This is not a transaction. No SOL is spent and nothing is approved.',
    '',
    'Wallet: ' + owner,
    'Nonce: ' + nonce
  ].join('\n');
}

function randomNonce() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return encodeBase58(bytes);
}

function keyBytes(publicKey) {
  if (!publicKey) return null;
  if (publicKey instanceof Uint8Array) return publicKey;
  if (typeof publicKey.toBytes === 'function') return publicKey.toBytes();
  if (Array.isArray(publicKey)) return new Uint8Array(publicKey);
  return null;
}

export function verifyHolderSignature(message, signature, publicKey) {
  const encoded = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const sig = signature instanceof Uint8Array ? signature : new Uint8Array(signature || []);
  const key = keyBytes(publicKey);
  if (!key || key.length !== 32 || sig.length !== 64) return false;
  return nacl.sign.detached.verify(encoded, sig, key);
}

function cancelled(err) {
  if (!err) return false;
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') return true;
  return /reject|cancel|declin|denied/i.test(String(err.message || ''));
}

function cancelError() {
  const error = new Error('The wallet request was cancelled.');
  error.name = 'AbortError';
  return error;
}

async function proveInjected(provider) {
  if (typeof provider.signMessage !== 'function') {
    throw new Error('This wallet cannot sign a message. The unlock does not send a transaction.');
  }
  const connected = await provider.connect();
  const publicKey = (connected && connected.publicKey) || provider.publicKey;
  const bytes = keyBytes(publicKey);
  if (!bytes) throw new Error('The wallet did not share an address.');
  const owner = encodeBase58(bytes);
  const message = holderMessage(owner, randomNonce());
  const encoded = new TextEncoder().encode(message);
  const signed = await provider.signMessage(encoded, 'utf8');
  const signature = signed && signed.signature ? signed.signature : signed;
  const returned = signed && signed.publicKey ? keyBytes(signed.publicKey) : bytes;
  if (!returned || encodeBase58(returned) !== owner) {
    throw new Error('The wallet returned a different address than the one it connected.');
  }
  if (!verifyHolderSignature(encoded, signature, returned)) {
    throw new Error('The wallet signature did not verify.');
  }
  return owner;
}

async function proveStandard(wallet) {
  const features = wallet.features || {};
  const connect = features['standard:connect'];
  const sign = features['solana:signMessage'];
  if (!sign || typeof sign.signMessage !== 'function') {
    throw new Error('This wallet cannot sign a message. The unlock does not send a transaction.');
  }
  if (connect && typeof connect.connect === 'function') await connect.connect();
  const account = (wallet.accounts || [])[0];
  if (!account || !account.address || !account.publicKey) {
    throw new Error('The wallet did not share an account.');
  }
  const owner = account.address;
  if (encodeBase58(account.publicKey) !== owner) {
    throw new Error('The wallet account does not match its address.');
  }
  const message = holderMessage(owner, randomNonce());
  const encoded = new TextEncoder().encode(message);
  const [result] = await sign.signMessage({ account, message: encoded });
  if (!result || !verifyHolderSignature(encoded, result.signature, account.publicKey)) {
    throw new Error('The wallet signature did not verify.');
  }
  return owner;
}

function addInjected(list, name, provider) {
  if (!provider || typeof provider.signMessage !== 'function') return;
  if (list.some((item) => item.provider === provider)) return;
  list.push({ name, kind: 'injected', provider });
}

export function listWallets() {
  listenForStandardWallets();
  const list = [];
  if (typeof window === 'undefined') return list;
  const phantom = window.phantom && window.phantom.solana;
  if (phantom && phantom.isPhantom) addInjected(list, 'Phantom', phantom);
  if (window.solflare) addInjected(list, 'Solflare', window.solflare);
  if (window.backpack) addInjected(list, 'Backpack', window.backpack);
  const generic = window.solana;
  if (generic && generic !== phantom) {
    const name = generic.isPhantom ? 'Phantom' : (generic.isSolflare ? 'Solflare' : 'Wallet');
    addInjected(list, name, generic);
  }
  const names = new Set(list.map((item) => item.name));
  standardWallets.forEach((wallet) => {
    if (names.has(wallet.name)) return;
    list.push({ name: wallet.name || 'Wallet', kind: 'standard', wallet });
  });
  return list;
}

export async function proveWallet(entry) {
  try {
    if (entry.kind === 'standard') return await proveStandard(entry.wallet);
    return await proveInjected(entry.provider);
  } catch (err) {
    if (cancelled(err)) throw cancelError();
    throw err;
  }
}

export function balanceFromParsedAccounts(results) {
  const seen = new Set();
  let raw = 0n;
  const lists = Array.isArray(results) ? results : [results];
  lists.forEach((result) => {
    const rows = (result && result.value) || [];
    rows.forEach((row) => {
      if (!row || seen.has(row.pubkey)) return;
      seen.add(row.pubkey);
      const info = row.account && row.account.data && row.account.data.parsed && row.account.data.parsed.info;
      if (!info || info.mint !== QUESTO_MINT) return;
      const amount = info.tokenAmount && info.tokenAmount.amount;
      if (typeof amount !== 'string' || !/^\d+$/.test(amount)) return;
      raw += BigInt(amount);
    });
  });
  return raw;
}

export function holderMinRaw() {
  return BigInt(QUESTO_HOLDER_MIN) * (10n ** BigInt(QUESTO_DECIMALS));
}

export function holderBalanceMeetsMin(raw) {
  return BigInt(raw) >= holderMinRaw();
}

export function formatQuesto(raw) {
  const value = BigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const scale = 10n ** BigInt(QUESTO_DECIMALS);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(QUESTO_DECIMALS, '0').replace(/0+$/, '');
  return (negative ? '-' : '') + whole.toString() + (frac ? '.' + frac : '');
}

function busyError() {
  return new Error('The public Solana network is busy. Wait a moment and try again.');
}

function downError() {
  return new Error('The public Solana network could not be reached. Try again in a moment.');
}

export async function rpcCall(method, params) {
  let last = downError();
  for (let i = 0; i < SOLANA_RPCS.length; i += 1) {
    const url = SOLANA_RPCS[i];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      if (res.status === 429 || res.status === 503) {
        last = busyError();
        continue;
      }
      if (!res.ok) {
        last = downError();
        continue;
      }
      const body = await res.json();
      if (body.error) {
        const message = body.error.message || '';
        if (body.error.code === 429 || /rate|limit|429|congested|too many/i.test(message)) {
          last = busyError();
          continue;
        }
        last = new Error(message || 'The Solana lookup failed.');
        continue;
      }
      return body.result;
    } catch (err) {
      last = downError();
    }
  }
  throw last;
}

export async function fetchQuestoRawBalance(owner, call = rpcCall) {
  const byMint = await call('getParsedTokenAccountsByOwner', [
    owner,
    { mint: QUESTO_MINT },
    { commitment: 'confirmed' }
  ]);
  let token2022 = { value: [] };
  try {
    token2022 = await call('getParsedTokenAccountsByOwner', [
      owner,
      { programId: TOKEN_2022_PROGRAM },
      { commitment: 'confirmed' }
    ]);
  } catch (err) {
    if (!((byMint && byMint.value) || []).length) throw err;
  }
  return balanceFromParsedAccounts([byMint, token2022]);
}

export function readHolderGrant() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_HOLDER) || 'null');
    if (!parsed || parsed.ok !== true || typeof parsed.owner !== 'string') return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function holderUnlockActive() {
  return Boolean(readHolderGrant());
}

export function clearHolderGrant() {
  localStorage.removeItem(LS_HOLDER);
}

function saveGrant(owner, raw) {
  const grant = { owner, raw: raw.toString(), checkedAt: Date.now(), ok: true };
  localStorage.setItem(LS_HOLDER, JSON.stringify(grant));
  return grant;
}

function grantDue(grant) {
  const daily = Number(grant.checkedAt || 0) + HOLDER_RECHECK_MS;
  const retry = Number(grant.nextCheckAt || 0);
  return Date.now() >= Math.max(daily, retry);
}

export async function refreshHolderGrant(call = rpcCall) {
  const grant = readHolderGrant();
  if (!grant) return { active: false };
  if (!grantDue(grant)) return { active: true, grant };
  try {
    const raw = await fetchQuestoRawBalance(grant.owner, call);
    if (holderBalanceMeetsMin(raw)) return { active: true, grant: saveGrant(grant.owner, raw) };
    clearHolderGrant();
    return { active: false, below: true, raw };
  } catch (err) {
    grant.nextCheckAt = Date.now() + RETRY_MS;
    localStorage.setItem(LS_HOLDER, JSON.stringify(grant));
    return { active: true, grant, error: err };
  }
}

export async function unlockHolderWallet(entry, call = rpcCall) {
  const owner = await proveWallet(entry);
  const raw = await fetchQuestoRawBalance(owner, call);
  if (!holderBalanceMeetsMin(raw)) {
    return {
      ok: false,
      owner,
      raw,
      message: 'This wallet holds ' + formatQuesto(raw) + ' $QUESTO. The free unlock needs ' + QUESTO_HOLDER_MIN.toLocaleString('en-US') + ' or more. The trial and the 0.05 SOL unlock are still available. Apps, not investments.'
    };
  }
  saveGrant(owner, raw);
  return {
    ok: true,
    owner,
    raw,
    message: 'Holder unlock is on for this browser. The balance is checked about once a day. Apps, not investments.'
  };
}
