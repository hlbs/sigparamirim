import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { LanguageCode, usePreferences } from './stores/preferences';
import { signOutUser, useAuth } from './features/auth';
import { AuthLoading } from './components/AuthLoading';
import { UserAvatar } from './components/UserAvatar';
import { BrandLogo } from './components/BrandLogo';
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

type IconName = 'home' | 'map' | 'chart' | 'help' | 'menu' | 'moon' | 'sun' | 'bell' | 'edit' | 'settings' | 'chevron' | 'chevronLeft' | 'chevronRight' | 'user' | 'logout';
function UiIcon({ name }: { name: IconName }) {
  const classes: Record<IconName, string> = {
    home: 'fa-solid fa-house', map: 'fa-solid fa-map', chart: 'fa-solid fa-chart-line', help: 'fa-solid fa-circle-question',
    menu: 'fa-solid fa-bars', moon: 'fa-solid fa-moon', sun: 'fa-solid fa-sun', bell: 'fa-solid fa-bell',
    edit: 'fa-solid fa-pen-to-square', settings: 'fa-solid fa-gear', chevron: 'fa-solid fa-chevron-down',
    chevronLeft: 'fa-solid fa-chevron-left', chevronRight: 'fa-solid fa-chevron-right',
    user: 'fa-solid fa-user', logout: 'fa-solid fa-arrow-right-from-bracket',
  };
  return <i className={classes[name]} aria-hidden="true" />;
}

function ThemeSwitch({ theme, onChange }: { theme: 'light' | 'dark'; onChange: () => void }) {
  return (
    <label className="theme-switch" title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}>
      <input type="checkbox" checked={theme === 'dark'} onChange={onChange} aria-label="Alternar modo claro e escuro" />
      <span className="theme-switch-track"><span className="theme-switch-thumb"><UiIcon name={theme === 'light' ? 'sun' : 'moon'} /></span></span>
    </label>
  );
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
        <button type="button" className="icon-button menu-button mobile-menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Recolher menu' : 'Abrir menu'} aria-expanded={sidebarOpen} aria-controls="main-sidebar">
          <UiIcon name={sidebarOpen ? 'chevronLeft' : 'chevronRight'} />
        </button>
        <NavLink className="brand" to="/" aria-label="SIG Paramirim — início">
          <BrandLogo kind="icon" alt="" />
          <span>SIG Paramirim</span>
        </NavLink>
        <a className="version release-link" href={`https://github.com/hlbs/sigparamirim/releases/tag/v${__APP_VERSION__}`} target="_blank" rel="noreferrer" title={`Abrir release v${__APP_VERSION__} no GitHub`}>v{__APP_VERSION__}</a>

        <div className="topbar-actions">
          <select
            className="compact-select"
            aria-label="Idioma"
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          >
            {languages.map((code) => <option key={code}>{code}</option>)}
          </select>

          <ThemeSwitch theme={resolvedTheme} onChange={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')} />

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
                <UiIcon name="chevron" />
              </button>
              {profileMenuOpen && (
                <div className="profile-popover" role="menu">
                  <div className="profile-popover-header">
                    <strong>{user.displayName || 'Usuário SIG Paramirim'}</strong>
                    <small>{user.email}</small>
                  </div>
                  <NavLink className="profile-menu-item" to="/perfil" role="menuitem" onClick={() => setProfileMenuOpen(false)}><UiIcon name="user" /><span>Meu perfil</span></NavLink>
                  <button className="profile-menu-item" type="button" role="menuitem" onClick={() => void signOutUser()}><UiIcon name="logout" /><span>Sair da conta</span></button>
                </div>
              )}
            </div>
          ) : (
            <NavLink className="login-link" to="/entrar">Entrar</NavLink>
          )}
        </div>
      </header>

      <aside id="main-sidebar" className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`} aria-label="Navegação principal">
        <button type="button" className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'} aria-expanded={sidebarOpen}>
          <UiIcon name={sidebarOpen ? 'chevronLeft' : 'chevronRight'} />
          <span>Menu</span>
        </button>
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
            <span>Desenvolvido por<br /><strong>Hermes Santos</strong></span>
            <small>Inteligência de dados territoriais</small>
          </div>
          <div className="sidebar-socials" aria-label="Redes do desenvolvedor">
            <a href="https://github.com/hlbs" target="_blank" rel="noreferrer" aria-label="GitHub de Hermes Santos"><img src="/github.png" alt="" /></a>
            <a href="https://www.linkedin.com/in/hermes-santos-28720b141" target="_blank" rel="noreferrer" aria-label="LinkedIn de Hermes Santos"><img src="/linkedin.png" alt="" /></a>
            <a href="http://lattes.cnpq.br/0845969740727255" target="_blank" rel="noreferrer" aria-label="Currículo Lattes de Hermes Santos"><img src="/lattes.png" alt="" /></a>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

      <main className={`main-content ${sidebarOpen ? '' : 'main-content-expanded'}`}>
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
