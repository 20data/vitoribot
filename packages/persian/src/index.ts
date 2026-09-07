import * as jalaali from 'jalaali-js';

export { DEFAULT_MESSAGES } from './defaultMessages.js';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/** Convert Latin digits in a string to Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/** Convert Persian digits to Latin digits. */
export function toEnDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d as (typeof FA_DIGITS)[number])));
}

/** Format a number with thousand separators + Persian digits. */
export function formatToman(amount: string | number): string {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(num)) return toFaDigits(String(amount));
  return toFaDigits(num.toLocaleString('en-US'));
}

/** Format a UTC date as Jalali string: YYYY/MM/DD. */
export function toJalali(date: Date): string {
  const j = jalaali.toJalaali(date);
  const mm = String(j.jm).padStart(2, '0');
  const dd = String(j.jd).padStart(2, '0');
  return toFaDigits(`${j.jy}/${mm}/${dd}`);
}

/** Format a UTC date as Jalali datetime string. */
export function toJalaliDateTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${toJalali(date)} — ${toFaDigits(`${hh}:${mi}`)}`;
}

/** Escape user input for safe use in Telegram MarkdownV2 messages. */
export function escapeMarkdown(input: string): string {
  return input.replace(/([_*[()\]~`>#+\-=|{}.!])/g, '\\$1');
}

export type TemplateVars = Record<string, string | number>;

/** Render a message template, replacing {{var}} placeholders. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value));
  }
  return out;
}
