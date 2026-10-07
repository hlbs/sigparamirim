import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapCanvas, type MapBaseMap, type MapFeatureSelection, type MapLayerDefinition } from '../features/gis/MapCanvas';
import { PrintMapDialog } from '../features/gis/PrintMapDialog';

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

// Static tiles at the basin's approximate center (z=7, x=48, y=68) double as
// honest previews of the same public, keyless XYZ services used by OpenLayers.
const baseMaps: BaseMapChoice[] = [
  { id: 'osm', title: 'OpenStreetMap', attribution: '© OpenStreetMap contributors', thumbnailUrl: 'https://tile.openstreetmap.org/7/48/68.png' },
  { id: 'carto-light', title: 'Carto Claro', attribution: '© OpenStreetMap · © CARTO', thumbnailUrl: 'https://a.basemaps.cartocdn.com/light_all/7/48/68.png' },
  { id: 'carto-dark', title: 'Carto Escuro', attribution: '© OpenStreetMap · © CARTO', thumbnailUrl: 'https://a.basemaps.cartocdn.com/dark_all/7/48/68.png' },
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
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const [toolsOpen, setToolsOpen] = useState(true);
  const [tool, setTool] = useState<MapTool>('identify');
  const [measure, setMeasure] = useState<{ value: number; unit: 'm' | 'km' | 'm²' | 'km²' } | null>(null);
  const [homeToken, setHomeToken] = useState(0);
  const powerBiUrl = import.meta.env.VITE_POWERBI_DASHBOARD_URL?.trim() || defaultPowerBiUrl;

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
    .map((layer) => ({ id: layer.id, title: layer.title, url: layer.url as string, kind: layer.kind, group: layer.group, crs: layer.crs, statistics: layer.statistics, palette: layer.styleDefault?.palette, styleDefault: layer.styleDefault, noData: layer.noData ?? 0, opacity: opacity[layer.id] ?? (layer.kind === 'raster' ? 0.82 : 1) })), [featureLayers, opacity, selectedIds]);
  const filteredCatalog = useMemo(() => catalog.filter((layer) => {
    if (layer.status !== 'present' || !layer.url) return false;
    const matchesSearch = `${layer.title} ${layer.group}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
    const matchesKind = filter === 'all' || (filter === 'basemap' ? false : layer.kind === filter);
    return matchesSearch && matchesKind;
  }), [catalog, filter, search]);
  const groupedVectors = useMemo(() => groupLayers(filteredCatalog.filter((layer) => layer.kind === 'vector')), [filteredCatalog]);
  const filteredRasters = useMemo(() => filteredCatalog.filter((layer) => layer.kind === 'raster'), [filteredCatalog]);
  const handleFeatureSelect = useCallback((next: MapFeatureSelection | null) => setSelection(next), []);

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
          <MapCanvas layers={selectedLayers} baseMap={baseMap} tool={tool} homeToken={homeToken} onMeasure={setMeasure} onFeatureSelect={handleFeatureSelect} />
          {selection && <section className="webgis-identify-card" aria-label="Feição identificada"><header><div><small>Identificar feição</small><strong>{selection.layerTitle}</strong></div><button type="button" aria-label="Fechar identificação" onClick={() => setSelection(null)}><i className="fa-solid fa-xmark" /></button></header><dl>{Object.entries(selection.properties).slice(0, 14).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></section>}
          <div className="webgis-scale-note">SIG Paramirim <span>·</span> EPSG:3857 <span>·</span> {selectedLayers.length} camada(s)</div>
        </main>

        <aside className={`webgis-tools-panel ${toolsOpen ? '' : 'is-collapsed'}`} aria-label="Ferramentas e catálogo de camadas">
          {!toolsOpen && <button type="button" className="webgis-panel-expand" onClick={() => setToolsOpen(true)} aria-label="Expandir painel do WebGIS"><i className="fa-solid fa-chevron-left" /></button>}
          <nav className="webgis-side-tabs" role="tablist" aria-label="Painel do mapa">
            <button role="tab" aria-selected={sideTab === 'layers'} className={sideTab === 'layers' ? 'is-active' : ''} onClick={() => setSideTab('layers')} title="Camadas"><i className="fa-solid fa-layer-group" /><span>Camadas</span></button>
            <button role="tab" aria-selected={sideTab === 'legend'} className={sideTab === 'legend' ? 'is-active' : ''} onClick={() => setSideTab('legend')} title="Legenda"><i className="fa-solid fa-list" /><span>Legenda</span></button>
            <button role="tab" aria-selected={sideTab === 'tools'} className={sideTab === 'tools' ? 'is-active' : ''} onClick={() => setSideTab('tools')} title="Ferramentas"><i className="fa-solid fa-screwdriver-wrench" /><span>Ferramentas</span></button>
          </nav>

          {sideTab === 'layers' && <div className="webgis-side-content">
            <div className="webgis-panel-title"><div><small>Conteúdo do mapa</small><h2>Catálogo de camadas</h2></div><button type="button" onClick={() => setToolsOpen(false)} title="Recolher painel" aria-label="Recolher painel"><i className="fa-solid fa-chevron-right" /></button></div>
            <label className="webgis-search"><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar camada" /></label>
            <div className="webgis-layer-kind-tabs" role="group" aria-label="Filtrar tipo de camada">
              {(['all', 'basemap', 'vector', 'raster'] as const).map((kind) => <button key={kind} type="button" className={filter === kind ? 'is-active' : ''} onClick={() => setFilter(kind)}>{kind === 'all' ? 'Todas' : kind === 'basemap' ? 'Base' : kind === 'vector' ? 'Vetoriais' : 'Rasters'}</button>)}
            </div>

            {(filter === 'all' || filter === 'basemap') && <section className="webgis-layer-group"><header><strong><i className="fa-solid fa-map" /> Mapas base</strong><span>{baseMaps.length}</span></header><div className="webgis-basemap-list">{baseMaps.map((base) => <button type="button" className={`webgis-basemap-row ${activeBase === base.id ? 'is-active' : ''}`} key={base.id} onClick={() => { setBaseMap(base.id); setActiveBase(base.id); }}><img className="webgis-basemap-thumb" src={base.thumbnailUrl} alt={`Prévia real do mapa ${base.title}`} loading="lazy" /><span><strong>{base.title}</strong><small>{base.attribution}</small></span><i className={`fa-solid ${activeBase === base.id ? 'fa-circle-check' : 'fa-circle'}`} /></button>)}</div></section>}

            {(filter === 'all' || filter === 'vector') && <section className="webgis-layer-group"><header><strong><i className="fa-solid fa-draw-polygon" /> Camadas vetoriais</strong><span>{featureLayers.filter((layer) => layer.kind === 'vector').length}</span></header>{groupedVectors.map(([group, layers]) => <div className="webgis-layer-subgroup" key={group}><h3 className="webgis-layer-subgroup-title"><span>{group}</span><small>{layers.length}</small></h3>{layers.map((layer) => <LayerRow key={layer.id} layer={layer} active={selectedIds.includes(layer.id)} onToggle={() => toggleLayer(layer)} />)}</div>)}</section>}
            {(filter === 'all' || filter === 'raster') && <section className="webgis-layer-group"><header><strong><i className="fa-solid fa-image" /> Camadas raster</strong><span>{featureLayers.filter((layer) => layer.kind === 'raster').length}</span></header>{filteredRasters.map((layer) => <LayerRow key={layer.id} layer={layer} active={selectedIds.includes(layer.id)} onToggle={() => toggleLayer(layer)} />)}</section>}
            {filter === 'basemap' && <p className="webgis-panel-hint">Selecione um mapa base. As miniaturas mostram o tipo de referência cartográfica.</p>}
          </div>}

          {sideTab === 'legend' && <div className="webgis-side-content"><div className="webgis-panel-title"><div><small>Simbologia ativa</small><h2>Legenda</h2></div><button type="button" onClick={() => setToolsOpen(false)} title="Recolher painel" aria-label="Recolher painel"><i className="fa-solid fa-chevron-right" /></button></div>{selectedLayers.length === 0 ? <p className="webgis-panel-hint">Ative uma camada no catálogo para ver sua legenda.</p> : selectedLayers.map((layer) => <div className="webgis-legend-row" key={layer.id}><span className={`webgis-legend-symbol ${layer.kind} layer-${layer.id}`} /><div><strong>{layer.title}</strong><small>{layer.kind === 'raster' ? `Baixo: ${layer.statistics?.p2 ?? layer.statistics?.min ?? '—'} · Alto: ${layer.statistics?.p98 ?? layer.statistics?.max ?? '—'}` : layer.group}</small></div></div>)}</div>}

          {sideTab === 'tools' && <div className="webgis-side-content"><div className="webgis-panel-title"><div><small>Navegação e consulta</small><h2>Ferramentas</h2></div><button type="button" onClick={() => setToolsOpen(false)} title="Recolher painel" aria-label="Recolher painel"><i className="fa-solid fa-chevron-right" /></button></div><div className="webgis-tool-grid"><button type="button" className={tool === 'identify' ? 'is-active' : ''} onClick={() => { setTool('identify'); setSelection(null); }}><i className="fa-solid fa-arrow-pointer" /><span>Identificar</span></button><button type="button" className={tool === 'measure-length' ? 'is-active' : ''} onClick={() => { setTool('measure-length'); setMeasure(null); }}><i className="fa-solid fa-ruler" /><span>Medir distância</span></button><button type="button" className={tool === 'measure-area' ? 'is-active' : ''} onClick={() => { setTool('measure-area'); setMeasure(null); }}><i className="fa-solid fa-draw-polygon" /><span>Medir área</span></button><PrintMapDialog layers={selectedLayers} /><button type="button" onClick={() => setSelectedIds([])}><i className="fa-solid fa-eye-slash" /><span>Limpar camadas</span></button><button type="button" onClick={() => { setSelectedIds(catalog.filter((layer) => layer.status === 'present' && layer.visibleByDefault).map((layer) => layer.id)); setBaseMap('osm'); setActiveBase('osm'); setHomeToken((current) => current + 1); }}><i className="fa-solid fa-house" /><span>Vista inicial</span></button></div>{tool !== 'identify' && <div className="webgis-measure-status"><span>{tool === 'measure-length' ? 'Distância' : 'Área'}</span>{measure ? <strong>{measure.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {measure.unit}</strong> : <small>Desenhe no mapa; dê duplo clique para concluir.</small>}<button type="button" onClick={() => { setTool('identify'); setMeasure(null); }}><i className="fa-solid fa-trash-can" /> Limpar medição</button></div>}<div className="webgis-tool-section"><h3>Transparência</h3>{selectedLayers.map((layer) => <label className="webgis-opacity-row" key={layer.id}><span>{layer.title}</span><input type="range" min="0.1" max="1" step="0.05" value={opacity[layer.id] ?? (layer.kind === 'raster' ? .82 : 1)} onChange={(event) => setOpacity((current) => ({ ...current, [layer.id]: Number(event.target.value) }))} /></label>)}</div></div>}
        </aside>
      </div> : <DashboardPanel url={powerBiUrl} />}
    </section>
  );
}

function LayerRow({ layer, active, onToggle }: { layer: CatalogLayer; active: boolean; onToggle: () => void }) {
  const available = layer.status === 'present' && Boolean(layer.url);
  return <div className={`webgis-layer-row ${active ? 'is-active' : ''} ${available ? '' : 'is-planned'}`}><button type="button" className="webgis-layer-check" aria-label={`${active ? 'Ocultar' : 'Mostrar'} ${layer.title}`} aria-pressed={active} disabled={!available} onClick={onToggle}><i className={`fa-solid ${active ? 'fa-square-check' : 'fa-square'}`} /></button><span className={`webgis-layer-swatch ${layer.kind} layer-${layer.id}`} /><div className="webgis-layer-row-copy"><strong title={layer.title}>{layer.title}</strong><small>{layerMetadata(layer)}</small></div>{layer.kind === 'raster' && <i className="fa-solid fa-image webgis-layer-kind-icon" title="Raster" />}</div>;
}

function DashboardPanel({ url }: { url?: string }) {
  if (!url) return <div className="webgis-dashboard-empty"><span><i className="fa-solid fa-chart-column" /></span><h2>Dashboards territoriais</h2><p>O painel Power BI abrirá aqui quando a URL do dashboard for configurada para o ambiente.</p><button type="button" disabled>Dashboard não configurado</button></div>;
  return <div className="webgis-dashboard-view"><header><div><small>Inteligência territorial</small><h2>Dashboards</h2></div><a href={url} target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" /> Abrir em nova aba</a></header><iframe title="Dashboard Power BI do SIG Paramirim" src={url} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>;
}
