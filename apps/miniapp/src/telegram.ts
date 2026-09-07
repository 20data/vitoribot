import WebApp from '@twa-dev/sdk';

// Telegram WebApp bridge: theme, haptics, initData. Safe outside Telegram (dev).

export function isTelegram(): boolean {
  return typeof window !== 'undefined' && Boolean((WebApp as { initData?: string }).initData);
}

export function getInitData(): string {
  try {
    return WebApp.initData || '';
  } catch {
    return '';
  }
}

export function ready(): void {
  try {
    WebApp.ready();
    WebApp.expand();
  } catch {
    // ignore outside Telegram
  }
}

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    WebApp.HapticFeedback?.impactOccurred(kind);
  } catch {
    // ignore
  }
}

export function notifyHaptic(kind: 'success' | 'warning' | 'error'): void {
  try {
    WebApp.HapticFeedback?.notificationOccurred(kind);
  } catch {
    // ignore
  }
}

/** Apply Telegram themeParams as CSS variables + dark class. Returns color scheme. */
export function applyTelegramTheme(): 'dark' | 'light' {
  try {
    const params = WebApp.themeParams as unknown as Record<string, string | undefined>;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(params)) {
      if (value) root.style.setProperty(`--tg-${key.replace(/_/g, '-')}`, value);
    }
    const scheme = WebApp.colorScheme === 'light' ? 'light' : 'dark';
    root.classList.toggle('dark', scheme === 'dark');
    return scheme;
  } catch {
    document.documentElement.classList.add('dark');
    return 'dark';
  }
}

export function telegramUser(): { firstName: string; photoUrl?: string } {
  try {
    const u = (WebApp.initDataUnsafe as { user?: { first_name?: string; photo_url?: string } }).user;
    return { firstName: u?.first_name ?? 'کاربر', photoUrl: u?.photo_url };
  } catch {
    return { firstName: 'کاربر' };
  }
}
