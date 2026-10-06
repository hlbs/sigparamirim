import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { LanguageCode, usePreferences } from './stores/preferences';
import { useAuth } from './features/auth';
import { AuthLoading } from './components/AuthLoading';
import { UserAvatar } from './components/UserAvatar';
import { ProtectedRoute, RoleRoute } from './components/RouteGuards';
import { AuthPage } from './pages/AuthPage';
import { AccessDeniedPage, AdminPage, EditorialPage, ProfilePage } from './pages/AccountPages';

const navigation = [
  { path: '/', label: 'Início', icon: '⌂' },
  { path: '/mapa', label: 'Mapa', icon: '◇' },
  { path: '/observatorio', label: 'Observatório', icon: '▤' },
  { path: '/ajuda', label: 'Ajuda', icon: '?' },
];

const languages: LanguageCode[] = ['PT', 'EN', 'ES', 'FR', 'ZH', 'DE', 'AR'];

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

function Home() {
  const cards = [
    ['WebGIS', 'Camadas vetoriais e raster com filtros, identificação e composição cartográfica.'],
    ['Observatório Científico', 'Produção técnica e científica relacionada à Bacia do Rio Paramirim.'],
    ['Atendimento', 'Canal estruturado de ajuda, acompanhamento e resolução de solicitações.'],
  ];

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Bacia Hidrográfica do Rio Paramirim</span>
          <h1>Conhecimento territorial para compreender, planejar e preservar.</h1>
          <p>
            Uma plataforma científica em construção para integrar mapas, indicadores morfométricos,
            publicações e atendimento em um único ambiente.
          </p>
          <div className="hero-actions">
            <NavLink className="button button-primary" to="/mapa">Explorar o mapa</NavLink>
            <NavLink className="button button-secondary" to="/observatorio">Conhecer o observatório</NavLink>
          </div>
        </div>
        <div className="hero-visual" aria-label="Identidade visual do SIG Paramirim">
          <img src="/sig-logo.png" alt="SIG Paramirim" />
          <div className="phase-chip">Marco v{__APP_VERSION__}</div>
        </div>
      </section>

      <section className="module-grid" aria-label="Módulos da plataforma">
        {cards.map(([title, text], index) => (
          <article className="module-card" key={title}>
            <span className="module-index">0{index + 1}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="foundation-callout">
        <div>
          <span className="eyebrow">Fase atual</span>
          <h2>Fundação técnica e catálogo de dados</h2>
        </div>
        <p>
          O projeto está inventariando fontes, projeções, metadados e requisitos de segurança antes da
          publicação das primeiras camadas.
        </p>
      </section>
    </div>
  );
}

function PlatformShell() {
  const { theme, setTheme, language, setLanguage, sidebarOpen, setSidebarOpen } = usePreferences();
  const { user, loading } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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

  if (loading) return <AuthLoading />;

  const roleNavigation = user?.role === 'admin'
    ? [{ path: '/editorial', label: 'Área editorial', icon: '✎' }, { path: '/administracao', label: 'Administração', icon: '⚙' }]
    : user?.role === 'editor'
      ? [{ path: '/editorial', label: 'Área editorial', icon: '✎' }]
      : [];
  const visibleNavigation = [...navigation, ...roleNavigation];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menu">
          ☰
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
            {resolvedTheme === 'light' ? '☾' : '☀'}
          </button>

          <div className="notification-anchor">
            <button
              className="icon-button"
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              ♢
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
            <NavLink className="avatar-link" to="/perfil" aria-label="Abrir perfil do usuário">
              <UserAvatar name={user.displayName} email={user.email} photoURL={user.photoURL} />
            </NavLink>
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
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`connection-dot ${firebaseConfigured ? 'ready' : ''}`} />
          {firebaseConfigured ? 'Firebase configurado' : 'Ambiente local seguro'}
        </div>
      </aside>

      {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
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
            <span aria-hidden="true">{item.icon}</span>
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
      <Route path="/entrar" element={<AuthPage mode="login" />} />
      <Route path="/criar-conta" element={<AuthPage mode="register" />} />
      <Route path="*" element={<PlatformShell />} />
    </Routes>
  );
}
