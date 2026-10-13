import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../features/auth';
import { reviewEditorialChange, submitPublicationChange, uploadPublicationDraft, watchEditorialChanges, watchPublishedPublications, type EditorialChange, type ObservatoryPublication } from '../features/editorial/service';

type PublicationType = 'article' | 'thesis' | 'dissertation' | 'monograph' | 'map' | 'report' | 'book' | 'atlas' | 'other';
type SeedPublication = { id: string; title: string; authors: string[]; year: number; type: PublicationType; reference: string; abstract: string; studyArea: string; municipalities: string[]; keywords: string[]; externalUrl?: string };

const initialCollection: SeedPublication[] = [
  { id: 'atlas-geoquimico-paramirim', title: 'Atlas geoquímico da bacia do rio Paramirim', authors: ['Eduardo Paim Viglio', 'André Luís Invernizzi', 'Deborah Ribeiro Baptista'], year: 2021, type: 'atlas', reference: 'VIGLIO, Eduardo Paim; INVERNIZZI, André Luís; BAPTISTA, Deborah Ribeiro. Atlas geoquímico da bacia do rio Paramirim. Rio de Janeiro: CPRM, 2021.', abstract: 'Atlas de mapas geoquímicos de solos, sedimentos de corrente e águas superficiais e de abastecimento na bacia do rio Paramirim.', studyArea: 'Bacia Hidrográfica do Rio Paramirim', municipalities: [], keywords: ['geoquímica', 'atlas', 'água', 'solo', 'sedimentos'], externalUrl: 'https://rigeo.sgb.gov.br/handle/doc/22505' },
  { id: 'carta-geologica-boquira', title: 'Carta geológica de Boquira (BA)', authors: ['Serviço Geológico do Brasil — CPRM'], year: 2014, type: 'map', reference: 'BRASIL. Serviço Geológico do Brasil. Carta geológica: Boquira (SD.23-X-D-I). Escala 1:100.000. Brasília, DF: CPRM, 2014.', abstract: 'Carta geológica da folha Boquira, com unidades litológicas, estruturas, ocorrências minerais e mapas temáticos regionais.', studyArea: 'Boquira e entorno', municipalities: ['Boquira'], keywords: ['geologia', 'cartografia', 'mapa geológico'] },
  { id: 'impactos-recursos-hidricos-metais-boquira', title: 'Impactos ambientais nos recursos hídricos por metais tóxicos: o caso do município de Boquira, no semiárido baiano', authors: ['Rafael Ribeiro Daltro'], year: 2017, type: 'dissertation', reference: 'DALTRO, Rafael Ribeiro. Impactos ambientais nos recursos hídricos por metais tóxicos: o caso do município de Boquira, no semiárido baiano. 2017. Dissertação (Mestrado em Geologia) — Instituto de Geociências, Universidade Federal da Bahia, Salvador, 2017.', abstract: 'Dissertação sobre impactos ambientais em recursos hídricos associados a metais tóxicos no município de Boquira.', studyArea: 'Município de Boquira', municipalities: ['Boquira'], keywords: ['recursos hídricos', 'metais tóxicos', 'contaminação', 'água'] },
  { id: 'predicao-elementos-toxicos-solos-boquira', title: 'Predição e espacialização de elementos potencialmente tóxicos em solos no entorno de pilha de rejeito de mineração: riscos à saúde humana e fitorremediação', authors: ['Ésio de Castro Paes'], year: 2022, type: 'thesis', reference: 'PAES, Ésio de Castro. Predição e espacialização de elementos potencialmente tóxicos em solos no entorno de pilha de rejeito de mineração: riscos à saúde humana e fitorremediação. 2022. Tese (Doctor Scientiae em Solos e Nutrição de Plantas) — Universidade Federal de Viçosa, Viçosa, MG, 2022.', abstract: 'Pesquisa sobre predição espacial de elementos potencialmente tóxicos nos solos próximos à pilha de rejeitos de mineração em Boquira e avaliação de riscos e fitorremediação.', studyArea: 'Pilha de rejeitos e área urbana de Boquira', municipalities: ['Boquira'], keywords: ['solos', 'metais potencialmente tóxicos', 'chumbo', 'fitorremediação', 'saúde'] },
  { id: 'estudos-geoquimicos-boquira', title: 'Estudos geoquímicos no município de Boquira, estado da Bahia', authors: ['Fernanda Gonçalves da Cunha', 'Eduardo Paim Viglio', 'José Ângelo Sebastião Araújo dos Anjos', 'Thais Belloti Loureiro'], year: 2016, type: 'report', reference: 'CUNHA, Fernanda Gonçalves da; VIGLIO, Eduardo Paim; ANJOS, José Ângelo Sebastião Araújo dos; LOUREIRO, Thais Belloti. Estudos geoquímicos no município de Boquira, estado da Bahia. Rio de Janeiro: CPRM, nov. 2016.', abstract: 'Relatório de levantamento geoquímico urbano em Boquira, com análise de água subterrânea, rejeitos, sedimentos de rua e poeira residencial.', studyArea: 'Município de Boquira', municipalities: ['Boquira'], keywords: ['geoquímica', 'chumbo', 'rejeitos', 'poeira', 'saúde ambiental'] },
  { id: 'alternativa-aterro-boquira', title: 'Alternativa locacional para implantação de aterro sanitário de pequeno porte no município de Boquira-BA', authors: ['Luciana Souza de Oliveira', 'José Ângelo Sebastião Araújo dos Anjos'], year: 2021, type: 'article', reference: 'OLIVEIRA, Luciana Souza de; ANJOS, José Ângelo Sebastião Araújo dos. Alternativa locacional para implantação de aterro sanitário de pequeno porte no município de Boquira-Bahia. In: GEOLOGIA AMBIENTAL E MÉDICA DO ESTADO DA BAHIA: avaliação de impactos ambientais. v. 1, 2021. p. 116–131. DOI: https://doi.org/10.60111/978-65-00-23593-7_05.', abstract: 'Estudo de alternativas locacionais para implantação de aterro sanitário de pequeno porte em Boquira, integrando critérios ambientais e geoprocessamento.', studyArea: 'Município de Boquira', municipalities: ['Boquira'], keywords: ['resíduos sólidos', 'aterro sanitário', 'geoprocessamento', 'análise multicritério'], externalUrl: 'https://doi.org/10.60111/978-65-00-23593-7_05' },
];
const typeNames: Record<PublicationType, string> = { article: 'Artigo', thesis: 'Tese', dissertation: 'Dissertação', monograph: 'TCC / Monografia', map: 'Mapeamento', report: 'Relatório técnico', book: 'Livro', atlas: 'Atlas', other: 'Outro' };
const emptyForm = { title: '', authors: '', year: String(new Date().getFullYear()), type: 'article' as PublicationType, reference: '', abstract: '', studyArea: '', municipalities: '', keywords: '', doi: '', externalUrl: '' };
const asArray = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const asText = (value: unknown) => typeof value === 'string' ? value : '';
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 110);

export function ObservatoryPage() {
  const { user, role } = useAuth();
  const isManager = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';
  const [publications, setPublications] = useState<ObservatoryPublication[]>([]);
  const [loadingPublications, setLoadingPublications] = useState(true);
  const [requests, setRequests] = useState<EditorialChange[]>([]);
  const [view, setView] = useState<'catalog' | 'management'>('catalog');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<ObservatoryPublication | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [decisionText, setDecisionText] = useState('Referência conferida e arquivo validado.');
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true; let stop: (() => void) | undefined;
    void watchPublishedPublications((items) => { if (active) { setPublications(items); setLoadingPublications(false); } }, (error) => { if (active) { setMessage(error.message); setLoadingPublications(false); } })
      .then((unsubscribe) => { if (active) stop = unsubscribe; else unsubscribe(); });
    return () => { active = false; stop?.(); };
  }, []);
  useEffect(() => {
    if (!user || !isManager) return undefined;
    let active = true; let stop: (() => void) | undefined;
    void watchEditorialChanges(user.uid, isAdmin, (items) => { if (active) setRequests(items.filter((item) => item.resourceType === 'publication')); }, (error) => { if (active) setMessage(error.message); })
      .then((unsubscribe) => { if (active) stop = unsubscribe; else unsubscribe(); });
    return () => { active = false; stop?.(); };
  }, [user, isManager, isAdmin]);

  const municipalities = useMemo(() => [...new Set(publications.flatMap((item) => asArray(item.municipalities)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [publications]);
  const areas = useMemo(() => [...new Set(publications.map((item) => asText(item.studyArea)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [publications]);
  const years = useMemo(() => [...new Set(publications.map((item) => Number(item.year)).filter(Number.isFinite))].sort((a, b) => b - a), [publications]);
  const visible = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return publications.filter((item) => {
      const text = [item.title, item.reference, item.abstract, ...asArray(item.authors), ...asArray(item.municipalities), ...asArray(item.keywords), item.studyArea].join(' ').toLocaleLowerCase('pt-BR');
      return (!normalized || text.includes(normalized)) && (yearFilter === 'all' || String(item.year) === yearFilter) && (typeFilter === 'all' || item.type === typeFilter) && (municipalityFilter === 'all' || asArray(item.municipalities).includes(municipalityFilter)) && (areaFilter === 'all' || item.studyArea === areaFilter);
    }).sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0) || String(a.title).localeCompare(String(b.title), 'pt-BR'));
  }, [publications, search, yearFilter, typeFilter, municipalityFilter, areaFilter]);

  const resetEditor = () => { setSelected(null); setForm(emptyForm); setFile(null); setEditorOpen(false); };
  const startCreate = () => { setSelected(null); setForm(emptyForm); setFile(null); setEditorOpen(true); setMessage(''); };
  const startEdit = (publication: ObservatoryPublication) => {
    setSelected(publication);
    setForm({ title: asText(publication.title), authors: asArray(publication.authors).join(', '), year: String(publication.year ?? ''), type: (publication.type as PublicationType) || 'other', reference: asText(publication.reference), abstract: asText(publication.abstract), studyArea: asText(publication.studyArea), municipalities: asArray(publication.municipalities).join(', '), keywords: asArray(publication.keywords).join(', '), doi: asText(publication.doi), externalUrl: asText(publication.externalUrl) });
    setFile(null); setEditorOpen(true); setMessage('');
  };
  const tokens = (value: string) => value.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  const savePublication = async (event: FormEvent) => {
    event.preventDefault(); if (!user) return;
    setBusy(true); setMessage('');
    try {
      const publicationId = selected?.id ?? slugify(form.title); if (!publicationId) throw new Error('Informe um título válido.');
      const requestId = crypto.randomUUID(); const uploaded = file ? await uploadPublicationDraft(user.uid, requestId, file) : undefined;
      const publication = { id: publicationId, title: form.title.trim(), authors: tokens(form.authors), year: Number(form.year), type: form.type, reference: form.reference.trim(), abstract: form.abstract.trim(), studyArea: form.studyArea.trim(), municipalities: tokens(form.municipalities), keywords: tokens(form.keywords), doi: form.doi.trim(), externalUrl: form.externalUrl.trim(), ...(selected?.storagePath ? { storagePath: selected.storagePath, fileName: selected.fileName, sizeBytes: selected.sizeBytes } : {}), ...(uploaded ? { fileName: uploaded.fileName, contentType: 'application/pdf' } : {}) };
      const result = await submitPublicationChange({ requestId, resourceId: publicationId, operation: selected ? 'update' : 'create', summary: `${selected ? 'Atualização' : 'Inclusão'} de publicação: ${form.title.trim()}`, payload: { publication, ...(uploaded ? { stagingPath: uploaded.stagingPath } : {}) } });
      setMessage(result.status === 'approved' ? 'Publicação salva e disponível no Observatório.' : 'Proposta enviada. Ela ficará visível após a aprovação de um administrador.'); resetEditor();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar esta publicação.'); }
    finally { setBusy(false); }
  };

  const archivePublication = async (publication: ObservatoryPublication) => {
    if (!user || !window.confirm(`Arquivar “${publication.title}”? O item deixará de aparecer no catálogo público.`)) return;
    setBusy(true); setMessage('');
    try {
      const payload = { publication: { id: publication.id, title: asText(publication.title), authors: asArray(publication.authors), year: Number(publication.year), type: publication.type as PublicationType, reference: asText(publication.reference), abstract: asText(publication.abstract), studyArea: asText(publication.studyArea), municipalities: asArray(publication.municipalities), keywords: asArray(publication.keywords), doi: asText(publication.doi), externalUrl: asText(publication.externalUrl), storagePath: asText(publication.storagePath), fileName: asText(publication.fileName), contentType: asText(publication.contentType), sizeBytes: Number(publication.sizeBytes ?? 0) } };
      const result = await submitPublicationChange({ requestId: crypto.randomUUID(), resourceId: publication.id, operation: 'archive', summary: `Arquivamento da publicação: ${publication.title}`, payload });
      setMessage(result.status === 'approved' ? 'Publicação arquivada.' : 'Pedido de arquivamento enviado para aprovação.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível arquivar a publicação.'); }
    finally { setBusy(false); }
  };

  const importInitialCollection = async (files: FileList | null) => {
    if (!files || !user) return;
    const byIndex = new Map<number, File>();
    for (const item of Array.from(files)) { const match = item.name.match(/^0?([1-6])[_-]/); if (match) byIndex.set(Number(match[1]), item); }
    const missing = initialCollection.filter((entry, index) => !byIndex.has(index + 1) && !publications.some((item) => item.id === entry.id));
    if (missing.length) { setMessage(`Não encontrei os PDFs ${missing.map((entry) => String(initialCollection.indexOf(entry) + 1).padStart(2, '0')).join(', ')}. Selecione os seis arquivos com os nomes originais iniciados por 01 a 06.`); return; }
    const toImport = initialCollection.map((entry, index) => ({ entry, file: byIndex.get(index + 1) })).filter((value): value is { entry: SeedPublication; file: File } => Boolean(value.file) && !publications.some((item) => item.id === value.entry.id));
    if (!toImport.length) { setMessage('Os seis trabalhos já estão no catálogo.'); return; }
    setBusy(true); setMessage('');
    try {
      for (const [index, item] of toImport.entries()) {
        setImportProgress(`Enviando ${index + 1} de ${toImport.length}: ${item.entry.title}`);
        const requestId = crypto.randomUUID(); const uploaded = await uploadPublicationDraft(user.uid, requestId, item.file);
        const publication = { ...item.entry, fileName: uploaded.fileName, contentType: 'application/pdf', sizeBytes: item.file.size };
        const result = await submitPublicationChange({ requestId, resourceId: publication.id, operation: 'create', summary: `Inclusão do acervo inicial: ${publication.title}`, payload: { publication, stagingPath: uploaded.stagingPath } });
        if (result.status !== 'approved') throw new Error('A importação foi enviada para aprovação e ainda não está pública.');
      }
      setMessage(`${toImport.length} publicação(ões) importada(s) e disponível(is) no Observatório.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'A importação foi interrompida. Os itens já enviados foram preservados.'); }
    finally { setBusy(false); setImportProgress(''); if (importInput.current) importInput.current.value = ''; }
  };
  const review = async (item: EditorialChange, decision: 'approved' | 'rejected') => {
    setBusy(true); setMessage('');
    try { await reviewEditorialChange({ requestId: item.id, decision, justification: decisionText }); setMessage(decision === 'approved' ? 'Publicação aprovada e processada.' : 'Proposta recusada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível revisar a solicitação.'); }
    finally { setBusy(false); }
  };
  const clearFilters = () => { setSearch(''); setYearFilter('all'); setTypeFilter('all'); setMunicipalityFilter('all'); setAreaFilter('all'); };
  const pending = requests.filter((item) => item.status === 'pending');

  return <main className="observatory-page">
    <header className="observatory-hero"><div className="observatory-hero-copy"><span className="observatory-kicker"><i className="fa-solid fa-book-open-reader" /> ACERVO CIENTÍFICO · TERRITÓRIO DO PARAMIRIM</span><h1>Conhecimento que conta a história do território.</h1><p>Pesquisas, mapas e publicações sobre a bacia e os municípios que a compõem, reunidos em um só lugar.</p></div><div className="observatory-hero-mark" aria-hidden="true"><i className="fa-solid fa-book-open-reader" /></div><div className="observatory-stats"><article><strong>{publications.length}</strong><span>publicações no acervo</span></article><article><strong>{municipalities.length}</strong><span>municípios indexados</span></article><article><strong>{years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—'}</strong><span>período coberto</span></article></div></header>
    {isManager && <nav className="observatory-tabs" aria-label="Seções do Observatório"><button type="button" className={view === 'catalog' ? 'is-active' : ''} onClick={() => setView('catalog')}><i className="fa-solid fa-book-open" /> Acervo <small>{publications.length}</small></button><button type="button" className={view === 'management' ? 'is-active' : ''} onClick={() => setView('management')}><i className="fa-solid fa-sliders" /> Gestão editorial {pending.length > 0 && <small>{pending.length}</small>}</button></nav>}
    {view === 'catalog' ? <section className="observatory-catalog"><div className="observatory-section-heading"><div><span className="observatory-eyebrow">Explore o acervo</span><h2>Publicações da região</h2><p>Busque por tema, autor ou localidade, ou combine filtros para refinar a seleção.</p></div><span className="observatory-result-count">{visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}</span></div>
      <div className="observatory-filters"><label className="observatory-search"><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, autor, tema ou referência" aria-label="Buscar publicações" /></label><label><span>Ano</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">Todos os anos</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label><label><span>Tipo</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Todos os tipos</option>{Object.entries(typeNames).filter(([type]) => publications.some((item) => item.type === type)).map(([type, name]) => <option key={type} value={type}>{name}</option>)}</select></label><label><span>Município</span><select value={municipalityFilter} onChange={(event) => setMunicipalityFilter(event.target.value)}><option value="all">Todos os municípios</option>{municipalities.map((municipality) => <option key={municipality}>{municipality}</option>)}</select></label><label><span>Área de estudo</span><select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option value="all">Todas as áreas</option>{areas.map((area) => <option key={area}>{area}</option>)}</select></label><button type="button" className="observatory-clear" onClick={clearFilters}>Limpar filtros</button></div>
      {visible.length ? <div className="observatory-grid">{visible.map((item) => <article className="observatory-card" key={item.id}><div className="observatory-card-top"><span className="observatory-type">{typeNames[item.type as PublicationType] ?? 'Publicação'}</span><span className="observatory-year">{String(item.year ?? '')}</span></div><h3>{asText(item.title)}</h3><p className="observatory-authors">{asArray(item.authors).join(' · ')}</p>{asText(item.abstract) && <p className="observatory-abstract">{asText(item.abstract)}</p>}<div className="observatory-tags">{asText(item.studyArea) && <span><i className="fa-solid fa-location-dot" />{asText(item.studyArea)}</span>}{asArray(item.municipalities).map((name) => <span key={name}>{name}</span>)}</div><details className="observatory-reference"><summary>Referência bibliográfica</summary><p>{asText(item.reference)}</p></details><div className="observatory-card-actions">{asText(item.downloadUrl) && <a href={asText(item.downloadUrl)} target="_blank" rel="noreferrer"><i className="fa-solid fa-file-pdf" /> Abrir PDF</a>}{asText(item.externalUrl) && <a href={asText(item.externalUrl)} target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" /> Fonte externa</a>}{isManager && <button type="button" onClick={() => startEdit(item)} aria-label={`Editar ${asText(item.title)}`}><i className="fa-solid fa-pen" /> Editar</button>}</div></article>)}</div> : <div className="observatory-empty"><span><i className={`fa-solid ${loadingPublications ? 'fa-spinner fa-spin' : 'fa-book-open'}`} /></span><h3>{loadingPublications ? 'Carregando o acervo' : publications.length ? 'Nenhuma publicação encontrada' : 'O acervo está sendo organizado'}</h3><p>{loadingPublications ? 'Consultando as publicações disponíveis.' : publications.length ? 'Ajuste os filtros ou tente outros termos de busca.' : 'As publicações sobre a Bacia do Rio Paramirim serão reunidas aqui.'}</p>{publications.length > 0 && <button type="button" className="observatory-secondary" onClick={clearFilters}>Limpar filtros</button>}</div>}
    </section> : <section className="observatory-management"><div className="observatory-section-heading"><div><span className="observatory-eyebrow">Área restrita · {isAdmin ? 'Administrador' : 'Editor'}</span><h2>Gestão do acervo</h2><p>Edite publicações, inclua novos materiais e acompanhe a revisão das propostas.</p></div><button className="observatory-primary" type="button" onClick={startCreate}><i className="fa-solid fa-plus" /> Nova publicação</button></div>
      {isAdmin && <div className="observatory-import"><div><strong>Importar os seis trabalhos enviados</strong><p>Selecione os PDFs originais (nomes iniciados por 01 a 06). Referências e metadados estão preparados; os arquivos serão guardados no Storage.</p></div><input ref={importInput} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(event) => void importInitialCollection(event.target.files)} /><button type="button" className="observatory-secondary" onClick={() => importInput.current?.click()} disabled={busy}><i className="fa-solid fa-file-arrow-up" /> Selecionar PDFs</button></div>}
      {importProgress && <p className="observatory-progress" role="status"><i className="fa-solid fa-spinner fa-spin" /> {importProgress}</p>}
      <div className="observatory-manage-list">{publications.map((item) => <article key={item.id}><span className="observatory-manage-icon"><i className="fa-solid fa-file-lines" /></span><div><strong>{asText(item.title)}</strong><small>{String(item.year ?? '')} · {typeNames[item.type as PublicationType] ?? 'Publicação'} · {asArray(item.municipalities).join(', ') || asText(item.studyArea)}</small></div><div><button type="button" className="observatory-manage-edit" onClick={() => startEdit(item)}><i className="fa-solid fa-pen" /> Editar</button><button type="button" className="observatory-manage-archive" disabled={busy} onClick={() => void archivePublication(item)} aria-label={`Arquivar ${asText(item.title)}`}><i className="fa-solid fa-box-archive" /></button></div></article>)}</div>
      <div className="observatory-reviews"><div className="observatory-section-heading"><div><span className="observatory-eyebrow">Rastreabilidade</span><h2>{isAdmin ? 'Propostas para aprovação' : 'Minhas propostas'}</h2></div></div>{isAdmin && <label className="observatory-decision">Justificativa da decisão<textarea rows={2} value={decisionText} onChange={(event) => setDecisionText(event.target.value)} /></label>}{requests.length ? requests.map((item) => <article className="observatory-request" key={item.id}><div><strong>{item.summary}</strong><small>{item.operation === 'create' ? 'Inclusão' : item.operation === 'update' ? 'Atualização' : 'Arquivamento'} · {item.status === 'pending' ? 'Aguardando revisão' : item.status}</small></div>{isAdmin && item.status === 'pending' && <div><button type="button" className="observatory-approve" disabled={busy} onClick={() => void review(item, 'approved')}><i className="fa-solid fa-check" /> Aprovar</button><button type="button" className="observatory-reject" disabled={busy} onClick={() => void review(item, 'rejected')}>Recusar</button></div>}</article>) : <p className="observatory-no-requests">Nenhuma solicitação editorial de publicação.</p>}</div>
    </section>}
    {message && <p className="observatory-message" role="status">{message}<button type="button" aria-label="Fechar mensagem" onClick={() => setMessage('')}><i className="fa-solid fa-xmark" /></button></p>}
    {editorOpen && <div className="observatory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) resetEditor(); }}><section className="observatory-modal" role="dialog" aria-modal="true" aria-labelledby="observatory-form-title"><header><div><span className="observatory-eyebrow">Acervo bibliográfico</span><h2 id="observatory-form-title">{selected ? 'Editar publicação' : 'Nova publicação'}</h2></div><button type="button" aria-label="Fechar formulário" disabled={busy} onClick={resetEditor}><i className="fa-solid fa-xmark" /></button></header><form onSubmit={(event) => void savePublication(event)}><div className="observatory-form-grid"><label className="field-wide">Título<input required minLength={5} maxLength={240} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Autores <small>Separe os nomes por vírgulas</small><input required value={form.authors} onChange={(event) => setForm({ ...form, authors: event.target.value })} /></label><label>Ano de publicação<input required type="number" min="1800" max="2200" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} /></label><label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PublicationType })}>{Object.entries(typeNames).map(([type, name]) => <option key={type} value={type}>{name}</option>)}</select></label><label>Área de estudo<input value={form.studyArea} onChange={(event) => setForm({ ...form, studyArea: event.target.value })} placeholder="Ex.: Bacia do Rio Paramirim" /></label><label>Municípios <small>Separe por vírgulas</small><input value={form.municipalities} onChange={(event) => setForm({ ...form, municipalities: event.target.value })} placeholder="Boquira, Macaúbas" /></label><label>Palavras-chave <small>Separe por vírgulas</small><input value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} /></label><label className="field-wide">Referência (ABNT)<textarea required rows={3} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></label><label className="field-wide">Resumo<input value={form.abstract} onChange={(event) => setForm({ ...form, abstract: event.target.value })} /></label><label>DOI<input value={form.doi} onChange={(event) => setForm({ ...form, doi: event.target.value })} /></label><label>Link externo<input type="url" value={form.externalUrl} onChange={(event) => setForm({ ...form, externalUrl: event.target.value })} /></label><label className="field-wide observatory-file">PDF {selected && <small>Deixe em branco para manter o arquivo atual.</small>}<input type="file" accept="application/pdf,.pdf" required={!selected} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>PDF com até 50 MB. Para editores, a publicação entra no catálogo após aprovação administrativa.</small></label></div><footer><button type="button" className="observatory-secondary" disabled={busy} onClick={resetEditor}>Cancelar</button><button type="submit" className="observatory-primary" disabled={busy}>{busy ? 'Enviando…' : isAdmin ? 'Salvar publicação' : 'Enviar para aprovação'}</button></footer></form></section></div>}
  </main>;
}
