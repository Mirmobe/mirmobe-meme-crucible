// Client-side prompt gate. The image service has its own filter too.
// Reasons stay generic so the panel does not repeat blocked wording.

const SEXUAL = /\b(porn|porno|nsfw|nude|nudes|naked|topless|bottomless|sex|sexual|sexy|xxx|hentai|erotic|explicit|boobs|breasts|penis|vagina|blowjob|orgasm|onlyfans|fetish|camgirl)\b/i;
const YOUTH = /\b(child|children|kid|kids|toddler|infant|preteen|underage|minor|minors|teen|teens|teenager|schoolgirl|schoolboy|loli|lolita|shota|jailbait|csam|\d{1,2}\s*years?\s*old)\b/i;
const MINOR_BLOCK = /\b(loli|lolita|shota|jailbait|csam|child\s*porn|preteen|underage)\b/i;
const DEEPFAKE = /\b(deep\s*fakes?|face\s*swaps?|faceswaps?|impersonat(?:e|ing|ion)|exact\s+likeness|looks?\s+exactly\s+like|celebrity\s+likeness|real\s+person(?:'s)?\s+face)\b/i;
const FACE_SWAP = /\b(put|swap|paste|replace)\b[^.!?\n]{0,48}\bface\b/i;
const NAMED_PHOTO = /\b(?:photo|photograph|portrait|picture|image)\s+of\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/;
const HATE = /\b(kill\s+all|gas\s+the|white\s+power|heil\s+hitler|sieg\s+heil|ethnic\s+cleansing|race\s+war)\b/i;
const SLUR = /\b(nigger|nigga|faggot|kike|spic|chink|tranny|retard)\b/i;

const BLOCKED = 'That prompt is not allowed. This app does not generate sexual content, sexual or exploitative images of minors, fake photos of real people, or hate.';

export function reviewPrompt(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: 'Describe a picture first.' };
  if (text.length > 400) return { ok: false, reason: 'Keep the prompt under 400 characters.' };
  const sexual = SEXUAL.test(text);
  const youth = YOUTH.test(text);
  if (MINOR_BLOCK.test(text) || (sexual && youth)) return { ok: false, reason: BLOCKED };
  if (sexual) return { ok: false, reason: BLOCKED };
  if (DEEPFAKE.test(text) || FACE_SWAP.test(text) || NAMED_PHOTO.test(text)) return { ok: false, reason: BLOCKED };
  if (HATE.test(text) || SLUR.test(text)) return { ok: false, reason: BLOCKED };
  return { ok: true, text };
}
