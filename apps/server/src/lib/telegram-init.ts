import crypto from 'node:crypto';

export interface ParsedInitData {
  [key: string]: string;
}

/** Parse Telegram Mini App initData query string into a key/value map. */
export function parseInitData(initData: string): ParsedInitData {
  const out: ParsedInitData = {};
  const params = new URLSearchParams(initData);
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Validate Telegram WebApp initData HMAC-SHA256 signature.
 * Throws on invalid signature or stale auth_date (>600s).
 */
export function validateInitData(initData: string, botToken: string): ParsedInitData {
  const parsed = parseInitData(initData);
  const hash = parsed['hash'];
  if (!hash) throw new Error('Missing initData hash');

  const authDate = Number(parsed['auth_date'] ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 600) {
    throw new Error('initData expired');
  }

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const checkString = Object.entries(parsed)
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const calc = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  if (calc !== hash) throw new Error('Invalid initData signature');
  return parsed;
}
