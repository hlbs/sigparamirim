import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { LanguageCode, usePreferences } from './stores/preferences';
import { signOutUser, useAuth } from './features/auth';
import { AuthLoading } from './components/AuthLoading';
import { UserAvatar } from './components/UserAvatar';
import { PlatformRoute, ProtectedRoute, RoleRoute } from './components/RouteGuards';
import { AuthPage } from './pages/AuthPage';
import { AccessDeniedPage, AccountStatusPage, AdminPage, EditorialPage, ProfilePage } from './pages/AccountPages';
import { HomePage } from './pages/HomePage';

const navigation = [
  { path: '/', label: 'Início', icon: 'home' },
  { path: '/mapa', label: 'Mapa', icon: 'map' },
  { path: '/observatorio', label: 'Observatório', icon: 'chart' },
  { path: '/ajuda', label: 'Ajuda', icon: 'help' },
];

const languages: LanguageCode[] = ['PT', 'EN', 'ES', 'FR', 'ZH', 'DE', 'AR'];

type IconName = 'home' | 'map' | 'chart' | 'help' | 'menu' | 'moon' | 'sun' | 'bell' | 'edit' | 'settings';
function UiIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v10h13V9M9 19v-5h6v5',
    map: 'M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20zM9 4v13.5M15 6.5V20',
    chart: 'M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-7',
    help: 'M9.4 9a2.7 2.7 0 1 1 4.4 2.1c-1.3 1-1.8 1.4-1.8 3M12 18h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    moon: 'M20 15.2A8 8 0 0 1 8.8 4 8.1 8.1 0 1 0 20 15.2Z',
    sun: 'M12 3v2m0 14v2M3 12h2m14 0h2m-3.4-6.6 1.4-1.4M6.4 17.6 5 19m0-14 1.4 1.4m11.2 11.2 1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    bell: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
    settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm0-12 1 2.1 2.3.5 1.8-1.4 1.7 1.7-1.4 1.8.5 2.3 2.1 1 2.1-2.1 1-.5 2.3 1.4 1.8-1.7 1.7-1.8-1.4-2.3.5-1 2.1h-2l-1-2.1-2.3-.5-1.8 1.4-1.7-1.7 1.4-1.8-.5-2.3-2.1-1v-2l2.1-1 .5-2.3-1.4-1.8 1.7-1.7 1.8 1.4 2.3-.5 1-2.1h2Z',
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder" aria-labelledby={`title-${title}`}>
      <span className="eyebrow">Módulo em preparação</span>
      <h1 id={`title-${title}`}>{title}</h1>
      <p>{description}</p>
      <div className="status-panel">
        <span className="status-dot" aria-hidden="true" />
        Arquitetura preparada para implementação incremental e validação em emuladores.
      </div>
    </section>
  );
}

function PlatformShell() {
  const { theme, setTheme, language, setLanguage, sidebarOpen, setSidebarOpen } = usePreferences();
  const { user, loading } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const firebaseConfigured = Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY
      && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
      && import.meta.env.VITE_FIREBASE_PROJECT_ID
      && import.meta.env.VITE_FIREBASE_APP_ID,
  );

  const resolvedTheme = useMemo(() => {
    if (theme !== 'system') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [theme]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const close = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileMenuOpen]);

  if (loading) return <AuthLoading />;

  const roleNavigation = user?.role === 'admin'
    ? [{ path: '/editorial', label: 'Área editorial', icon: 'edit' as const }, { path: '/administracao', label: 'Administração', icon: 'settings' as const }]
    : user?.role === 'editor'
      ? [{ path: '/editorial', label: 'Área editorial', icon: 'edit' as const }]
      : [];
  const visibleNavigation = [...navigation, ...roleNavigation];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menu">
          <UiIcon name="menu" />
        </button>
        <NavLink className="brand" to="/" aria-label="SIG Paramirim — início">
          <img src="/sig-logo.png" alt="" />
          <span>SIG Paramirim</span>
        </NavLink>
        <span className="version">v{__APP_VERSION__}</span>

        <div className="topbar-actions">
          <select
            className="compact-select"
            aria-label="Idioma"
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          >
            {languages.map((code) => <option key={code}>{code}</option>)}
          </select>

          <button
            className="icon-button"
            aria-label={`Alterar tema. Tema atual: ${resolvedTheme}`}
            onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
          >
            <UiIcon name={resolvedTheme === 'light' ? 'moon' : 'sun'} />
          </button>

          <div className="notification-anchor">
            <button
              className="icon-button"
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <UiIcon name="bell" />
            </button>
            {notificationsOpen && (
              <div className="notification-popover" role="dialog" aria-label="Notificações recentes">
                <strong>Notificações</strong>
                <p>Nenhuma notificação nesta etapa.</p>
                <button className="text-button">Ver histórico completo</button>
              </div>
            )}
          </div>

          {user ? (
            <div className="profile-menu-anchor" ref={profileMenuRef}>
              <button className="profile-trigger" type="button" aria-label="Menu do usuário" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
                <UserAvatar name={user.displayName} email={user.email} photoURL={user.photoURL} />
                <span className="profile-trigger-caret" aria-hidden="true">⌄</span>
              </button>
              {profileMenuOpen && (
                <div className="profile-popover" role="menu">
                  <div className="profile-popover-header">
                    <strong>{user.displayName || 'Usuário SIG Paramirim'}</strong>
                    <small>{user.email}</small>
                  </div>
                  <NavLink className="profile-menu-item" to="/perfil" role="menuitem" onClick={() => setProfileMenuOpen(false)}>◉ <span>Meu perfil</span></NavLink>
                  <button className="profile-menu-item danger" type="button" role="menuitem" onClick={() => void signOutUser()}>↪ <span>Sair da conta</span></button>
                </div>
              )}
            </div>
          ) : (
            <NavLink className="login-link" to="/entrar">Entrar</NavLink>
          )}
        </div>
      </header>

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Navegação principal">
        <nav>
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span aria-hidden="true"><UiIcon name={item.icon as IconName} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`connection-dot ${firebaseConfigured ? 'ready' : ''}`} aria-hidden="true" />
          <div className="sidebar-author">
            <span>Desenvolvido por Hermes Santos</span>
            <small>Inteligência geográfica e ciência territorial</small>
          </div>
          <div className="sidebar-socials" aria-label="Redes do desenvolvedor">
            <a href="#github" aria-label="GitHub (link demonstrativo)">GH</a>
            <a href="#linkedin" aria-label="LinkedIn (link demonstrativo)">in</a>
            <a href="#lattes" aria-label="Lattes (link demonstrativo)">L</a>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/mapa" element={<Placeholder title="Mapa e dashboard" description="O catálogo geoespacial e o motor OpenLayers serão conectados após a validação das camadas iniciais." />} />
          <Route path="/observatorio" element={<Placeholder title="Observatório Científico Paramirim" description="Acervo pesquisável de publicações, fontes e estudos sobre a bacia." />} />
          <Route path="/ajuda" element={<Placeholder title="Central de ajuda" description="Abertura e acompanhamento de tickets com histórico e anexos protegidos." />} />
          <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/editorial" element={<RoleRoute allowed={['editor', 'admin']}><EditorialPage /></RoleRoute>} />
          <Route path="/administracao" element={<RoleRoute allowed={['admin']}><AdminPage /></RoleRoute>} />
          <Route path="/acesso-restrito" element={<ProtectedRoute><AccessDeniedPage /></ProtectedRoute>} />
        </Routes>
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.slice(0, 4).map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
            <span aria-hidden="true"><UiIcon name={item.icon as IconName} /></span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  const { theme, language } = usePreferences();
  const resolvedTheme = useMemo(() => {
    if (theme !== 'system') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.lang = language === 'PT' ? 'pt-BR' : language.toLowerCase();
    document.documentElement.dir = language === 'AR' ? 'rtl' : 'ltr';
  }, [language, resolvedTheme]);

  return (
    <Routes>
      <Route path="/entrar" element={<AuthPage />} />
      <Route path="/criar-conta" element={<Navigate to="/entrar" replace />} />
      <Route path="/status-conta" element={<AccountStatusPage />} />
      <Route path="*" element={<PlatformRoute><PlatformShell /></PlatformRoute>} />
    </Routes>
  );
}
