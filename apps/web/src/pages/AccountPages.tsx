import { Navigate } from 'react-router-dom';
import { AuthLoading } from '../components/AuthLoading';
import { signOutUser, useAuth } from '../features/auth';
import { UserAvatar } from '../components/UserAvatar';

export function AccountStatusPage() {
  const { user, loading, canAccessPlatform, accountStatus } = useAuth();

  if (loading) return <AuthLoading label="Verificando sua autorização" />;
  if (!user) return <Navigate to="/entrar" replace />;
  if (canAccessPlatform) return <Navigate to="/" replace />;

  const suspended = accountStatus === 'suspended';

  return (
    <main className="account-status-page">
      <section className="account-status-card" aria-labelledby="account-status-title">
        <img src="/sig-logo.png" alt="SIG Paramirim" />
        <span className={`account-status-badge ${suspended ? 'suspended' : 'pending'}`}>
          {suspended ? 'Acesso suspenso' : 'Cadastro em análise'}
        </span>
        <h1 id="account-status-title">
          {suspended ? 'Seu acesso está temporariamente suspenso.' : 'Seu cadastro foi recebido.'}
        </h1>
        <p>
          {suspended
            ? 'A administração precisa regularizar sua conta antes que você volte a acessar a plataforma.'
            : 'A administração analisará sua solicitação. Assim que o acesso for aprovado, a plataforma será liberada para esta conta.'}
        </p>
        <div className="account-status-identity">
          <UserAvatar name={user.displayName} email={user.email} photoURL={user.photoURL} />
          <div><strong>{user.displayName || 'Usuário SIG Paramirim'}</strong><span>{user.email}</span></div>
        </div>
        <div className="account-status-actions">
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Verificar acesso</button>
          <button type="button" className="button button-outline" onClick={() => void signOutUser()}>Sair da conta</button>
        </div>
        <small>O acesso ao conteúdo permanece bloqueado enquanto a conta não estiver ativa.</small>
      </section>
    </main>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section className="account-page">
      <div className="account-heading">
        <span className="eyebrow">Minha conta</span>
        <h1>Perfil</h1>
        <p>Gerencie sua identidade e preferências de acesso à plataforma.</p>
      </div>
      <article className="profile-card">
        <UserAvatar name={user.displayName} email={user.email} photoURL={user.photoURL} size="large" />
        <div className="profile-identity">
          <h2>{user.displayName || 'Usuário SIG Paramirim'}</h2>
          <p>{user.email}</p>
          <span className="role-badge">{user.role === 'admin' ? 'Administrador' : user.role === 'editor' ? 'Editor' : 'Usuário'}</span>
        </div>
        <button className="button button-outline" onClick={() => void signOutUser()}>Sair da conta</button>
      </article>
      <div className="settings-grid">
        <article><span>Idioma</span><strong>Salvo automaticamente</strong><p>Sua última escolha acompanha este dispositivo.</p></article>
        <article><span>Segurança</span><strong>Conta federada</strong><p>O acesso é protegido pelo provedor escolhido.</p></article>
      </div>
    </section>
  );
}

export function EditorialPage() {
  return <WorkspacePage eyebrow="Fluxo editorial" title="Gestão de conteúdo" description="Prepare alterações em camadas, dashboards e no Acervo Paramirim. Toda publicação segue para validação administrativa." items={['Alterações em rascunho', 'Aguardando aprovação', 'Histórico de decisões']} />;
}

export function AdminPage() {
  return <WorkspacePage eyebrow="Administração" title="Central de governança" description="Gerencie pessoas, permissões, solicitações e aprovações em um único ambiente." items={['Usuários e acessos', 'Fila de aprovações', 'Tickets em atendimento']} />;
}

function WorkspacePage({ eyebrow, title, description, items }: { eyebrow: string; title: string; description: string; items: string[] }) {
  return (
    <section className="account-page">
      <div className="account-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="workspace-grid">
        {items.map((item, index) => <article key={item}><span>0{index + 1}</span><h2>{item}</h2><p>Módulo preparado para conexão com os fluxos operacionais da próxima entrega.</p><button className="text-button">Acessar módulo →</button></article>)}
      </div>
    </section>
  );
}

export function AccessDeniedPage() {
  return (
    <section className="placeholder">
      <span className="eyebrow">Acesso restrito</span>
      <h1>Esta área requer outra permissão.</h1>
      <p>Seu acesso permanece ativo. Caso precise trabalhar neste módulo, solicite a alteração do seu papel à administração.</p>
    </section>
  );
}
