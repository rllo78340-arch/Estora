import { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { ThemeProvider } from './context/ThemeContext';
import { AddPropertyPage } from './pages/AddPropertyPage';
import { AdminPage } from './pages/AdminPage';
import { CatalogPage } from './pages/CatalogPage';
import { EstoraAiPage } from './pages/EstoraAiPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { InteriorDesignerPage } from './pages/InteriorDesignerPage';
import type { PropertyListing } from './types/estora';

function AppRouter() {
  const { onNavigateCallbackRef } = useRealtime();
  const [locationState, setLocationState] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setLocationState({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setLocationState({
      pathname: url.pathname || '/',
      search: url.search || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    onNavigateCallbackRef.current = navigate;
    return () => {
      onNavigateCallbackRef.current = null;
    };
  }, [navigate, onNavigateCallbackRef]);

  const { pathname, search } = locationState;

  const renderPage = () => {
    switch (pathname) {
      case '/':
        return <HomePage onNavigate={navigate} onSelectProperty={setSelectedProperty} />;
      case '/catalog':
        return (
          <CatalogPage mode="catalog" querySearch={search} onSelectProperty={setSelectedProperty} />
        );
      case '/sale':
        return (
          <CatalogPage mode="sale" querySearch={search} onSelectProperty={setSelectedProperty} />
        );
      case '/rent':
        return (
          <CatalogPage mode="rent" querySearch={search} onSelectProperty={setSelectedProperty} />
        );
      case '/3d':
        return <CatalogPage mode="3d" querySearch={search} onSelectProperty={setSelectedProperty} />;
      case '/ai':
        return (
          <EstoraAiPage
            querySearch={search}
            onNavigate={navigate}
            onSelectProperty={setSelectedProperty}
          />
        );
      case '/favorites':
        return <FavoritesPage onNavigate={navigate} onSelectProperty={setSelectedProperty} />;
      case '/add':
        return (
          <AddPropertyPage
            querySearch={search}
            onCreated={(created) => {
              setSelectedProperty(created);
              navigate('/profile');
            }}
          />
        );
      case '/messages':
        return <MessagesPage querySearch={search} onNavigate={navigate} />;
      case '/profile':
        return (
          <ProfilePage
            querySearch={search}
            onNavigate={navigate}
            onSelectProperty={setSelectedProperty}
          />
        );
      case '/settings':
        return <SettingsPage />;
      case '/design':
        return <InteriorDesignerPage querySearch={search} onNavigate={navigate} />;
      case '/admin':
        return <AdminPage />;
      default:
        return <HomePage onNavigate={navigate} onSelectProperty={setSelectedProperty} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F8F7] text-[#171717] transition-colors duration-200 dark:bg-[#111111] dark:text-[#F5F5F5]">
      <Navbar currentPath={pathname} onNavigate={navigate} />
      <main className="flex-1">{renderPage()}</main>
      <Footer onNavigate={navigate} />
      <PropertyDetailModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onNavigate={navigate}
      />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <RealtimeProvider>
            <AppRouter />
          </RealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
