import { useState } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router-dom';
import { signInWithGoogle, useAuth } from '../features/auth';
import { AuthLoading } from '../components/AuthLoading';
import { BrandLogo } from '../components/BrandLogo';
import { NetworkParticles } from '../components/NetworkParticles';
import { ThemeDetail } from '../components/ThemeDetail';
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
          <ThemeDetail className="auth-detail" />
          <NavLink className="auth-brand" to="/">
          <BrandLogo kind="logo" alt="SIG Paramirim" />
        </NavLink>
        <div>
          <span className="eyebrow">Ciência territorial acessível</span>
          <h1>Geoinformação para compreender o território.</h1>
          <p>Explore mapas, indicadores hidrológicos e pesquisas que transformam conhecimento científico em leitura acessível da Bacia do Rio Paramirim.</p>
        </div>
        <small>Plataforma de inteligência geográfica da Bacia do Rio Paramirim</small>
      </section>

      <main className="auth-panel">
        <NetworkParticles className="auth-particles" speed={.42} />
        <div className="auth-card">
          <span className="auth-mobile-brand"><BrandLogo kind="logo" alt="SIG Paramirim" /></span>
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
