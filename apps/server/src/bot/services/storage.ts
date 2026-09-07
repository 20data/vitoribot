import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/** Download a Telegram file_id and store it locally. Returns the storage path. */
export async function storeTelegramPhoto(
  getFilePath: (fileId: string) => Promise<string>,
  fileId: string,
  subdir: string,
): Promise<string> {
  const token = process.env['BOT_TOKEN'] ?? '';
  const filePath = await getFilePath(fileId);
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to download receipt image');
  const buf = Buffer.from(await res.arrayBuffer());

  const base = process.env['STORAGE_LOCAL_PATH'] ?? '/app/uploads';
  const dir = path.join(base, subdir);
  await fs.mkdir(dir, { recursive: true });
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(8).toString('hex')}.jpg`;
  const full = path.join(dir, name);
  await fs.writeFile(full, buf);
  return full;
}
