import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLoading } from '../components/AuthLoading';
import { signOutUser, updateUserProfile, useAuth } from '../features/auth';
import { UserAvatar } from '../components/UserAvatar';
import { ThemeDetail } from '../components/ThemeDetail';

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
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [states, setStates] = useState<Array<{ id: number; sigla: string; nome: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: number; nome: string }>>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [fields, setFields] = useState({ bio: '', lattesUrl: '', institution: '', educationLevel: '', country: 'Brasil', state: '', city: '', contactEmail: '' });

  useEffect(() => {
    if (!user) return;
    setName(profile?.displayName || user.displayName || '');
    setFields({
      bio: profile?.bio || '', lattesUrl: profile?.lattesUrl || '', institution: profile?.institution || '',
      educationLevel: profile?.educationLevel || '', country: profile?.country || 'Brasil', state: profile?.state || '',
      city: profile?.city || '', contactEmail: profile?.contactEmail || '',
    });
  }, [profile, user]);

  useEffect(() => {
    if (fields.country !== 'Brasil') { setStates([]); setCities([]); return undefined; }
    const controller = new AbortController();
    setLocationLoading(true);
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Array<{ id: number; sigla: string; nome: string }>> : Promise.reject(new Error('Falha ao consultar estados.')))
      .then((items) => setStates(items))
      .catch(() => { if (!controller.signal.aborted) setStates([]); })
      .finally(() => { if (!controller.signal.aborted) setLocationLoading(false); });
    return () => controller.abort();
  }, [fields.country]);

  useEffect(() => {
    if (fields.country !== 'Brasil' || !/^[A-Z]{2}$/.test(fields.state)) { setCities([]); return undefined; }
    const controller = new AbortController();
    setLocationLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${fields.state}/municipios`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Array<{ id: number; nome: string }>> : Promise.reject(new Error('Falha ao consultar municípios.')))
      .then((items) => setCities(items))
      .catch(() => { if (!controller.signal.aborted) setCities([]); })
      .finally(() => { if (!controller.signal.aborted) setLocationLoading(false); });
    return () => controller.abort();
  }, [fields.country, fields.state]);

  if (!user) return null;

  const setField = (key: keyof typeof fields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const choosePhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoEditorOpen(true);
  };
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      let avatar: Blob | undefined;
      if (photoFile) {
        const image = new Image();
        image.src = photoPreview || URL.createObjectURL(photoFile);
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível ler a imagem.')); });
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const context = canvas.getContext('2d'); if (!context) throw new Error('Editor de imagem indisponível.');
        const scale = Math.max(512 / image.width, 512 / image.height) * zoom;
        const width = image.width * scale; const height = image.height * scale;
        context.drawImage(image, (512 - width) / 2, (512 - height) / 2, width, height);
        avatar = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9)) || undefined;
      }
      await updateUserProfile({ displayName: name.trim(), ...fields }, avatar);
      setMessage('Perfil atualizado.');
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.');
    } finally { setSaving(false); }
  };

  const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'editor' ? 'Editor' : 'Colaborador';
  const isBrazil = fields.country.trim().toLocaleLowerCase('pt-BR') === 'brasil';

  return (
    <section className="account-page profile-page">
      <article className="profile-hero">
        <ThemeDetail className="profile-detail" />
        <div className="profile-hero-avatar">
          <button type="button" className="profile-avatar-edit" onClick={() => setPhotoEditorOpen(true)} aria-label="Editar foto de perfil">
            <UserAvatar name={user.displayName} email={user.email} photoURL={user.photoURL} size="large" />
            <span><i className="fa-solid fa-camera" /></span>
          </button>
          <span className="profile-avatar-status" title="Conta ativa"><i className="fa-solid fa-check" /></span>
        </div>
        <div className="profile-hero-copy">
          <span className="profile-kicker"><i className="fa-solid fa-shield-halved" /> Conta autenticada pelo Google</span>
          <h2>{user.displayName || 'Usuário SIG Paramirim'}</h2>
          <p>{user.email}</p>
          <div className="profile-hero-meta"><span className="role-badge">{roleLabel}</span><span><i className="fa-solid fa-location-dot" /> {fields.city || 'Localização não informada'}</span></div>
        </div>
        <button className="button button-ghost profile-signout" type="button" onClick={() => void signOutUser()}><i className="fa-solid fa-arrow-right-from-bracket" /> Sair da conta</button>
      </article>

      {photoEditorOpen && <div className="profile-photo-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setPhotoEditorOpen(false); }}>
        <section className="profile-photo-modal" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title">
          <button type="button" className="profile-photo-modal-close" onClick={() => setPhotoEditorOpen(false)} aria-label="Fechar editor de foto"><i className="fa-solid fa-xmark" /></button>
          <span className="eyebrow">Imagem do perfil</span><h2 id="profile-photo-title">Ajuste sua foto</h2><p>Escolha uma imagem, alinhe o enquadramento e confirme antes de salvar o perfil.</p>
          <div className="profile-crop-stage">{photoPreview || user.photoURL ? <img src={photoPreview || user.photoURL || ''} alt="Pré-visualização do recorte" style={{ transform: `scale(${zoom})` }} /> : <UserAvatar name={name} email={user.email} size="large" />}<span className="profile-crop-guides" aria-hidden="true" /></div>
          <label className="button button-outline profile-photo-pick" htmlFor="profile-photo-modal-input"><i className="fa-solid fa-image" /> Escolher imagem</label>
          <input id="profile-photo-modal-input" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <label className="profile-crop-range" htmlFor="profile-modal-zoom"><span>Zoom</span><output>{zoom.toFixed(2)}×</output></label>
          <input id="profile-modal-zoom" type="range" min="1" max="2.5" step=".05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          <button type="button" className="button button-primary profile-photo-confirm" onClick={() => setPhotoEditorOpen(false)}><i className="fa-solid fa-check" /> Confirmar enquadramento</button>
        </section>
      </div>}

      <form className="profile-editor-shell" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="profile-editor-header"><div><span className="eyebrow">Edição segura</span><h2>Informações do perfil</h2><p>Você controla quais informações deseja compartilhar com a comunidade.</p></div><span className="profile-edit-badge"><i className="fa-solid fa-lock" /> Dados protegidos</span></div>
        <div className="profile-section-label"><i className="fa-solid fa-id-card" /><span>Identidade e contato</span></div>
        <div className="profile-form-grid">
          <div className="profile-field"><label htmlFor="profile-name">Nome público</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="profile-field"><label htmlFor="profile-contact">E-mail de contato</label><input id="profile-contact" type="email" value={fields.contactEmail} onChange={(event) => setField('contactEmail', event.target.value)} placeholder="opcional" /></div>
          <div className="profile-field"><label htmlFor="profile-institution">Instituição</label><input id="profile-institution" value={fields.institution} onChange={(event) => setField('institution', event.target.value)} placeholder="Universidade, órgão ou empresa" /></div>
          <div className="profile-field"><label htmlFor="profile-education">Grau de escolaridade</label><select id="profile-education" value={fields.educationLevel} onChange={(event) => setField('educationLevel', event.target.value)}><option value="">Selecione uma opção</option><option>Ensino fundamental incompleto</option><option>Ensino fundamental completo</option><option>Ensino médio incompleto</option><option>Ensino médio completo</option><option>Ensino técnico</option><option>Graduação</option><option>Especialização</option><option>Mestrado</option><option>Doutorado</option><option>Pós-doutorado</option><option>Outro</option></select></div>
        </div>
        <div className="profile-section-label"><i className="fa-solid fa-map-location-dot" /><span>Território e referências</span></div>
        <div className="profile-form-grid">
          <div className="profile-field"><label htmlFor="profile-country">País</label><select id="profile-country" value={isBrazil ? 'Brasil' : 'Outro'} onChange={(event) => { setField('country', event.target.value === 'Brasil' ? 'Brasil' : ''); setField('state', ''); setField('city', ''); }}><option>Brasil</option><option value="Outro">Outro país (preenchimento manual)</option></select>{!isBrazil && <input className="profile-manual-location" value={fields.country} onChange={(event) => setField('country', event.target.value)} placeholder="Informe o país" aria-label="Nome do país" />}</div>
          <div className="profile-field"><label htmlFor="profile-state">Estado / UF</label>{isBrazil ? <select id="profile-state" value={fields.state} onChange={(event) => { setField('state', event.target.value); setField('city', ''); }} disabled={locationLoading && states.length === 0}><option value="">{locationLoading && states.length === 0 ? 'Carregando estados…' : 'Selecione o estado'}</option>{states.map((state) => <option key={state.id} value={state.sigla}>{state.nome} ({state.sigla})</option>)}</select> : <input id="profile-state" value={fields.state} onChange={(event) => setField('state', event.target.value)} placeholder="Informe o estado ou província" />}</div>
          <div className="profile-field"><label htmlFor="profile-city">Cidade</label>{isBrazil ? <select id="profile-city" value={fields.city} onChange={(event) => setField('city', event.target.value)} disabled={!fields.state || (locationLoading && cities.length === 0)}><option value="">{locationLoading && cities.length === 0 ? 'Carregando municípios…' : 'Selecione a cidade'}</option>{cities.map((city) => <option key={city.id} value={city.nome}>{city.nome}</option>)}</select> : <input id="profile-city" value={fields.city} onChange={(event) => setField('city', event.target.value)} placeholder="Informe a cidade" />}</div>
          <div className="profile-field"><label htmlFor="profile-lattes">Currículo Lattes</label><input id="profile-lattes" type="url" value={fields.lattesUrl} onChange={(event) => setField('lattesUrl', event.target.value)} placeholder="https://lattes.cnpq.br/..." /></div>
          <div className="profile-field full"><label htmlFor="profile-bio">Apresentação</label><textarea id="profile-bio" value={fields.bio} onChange={(event) => setField('bio', event.target.value)} placeholder="Conte brevemente sobre sua atuação, interesses ou referências." /></div>
        </div>
        <div className="profile-save-row"><button className="button button-primary" type="submit" disabled={saving}><i className="fa-solid fa-floppy-disk" /> {saving ? 'Salvando…' : 'Salvar alterações'}</button>{message && <span className="profile-save-message" role="status"><i className="fa-solid fa-circle-check" /> {message}</span>}</div>
      </form>
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
