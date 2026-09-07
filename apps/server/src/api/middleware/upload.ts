import type { FastifyRequest } from 'fastify';

/** Validate uploaded receipt file: 5MB max, JPEG/PNG/WebP magic bytes only. */
const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

export function detectMime(buf: Buffer): string | null {
  for (const m of MAGIC) {
    const head = buf.subarray(0, m.bytes.length);
    if (m.bytes.every((b, i) => head[i] === b)) return m.mime;
  }
  return null;
}

export async function assertValidReceiptUpload(request: FastifyRequest): Promise<Buffer> {
  const file = await request.file();
  if (!file) throw new Error('No file uploaded');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of file.file) {
    size += (chunk as Buffer).length;
    if (size > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)');
    chunks.push(chunk as Buffer);
  }
  const buf = Buffer.concat(chunks);
  if (!detectMime(buf)) throw new Error('Only JPEG/PNG/WebP images are accepted');
  return buf;
}
