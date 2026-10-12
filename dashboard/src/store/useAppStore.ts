import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type Language = 'fa' | 'en';

interface AppState {
  theme: Theme;
  language: Language;
  sidebarOpen: boolean;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'fa',
      sidebarOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => {
        set({ language });
        document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
        // The actual i18next language change should be triggered in an effect or App root
        // to avoid circular dependency in the store directly.
      },
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'app-storage',
    }
  )
);
