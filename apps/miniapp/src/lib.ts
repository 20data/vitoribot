const faNum = new Intl.NumberFormat('fa-IR');

export function fa(n: string | number): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  return faNum.format(num);
}

export function jalali(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export interface Product {
  id: string;
  groupName: string;
  name: string;
  trafficGB: number;
  durationDays: number;
  price: string;
  server: string;
}

export interface Service {
  id: string;
  productName: string;
  totalGB: number;
  usedGB: number | null;
  expiresAt: string | null;
  status: string;
  subLink: string;
}
