import { useState } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router-dom';
import { signInWithProvider, useAuth, type AuthProvider } from '../features/auth';
import { AuthLoading } from '../components/AuthLoading';

const providers: Array<{ id: AuthProvider; label: string; mark: string }> = [
  { id: 'google', label: 'Continuar com Google', mark: 'G' },
  { id: 'facebook', label: 'Continuar com Facebook', mark: 'f' },
  { id: 'microsoft', label: 'Continuar com Microsoft', mark: 'M' },
];

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const destination = (location.state as { from?: string } | null)?.from || '/';

  if (loading) return <AuthLoading label="Verificando sua sessão" />;
  if (user) return <Navigate to={destination} replace />;

  const handleProvider = async (provider: AuthProvider) => {
    setPendingProvider(provider);
    setError(null);
    try {
      await signInWithProvider(provider);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o acesso. Tente novamente.');
      setPendingProvider(null);
    }
  };

  const isRegister = mode === 'register';
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
          <span className="eyebrow">{isRegister ? 'Comece agora' : 'Bem-vindo de volta'}</span>
          <h2>{isRegister ? 'Crie sua conta' : 'Acesse a plataforma'}</h2>
          <p>{isRegister ? 'Escolha uma conta para criar seu perfil com segurança.' : 'Entre para acessar seu perfil e recursos personalizados.'}</p>

          <div className="provider-list">
            {providers.map((provider) => (
              <button
                key={provider.id}
                className={`provider-button provider-${provider.id}`}
                disabled={pendingProvider !== null}
                onClick={() => void handleProvider(provider.id)}
              >
                <span aria-hidden="true">{provider.mark}</span>
                {pendingProvider === provider.id ? 'Conectando…' : provider.label}
              </button>
            ))}
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}
          <p className="auth-switch">
            {isRegister ? 'Já possui uma conta?' : 'Ainda não possui uma conta?'}{' '}
            <NavLink to={isRegister ? '/entrar' : '/criar-conta'}>{isRegister ? 'Entrar' : 'Criar conta'}</NavLink>
          </p>
          <small className="auth-legal">Ao continuar, você concorda com os termos de uso e com a política de privacidade da plataforma.</small>
        </div>
      </main>
    </div>
  );
}
