const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
// Key derived from env — must be exactly 32 bytes
const KEY = Buffer.from(
  (process.env.DIGILOCKER_ENC_KEY || 'digilocker_enc_key_32bytes_padded').padEnd(32, '0').slice(0, 32)
);

// ── AES-256-GCM encrypt ───────────────────────────────────────────────────────
// Returns "iv:authTag:ciphertext" (all hex) — safe to store in DB TEXT column.
function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// ── AES-256-GCM decrypt ───────────────────────────────────────────────────────
function decrypt(stored) {
  if (!stored) return null;
  const [ivHex, authTagHex, encHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── Aadhaar masking ───────────────────────────────────────────────────────────
// "123456789012" → "XXXX XXXX 9012"
function maskAadhaar(aadhaar) {
  const s = String(aadhaar).replace(/\s/g, '');
  if (s.length !== 12) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${s.slice(8)}`;
}

// ── PAN masking ───────────────────────────────────────────────────────────────
// "ABCDE1234F" → "XXXXX1234X"
function maskPan(pan) {
  const s = String(pan).toUpperCase();
  if (s.length !== 10) return 'XXXXXXXXXX';
  return `XXXXX${s.slice(5, 9)}X`;
}

// ── Document type detector ────────────────────────────────────────────────────
function detectDocType(value) {
  const v = String(value).trim().replace(/\s/g, '');
  if (/^\d{12}$/.test(v)) return 'aadhaar';
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(v)) return 'pan';
  return 'unknown';
}

// ── Confidence score ──────────────────────────────────────────────────────────
// Based on mode and match quality
function confidenceScore(status, mode) {
  if (status !== 'Verified') return 10;
  if (mode === 'live') return 98;
  return 85; // mock — high but not 100 since it's sample data
}

// ── Authenticity score (bonus requirement) ────────────────────────────────────
function authenticityScore(status) {
  return status === 'Verified' ? 100 : 30;
}

module.exports = { encrypt, decrypt, maskAadhaar, maskPan, detectDocType, confidenceScore, authenticityScore };
