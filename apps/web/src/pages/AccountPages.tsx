import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthLoading } from '../components/AuthLoading';
import { signOutUser, updateUserProfile, useAuth } from '../features/auth';
import { UserAvatar } from '../components/UserAvatar';
import { ThemeDetail } from '../components/ThemeDetail';
import { migrateLegacyGeospatial, reviewEditorialChange, submitLayerChange, uploadLayerDraft, watchEditorialChanges, watchPublishedLayers, type EditorialChange } from '../features/editorial/service';
import { updateAdminUserAccess, watchAdminUsers, watchAuditRecords, type AdminUser, type AuditRecord } from '../features/admin/service';
import { watchTickets, type TicketRecord } from '../features/helpdesk/service';

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
        </div>
        <div className="profile-hero-copy">
          <span className="profile-kicker"><i className="fa-solid fa-shield-halved" /> Conta autenticada pelo Google</span>
          <h2>{user.displayName || 'Usuário SIG Paramirim'}</h2>
          <p>{user.email}</p>
          <div className="profile-hero-meta"><span className="role-badge">{roleLabel}</span><span><i className="fa-solid fa-location-dot" /> {fields.city || 'Localização não informada'}</span></div>
        </div>
        <button className="button button-ghost brand-hero-action profile-signout" type="button" onClick={() => void signOutUser()}><i className="fa-solid fa-arrow-right-from-bracket" /> Sair da conta</button>
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
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<EditorialChange[]>([]);
  const [layers, setLayers] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [operation, setOperation] = useState<'create' | 'update' | 'archive'>('create');
  const [layerId, setLayerId] = useState('');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [kind, setKind] = useState<'vector' | 'raster'>('vector');
  const [crs, setCrs] = useState('EPSG:4674');
  const [source, setSource] = useState('');
  const [rasterMin, setRasterMin] = useState('');
  const [rasterMax, setRasterMax] = useState('');
  const [noData, setNoData] = useState('');
  const [styleJson, setStyleJson] = useState('{}');
  const [summary, setSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [decisionText, setDecisionText] = useState('Revisado e aprovado.');

  useEffect(() => {
    if (!user) return;
    let active = true;
    let stopChanges: (() => void) | undefined;
    let stopLayers: (() => void) | undefined;
    void watchEditorialChanges(user.uid, role === 'admin', (items) => { if (active) setRequests(items); }, (error) => { if (active) setMessage(error.message); })
      .then((unsubscribe) => { if (active) stopChanges = unsubscribe; else unsubscribe(); });
    void watchPublishedLayers((items) => { if (active) setLayers(items.filter((item) => item.status === 'published')); }, (error) => { if (active) setMessage(error.message); })
      .then((unsubscribe) => { if (active) stopLayers = unsubscribe; else unsubscribe(); });
    return () => { active = false; stopChanges?.(); stopLayers?.(); };
  }, [user, role]);

  useEffect(() => {
    if (operation === 'create') { setLayerId(''); setTitle(''); setGroup(''); setSource(''); setRasterMin(''); setRasterMax(''); setNoData(''); setFile(null); return; }
    const selected = layers.find((layer) => layer.id === layerId);
    if (!selected) return;
    setTitle(String(selected.title ?? ''));
    setGroup(String(selected.group ?? ''));
    setKind(selected.kind === 'raster' ? 'raster' : 'vector');
    setCrs(String(selected.crs ?? ''));
    setSource(String(selected.source ?? ''));
    setStyleJson(JSON.stringify(selected.styleDefault ?? {}, null, 2));
    const statistics = selected.statistics && typeof selected.statistics === 'object' ? selected.statistics as Record<string, unknown> : {};
    setRasterMin(statistics.min === undefined ? '' : String(statistics.min));
    setRasterMax(statistics.max === undefined ? '' : String(statistics.max));
    setNoData(selected.noData === undefined ? '' : String(selected.noData));
    setFile(null);
  }, [operation, layerId, layers]);

  if (!user) return null;
  const isAdmin = role === 'admin';
  const finishChange = async (item: EditorialChange, decision: 'approved' | 'rejected') => {
    if (decisionText.trim().length < 10) { setMessage('Informe uma justificativa com pelo menos 10 caracteres.'); return; }
    setBusy(true); setMessage('');
    try {
      await reviewEditorialChange({ requestId: item.id, decision, justification: decisionText.trim() });
      setMessage(decision === 'approved' ? 'Camada aprovada e publicada.' : 'Alteração recusada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível revisar a alteração.'); }
    finally { setBusy(false); }
  };
  const migrateExistingLayers = async () => {
    if (!isAdmin || !window.confirm('Migrar as camadas já publicadas para webgis/raster e webgis/vetor no Storage?')) return;
    setBusy(true); setMessage('Migrando camadas publicadas…');
    try {
      const result = await migrateLegacyGeospatial();
      setMessage(result.migrated ? `Migração concluída: ${result.migrated} camada(s) transferida(s), ${result.skipped} já existentes ou arquivadas.` : 'As camadas já estavam migradas.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível migrar o catálogo.'); }
    finally { setBusy(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const safeId = (operation === 'create' ? layerId || title : layerId).trim().toLocaleLowerCase('en').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      if (!safeId) throw new Error('Informe o identificador da camada.');
      if (operation !== 'archive' && (!title.trim() || !group.trim())) throw new Error('Informe o nome e o grupo da camada.');
      if (operation === 'create' && !file) throw new Error('Selecione o arquivo da camada.');
      let styleDefault: Record<string, unknown> = {};
      try { styleDefault = JSON.parse(styleJson || '{}') as Record<string, unknown>; }
      catch { throw new Error('O estilo deve estar em formato JSON válido.'); }
      const requestId = crypto.randomUUID();
      if (file) setMessage('Enviando arquivo para a área de preparação…');
      const uploaded = file ? { ...await uploadLayerDraft(user.uid, requestId, file), sizeBytes: file.size } : {};
      setMessage('Registrando alteração…');
      const selectedLayer = layers.find((item) => item.id === safeId);
      const layer = operation === 'archive'
        ? { id: safeId, title: String(selectedLayer?.title ?? title), group: String(selectedLayer?.group ?? group), kind: selectedLayer?.kind === 'raster' ? 'raster' : 'vector' }
        : { id: safeId, title: title.trim(), group: group.trim(), kind, crs: crs.trim(), source: source.trim(), styleDefault,
          ...(kind === 'raster' && rasterMin !== '' && rasterMax !== '' ? { statistics: { min: Number(rasterMin), max: Number(rasterMax) } } : {}),
          ...(kind === 'raster' && noData !== '' ? { noData: Number(noData) } : {}) };
      const result = await submitLayerChange({
        requestId, resourceId: safeId, operation,
        summary: summary.trim() || `${operation === 'create' ? 'Nova camada' : operation === 'update' ? 'Atualização da camada' : 'Remoção da camada'}: ${title || safeId}`,
        payload: { layer, ...uploaded },
      });
      setMessage(result.status === 'approved' ? 'Alteração publicada.' : 'Alteração enviada para aprovação administrativa.');
      if (operation === 'create') { setLayerId(''); setTitle(''); setGroup(''); setSource(''); setFile(null); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a alteração.'); }
    finally { setBusy(false); }
  };

  return <section className="account-page editorial-page">
    <div className="account-heading"><span className="eyebrow">Fluxo editorial · WebGIS</span><h1>Gestão de camadas</h1><p>Envie ou ajuste camadas. Arquivos ficam em preparação até a aprovação de um administrador; publicações aprovadas são armazenadas no Firebase Storage.</p></div>
    <form className="editorial-form" onSubmit={(event) => void submit(event)}>
      <div className="editorial-form-heading"><div><span className="eyebrow">Catálogo de conteúdo</span><h2>{operation === 'create' ? 'Adicionar camada' : operation === 'update' ? 'Editar camada' : 'Remover camada'}</h2></div><div className="editorial-heading-actions">{isAdmin && <button type="button" className="button button-outline" onClick={() => void migrateExistingLayers()} disabled={busy}>Migrar catálogo atual para Storage</button>}<span className="editorial-role-pill">{isAdmin ? 'Publicação administrativa' : 'Aguardará aprovação'}</span></div></div>
      <div className="editorial-form-grid">
        <label>Operação<select value={operation} onChange={(event) => setOperation(event.target.value as typeof operation)}><option value="create">Adicionar camada</option><option value="update">Editar camada</option><option value="archive">Remover do catálogo</option></select></label>
        {operation !== 'create' && <label>Camada<select required value={layerId} onChange={(event) => setLayerId(event.target.value)}><option value="">Selecione</option>{layers.map((layer) => <option value={layer.id} key={layer.id}>{String(layer.title ?? layer.id)}</option>)}</select></label>}
        {operation !== 'archive' && <>
          {operation === 'create' && <label>Identificador<input value={layerId} onChange={(event) => setLayerId(event.target.value)} placeholder="ex.: uso-solo-2025" /></label>}
          <label>Nome da camada<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Grupo<input required value={group} onChange={(event) => setGroup(event.target.value)} placeholder="ex.: Hidrografia" /></label>
          <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="vector">Vetor GeoJSON</option><option value="raster">Raster GeoTIFF/COG</option></select></label>
          <label>CRS<input value={crs} onChange={(event) => setCrs(event.target.value)} placeholder="EPSG:4674" /></label>
          <label>Fonte dos dados<input value={source} onChange={(event) => setSource(event.target.value)} /></label>
          {kind === 'raster' && <>
            <label>Valor mínimo observado<input type="number" step="any" value={rasterMin} onChange={(event) => setRasterMin(event.target.value)} /></label>
            <label>Valor máximo observado<input type="number" step="any" value={rasterMax} onChange={(event) => setRasterMax(event.target.value)} /></label>
            <label>Valor NoData (opcional)<input type="number" step="any" value={noData} onChange={(event) => setNoData(event.target.value)} /></label>
          </>}
          <label className="editorial-wide">Arquivo {operation === 'update' ? '(opcional para manter o arquivo atual)' : ''}<input type="file" accept={kind === 'raster' ? '.tif,.tiff' : '.geojson,.json,application/geo+json,application/json'} required={operation === 'create'} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <label className="editorial-wide">Estilo padrão (JSON)<textarea rows={3} value={styleJson} onChange={(event) => setStyleJson(event.target.value)} /></label>
        </>}
        <label className="editorial-wide">Resumo da alteração<input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Opcional; ajuda o administrador a revisar" /></label>
      </div>
      <div className="editorial-submit-row"><button type="submit" className="button button-primary" disabled={busy || (operation !== 'create' && !layerId)}>{busy ? 'Processando…' : isAdmin ? 'Salvar publicação' : 'Enviar para aprovação'}</button>{message && <span role="status">{message}</span>}</div>
    </form>
    <section className="editorial-requests"><div className="editorial-form-heading"><div><span className="eyebrow">Rastreabilidade</span><h2>{isAdmin ? 'Solicitações de alteração' : 'Minhas alterações'}</h2></div></div>
      {isAdmin && <label className="editorial-justification">Justificativa da decisão<textarea rows={2} value={decisionText} onChange={(event) => setDecisionText(event.target.value)} /></label>}
      {requests.length === 0 ? <p className="editorial-empty">Nenhuma solicitação registrada.</p> : requests.map((item) => <article className="editorial-request" key={item.id}><div><strong>{item.summary}</strong><span>{item.resourceType} · {item.resourceId} · {item.status}</span></div>{isAdmin && item.status === 'pending' && <div className="editorial-request-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void finishChange(item, 'approved')}>Aprovar e publicar</button><button type="button" className="button button-outline" disabled={busy} onClick={() => void finishChange(item, 'rejected')}>Recusar</button></div>}</article>)}
    </section>
  </section>;
}

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'overview' | 'users' | 'reviews' | 'support' | 'audit'>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<EditorialChange[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUid, setEditingUid] = useState('');
  const [accessDraft, setAccessDraft] = useState<{ role: AdminUser['role']; accountStatus: AdminUser['accountStatus']; justification: string }>({ role: 'user', accountStatus: 'active', justification: '' });
  const [decisionText, setDecisionText] = useState('Revisado e aprovado.');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    let pending = 4;
    const settled = () => { pending -= 1; if (pending <= 0 && active) setLoading(false); };
    let stopUsers: (() => void) | undefined;
    let stopRequests: (() => void) | undefined;
    let stopAudit: (() => void) | undefined;
    let stopTickets: (() => void) | undefined;
    void watchAdminUsers((items) => { if (active) setUsers(items); settled(); }, (error) => { if (active) setMessage(error.message); settled(); }).then((unsubscribe) => { if (active) stopUsers = unsubscribe; else unsubscribe(); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as contas.'); settled(); });
    void watchEditorialChanges(user.uid, true, (items) => { if (active) setRequests(items); settled(); }, (error) => { if (active) setMessage(error.message); settled(); }).then((unsubscribe) => { if (active) stopRequests = unsubscribe; else unsubscribe(); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as revisões.'); settled(); });
    void watchAuditRecords((items) => { if (active) setAudit(items); settled(); }, (error) => { if (active) setMessage(error.message); settled(); }).then((unsubscribe) => { if (active) stopAudit = unsubscribe; else unsubscribe(); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a auditoria.'); settled(); });
    void watchTickets(user.uid, true, (items) => { if (active) setTickets(items); settled(); }, (error) => { if (active) setMessage(error.message); settled(); }).then((unsubscribe) => { if (active) stopTickets = unsubscribe; else unsubscribe(); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os chamados.'); settled(); });
    return () => { active = false; stopUsers?.(); stopRequests?.(); stopAudit?.(); stopTickets?.(); };
  }, [user]);

  const pendingRequests = useMemo(() => requests.filter((item) => item.status === 'pending'), [requests]);
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return users;
    return users.filter((item) => `${item.displayName ?? ''} ${item.email ?? ''} ${item.uid}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [search, users]);
  const beginAccessEdit = (item: AdminUser) => {
    setEditingUid(item.uid);
    setAccessDraft({ role: item.role ?? 'user', accountStatus: item.accountStatus ?? 'pending', justification: '' });
  };
  const saveAccess = async (item: AdminUser) => {
    if (accessDraft.justification.trim().length < 10) return;
    setBusy(true); setMessage('');
    try {
      await updateAdminUserAccess({ uid: item.uid, ...accessDraft, justification: accessDraft.justification.trim() });
      setEditingUid(''); setMessage(`Acesso de ${item.displayName || item.email || 'usuário'} atualizado.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o acesso.'); }
    finally { setBusy(false); }
  };
  const review = async (item: EditorialChange, decision: 'approved' | 'rejected') => {
    if (decisionText.trim().length < 10) { setMessage('Registre uma justificativa com pelo menos 10 caracteres antes de revisar.'); return; }
    setBusy(true); setMessage('');
    try {
      await reviewEditorialChange({ requestId: item.id, decision, justification: decisionText.trim() });
      setMessage(decision === 'approved' ? 'Solicitação aprovada e publicada.' : 'Solicitação recusada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a revisão.'); }
    finally { setBusy(false); }
  };
  const dateLabel = (value: unknown) => {
    const date = value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? (value.toDate as () => Date)() : value instanceof Date ? value : null;
    return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Data não disponível';
  };
  const roleName = (role: AdminUser['role']) => role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editor' : 'Usuário';
  const statusName = (status: AdminUser['accountStatus']) => status === 'active' ? 'Ativo' : status === 'suspended' ? 'Suspenso' : 'Pendente';

  const openTickets = tickets.filter((ticket) => !['resolved', 'closed', 'cancelled'].includes(ticket.status)).length;
  return <section className="account-page admin-page">
    <article className="admin-hero"><ThemeDetail className="admin-detail" /><div className="admin-hero-copy"><span className="admin-eyebrow"><i className="fa-solid fa-shield-halved" /> Governança da plataforma</span><h1>Administração</h1><p>Contas, publicações e decisões da plataforma em um só lugar.</p></div><Link to="/ajuda" className="admin-hero-action"><i className="fa-solid fa-headset" /> Central de atendimento</Link>
      <div className="admin-metrics"><article><span><i className="fa-solid fa-users" /></span><div><strong>{users.length}</strong><small>Contas cadastradas</small></div></article><article><span><i className="fa-solid fa-user-clock" /></span><div><strong>{users.filter((item) => item.accountStatus === 'pending').length}</strong><small>Aguardando acesso</small></div></article><article><span><i className="fa-solid fa-inbox" /></span><div><strong>{pendingRequests.length}</strong><small>Revisões pendentes</small></div></article><article><span><i className="fa-solid fa-headset" /></span><div><strong>{openTickets}</strong><small>Chamados em aberto</small></div></article></div>
    </article>
    <nav className="admin-tabs" role="tablist" aria-label="Seções administrativas">{([['overview', 'Visão geral', 'fa-chart-pie'], ['users', 'Contas e acessos', 'fa-users'], ['reviews', 'Revisões', 'fa-list-check'], ['support', 'Atendimento', 'fa-headset'], ['audit', 'Auditoria', 'fa-clock-rotate-left']] as const).map(([id, label, icon]) => <button key={id} role="tab" type="button" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><i className={`fa-solid ${icon}`} /><span>{label}</span>{id === 'reviews' && pendingRequests.length > 0 && <small>{pendingRequests.length}</small>}{id === 'support' && openTickets > 0 && <small>{openTickets}</small>}</button>)}</nav>
    {message && <div className="admin-message" role="status"><i className="fa-solid fa-circle-info" />{message}<button type="button" aria-label="Fechar aviso" onClick={() => setMessage('')}><i className="fa-solid fa-xmark" /></button></div>}
    {tab === 'overview' && <section className="admin-content"><div className="admin-section-heading"><div><span>Resumo operacional</span><h2>Bem-vindo à central de governança</h2><p>Acompanhe pendências e siga diretamente para a tarefa que precisa de atenção.</p></div></div><div className="admin-quick-grid"><button type="button" onClick={() => setTab('users')}><span><i className="fa-solid fa-user-gear" /></span><strong>Gerenciar contas</strong><small>Aprovar acessos e administrar papéis</small><i className="fa-solid fa-arrow-right" /></button><button type="button" onClick={() => setTab('reviews')}><span><i className="fa-solid fa-list-check" /></span><strong>Revisar publicações</strong><small>{pendingRequests.length ? `${pendingRequests.length} solicitação(ões) aguardando decisão` : 'Nenhuma solicitação pendente'}</small><i className="fa-solid fa-arrow-right" /></button><button type="button" onClick={() => setTab('support')}><span><i className="fa-solid fa-headset" /></span><strong>Atendimento</strong><small>{openTickets ? `${openTickets} chamado(s) em aberto` : 'Nenhum chamado pendente'}</small><i className="fa-solid fa-arrow-right" /></button><button type="button" onClick={() => setTab('audit')}><span><i className="fa-solid fa-clock-rotate-left" /></span><strong>Consultar auditoria</strong><small>Histórico recente de decisões</small><i className="fa-solid fa-arrow-right" /></button></div><div className="admin-recent"><div className="admin-section-heading"><div><span>Atividade registrada</span><h2>Últimos eventos</h2></div><button type="button" onClick={() => setTab('audit')}>Ver auditoria <i className="fa-solid fa-arrow-right" /></button></div>{audit.slice(0, 4).map((event) => <article key={event.id}><span><i className="fa-solid fa-check" /></span><div><strong>{event.type === 'user.access.updated' ? 'Acesso de usuário atualizado' : event.type ?? 'Evento administrativo'}</strong><small>{event.justification || `Conta ${event.targetUid ?? ''}`}</small></div><time>{dateLabel(event.createdAt)}</time></article>)}{!loading && audit.length === 0 && <p className="admin-empty">As próximas ações administrativas aparecerão aqui.</p>}</div></section>}
    {tab === 'users' && <section className="admin-content"><div className="admin-section-heading"><div><span>Identidades e permissões</span><h2>Contas da plataforma</h2><p>Gerencie a situação de acesso e o papel de cada pessoa. Toda alteração exige justificativa e fica registrada.</p></div><strong className="admin-count">{filteredUsers.length} contas</strong></div><label className="admin-search"><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou identificador" /></label>{loading ? <p className="admin-empty"><i className="fa-solid fa-spinner fa-spin" /> Carregando contas e registros…</p> : filteredUsers.length ? <div className="admin-user-list">{filteredUsers.map((item) => <article key={item.uid} className="admin-user-row"><UserAvatar name={item.displayName} email={item.email} photoURL={item.photoURL} /><div className="admin-user-identity"><strong>{item.displayName || 'Nome não informado'}</strong><span>{item.email || item.uid}</span>{item.institution && <small>{item.institution}</small>}</div><span className={`admin-status status-${item.accountStatus}`}>{statusName(item.accountStatus)}</span><span className="admin-role">{roleName(item.role)}</span>{item.uid === user?.uid ? <span className="admin-self-note">Sua conta</span> : <button type="button" className="admin-row-action" onClick={() => editingUid === item.uid ? setEditingUid('') : beginAccessEdit(item)}>{editingUid === item.uid ? 'Cancelar' : 'Gerenciar'}</button>}{editingUid === item.uid && <div className="admin-access-editor"><label>Papel<select value={accessDraft.role} onChange={(event) => setAccessDraft({ ...accessDraft, role: event.target.value as AdminUser['role'] })}><option value="user">Usuário</option><option value="editor">Editor</option><option value="admin">Administrador</option></select></label><label>Acesso<select value={accessDraft.accountStatus} onChange={(event) => setAccessDraft({ ...accessDraft, accountStatus: event.target.value as AdminUser['accountStatus'] })}><option value="pending">Pendente</option><option value="active">Ativo</option><option value="suspended">Suspenso</option></select></label><label className="admin-justification">Justificativa<textarea rows={2} minLength={10} maxLength={500} value={accessDraft.justification} onChange={(event) => setAccessDraft({ ...accessDraft, justification: event.target.value })} placeholder="Explique a alteração (mínimo de 10 caracteres)" /></label><button type="button" className="admin-save-action" disabled={busy || accessDraft.justification.trim().length < 10} onClick={() => void saveAccess(item)}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Salvando…' : 'Salvar alteração'}</button></div>}</article>)}</div> : <p className="admin-empty">Nenhuma conta corresponde à busca.</p>}</section>}
    {tab === 'reviews' && <section className="admin-content"><div className="admin-section-heading"><div><span>Fluxo editorial</span><h2>Fila de revisões</h2><p>As alterações de editores só chegam ao público depois da aprovação administrativa.</p></div><strong className="admin-count">{pendingRequests.length} pendentes</strong></div><label className="admin-review-note">Justificativa para a decisão<textarea rows={2} value={decisionText} onChange={(event) => setDecisionText(event.target.value)} placeholder="Mínimo de 10 caracteres" /></label>{requests.length ? <div className="admin-review-list">{requests.map((item) => <article key={item.id}><div className="admin-review-top"><span className={`admin-status status-${item.status === 'pending' ? 'pending' : 'active'}`}>{item.status === 'pending' ? 'Aguardando revisão' : item.status === 'approved' ? 'Aprovada' : 'Recusada'}</span><small>{item.resourceType} · {item.operation} · {dateLabel(item.requestedAt)}</small></div><h3>{item.summary}</h3><p>Identificador: {item.resourceId}</p>{item.status === 'pending' && <div className="admin-review-actions"><button type="button" disabled={busy || decisionText.trim().length < 10} onClick={() => void review(item, 'approved')}><i className="fa-solid fa-check" /> Aprovar e publicar</button><button type="button" className="is-reject" disabled={busy || decisionText.trim().length < 10} onClick={() => void review(item, 'rejected')}><i className="fa-solid fa-xmark" /> Recusar</button></div>}</article>)}</div> : <p className="admin-empty">Nenhuma solicitação editorial registrada.</p>}</section>}
    {tab === 'support' && <section className="admin-content"><div className="admin-section-heading"><div><span>Central de atendimento</span><h2>Chamados de suporte</h2><p>Acompanhe a fila e responda às solicitações da comunidade.</p></div><strong className="admin-count">{openTickets} em andamento</strong></div>{tickets.length ? <div className="admin-ticket-list">{tickets.slice(0, 12).map((ticket) => <article key={ticket.id}><div><strong>{ticket.subject}</strong><small>{ticket.ownerName} · {ticket.ownerEmail} · {dateLabel(ticket.updatedAt)}</small></div><span className={`admin-status status-${['resolved', 'closed', 'cancelled'].includes(ticket.status) ? 'active' : 'pending'}`}>{ticket.status === 'in_progress' ? 'Em atendimento' : ticket.status === 'waiting_for_user' ? 'Aguardando usuário' : ticket.status === 'resolved' ? 'Resolvido' : ticket.status === 'closed' ? 'Encerrado' : ticket.status === 'cancelled' ? 'Cancelado' : 'Aberto'}</span><Link to={`/ajuda?ticket=${ticket.id}`}>Abrir chamado <i className="fa-solid fa-arrow-up-right-from-square" /></Link></article>)}</div> : <p className="admin-empty">{loading ? 'Carregando chamados…' : 'Nenhum chamado registrado.'}</p>}<Link to="/ajuda" className="admin-all-tickets">Abrir central de atendimento <i className="fa-solid fa-arrow-right" /></Link></section>}
    {tab === 'audit' && <section className="admin-content"><div className="admin-section-heading"><div><span>Rastreabilidade</span><h2>Registro de auditoria</h2><p>Histórico recente de decisões administrativas e alterações de acesso.</p></div><strong className="admin-count">Últimos {audit.length}</strong></div>{audit.length ? <div className="admin-audit-list">{audit.map((event) => <article key={event.id}><span><i className="fa-solid fa-shield-halved" /></span><div><strong>{event.type === 'user.access.updated' ? 'Permissão de conta alterada' : event.type ?? 'Evento administrativo'}</strong><small>Responsável: {event.actorUid || 'Não informado'} · Conta afetada: {event.targetUid || '—'}</small>{event.justification && <p>{event.justification}</p>}{event.next && <small>Novo papel: {roleName(String(event.next.role ?? 'user') as AdminUser['role'])} · Acesso: {statusName(String(event.next.accountStatus ?? 'pending') as AdminUser['accountStatus'])}</small>}</div><time>{dateLabel(event.createdAt)}</time></article>)}</div> : <p className="admin-empty">Nenhuma ação administrativa foi registrada até o momento.</p>}</section>}
  </section>;
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
