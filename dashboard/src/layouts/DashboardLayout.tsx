import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Moon, Sun, LogOut, Menu } from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage, toggleSidebar } = useAppStore();

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['session'],
    queryFn: client.session,
    retry: false,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (isError || !session) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await client.logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fa' ? 'en' : 'fa');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1 font-semibold text-lg truncate">VitoriBot</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" onClick={toggleLanguage}>
            {language === 'fa' ? 'EN' : 'فا'}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
