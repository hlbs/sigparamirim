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
    const container = document.getElementById('auth-particles');
    if (!container) return;

    // Rede independente do carregamento externo do particles.js: desenhar em
    // canvas evita a ausência de linhas quando o navegador mantém um bundle
    // antigo em cache e também mantém o efeito sem interação com o mouse.
    const canvas = document.createElement('canvas');
    canvas.className = 'auth-network-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    const context = canvas.getContext('2d');
    if (!context) return () => canvas.remove();

    type NetworkNode = { x: number; y: number; vx: number; vy: number; radius: number };
    const nodes: NetworkNode[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let seed = 9127;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(container.clientWidth, 1);
      height = Math.max(container.clientHeight, 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (nodes.length === 0) {
        for (let index = 0; index < 62; index += 1) {
          nodes.push({
            x: random() * width,
            y: random() * height,
            vx: (random() - .5) * .18,
            vy: (random() - .5) * .18,
            radius: 1.1 + random() * 1.8,
          });
        }
      }
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const maxDistance = Math.min(190, Math.max(120, width * .24));
      const maxDistanceSquared = maxDistance * maxDistance;
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < -10 || node.x > width + 10) node.vx *= -1;
        if (node.y < -10 || node.y > height + 10) node.vy *= -1;
      }
      for (let first = 0; first < nodes.length; first += 1) {
        const node = nodes[first];
        if (!node) continue;
        for (let second = first + 1; second < nodes.length; second += 1) {
          const other = nodes[second];
          if (!other) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > maxDistanceSquared) continue;
          const alpha = (1 - Math.sqrt(distanceSquared) / maxDistance) * .24;
          const lineColor = document.documentElement.dataset.theme === 'dark' ? '215,231,122' : '90,94,11';
          context.strokeStyle = `rgba(${lineColor},${alpha.toFixed(3)})`;
          context.lineWidth = .7;
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }
      for (const node of nodes) {
        const darkTheme = document.documentElement.dataset.theme === 'dark';
        context.fillStyle = darkTheme ? 'rgba(224,239,154,.78)' : 'rgba(90,94,11,.62)';
        context.shadowColor = darkTheme ? 'rgba(215,231,122,.52)' : 'rgba(90,94,11,.28)';
        context.shadowBlur = 9;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };
    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    draw();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      canvas.remove();
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
