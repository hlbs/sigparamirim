import { useState } from 'react';
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
          <img src="/sig-logo.png" alt="" />
          <span>SIG Paramirim</span>
        </NavLink>
        <div>
          <span className="eyebrow">Ciência territorial acessível</span>
          <h1>Dados confiáveis para decisões que atravessam a bacia.</h1>
          <p>Mapas, indicadores e conhecimento científico reunidos em um ambiente seguro e colaborativo.</p>
        </div>
        <small>Plataforma de inteligência geográfica da Bacia do Rio Paramirim</small>
      </section>

      <main className="auth-panel">
        <div className="auth-card">
          <span className="auth-mobile-brand"><img src="/sig-logo.png" alt="" /> SIG Paramirim</span>
          <span className="eyebrow">Bem-vindo</span>
          <h2>Acesse a plataforma</h2>
          <p>No primeiro acesso, sua conta será criada automaticamente e encaminhada para aprovação.</p>

          <div className="provider-list">
            <button
              className="provider-button provider-google"
              disabled={pending}
              onClick={() => void handleGoogle()}
            >
              <span aria-hidden="true">G</span>
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
