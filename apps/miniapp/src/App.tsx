import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Buy } from './pages/Buy';
import { Services } from './pages/Services';
import { Tickets } from './pages/Tickets';
import { Profile } from './pages/Profile';
import { applyTelegramTheme, ready } from './telegram';
import { login, useAuth } from './api/client';

function AnimatedRoutes(): JSX.Element {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.18 }}
      >
        <Routes location={location}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/services" element={<Services />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function Boot(): JSX.Element {
  const { ready: isReady, error, token, theme } = useAuth();

  useEffect(() => {
    ready();
    void login();
  }, []);

  useEffect(() => {
    const scheme = applyTelegramTheme();
    const dark = theme === 'dark' || (theme === 'auto' && scheme === 'dark');
    document.documentElement.classList.toggle('dark', dark);
  }, [theme]);

  if (!isReady) return <p className="p-6 text-center">⏳ در حال بارگذاری...</p>;
  if (error || !token) return <p className="p-6 text-center">{error ?? 'خطا'}</p>;
  return <AnimatedRoutes />;
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Boot />
    </BrowserRouter>
  );
}
