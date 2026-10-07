import { useEffect, useState } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router-dom';
import { signInWithGoogle, useAuth } from '../features/auth';
import { AuthLoading } from '../components/AuthLoading';

function authErrorMessage(reason: unknown): string {
  const code = typeof reason === 'object' && reason !== null && 'code' in reason
    ? String(reason.code)
    : '';
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes da conclusão.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.',
    'auth/network-request-failed': 'Não foi possível conectar ao serviço de autenticação. Verifique sua internet.',
    'auth/too-many-requests': 'Muitas tentativas foram feitas. Aguarde alguns minutos e tente novamente.',
    'functions/permission-denied': 'O acesso ao SIG Paramirim requer uma conta Google.',
  };
  return messages[code] ?? 'Não foi possível concluir o acesso. Tente novamente.';
}

export function AuthPage() {
  const { user, loading, canAccessPlatform } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destination = (location.state as { from?: string } | null)?.from || '/';

  useEffect(() => {
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      const container = document.getElementById('auth-particles');
      if (!container || !window.particlesJS || container.dataset.initialized === 'true') return;
      container.dataset.initialized = 'true';
      try {
        window.particlesJS('auth-particles', {
          particles: { number: { value: 34, density: { enable: true, value_area: 900 } }, color: { value: '#eef4a2' }, opacity: { value: .23, random: true }, size: { value: 2.4, random: true }, line_linked: { enable: true, distance: 145, color: '#e6ed95', opacity: .12, width: 1 }, move: { enable: true, speed: .65, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false } },
          interactivity: { detect_on: 'canvas', events: { onhover: { enable: false }, onclick: { enable: false }, resize: true } },
          retina_detect: true,
        });
      } catch { container.dataset.initialized = 'false'; }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      const container = document.getElementById('auth-particles');
      container?.querySelector('canvas')?.remove();
      if (container) container.dataset.initialized = 'false';
    };
  }, []);

  if (loading) return <AuthLoading label="Verificando sua sessão" />;
  if (user && !canAccessPlatform) return <Navigate to="/status-conta" replace />;
  if (user) return <Navigate to={destination} replace />;

  const handleGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (reason) {
      setError(authErrorMessage(reason));
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-story" aria-label="Sobre o SIG Paramirim">
        <div id="auth-particles" className="auth-particles" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => <span key={index} className="auth-particle" style={{ left: `${(index * 37) % 100}%`, top: `${(index * 61) % 100}%`, animationDelay: `-${(index * .27).toFixed(2)}s` }} />)}
        </div>
        <NavLink className="auth-brand" to="/">
          <img src="/sig-logo.png" alt="" />
          <span>SIG Paramirim</span>
        </NavLink>
        <div>
          <span className="eyebrow">Ciência territorial acessível</span>
          <h1>Geoinformação para compreender o território.</h1>
          <p>Explore mapas, indicadores hidrológicos e pesquisas que transformam conhecimento científico em leitura acessível da Bacia do Rio Paramirim.</p>
        </div>
        <small>Plataforma de inteligência geográfica da Bacia do Rio Paramirim</small>
      </section>

      <main className="auth-panel">
        <div className="auth-card">
          <span className="auth-mobile-brand"><img src="/sig-logo.png" alt="" /> SIG Paramirim</span>
          <span className="eyebrow">Bem-vindo</span>
          <h2>Acesse a plataforma</h2>
          <p>Entre com sua conta Google para explorar mapas, dados territoriais e conteúdos científicos da Bacia do Rio Paramirim. O acesso é criado automaticamente.</p>

          <div className="provider-list">
            <button
              className="provider-button provider-google"
              disabled={pending}
              onClick={() => void handleGoogle()}
            >
              <span aria-hidden="true"><i className="fa-brands fa-google" /></span>
              {pending ? 'Conectando…' : 'Continuar com Google'}
            </button>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}
          <small className="auth-legal">Ao continuar, você concorda com os termos de uso e com a política de privacidade da plataforma.</small>
        </div>
      </main>
    </div>
  );
}
