import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../features/auth';
import { ThemeDetail } from '../components/ThemeDetail';
import {
  migrateLegacyGeospatial,
  reviewEditorialChange,
  submitLayerChange,
  uploadLayerDraft,
  watchEditorialChanges,
  watchPublishedLayers,
  type EditorialChange,
} from '../features/editorial/service';

type Layer = Record<string, unknown> & { id: string };
type Operation = 'create' | 'update' | 'archive';
type EditorialView = 'catalog' | 'requests';
type LayerFilter = 'all' | 'vector' | 'raster';
type RequestFilter = 'pending' | 'all' | 'resolved';

function formatBytes(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Tamanho não informado';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[index]}`;
}

function formatDate(value: unknown) {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') date = value.toDate();
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Data não informada';
}

function statusLabel(status: string) {
  return ({ pending: 'Aguardando revisão', processing: 'Em análise', approved: 'Aprovada', rejected: 'Recusada' } as Record<string, string>)[status] ?? status;
}

function resourceLabel(resource: EditorialChange['resourceType']) {
  return ({ layer: 'Camada', dashboard: 'Dashboard', publication: 'Publicação' } as const)[resource];
}

function operationLabel(operation: EditorialChange['operation']) {
  return ({ create: 'Inclusão', update: 'Atualização', archive: 'Arquivamento' } as const)[operation];
}

export function EditorialPage() {
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<EditorialChange[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [view, setView] = useState<EditorialView>('catalog');
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('pending');
  const [search, setSearch] = useState('');
  const [operation, setOperation] = useState<Operation>('create');
  const [editorOpen, setEditorOpen] = useState(false);
  const [layerId, setLayerId] = useState('');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [subgroup, setSubgroup] = useState('');
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
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!user) return;
    let active = true;
    let stopChanges: (() => void) | undefined;
    let stopLayers: (() => void) | undefined;
    void watchEditorialChanges(user.uid, isAdmin,
      (items) => { if (active) setRequests(items); },
      (error) => { if (active) setMessage(error.message); },
    ).then((unsubscribe) => { if (active) stopChanges = unsubscribe; else unsubscribe(); });
    void watchPublishedLayers(
      (items) => { if (active) setLayers(items.filter((item) => item.status === 'published') as Layer[]); },
      (error) => { if (active) setMessage(error.message); },
    ).then((unsubscribe) => { if (active) stopLayers = unsubscribe; else unsubscribe(); });
    return () => { active = false; stopChanges?.(); stopLayers?.(); };
  }, [user, isAdmin]);

  useEffect(() => {
    if (operation === 'create') return;
    const selected = layers.find((layer) => layer.id === layerId);
    if (!selected) return;
    setTitle(String(selected.title ?? ''));
    setGroup(String(selected.group ?? ''));
    setSubgroup(String(selected.subgroup ?? selected.subGroup ?? selected.subgroupName ?? ''));
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

  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const visibleLayers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return layers.filter((layer) => {
      const matchesKind = layerFilter === 'all' || layer.kind === layerFilter;
      const group = String(layer.group ?? 'Sem grupo');
      const subgroup = layer.subgroup ?? layer.subGroup ?? layer.subgroupName ?? '';
      const text = `${layer.title ?? ''} ${group} ${subgroup} ${layer.id}`.toLocaleLowerCase('pt-BR');
      return matchesKind && (groupFilter === 'all' || group === groupFilter) && (!normalizedSearch || text.includes(normalizedSearch));
    });
  }, [layers, layerFilter, groupFilter, search]);

  const availableGroups = useMemo(() => [...new Set(layers
    .filter((layer) => layerFilter === 'all' || layer.kind === layerFilter)
    .map((layer) => String(layer.group ?? 'Sem grupo')))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR')),
  [layers, layerFilter]);

  const groupedLayers = useMemo(() => (['vector', 'raster'] as const)
    .filter((kind) => layerFilter === 'all' || layerFilter === kind)
    .map((kind) => {
      const typedLayers = visibleLayers.filter((layer) => layer.kind === kind);
      const groups = new Map<string, Map<string, Layer[]>>();
      typedLayers.forEach((layer) => {
        const groupName = String(layer.group ?? 'Sem grupo');
        const subgroupName = String(layer.subgroup ?? layer.subGroup ?? layer.subgroupName ?? 'Geral');
        const subgroups = groups.get(groupName) ?? new Map<string, Layer[]>();
        subgroups.set(subgroupName, [...(subgroups.get(subgroupName) ?? []), layer]);
        groups.set(groupName, subgroups);
      });
      return {
        kind,
        title: kind === 'vector' ? 'Camadas vetoriais' : 'Camadas raster',
        icon: kind === 'vector' ? 'fa-draw-polygon' : 'fa-image',
        count: typedLayers.length,
        groups: [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
          .map(([name, subgroups]) => ({
            name,
            count: [...subgroups.values()].reduce((total, items) => total + items.length, 0),
            subgroups: [...subgroups.entries()].sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
              .map(([subgroup, items]) => ({ name: subgroup, layers: items })),
          })),
      };
    }), [visibleLayers, layerFilter]);

  const visibleRequests = useMemo(() => requests.filter((item) => {
    if (requestFilter === 'pending') return item.status === 'pending' || item.status === 'processing';
    if (requestFilter === 'resolved') return item.status === 'approved' || item.status === 'rejected';
    return true;
  }), [requests, requestFilter]);

  if (!user) return null;

  const resetEditor = () => {
    setOperation('create'); setLayerId(''); setTitle(''); setGroup(''); setSubgroup(''); setKind('vector'); setCrs('EPSG:4674');
    setSource(''); setRasterMin(''); setRasterMax(''); setNoData(''); setStyleJson('{}'); setSummary(''); setFile(null);
  };

  const startCreate = () => {
    resetEditor(); setMessage(''); setView('catalog'); setEditorOpen(true);
  };

  const startEdit = (layer: Layer, nextOperation: Operation) => {
    setMessage(''); setOperation(nextOperation); setLayerId(layer.id); setEditorOpen(true);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const safeId = (operation === 'create' ? layerId || title : layerId).trim().toLocaleLowerCase('en').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      if (!safeId) throw new Error('Informe o identificador da camada.');
      if (operation !== 'archive' && (!title.trim() || !group.trim())) throw new Error('Informe o nome e o grupo da camada.');
      if (operation === 'create' && !file) throw new Error('Selecione o arquivo da camada.');
      let styleDefault: Record<string, unknown> = {};
      try { styleDefault = JSON.parse(styleJson || '{}') as Record<string, unknown>; }
      catch { throw new Error('O estilo deve estar em formato JSON válido.'); }
      if (kind === 'raster' && rasterMin !== '' && rasterMax !== '' && Number(rasterMin) >= Number(rasterMax)) {
        throw new Error('O valor mínimo deve ser menor que o máximo.');
      }
      const requestId = crypto.randomUUID();
      if (file) setMessage('Enviando arquivo para a área de preparação…');
      const uploaded = file ? { ...await uploadLayerDraft(user.uid, requestId, file), sizeBytes: file.size } : {};
      setMessage('Registrando alteração…');
      const selectedLayer = layers.find((item) => item.id === safeId);
      const layer = operation === 'archive'
        ? { id: safeId, title: String(selectedLayer?.title ?? title), group: String(selectedLayer?.group ?? group), subgroup: String(selectedLayer?.subgroup ?? selectedLayer?.subGroup ?? subgroup), kind: selectedLayer?.kind === 'raster' ? 'raster' : 'vector' }
        : { id: safeId, title: title.trim(), group: group.trim(), ...(subgroup.trim() ? { subgroup: subgroup.trim() } : {}), kind, crs: crs.trim(), source: source.trim(), styleDefault,
          ...(kind === 'raster' && rasterMin !== '' && rasterMax !== '' ? { statistics: { min: Number(rasterMin), max: Number(rasterMax) } } : {}),
          ...(kind === 'raster' && noData !== '' ? { noData: Number(noData) } : {}) };
      const result = await submitLayerChange({
        requestId, resourceId: safeId, operation,
        summary: summary.trim() || `${operation === 'create' ? 'Nova camada' : operation === 'update' ? 'Atualização da camada' : 'Remoção da camada'}: ${title || safeId}`,
        payload: { layer, ...uploaded },
      });
      setMessage(result.status === 'approved' ? 'Alteração publicada no catálogo.' : 'Alteração enviada para aprovação administrativa.');
      if (operation === 'create') resetEditor();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a alteração.'); }
    finally { setBusy(false); }
  };

  const finishChange = async (item: EditorialChange, decision: 'approved' | 'rejected') => {
    if (decisionText.trim().length < 10) { setMessage('Informe uma justificativa com pelo menos 10 caracteres.'); return; }
    setBusy(true); setMessage('');
    try {
      await reviewEditorialChange({ requestId: item.id, decision, justification: decisionText.trim() });
      setMessage(decision === 'approved' ? 'Solicitação aprovada e publicada.' : 'Solicitação recusada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível revisar a solicitação.'); }
    finally { setBusy(false); }
  };

  return <main className="account-page editorial-page">
    <header className="editorial-hero">
      <ThemeDetail className="editorial-detail" />
      <div className="editorial-hero-copy">
        <h1>Conteúdo que constrói o mapa.</h1>
        <p>Organize as camadas do WebGIS e acompanhe, com transparência, cada publicação e decisão editorial.</p>
      </div>
      <div className="editorial-hero-actions">
        <span className={`editorial-role-chip ${isAdmin ? 'is-admin' : ''}`}><i className={`fa-solid ${isAdmin ? 'fa-shield-halved' : 'fa-pen-to-square'}`} />{isAdmin ? 'Administrador' : 'Editor'}</span>
        <button type="button" className="editorial-primary-action brand-hero-action" onClick={startCreate}><i className="fa-solid fa-plus" /> Nova camada</button>
      </div>
      <div className="editorial-metrics" aria-label="Resumo editorial">
        <article><span className="editorial-metric-icon"><i className="fa-solid fa-layer-group" /></span><div><strong>{layers.length}</strong><span>Camadas publicadas</span></div></article>
        <article><span className="editorial-metric-icon"><i className="fa-solid fa-draw-polygon" /></span><div><strong>{layers.filter((layer) => layer.kind === 'vector').length}</strong><span>Vetoriais</span></div></article>
        <article><span className="editorial-metric-icon"><i className="fa-solid fa-image" /></span><div><strong>{layers.filter((layer) => layer.kind === 'raster').length}</strong><span>Rasters</span></div></article>
        <article className={pendingCount > 0 ? 'has-pending' : ''}><span className="editorial-metric-icon"><i className="fa-solid fa-inbox" /></span><div><strong>{pendingCount}</strong><span>{isAdmin ? 'Aguardando revisão' : 'Minhas pendências'}</span></div></article>
      </div>
    </header>

    {message && <div className="editorial-message" role="status"><i className="fa-solid fa-circle-info" /><span>{message}</span><button type="button" aria-label="Dispensar mensagem" onClick={() => setMessage('')}><i className="fa-solid fa-xmark" /></button></div>}

    <nav className="editorial-tabs" role="tablist" aria-label="Seções editoriais">
      <button type="button" role="tab" aria-selected={view === 'catalog'} className={view === 'catalog' ? 'is-active' : ''} onClick={() => setView('catalog')}><i className="fa-solid fa-layer-group" /><span>Catálogo</span><small>{layers.length}</small></button>
      <button type="button" role="tab" aria-selected={view === 'requests'} className={view === 'requests' ? 'is-active' : ''} onClick={() => setView('requests')}><i className="fa-solid fa-list-check" /><span>{isAdmin ? 'Revisões' : 'Minhas solicitações'}</span><small className={pendingCount ? 'is-pending' : ''}>{pendingCount}</small></button>
    </nav>

    {view === 'catalog' ? <section className="editorial-catalog" aria-label="Catálogo de camadas">
      <div className="editorial-catalog-heading">
        <div><span className="editorial-section-kicker">WEBGIS · CONTEÚDO PUBLICADO</span><h2>Camadas do mapa</h2><p>Arquivos públicos organizados por tipo, grupo e referência espacial.</p></div>
        {isAdmin && <button type="button" className="editorial-quiet-action" onClick={() => void migrateExistingLayers()} disabled={busy}><i className="fa-solid fa-box-archive" /> Migrar catálogo antigo</button>}
      </div>
      <div className="editorial-catalog-tools">
        <label className="editorial-search"><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, grupo ou identificador" /></label>
        <label className="editorial-group-select"><i className="fa-solid fa-filter" /><span>Grupo</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">Todos os grupos</option>{availableGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
        <div className="editorial-filter" role="group" aria-label="Filtrar camadas">
          {([{ id: 'all', label: 'Todas' }, { id: 'vector', label: 'Vetoriais' }, { id: 'raster', label: 'Rasters' }] as const).map((filter) => <button key={filter.id} type="button" className={layerFilter === filter.id ? 'is-active' : ''} aria-pressed={layerFilter === filter.id} onClick={() => { setLayerFilter(filter.id); setGroupFilter('all'); }}>{filter.label}</button>)}
        </div>
      </div>
      {visibleLayers.length ? <div className="editorial-layer-catalog">
        {groupedLayers.filter((section) => section.count > 0).map((section) => <section className={`editorial-kind-section is-${section.kind}`} key={section.kind}>
          <header className="editorial-kind-heading"><span><i className={`fa-solid ${section.icon}`} />{section.title}</span><small>{section.count}</small></header>
          {section.groups.map((group) => <details className="editorial-group-card" key={group.name} open>
            <summary><span><i className="fa-solid fa-folder-tree" />{group.name}</span><small>{group.count}</small><i className="fa-solid fa-chevron-down editorial-group-chevron" /></summary>
            <div className="editorial-subgroups">{group.subgroups.map((subgroup) => <section className="editorial-subgroup" key={subgroup.name}>
              <h4><span>{subgroup.name}</span><small>{subgroup.layers.length}</small></h4>
              <div className="editorial-layer-list">{subgroup.layers.map((layer) => {
                const raster = section.kind === 'raster';
                const statistics = layer.statistics && typeof layer.statistics === 'object' ? layer.statistics as Record<string, unknown> : {};
                return <article className="editorial-layer-card" key={layer.id}>
                  <span className={`editorial-layer-symbol ${raster ? 'is-raster' : 'is-vector'}`}><i className={`fa-solid ${raster ? 'fa-image' : 'fa-draw-polygon'}`} /></span>
                  <div className="editorial-layer-copy"><div className="editorial-layer-title"><h3>{String(layer.title ?? layer.id)}</h3><span className={`editorial-type-tag ${raster ? 'is-raster' : ''}`}>{raster ? 'Raster' : 'Vetor'}</span></div><p>{String(layer.crs ?? 'CRS não informado')}</p><div className="editorial-layer-meta"><span><i className="fa-solid fa-hard-drive" /> {formatBytes(layer.sizeBytes)}</span><span><i className="fa-solid fa-code-branch" /> Revisão {String(layer.revision ?? 1)}</span>{raster && statistics.min !== undefined && statistics.max !== undefined && <span><i className="fa-solid fa-arrows-left-right" /> {Number(statistics.min).toLocaleString('pt-BR')} – {Number(statistics.max).toLocaleString('pt-BR')}</span>}</div></div>
                  <div className="editorial-layer-actions"><button type="button" aria-label={`Editar ${String(layer.title ?? layer.id)}`} title="Editar camada" onClick={() => startEdit(layer, 'update')}><i className="fa-solid fa-sliders" /><span>Editar</span></button><button type="button" className="is-archive" aria-label={`Arquivar ${String(layer.title ?? layer.id)}`} title="Remover do catálogo" onClick={() => startEdit(layer, 'archive')}><i className="fa-solid fa-box-archive" /><span>Arquivar</span></button></div>
                </article>;
              })}</div>
            </section>)}</div>
          </details>)}
        </section>)}
      </div> : <div className="editorial-catalog-empty"><span><i className="fa-solid fa-layer-group" /></span><h3>{search || groupFilter !== 'all' || layerFilter !== 'all' ? 'Nenhuma camada encontrada' : 'O catálogo está pronto para crescer'}</h3><p>{search || groupFilter !== 'all' || layerFilter !== 'all' ? 'Revise os filtros ou tente outro termo de busca.' : 'Adicione um arquivo vetorial GeoJSON ou raster GeoTIFF/COG. Editores enviam alterações para aprovação; administradores podem publicar diretamente.'}</p>{!search && <button type="button" className="editorial-primary-action" onClick={startCreate}><i className="fa-solid fa-plus" /> Adicionar primeira camada</button>}</div>}
    </section> : <section className="editorial-review" aria-label="Solicitações editoriais">
      <div className="editorial-review-heading"><div><span className="editorial-section-kicker">RASTREABILIDADE · GOVERNANÇA</span><h2>{isAdmin ? 'Fila de revisão' : 'Acompanhe suas solicitações'}</h2><p>{isAdmin ? 'Revise cada alteração antes que ela chegue ao WebGIS.' : 'Veja o andamento e o resultado das alterações que você enviou.'}</p></div><span className="editorial-review-total"><strong>{visibleRequests.length}</strong> {visibleRequests.length === 1 ? 'solicitação' : 'solicitações'}</span></div>
      <div className="editorial-request-filters" role="group" aria-label="Filtrar solicitações">
        {([{ id: 'pending', label: 'Em aberto', count: requests.filter((item) => item.status === 'pending' || item.status === 'processing').length }, { id: 'all', label: 'Todas', count: requests.length }, { id: 'resolved', label: 'Concluídas', count: requests.filter((item) => item.status === 'approved' || item.status === 'rejected').length }] as const).map((filter) => <button key={filter.id} type="button" className={requestFilter === filter.id ? 'is-active' : ''} aria-pressed={requestFilter === filter.id} onClick={() => setRequestFilter(filter.id)}>{filter.label}<span>{filter.count}</span></button>)}
      </div>
      {visibleRequests.length ? <div className="editorial-request-list">{visibleRequests.map((item) => <article className="editorial-request-card" key={item.id}>
        <span className={`editorial-request-icon status-${item.status}`}><i className={`fa-solid ${item.status === 'approved' ? 'fa-check' : item.status === 'rejected' ? 'fa-xmark' : 'fa-clock'}`} /></span>
        <div className="editorial-request-copy"><div className="editorial-request-meta"><span>{resourceLabel(item.resourceType)} · {operationLabel(item.operation)}</span><span className={`editorial-status status-${item.status}`}>{statusLabel(item.status)}</span></div><h3>{item.summary}</h3><p>{item.resourceId} <span>·</span> Enviada em {formatDate(item.requestedAt)}</p>{item.reviewJustification && <small><i className="fa-solid fa-message" /> {String(item.reviewJustification)}</small>}</div>
        {isAdmin && item.status === 'pending' && <div className="editorial-review-actions"><button type="button" className="editorial-approve-action" disabled={busy} onClick={() => void finishChange(item, 'approved')}><i className="fa-solid fa-check" /> Aprovar e publicar</button><button type="button" className="editorial-reject-action" disabled={busy} onClick={() => void finishChange(item, 'rejected')}><i className="fa-solid fa-xmark" /> Recusar</button></div>}
      </article>)}</div> : <div className="editorial-request-empty"><span><i className="fa-solid fa-inbox" /></span><h3>{requestFilter === 'pending' ? 'Tudo em dia' : 'Nenhuma solicitação por aqui'}</h3><p>{requestFilter === 'pending' ? 'Não há alterações aguardando revisão neste momento.' : 'As novas alterações e seus registros aparecerão nesta lista.'}</p></div>}
      {isAdmin && pendingCount > 0 && <label className="editorial-decision-note">Justificativa para a próxima decisão<textarea rows={2} value={decisionText} onChange={(event) => setDecisionText(event.target.value)} placeholder="Registre o motivo da aprovação ou recusa (mínimo de 10 caracteres)." /><small>Obrigatória para manter o histórico de governança.</small></label>}
    </section>}

    {editorOpen && <div className="editorial-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditorOpen(false); }}>
      <aside className="editorial-drawer" role="dialog" aria-modal="true" aria-labelledby="editorial-drawer-title">
        <header className="editorial-drawer-header"><div><span className="editorial-section-kicker">{operation === 'create' ? 'NOVA PUBLICAÇÃO' : operation === 'update' ? 'REVISÃO DO CATÁLOGO' : 'RETIRADA DO CATÁLOGO'}</span><h2 id="editorial-drawer-title">{operation === 'create' ? 'Adicionar camada' : operation === 'update' ? 'Editar camada' : 'Arquivar camada'}</h2></div><button type="button" aria-label="Fechar" onClick={() => setEditorOpen(false)} disabled={busy}><i className="fa-solid fa-xmark" /></button></header>
        <form className="editorial-drawer-form" onSubmit={(event) => void submit(event)}>
          {operation !== 'archive' ? <>
            <div className="editorial-form-intro"><span><i className="fa-solid fa-circle-info" /></span><p>{isAdmin ? 'A publicação será atualizada diretamente no WebGIS.' : 'Sua alteração ficará em preparação até a revisão de um administrador.'}</p></div>
            <div className="editorial-field-grid">
              {operation === 'create' && <label>Identificador estável<input value={layerId} onChange={(event) => setLayerId(event.target.value)} placeholder="ex.: uso-solo-2025" /><small>Gerado a partir do nome se deixado em branco.</small></label>}
              <label className="field-wide">Nome da camada<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Uso e cobertura do solo" /></label>
              <label>Grupo temático<input required value={group} onChange={(event) => setGroup(event.target.value)} placeholder="Ex.: Hidrografia" /></label>
              <label>Subgrupo<input value={subgroup} onChange={(event) => setSubgroup(event.target.value)} placeholder="Ex.: Drenagem principal (opcional)" /></label>
              <label>Formato<select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setFile(null); }}><option value="vector">Vetor · GeoJSON</option><option value="raster">Raster · GeoTIFF / COG</option></select></label>
              <label>Sistema de coordenadas<input value={crs} onChange={(event) => setCrs(event.target.value)} placeholder="EPSG:4674" /></label>
              <label className="field-wide">Fonte dos dados<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Instituição, levantamento ou referência" /></label>
              {kind === 'raster' && <>
                <label>Valor mínimo<input type="number" step="any" value={rasterMin} onChange={(event) => setRasterMin(event.target.value)} placeholder="Opcional" /></label>
                <label>Valor máximo<input type="number" step="any" value={rasterMax} onChange={(event) => setRasterMax(event.target.value)} placeholder="Opcional" /></label>
                <label>Valor NoData<input type="number" step="any" value={noData} onChange={(event) => setNoData(event.target.value)} placeholder="Opcional" /></label>
              </>}
              <label className="field-wide editorial-file-field"><span>Arquivo geoespacial <small>{operation === 'update' ? 'Escolha um novo arquivo apenas se quiser substituir o atual.' : 'O arquivo será validado e preparado antes da publicação.'}</small></span><input type="file" accept={kind === 'raster' ? '.tif,.tiff' : '.geojson,.json,application/geo+json,application/json'} required={operation === 'create'} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small className="editorial-file-name">{file ? <><i className="fa-solid fa-file-circle-check" /> {file.name} · {formatBytes(file.size)}</> : <><i className="fa-solid fa-arrow-up-from-bracket" /> Arraste ou selecione um arquivo {kind === 'raster' ? '.tif / .tiff' : '.geojson'}</>}</small></label>
              <details className="editorial-advanced field-wide"><summary>Estilo e metadados avançados <i className="fa-solid fa-chevron-down" /></summary><label>Estilo padrão (JSON)<textarea rows={5} value={styleJson} onChange={(event) => setStyleJson(event.target.value)} spellCheck={false} /></label></details>
              <label className="field-wide">Resumo para revisão<input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="O que mudou? (opcional)" /></label>
            </div>
          </> : <div className="editorial-archive-confirm"><span><i className="fa-solid fa-box-archive" /></span><h3>Retirar esta camada do catálogo?</h3><p><strong>{title || layerId}</strong> deixará de aparecer como camada publicada. Os dados permanecerão preservados no Storage para rastreabilidade.</p><label>Resumo da solicitação<input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Motivo da retirada (opcional)" /></label></div>}
          <footer className="editorial-drawer-footer"><button type="button" className="editorial-cancel-action" onClick={() => setEditorOpen(false)} disabled={busy}>Cancelar</button><button type="submit" className={operation === 'archive' ? 'editorial-submit-action is-danger' : 'editorial-submit-action'} disabled={busy || (operation !== 'create' && !layerId)}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : operation === 'archive' ? 'fa-box-archive' : isAdmin ? 'fa-floppy-disk' : 'fa-paper-plane'}`} />{busy ? 'Processando…' : operation === 'archive' ? (isAdmin ? 'Arquivar camada' : 'Enviar para revisão') : isAdmin ? 'Salvar publicação' : 'Enviar para revisão'}</button></footer>
        </form>
      </aside>
    </div>}
  </main>;
}
