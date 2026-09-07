const faNum = new Intl.NumberFormat('fa-IR');
const faJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const faJalaliTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Format a number with Persian digits. */
export function fa(n: string | number): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  return faNum.format(num);
}

/** Format ISO date as Jalali date (fa-IR). */
export function jalali(iso: string | Date): string {
  return faJalali.format(new Date(iso));
}

/** Format ISO date as Jalali datetime. */
export function jalaliTime(iso: string | Date): string {
  return faJalaliTime.format(new Date(iso));
}
