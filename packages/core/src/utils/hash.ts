import crypto from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
  const h = crypto.createHash('sha256');
  h.update(input);
  return h.digest('hex');
}

