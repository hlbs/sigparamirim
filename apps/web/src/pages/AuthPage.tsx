import { useEffect, useState } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router-dom';
import { signInWithGoogle, useAuth } from '../features/auth';
import { AuthLoading } from '../components/AuthLoading';
import { BrandLogo } from '../components/BrandLogo';
import termsText from '../content/terms.md?raw';
import privacyText from '../content/privacy.md?raw';

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
  const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy' | null>(null);
  const destination = (location.state as { from?: string } | null)?.from || '/';

  useEffect(() => {
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      const container = document.getElementById('auth-particles');
      if (!container || !window.particlesJS || container.dataset.initialized === 'true') return;
      container.dataset.initialized = 'true';
      try {
        window.particlesJS('auth-particles', {
          particles: { number: { value: 56, density: { enable: true, value_area: 760 } }, color: { value: '#b9ca53' }, opacity: { value: .3, random: true }, size: { value: 2.2, random: true }, line_linked: { enable: true, distance: 125, color: '#a8bf58', opacity: .2, width: 1 }, move: { enable: true, speed: .45, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false } },
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
          <NavLink className="auth-brand" to="/">
          <BrandLogo kind="logo" alt="" />
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
        <div id="auth-particles" className="auth-particles" aria-hidden="true">
          {Array.from({ length: 36 }, (_, index) => <span key={index} className="auth-particle" style={{ left: `${(index * 37) % 100}%`, top: `${(index * 61) % 100}%`, animationDelay: `-${(index * .27).toFixed(2)}s` }} />)}
        </div>
        <div className="auth-card">
          <span className="auth-mobile-brand"><BrandLogo kind="icon" alt="" /> SIG Paramirim</span>
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
          <small className="auth-legal">Ao continuar, você concorda com os <button type="button" onClick={() => setLegalDocument('terms')}>termos de uso</button> e com a <button type="button" onClick={() => setLegalDocument('privacy')}>política de privacidade</button> da plataforma.</small>
        </div>
      </main>
      {legalDocument && <div className="legal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLegalDocument(null); }}>
        <section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
          <button className="legal-modal-close" type="button" aria-label="Fechar documento" onClick={() => setLegalDocument(null)}><i className="fa-solid fa-xmark" /></button>
          <span className="eyebrow">Documento de teste</span>
          <h2 id="legal-modal-title">{legalDocument === 'terms' ? 'Termos de uso' : 'Política de privacidade'}</h2>
          <div className="legal-modal-content">{(legalDocument === 'terms' ? termsText : privacyText).split('\n').map((line) => line.startsWith('# ') ? <h3 key={line}>{line.slice(2)}</h3> : line ? <p key={line}>{line}</p> : <span key={line} />)}</div>
        </section>
      </div>}
    </div>
  );
}
