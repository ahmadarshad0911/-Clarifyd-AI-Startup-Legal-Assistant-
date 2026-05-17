import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM encryption for OAuth tokens at rest.
// VAULT_KEY env must be base64-encoded 32 bytes.

const keyBuffer = (): Buffer => {
  const raw = process.env.VAULT_KEY;
  if (!raw) throw new Error('VAULT_KEY not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('VAULT_KEY must decode to 32 bytes');
  return buf;
};

export const encrypt = (plaintext: string): Buffer => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: [iv(12)][tag(16)][ciphertext]
  return Buffer.concat([iv, tag, enc]);
};

export const decrypt = (blob: Buffer): string => {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
};
