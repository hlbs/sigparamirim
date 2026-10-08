import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getRasterGradient, rasterPaletteOptions, MapCanvas, type MapBaseMap, type MapFeatureSelection, type MapLayerDefinition, type MeasurementHistoryEntry } from '../features/gis/MapCanvas';
import { PrintMapDialog } from '../features/gis/PrintMapDialog';
import { useAuth } from '../features/auth';

type CatalogLayer = {
  id: string;
  title: string;
  group: string;
  status: 'present' | 'planned';
  kind: 'vector' | 'raster';
  url?: string | null;
  file?: string;
  crs?: string;
  source?: string;
  observation?: string;
  featureCount?: number;
  geometryTypes?: Record<string, number>;
  sizeBytes?: number;
  width?: number;
  height?: number;
  statistics?: { min?: number; max?: number; p2?: number; p98?: number };
  styleDefault?: { palette?: string; colorInterpolation?: string; classificationMethod?: string; classCount?: number; resamplingMethod?: string; resamplingKernel?: string };
  noData?: number;
  visibleByDefault?: boolean;
};

type CatalogDocument = { version: string; layers: CatalogLayer[] };
type MainTab = 'map' | 'dashboards';
type SideTab = 'layers' | 'legend' | 'tools';
type LayerKindFilter = 'all' | 'basemap' | 'vector' | 'raster';
type MapTool = 'identify' | 'measure-length' | 'measure-area';
type BaseMapChoice = { id: MapBaseMap; title: string; attribution: string; thumbnailUrl: string };
type AttributeFeature = { type?: string; properties?: Record<string, unknown>; geometry?: unknown };
type LayerView = 'properties' | 'table' | 'style' | null;
type NumericRange = { min: number; max: number };
type VectorFilter = { field: string; operator: 'equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean };
type UserLayerPreferences = {
  opacity: Record<string, number>;
  vectorColor: Record<string, string>;
  vectorFilters: Record<string, VectorFilter>;
  rasterRanges: Record<string, NumericRange>;
  rasterPalette: Record<string, string>;
};
const emptyLayerPreferences: UserLayerPreferences = { opacity: {}, vectorColor: {}, vectorFilters: {}, rasterRanges: {}, rasterPalette: {} };

function readLayerPreferences(uid?: string): UserLayerPreferences {
  if (!uid) return emptyLayerPreferences;
  try {
    const value = JSON.parse(localStorage.getItem(`sigparamirim:webgis:layer-preferences:${uid}`) || 'null') as Partial<UserLayerPreferences> | null;
    if (!value || typeof value !== 'object') return emptyLayerPreferences;
    return {
      opacity: value.opacity && typeof value.opacity === 'object' ? value.opacity : {},
      vectorColor: value.vectorColor && typeof value.vectorColor === 'object' ? value.vectorColor : {},
      vectorFilters: value.vectorFilters && typeof value.vectorFilters === 'object' ? value.vectorFilters : {},
      rasterRanges: value.rasterRanges && typeof value.rasterRanges === 'object' ? value.rasterRanges : {},
      rasterPalette: value.rasterPalette && typeof value.rasterPalette === 'object' ? value.rasterPalette : {},
    };
  } catch {
    return emptyLayerPreferences;
  }
}

// Static tiles at the basin's approximate center (z=7, x=48, y=68) double as
// honest previews of the same public, keyless XYZ services used by OpenLayers.
const baseMaps: BaseMapChoice[] = [
  { id: 'osm', title: 'OpenStreetMap', attribution: '© OpenStreetMap contributors', thumbnailUrl: 'https://tile.openstreetmap.org/7/48/68.png' },
  { id: 'osm-hot' as MapBaseMap, title: 'Humanitário (HOT)', attribution: '© OpenStreetMap contributors · HOT', thumbnailUrl: 'https://a.tile.openstreetmap.fr/hot/7/48/68.png' },
  { id: 'opentopomap' as MapBaseMap, title: 'OpenTopoMap', attribution: '© OpenStreetMap · SRTM · OpenTopoMap', thumbnailUrl: 'https://a.tile.opentopomap.org/7/48/68.png' },
  { id: 'cyclosm' as MapBaseMap, title: 'CyclOSM', attribution: '© OpenStreetMap contributors · CyclOSM', thumbnailUrl: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/7/48/68.png' },
  { id: 'osm-de' as MapBaseMap, title: 'OpenStreetMap DE', attribution: '© OpenStreetMap contributors · openstreetmap.de', thumbnailUrl: 'https://tile.openstreetmap.de/7/48/68.png' },
];

const defaultPowerBiUrl = 'https://app.powerbi.com/view?r=eyJrIjoiZDI4MDI2YWEtMjUyYS00Y2ViLWIxNWQtZDYyOWYzYzBhYTY3IiwidCI6ImRmNzFmNmJiLWUzY2MtNGY1Yi1iNTMyLTc5ZGUyNjFiNTFhMiJ9';

function groupLayers(layers: CatalogLayer[]) {
  const groups = new Map<string, CatalogLayer[]>();
  for (const layer of layers) {
    const group = layer.group?.trim() || 'Sem grupo definido no catálogo';
    groups.set(group, [...(groups.get(group) ?? []), layer]);
  }
  return [...groups.entries()];
}

const initialLayers: CatalogLayer[] = [
  { id: 'bacia-hidrografica-paramirim', title: 'Bacia Hidrográfica do Rio Paramirim', group: 'Bacia hidrográfica', status: 'present', kind: 'vector', crs: 'EPSG:4674', url: '/geospatial/layers/bacia_hidrografica/bacia_hidrografica_paramirim.geojson', visibleByDefault: true },
  { id: 'hidrografia', title: 'Hidrografia', group: 'Bacia hidrográfica', status: 'present', kind: 'vector', crs: 'EPSG:4674', url: '/geospatial/layers/bacia_hidrografica/hidrografia.geojson', visibleByDefault: true },
];

function formatBytes(bytes = 0) {
  if (!bytes) return '';
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function layerMetadata(layer: CatalogLayer) {
  if (layer.status === 'planned') return 'Planejada';
  if (layer.kind === 'raster') return `${layer.width?.toLocaleString('pt-BR') ?? '—'} × ${layer.height?.toLocaleString('pt-BR') ?? '—'} px${layer.sizeBytes ? ` · ${formatBytes(layer.sizeBytes)}` : ''}`;
  const geometry = layer.geometryTypes ? Object.keys(layer.geometryTypes).join(', ') : 'Vetorial';
  return `${layer.featureCount?.toLocaleString('pt-BR') ?? '—'} feições · ${geometry}${layer.sizeBytes ? ` · ${formatBytes(layer.sizeBytes)}` : ''}`;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function MapPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<CatalogLayer[]>(initialLayers);
  const [version, setVersion] = useState('');
  const [tab, setTab] = useState<MainTab>('map');
  const [sideTab, setSideTab] = useState<SideTab>('layers');
  const [baseMap, setBaseMap] = useState<MapBaseMap>('osm');
  const [activeBase, setActiveBase] = useState('osm');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialLayers.map((layer) => layer.id));
  const [filter, setFilter] = useState<LayerKindFilter>('all');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<MapFeatureSelection | null>(null);
  const [opacity, setOpacity] = useState<Record<string, number>>(() => readLayerPreferences(user?.uid).opacity);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'Mapas base': true, 'Camadas vetoriais': true, 'Camadas raster': true });
  const [expandedVectorGroups, setExpandedVectorGroups] = useState<Record<string, boolean>>({});
  const [layerView, setLayerView] = useState<{ id: string; view: LayerView } | null>(null);
  const [attributeCache, setAttributeCache] = useState<Record<string, AttributeFeature[]>>({});
  const [attributeLoading, setAttributeLoading] = useState<string | null>(null);
  const [attributeError, setAttributeError] = useState<string | null>(null);
  const [attributeField, setAttributeField] = useState<Record<string, string>>({});
  const [attributeQuery, setAttributeQuery] = useState<Record<string, string>>({});
  const [vectorColor, setVectorColor] = useState<Record<string, string>>(() => readLayerPreferences(user?.uid).vectorColor);
  const [vectorFilters, setVectorFilters] = useState<Record<string, VectorFilter>>(() => readLayerPreferences(user?.uid).vectorFilters);
  const [identifyEnabled, setIdentifyEnabled] = useState<Record<string, boolean>>({});
  const [rasterRanges, setRasterRanges] = useState<Record<string, NumericRange>>(() => readLayerPreferences(user?.uid).rasterRanges);
  const [rasterPalette, setRasterPalette] = useState<Record<string, string>>(() => readLayerPreferences(user?.uid).rasterPalette);
  const [preferencesLoadedFor, setPreferencesLoadedFor] = useState<string | null>(user?.uid ?? null);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [tool, setTool] = useState<MapTool>('identify');
  const [measure, setMeasure] = useState<{ value: number; unit: 'm' | 'km' | 'm²' | 'km²' } | null>(null);
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementHistoryEntry[]>([]);
  const [clearMeasurementsToken, setClearMeasurementsToken] = useState(0);
  const [homeToken, setHomeToken] = useState(0);
  const powerBiUrl = import.meta.env.VITE_POWERBI_DASHBOARD_URL?.trim() || defaultPowerBiUrl;

  useEffect(() => {
    if (!user?.uid) {
      setPreferencesLoadedFor(null);
      setOpacity({}); setVectorColor({}); setVectorFilters({}); setRasterRanges({}); setRasterPalette({});
      return;
    }
    const preferences = readLayerPreferences(user.uid);
    setPreferencesLoadedFor(null);
    setOpacity(preferences.opacity); setVectorColor(preferences.vectorColor); setVectorFilters(preferences.vectorFilters); setRasterRanges(preferences.rasterRanges); setRasterPalette(preferences.rasterPalette);
    setPreferencesLoadedFor(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || preferencesLoadedFor !== user.uid) return;
    const preferences: UserLayerPreferences = { opacity, vectorColor, vectorFilters, rasterRanges, rasterPalette };
    try { localStorage.setItem(`sigparamirim:webgis:layer-preferences:${user.uid}`, JSON.stringify(preferences)); } catch { /* browser storage may be unavailable */ }
  }, [user?.uid, preferencesLoadedFor, opacity, vectorColor, vectorFilters, rasterRanges, rasterPalette]);

  useEffect(() => {
    let cancelled = false;
    fetch('/geospatial/catalog.json', { headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() as Promise<CatalogDocument> : Promise.reject(new Error('catalog')))
      .then((document) => {
        if (cancelled || !Array.isArray(document.layers)) return;
        setCatalog(document.layers);
        setVersion(document.version);
        const defaults = document.layers.filter((layer) => layer.status === 'present' && layer.visibleByDefault).map((layer) => layer.id);
        if (defaults.length) setSelectedIds(defaults);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const featureLayers = useMemo(() => catalog.filter((layer) => layer.status === 'present'), [catalog]);
  const selectedLayers = useMemo<Array<MapLayerDefinition & { crs?: string }>>(() => featureLayers
    .filter((layer) => selectedIds.includes(layer.id) && layer.url)
    .map((layer) => ({ id: layer.id, title: layer.title, url: layer.url as string, kind: layer.kind, group: layer.group, crs: layer.crs, statistics: layer.statistics, palette: rasterPalette[layer.id] ?? layer.styleDefault?.palette, styleDefault: { ...layer.styleDefault, palette: rasterPalette[layer.id] ?? layer.styleDefault?.palette }, noData: layer.noData ?? 0, opacity: opacity[layer.id] ?? (layer.kind === 'raster' ? 0.82 : 1), range: layer.kind === 'raster' ? (rasterRanges[layer.id] ?? { min: layer.statistics?.p2 ?? layer.statistics?.min ?? 0, max: layer.statistics?.p98 ?? layer.statistics?.max ?? 1 }) : undefined, vectorStyle: layer.kind === 'vector' ? { stroke: vectorColor[layer.id], fill: vectorColor[layer.id] ? `${vectorColor[layer.id]}33` : undefined } : undefined, featureFilter: vectorFilters[layer.id], identifyEnabled: identifyEnabled[layer.id] ?? layer.kind === 'vector' })), [featureLayers, identifyEnabled, opacity, rasterPalette, rasterRanges, selectedIds, vectorColor, vectorFilters]);
  const filteredCatalog = useMemo(() => catalog.filter((layer) => {
    if (layer.status !== 'present' || !layer.url) return false;
    const matchesSearch = `${layer.title} ${layer.group}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
    const matchesKind = filter === 'all' || (filter === 'basemap' ? false : layer.kind === filter);
    return matchesSearch && matchesKind;
  }), [catalog, filter, search]);
  const groupedVectors = useMemo(() => groupLayers(filteredCatalog.filter((layer) => layer.kind === 'vector')), [filteredCatalog]);
  const filteredRasters = useMemo(() => filteredCatalog.filter((layer) => layer.kind === 'raster'), [filteredCatalog]);
  const handleFeatureSelect = useCallback((next: MapFeatureSelection | null) => setSelection(next), []);

  const toggleGroup = (group: string) => setExpandedGroups((current) => ({ ...current, [group]: !(current[group] ?? true) }));
  const toggleVectorGroup = (group: string) => setExpandedVectorGroups((current) => ({ ...current, [group]: !(current[group] ?? true) }));
  const openAttributes = async (layer: CatalogLayer, view: Exclude<LayerView, null>) => {
    setLayerView({ id: layer.id, view });
    setAttributeError(null);
    if (view === 'properties' || layer.kind === 'raster') return;
    if (attributeCache[layer.id] || !layer.url) return;
    setAttributeLoading(layer.id);
    try {
      const response = await fetch(layer.url, { headers: { Accept: 'application/geo+json, application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const document = await response.json() as { features?: AttributeFeature[] };
      setAttributeCache((current) => ({ ...current, [layer.id]: Array.isArray(document.features) ? document.features : [] }));
    } catch (error) {
      setAttributeError(error instanceof Error ? error.message : 'Não foi possível carregar os atributos.');
    } finally {
      setAttributeLoading(null);
    }
  };

  const toggleLayer = (layer: CatalogLayer) => {
    if (layer.status !== 'present' || !layer.url) return;
    setSelectedIds((current) => current.includes(layer.id) ? current.filter((id) => id !== layer.id) : [...current, layer.id]);
  };

  return (
    <section className="webgis-workspace" aria-label="WebGIS Paramirim">
      <div className="webgis-topbar">
        <nav className="webgis-main-tabs" role="tablist" aria-label="Visualização WebGIS">
          <button role="tab" aria-selected={tab === 'map'} className={tab === 'map' ? 'is-active' : ''} onClick={() => setTab('map')}><i className="fa-solid fa-map" aria-hidden="true" /> Mapa</button>
          <button role="tab" aria-selected={tab === 'dashboards'} className={tab === 'dashboards' ? 'is-active' : ''} onClick={() => setTab('dashboards')}><i className="fa-solid fa-chart-column" aria-hidden="true" /> Dashboards</button>
        </nav>
        <div className="webgis-topbar-meta"><span><i className="fa-solid fa-layer-group" aria-hidden="true" /> {selectedIds.length} camadas ativas</span>{version && <span className="webgis-version">Dados {version}</span>}</div>
      </div>

      {tab === 'map' ? <div className="webgis-map-layout">
        <main className="webgis-map-area" aria-label="Mapa da Bacia do Rio Paramirim">
          <MapCanvas layers={selectedLayers} baseMap={baseMap} tool={tool} homeToken={homeToken} onMeasure={setMeasure} onFeatureSelect={handleFeatureSelect} onRasterRangeChange={(id, range) => setRasterRanges((current) => ({ ...current, [id]: range }))} onLayerFeatures={(id, rows) => setAttributeCache((current) => current[id] ? current : ({ ...current, [id]: rows.map((properties) => ({ properties })) }))} onMeasurementHistoryChange={setMeasurementHistory} clearMeasurementsToken={clearMeasurementsToken} />
          {selection && <section className="webgis-identify-card" aria-label="Feição identificada"><header><div><small>Identificar feição</small><strong>{selection.layerTitle}</strong></div><button type="button" aria-label="Fechar identificação" onClick={() => setSelection(null)}><i className="fa-solid fa-xmark" /></button></header><dl>{Object.entries(selection.properties).slice(0, 14).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></section>}
          <div className="webgis-scale-note">SIG Paramirim <span>·</span> EPSG:3857 <span>·</span> {selectedLayers.length} camada(s)</div>
        </main>

        <aside className={`webgis-tools-panel ${toolsOpen ? '' : 'is-collapsed'}`} aria-label="Ferramentas e catálogo de camadas">
          {!toolsOpen && <button type="button" className="webgis-panel-expand" onClick={() => setToolsOpen(true)} aria-label="Expandir painel do WebGIS"><i className="fa-solid fa-chevron-left" /></button>}
          <nav className="webgis-side-tabs" role="tablist" aria-label="Painel do mapa">
            <button role="tab" aria-selected={sideTab === 'layers'} className={sideTab === 'layers' ? 'is-active' : ''} onClick={() => { setSideTab('layers'); setToolsOpen(true); }} title="Camadas"><i className="fa-solid fa-layer-group" /><span>Camadas</span></button>
            <button role="tab" aria-selected={sideTab === 'legend'} className={sideTab === 'legend' ? 'is-active' : ''} onClick={() => { setSideTab('legend'); setToolsOpen(true); }} title="Legenda"><i className="fa-solid fa-list" /><span>Legenda</span></button>
            <button role="tab" aria-selected={sideTab === 'tools'} className={sideTab === 'tools' ? 'is-active' : ''} onClick={() => { setSideTab('tools'); setToolsOpen(true); }} title="Ferramentas"><i className="fa-solid fa-screwdriver-wrench" /><span>Ferramentas</span></button>
          </nav>

          {sideTab === 'layers' && <div className={`webgis-side-content ${layerView ? 'is-details-open' : ''}`}>
            <div className="webgis-panel-title"><div><small>Conteúdo do mapa</small><h2>Catálogo de camadas</h2></div><button type="button" onClick={() => setToolsOpen(false)} title="Recolher painel" aria-label="Recolher painel"><i className="fa-solid fa-chevron-right" /></button></div>
            <label className="webgis-search"><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar camada" /></label>
            <div className="webgis-layer-kind-tabs" role="group" aria-label="Filtrar tipo de camada">
              {(['all', 'basemap', 'vector', 'raster'] as const).map((kind) => <button key={kind} type="button" className={filter === kind ? 'is-active' : ''} onClick={() => setFilter(kind)}>{kind === 'all' ? 'Todas' : kind === 'basemap' ? 'Base' : kind === 'vector' ? 'Vetoriais' : 'Rasters'}</button>)}
            </div>

            {(filter === 'all' || filter === 'basemap') && <CatalogGroup title="Mapas base" icon="fa-map" count={baseMaps.length} expanded={expandedGroups['Mapas base'] ?? true} onToggle={() => toggleGroup('Mapas base')}><div className="webgis-basemap-list">{baseMaps.map((base) => <button type="button" className={`webgis-basemap-row ${activeBase === base.id ? 'is-active' : ''}`} key={base.id} onClick={() => { setBaseMap(base.id); setActiveBase(base.id); }}><img className="webgis-basemap-thumb" src={base.thumbnailUrl} alt={`Miniatura do mapa ${base.title}`} loading="lazy" /><span><strong>{base.title}</strong><small>{base.attribution}</small></span><i className={`fa-solid ${activeBase === base.id ? 'fa-circle-check' : 'fa-circle'}`} /></button>)}</div></CatalogGroup>}

            {(filter === 'all' || filter === 'vector') && <CatalogGroup title="Camadas vetoriais" icon="fa-draw-polygon" count={featureLayers.filter((layer) => layer.kind === 'vector').length} expanded={expandedGroups['Camadas vetoriais'] ?? true} onToggle={() => toggleGroup('Camadas vetoriais')}>{groupedVectors.map(([group, layers]) => <div className="webgis-layer-subgroup" key={group}><button type="button" className="webgis-layer-subgroup-title" aria-expanded={expandedVectorGroups[group] ?? true} onClick={() => toggleVectorGroup(group)}><i className={`fa-solid ${(expandedVectorGroups[group] ?? true) ? 'fa-chevron-down' : 'fa-chevron-right'}`} /><span>{group}</span><small>{layers.length}</small></button>{(expandedVectorGroups[group] ?? true) && layers.map((layer) => <LayerRow key={layer.id} layer={layer} active={selectedIds.includes(layer.id)} onToggle={() => toggleLayer(layer)} onOpen={(view) => void openAttributes(layer, view)} onToggleIdentify={() => setIdentifyEnabled((current) => ({ ...current, [layer.id]: !(current[layer.id] ?? true) }))} identifyActive={identifyEnabled[layer.id] ?? true} />)}</div>)}</CatalogGroup>}
            {(filter === 'all' || filter === 'raster') && <CatalogGroup title="Camadas raster" icon="fa-image" count={featureLayers.filter((layer) => layer.kind === 'raster').length} expanded={expandedGroups['Camadas raster'] ?? true} onToggle={() => toggleGroup('Camadas raster')}>{filteredRasters.map((layer) => <LayerRow key={layer.id} layer={rasterPalette[layer.id] ? { ...layer, styleDefault: { ...layer.styleDefault, palette: rasterPalette[layer.id] } } : layer} active={selectedIds.includes(layer.id)} onToggle={() => toggleLayer(layer)} onOpen={(view) => void openAttributes(layer, view)} onToggleIdentify={() => setIdentifyEnabled((current) => ({ ...current, [layer.id]: !(current[layer.id] ?? false) }))} identifyActive={identifyEnabled[layer.id] ?? false} />)}</CatalogGroup>}
            {filter === 'basemap' && <p className="webgis-panel-hint">Selecione um mapa base. As miniaturas mostram o tipo de referência cartográfica.</p>}
            {layerView && (() => {
              const layer = catalog.find((item) => item.id === layerView.id);
              if (!layer) return null;
              const features = attributeCache[layer.id] ?? [];
              const fields = [...new Set(features.flatMap((feature) => Object.keys(feature.properties ?? {})))];
              const field = attributeField[layer.id] || fields[0] || '';
              const query = (attributeQuery[layer.id] ?? '').trim().toLocaleLowerCase('pt-BR');
              const rows = features.filter((feature) => !query || displayValue(feature.properties?.[field]).toLocaleLowerCase('pt-BR').includes(query)).slice(0, 100);
              return <div className="webgis-layer-detail" role="dialog" aria-modal="true" aria-label={`Detalhes de ${layer.title}`}><header><div><small>{layer.group}</small><h3>{layer.title}</h3></div><button type="button" aria-label="Fechar detalhes" onClick={() => setLayerView(null)}><i className="fa-solid fa-xmark" /></button></header>
                <nav aria-label="Detalhes da camada">{(layer.kind === 'vector' ? ['properties', 'table', 'style'] as const : ['properties', 'style'] as const).map((view) => <button type="button" className={layerView.view === view ? 'is-active' : ''} key={view} onClick={() => setLayerView({ id: layer.id, view })}>{view === 'properties' ? 'Fonte e dados' : view === 'table' ? 'Atributos' : 'Estilo'}</button>)}</nav>
                {layerView.view === 'properties' && <dl className="webgis-layer-metadata"><div><dt>Fonte</dt><dd>{layer.source || 'Não informada no catálogo'}</dd></div><div><dt>Sistema de referência</dt><dd>{layer.crs || 'Não informado'}</dd></div><div><dt>Feições / resolução</dt><dd>{layerMetadata(layer)}</dd></div><div><dt>Observação</dt><dd>{layer.observation || 'Sem observação registrada.'}</dd></div></dl>}
                {layerView.view === 'style' && <div className="webgis-layer-style"><label>Transparência <input type="range" min="0.1" max="1" step="0.05" value={opacity[layer.id] ?? (layer.kind === 'raster' ? .82 : 1)} onChange={(event) => setOpacity((current) => ({ ...current, [layer.id]: Number(event.target.value) }))} /></label>{layer.kind === 'vector' ? <><label>Cor de linha e pontos <input type="color" value={vectorColor[layer.id] ?? '#68710a'} onChange={(event) => setVectorColor((current) => ({ ...current, [layer.id]: event.target.value }))} /></label><h4>Filtro de feições no mapa</h4>{fields.length ? <><label>Campo<select value={vectorFilters[layer.id]?.field ?? ''} onChange={(event) => setVectorFilters((current) => ({ ...current, [layer.id]: { field: event.target.value, operator: current[layer.id]?.operator ?? 'contains', value: current[layer.id]?.value ?? '' } }))}><option value="">Sem filtro</option>{fields.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{vectorFilters[layer.id]?.field && <div className="webgis-filter-inputs"><label>Operador<select value={vectorFilters[layer.id]?.operator ?? 'contains'} onChange={(event) => setVectorFilters((current) => ({ ...current, [layer.id]: { ...current[layer.id]!, operator: event.target.value as VectorFilter['operator'] } }))}><option value="contains">Contém</option><option value="equals">Igual a</option><option value="gt">Maior que</option><option value="gte">Maior ou igual</option><option value="lt">Menor que</option><option value="lte">Menor ou igual</option></select></label><label>Valor<input value={String(vectorFilters[layer.id]?.value ?? '')} onChange={(event) => setVectorFilters((current) => ({ ...current, [layer.id]: { ...current[layer.id]!, value: event.target.value } }))} /></label><button type="button" onClick={() => setVectorFilters((current) => { const next = { ...current }; delete next[layer.id]; return next; })}>Limpar filtro</button></div>}</> : <p>Abra a tabela de atributos para carregar os campos disponíveis.</p>}</> : <><label>Paleta de cores<select value={rasterPalette[layer.id] ?? layer.styleDefault?.palette ?? 'blue-sequential'} onChange={(event) => setRasterPalette((current) => ({ ...current, [layer.id]: event.target.value }))}>{rasterPaletteOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p>O intervalo min–máx é ajustado na aba Legenda. A paleta e a transparência são preferências da sua conta.</p></>}</div>}
                {layerView.view === 'table' && <div className="webgis-attribute-panel">{attributeLoading === layer.id ? <p>Carregando tabela de atributos…</p> : attributeError ? <p role="alert">Erro ao carregar: {attributeError}</p> : features.length === 0 ? <p>Esta camada não contém feições tabulares ou o GeoJSON não possui propriedades.</p> : <><label>Propriedade<select value={field} onChange={(event) => setAttributeField((current) => ({ ...current, [layer.id]: event.target.value }))}>{fields.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Filtrar valor<input value={attributeQuery[layer.id] ?? ''} onChange={(event) => setAttributeQuery((current) => ({ ...current, [layer.id]: event.target.value }))} placeholder={`Buscar em ${field}`} /></label><small>{rows.length} de {features.length.toLocaleString('pt-BR')} feições (máximo 100 linhas exibidas)</small><div className="webgis-attribute-table-wrap"><table><thead><tr>{fields.slice(0, 5).map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{rows.map((feature, index) => <tr key={index}>{fields.slice(0, 5).map((item) => <td key={item}>{displayValue(feature.properties?.[item])}</td>)}</tr>)}</tbody></table></div></>}</div>}
              </div>;
            })()}
          </div>}

          {sideTab === 'legend' && <div className="webgis-side-content">
            <div className="webgis-panel-title"><div><small>Simbologia ativa</small><h2>Legenda</h2></div><button type="button" onClick={() => setToolsOpen(false)} title="Recolher painel" aria-label="Recolher painel"><i className="fa-solid fa-chevron-right" /></button></div>
            {selectedLayers.length === 0 ? <p className="webgis-panel-hint">Ative uma camada no catálogo para ver sua legenda.</p> : selectedLayers.map((layer) => {
              const range = rasterRanges[layer.id] ?? { min: layer.statistics?.p2 ?? layer.statistics?.min ?? 0, max: layer.statistics?.p98 ?? layer.statistics?.max ?? 1 };
              const domainMin = layer.statistics?.min ?? 0;
              const domainMax = layer.statistics?.max ?? 1;
              const rangeStep = (domainMax - domainMin) / 500 || 0.01;
              const minPercent = Math.max(0, Math.min(100, ((range.min - domainMin) / (domainMax - domainMin || 1)) * 100));
              const maxPercent = Math.max(minPercent, Math.min(100, ((range.max - domainMin) / (domainMax - domainMin || 1)) * 100));
              return <div className={`webgis-legend-row ${layer.kind}`} key={layer.id}><span className={`webgis-legend-symbol ${layer.kind} layer-${layer.id}`} style={layer.kind === 'raster' ? { background: getRasterGradient(layer) } : undefined} /><div>
                <strong>{layer.title}</strong>
                {layer.kind === 'raster' ? <div className="webgis-raster-legend" aria-label={`Legenda de ${layer.title}, mínimo ${range.min} e máximo ${range.max}`}><small>{range.min.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</small><span style={{ background: getRasterGradient(layer) }} /><small>{range.max.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</small></div> : <small>{layer.group}</small>}
                {layer.kind === 'raster' && <div className="webgis-raster-range">
                  <div className="webgis-range-values"><label>Mín.<input aria-label={`Mínimo exibido de ${layer.title}`} type="number" min={domainMin} max={range.max - rangeStep} step="any" value={range.min} onChange={(event) => { const value = Math.min(range.max - rangeStep, Math.max(domainMin, Number(event.target.value))); setRasterRanges((current) => ({ ...current, [layer.id]: { min: value, max: range.max } })); }} /></label><label>Máx.<input aria-label={`Máximo exibido de ${layer.title}`} type="number" min={range.min + rangeStep} max={domainMax} step="any" value={range.max} onChange={(event) => { const value = Math.max(range.min + rangeStep, Math.min(domainMax, Number(event.target.value))); setRasterRanges((current) => ({ ...current, [layer.id]: { min: range.min, max: value } })); }} /></label></div>
                  <div className="webgis-dual-range" style={{ '--range-start': `${minPercent}%`, '--range-end': `${maxPercent}%` } as React.CSSProperties}>
                    <input aria-label={`Ajustar mínimo de ${layer.title}`} type="range" min={domainMin} max={domainMax} step={rangeStep} value={range.min} onChange={(event) => { const value = Math.min(range.max - rangeStep, Number(event.target.value)); setRasterRanges((current) => ({ ...current, [layer.id]: { min: value, max: range.max } })); }} />
                    <input aria-label={`Ajustar máximo de ${layer.title}`} type="range" min={domainMin} max={domainMax} step={rangeStep} value={range.max} onChange={(event) => { const value = Math.max(range.min + rangeStep, Number(event.target.value)); setRasterRanges((current) => ({ ...current, [layer.id]: { min: range.min, max: value } })); }} />
                  </div>
                  <small>Domínio da amostra: {domainMin.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} – {domainMax.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</small>
                </div>}
              </div></div>;
            })}
          </div>}

          {sideTab === 'tools' && <div className="webgis-side-content"><div className="webgis-panel-title"><div><small>Navegação e consulta</small><h2>Ferramentas</h2></div><button type="button" onClick={() => setToolsOpen(false)} title="Recolher painel" aria-label="Recolher painel"><i className="fa-solid fa-chevron-right" /></button></div><div className="webgis-tool-grid"><button type="button" className={tool === 'identify' ? 'is-active' : ''} onClick={() => { setTool('identify'); setSelection(null); }}><i className="fa-solid fa-arrow-pointer" /><span>Identificar</span></button><button type="button" className={tool === 'measure-length' ? 'is-active' : ''} onClick={() => { setTool('measure-length'); setMeasure(null); }}><i className="fa-solid fa-ruler" /><span>Medir distância</span></button><button type="button" className={tool === 'measure-area' ? 'is-active' : ''} onClick={() => { setTool('measure-area'); setMeasure(null); }}><i className="fa-solid fa-draw-polygon" /><span>Medir área</span></button><PrintMapDialog layers={selectedLayers} /><button type="button" onClick={() => setSelectedIds([])}><i className="fa-solid fa-eye-slash" /><span>Limpar camadas</span></button><button type="button" onClick={() => { setSelectedIds(catalog.filter((layer) => layer.status === 'present' && layer.visibleByDefault).map((layer) => layer.id)); setBaseMap('osm'); setActiveBase('osm'); setHomeToken((current) => current + 1); }}><i className="fa-solid fa-house" /><span>Vista inicial</span></button></div>{tool !== 'identify' && <div className="webgis-measure-status"><span>{tool === 'measure-length' ? 'Distância' : 'Área'}</span>{measure ? <strong>{measure.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {measure.unit}</strong> : <small>Desenhe no mapa; dê duplo clique para concluir.</small>}<small>As medições ficam no mapa e no histórico desta sessão.</small></div>}{measurementHistory.length > 0 && <section className="webgis-measure-history"><header><h3>Histórico de medições</h3><button type="button" onClick={() => setClearMeasurementsToken((value) => value + 1)}><i className="fa-solid fa-trash-can" /> Limpar</button></header><ol>{measurementHistory.map((entry, index) => <li key={entry.id}><details><summary><span>{index + 1}. {entry.kind === 'measure-area' ? 'Área' : 'Distância'}</span><strong>{entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {entry.unit}</strong></summary><ol>{entry.vertices.map(([longitude, latitude], vertexIndex) => <li key={`${entry.id}-${vertexIndex}`}>V{vertexIndex + 1}: {longitude.toFixed(6)}, {latitude.toFixed(6)}</li>)}</ol></details></li>)}</ol></section>}</div>}
        </aside>
      </div> : <DashboardPanel url={powerBiUrl} />}
    </section>
  );
}

function CatalogGroup({ title, icon, count, expanded, onToggle, children }: { title: string; icon: string; count: number; expanded: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className={`webgis-layer-group ${expanded ? 'is-expanded' : 'is-collapsed'}`}><button type="button" className="webgis-layer-group-heading" aria-expanded={expanded} onClick={onToggle}><strong><i className={`fa-solid ${icon}`} />{title}</strong><span>{count}</span><i className={`fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} webgis-group-chevron`} /></button>{expanded && <div className="webgis-layer-group-content">{children}</div>}</section>;
}

function LayerRow({ layer, active, onToggle, onOpen, onToggleIdentify, identifyActive = true }: { layer: CatalogLayer; active: boolean; onToggle: () => void; onOpen?: (view: Exclude<LayerView, null>) => void; onToggleIdentify?: () => void; identifyActive?: boolean }) {
  const available = layer.status === 'present' && Boolean(layer.url);
  return <div className={`webgis-layer-row ${active ? 'is-active' : ''} ${available ? '' : 'is-planned'}`}><button type="button" className="webgis-layer-check" aria-label={`${active ? 'Ocultar' : 'Mostrar'} ${layer.title}`} aria-pressed={active} disabled={!available} onClick={onToggle}><i className={`fa-solid ${active ? 'fa-eye' : 'fa-eye-slash'}`} /></button><span className={`webgis-layer-swatch ${layer.kind} layer-${layer.id}`} style={layer.kind === 'raster' ? { background: getRasterGradient(layer) } : undefined} /><div className="webgis-layer-row-copy"><strong title={layer.title}>{layer.title}</strong><small>{layerMetadata(layer)}</small></div>{available && onOpen && <div className="webgis-layer-actions">{onToggleIdentify && <button type="button" className={identifyActive ? 'is-active' : ''} title={identifyActive ? 'Desativar consulta por clique no mapa' : layer.kind === 'raster' ? 'Ativar consulta de valores raster no mapa' : 'Ativar identificação no mapa'} aria-pressed={identifyActive} aria-label={`${layer.kind === 'raster' ? 'Consulta raster' : 'Identificação'} de ${layer.title}`} onClick={onToggleIdentify}><i className={`fa-solid ${layer.kind === 'raster' ? 'fa-crosshairs' : 'fa-arrow-pointer'}`} /></button>}<button type="button" title="Informações e fonte da camada" aria-label={`Informações de ${layer.title}`} onClick={() => onOpen('properties')}><i className="fa-solid fa-circle-info" /></button>{layer.kind === 'vector' && <button type="button" title="Tabela de atributos" aria-label={`Tabela de ${layer.title}`} onClick={() => onOpen('table')}><i className="fa-solid fa-table-list" /></button>}<button type="button" title="Propriedades e estilo" aria-label={`Estilo de ${layer.title}`} onClick={() => onOpen('style')}><i className="fa-solid fa-sliders" /></button></div>}</div>;
}

function DashboardPanel({ url }: { url?: string }) {
  if (!url) return <div className="webgis-dashboard-empty"><span><i className="fa-solid fa-chart-column" /></span><h2>Dashboard indisponível</h2><p>O painel não está configurado neste ambiente.</p></div>;
  return <DashboardFocusView url={url} />;
}

function DashboardFocusView({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);
  const dashboard = <iframe title="Dashboard Power BI do SIG Paramirim" src={url} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
  return <>
    <div className="webgis-dashboard-view">
      <header><div><small>Inteligência territorial</small><h2>Dashboards</h2></div><button type="button" onClick={() => setExpanded(true)}><i className="fa-solid fa-up-right-and-down-left-from-center" /> Ampliar visualização</button></header>
      {expanded ? <div className="webgis-dashboard-inline-state">Dashboard em modo de foco</div> : <div className="webgis-dashboard-content">{dashboard}</div>}
    </div>
    {expanded && createPortal(<div className="webgis-dashboard-portal"><div className="webgis-dashboard-focus-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <section className="webgis-dashboard-focus" role="dialog" aria-modal="true" aria-label="Dashboard ampliado">
        <header><strong>SIG Paramirim · Dashboard</strong><button type="button" aria-label="Fechar visualização ampliada" onClick={() => setExpanded(false)}><i className="fa-solid fa-xmark" /></button></header>
        <div className="webgis-dashboard-focus-frame">{dashboard}</div>
      </section>
    </div></div>, document.body)}
  </>;
}
