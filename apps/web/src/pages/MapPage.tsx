import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapCanvas, type MapBaseMap, type MapFeatureSelection, type MapLayerDefinition } from '../features/gis/MapCanvas';

type CatalogLayer = {
  id: string;
  title: string;
  group: string;
  status: 'present' | 'planned';
  kind: 'vector' | 'raster';
  url?: string | null;
  file?: string;
  source?: string;
  observation?: string;
  featureCount?: number;
  geometryTypes?: Record<string, number>;
  sizeBytes?: number;
  width?: number;
  height?: number;
  statistics?: { min?: number; max?: number; p2?: number; p98?: number };
  visibleByDefault?: boolean;
  fields?: Record<string, string[]>;
};

type CatalogDocument = { version: string; generatedAt: string; layers: CatalogLayer[] };
type LayerFilter = 'all' | 'present' | 'planned';

const fallbackLayers: CatalogLayer[] = [
  { id: 'bacia-hidrografica-paramirim', title: 'Bacia Hidrográfica do Rio Paramirim', group: 'Bacia hidrográfica', status: 'present', kind: 'vector', url: '/geospatial/layers/bacia_hidrografica/bacia_hidrografica_paramirim.geojson', visibleByDefault: true },
  { id: 'hidrografia', title: 'Hidrografia', group: 'Bacia hidrográfica', status: 'present', kind: 'vector', url: '/geospatial/layers/bacia_hidrografica/hidrografia.geojson', visibleByDefault: true },
];

const baseMaps: Array<{ id: MapBaseMap; title: string; description: string; thumb: string }> = [
  { id: 'osm', title: 'Ruas', description: 'OpenStreetMap', thumb: 'thumb-roads' },
  { id: 'carto-light', title: 'Claro', description: 'Carto Light', thumb: 'thumb-light' },
  { id: 'carto-dark', title: 'Escuro', description: 'Carto Dark', thumb: 'thumb-dark' },
  { id: 'esri-imagery', title: 'Imagem', description: 'Esri World Imagery', thumb: 'thumb-imagery' },
  { id: 'esri-topo', title: 'Topográfico', description: 'Esri World Topo', thumb: 'thumb-topo' },
];

function formatBytes(bytes = 0) {
  if (!bytes) return '';
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

function layerDetail(layer: CatalogLayer) {
  if (layer.status === 'planned') return 'Camada planejada; arquivo ainda não está disponível no acervo local.';
  if (layer.kind === 'raster') return `${layer.width ?? '—'} × ${layer.height ?? '—'} px${layer.sizeBytes ? ` · ${formatBytes(layer.sizeBytes)}` : ''}`;
  const geometries = layer.geometryTypes ? Object.entries(layer.geometryTypes).map(([name, count]) => `${count} ${name}`).join(' · ') : '';
  return `${layer.featureCount?.toLocaleString('pt-BR') ?? '—'} feições${geometries ? ` · ${geometries}` : ''}${layer.sizeBytes ? ` · ${formatBytes(layer.sizeBytes)}` : ''}`;
}

export function MapPage() {
  const [catalog, setCatalog] = useState<CatalogLayer[]>(fallbackLayers);
  const [catalogVersion, setCatalogVersion] = useState('local');
  const [filter, setFilter] = useState<LayerFilter>('all');
  const [baseMap, setBaseMap] = useState<MapBaseMap>('osm');
  const [selectedIds, setSelectedIds] = useState<string[]>(fallbackLayers.filter((layer) => layer.visibleByDefault).map((layer) => layer.id));
  const [selection, setSelection] = useState<MapFeatureSelection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/geospatial/catalog.json', { headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() as Promise<CatalogDocument> : Promise.reject(new Error('catálogo indisponível')))
      .then((document) => {
        if (cancelled || !Array.isArray(document.layers)) return;
        setCatalog(document.layers);
        setCatalogVersion(document.version);
        const defaults = document.layers.filter((layer) => layer.status === 'present' && layer.visibleByDefault).map((layer) => layer.id);
        if (defaults.length > 0) setSelectedIds(defaults);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const visibleLayers = useMemo(() => filter === 'all' ? catalog : catalog.filter((layer) => layer.status === filter), [catalog, filter]);
  const activeLayers = useMemo<MapLayerDefinition[]>(() => catalog
    .filter((layer) => layer.status === 'present' && selectedIds.includes(layer.id) && layer.url)
    .map((layer) => ({ id: layer.id, title: layer.title, url: layer.url as string, kind: layer.kind, group: layer.group, statistics: layer.statistics })), [catalog, selectedIds]);
  const presentCount = catalog.filter((layer) => layer.status === 'present').length;
  const plannedCount = catalog.filter((layer) => layer.status === 'planned').length;
  const powerBiUrl = import.meta.env.VITE_POWERBI_DASHBOARD_URL;
  const handleFeatureSelect = useCallback((next: MapFeatureSelection | null) => setSelection(next), []);

  const toggleLayer = (layer: CatalogLayer) => {
    if (layer.status !== 'present' || !layer.url) return;
    setSelectedIds((current) => current.includes(layer.id) ? current.filter((id) => id !== layer.id) : [...current, layer.id]);
  };

  return (
    <section className="catalog-page webgis-page" aria-labelledby="catalog-title">
      <header className="catalog-hero webgis-hero">
        <div>
          <span className="eyebrow">WebGIS · Bacia do Rio Paramirim</span>
          <h1 id="catalog-title">Explore o território em camadas.</h1>
          <p>Mapas base, vetores e rasters do acervo geoespacial em uma interface para consultar, comparar e identificar informações da bacia.</p>
        </div>
        <div className="webgis-actions">
          {powerBiUrl ? <a className="webgis-dashboard-link" href={powerBiUrl} target="_blank" rel="noreferrer"><i className="fa-solid fa-chart-line" aria-hidden="true" /> Abrir dashboard Power BI <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></a> : <span className="webgis-dashboard-link is-disabled" title="Configure VITE_POWERBI_DASHBOARD_URL para habilitar o dashboard"><i className="fa-solid fa-chart-line" aria-hidden="true" /> Dashboard Power BI indisponível</span>}
          <a className="webgis-references-link" href="/geospatial/references.csv" target="_blank" rel="noreferrer"><i className="fa-solid fa-book-open" aria-hidden="true" /> Referências do acervo (CSV)</a>
          <span className="webgis-catalog-version"><i className="fa-solid fa-database" aria-hidden="true" /> Catálogo {catalogVersion}</span>
        </div>
      </header>

      <div className="catalog-summary webgis-summary" aria-label="Resumo do WebGIS">
        <div><strong>{presentCount}</strong><span>camadas disponíveis</span></div>
        <div><strong>{selectedIds.length}</strong><span>camadas no mapa</span></div>
        <div><strong>{plannedCount}</strong><span>camadas planejadas</span></div>
      </div>

      <section className="catalog-map-panel webgis-map-panel" aria-labelledby="catalog-map-title">
        <div className="catalog-map-heading"><div><span className="eyebrow">Visualização cartográfica</span><h2 id="catalog-map-title">Mapa da bacia</h2></div><span className="catalog-map-state"><i className="fa-solid fa-hand-pointer" aria-hidden="true" /> Clique em uma feição para identificar</span></div>
        <MapCanvas layers={activeLayers} baseMap={baseMap} onFeatureSelect={handleFeatureSelect} />
        <div className="webgis-map-legend" aria-label="Legenda das camadas ativas"><span className="eyebrow">Legenda</span>{activeLayers.length === 0 ? <span className="webgis-legend-empty">Nenhuma camada ativa</span> : activeLayers.map((layer) => <span className={`webgis-legend-item ${layer.kind}`} key={layer.id}><i aria-hidden="true" />{layer.title}</span>)}</div>
        {selection && <aside className="map-identify-panel" aria-label="Informações da feição selecionada"><div className="map-identify-heading"><div><span className="eyebrow">Identificação</span><strong>{selection.layerTitle}</strong></div><button type="button" onClick={() => setSelection(null)} aria-label="Fechar identificação"><i className="fa-solid fa-xmark" aria-hidden="true" /></button></div><dl>{Object.entries(selection.properties).slice(0, 12).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd></div>)}</dl></aside>}
      </section>

      <section className="webgis-base-section" aria-labelledby="base-map-title"><div className="catalog-toolbar"><div><span className="eyebrow">Mapas base</span><h2 id="base-map-title">Escolha o contexto visual</h2></div></div><div className="webgis-base-grid">{baseMaps.map((base) => <button key={base.id} type="button" className={`webgis-base-card ${baseMap === base.id ? 'is-active' : ''}`} onClick={() => setBaseMap(base.id)}><span className={`webgis-base-thumb ${base.thumb}`} aria-hidden="true" /><span><strong>{base.title}</strong><small>{base.description}</small></span>{baseMap === base.id && <i className="fa-solid fa-circle-check" aria-hidden="true" />}</button>)}</div></section>

      <div className="catalog-toolbar webgis-layer-toolbar"><div><span className="eyebrow">Camadas geoespaciais</span><h2>Dados disponíveis</h2></div><div className="catalog-filters" role="group" aria-label="Filtrar camadas">{(['all', 'present', 'planned'] as const).map((option) => <button key={option} type="button" className={filter === option ? 'is-active' : ''} onClick={() => setFilter(option)}>{option === 'all' ? 'Todas' : option === 'present' ? 'Disponíveis' : 'Planejadas'}</button>)}</div></div>

      <div className="catalog-grid webgis-layer-grid">{visibleLayers.map((layer) => { const active = selectedIds.includes(layer.id); return <article className={`catalog-layer-card status-${layer.status} ${active ? 'is-selected' : ''}`} key={layer.id}><div className="catalog-layer-topline"><span className="catalog-layer-group">{layer.group}</span><span className="catalog-status"><i className={`fa-solid ${layer.status === 'present' ? 'fa-circle-check' : 'fa-clock'}`} aria-hidden="true" />{layer.status === 'present' ? 'Disponível' : 'Planejada'}</span></div><h3>{layer.title}</h3><p>{layerDetail(layer)}</p><span className="catalog-format"><i className={`fa-solid ${layer.kind === 'raster' ? 'fa-image' : 'fa-draw-polygon'}`} aria-hidden="true" /> {layer.kind === 'raster' ? 'Raster' : 'Vetorial'}{layer.observation ? ` · ${layer.observation}` : ''}</span>{layer.source && <small className="webgis-layer-source">Fonte: {layer.source}</small>}<button type="button" className="webgis-layer-toggle" disabled={layer.status !== 'present' || !layer.url} onClick={() => toggleLayer(layer)}><i className={`fa-solid ${active ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" /> {active ? 'Ocultar do mapa' : 'Exibir no mapa'}</button></article>; })}</div>
    </section>
  );
}
