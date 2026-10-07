import { useMemo, useState } from 'react';
import { MapCanvas, type MapLayerDefinition } from '../features/gis/MapCanvas';

type LayerStatus = 'blocked' | 'planned' | 'ready';
type LayerFormat = 'COG' | 'GeoJSON direto' | 'GeoJSON em Worker' | 'GeoJSON particionado';

type CatalogLayer = {
  id: string;
  title: string;
  group: string;
  status: LayerStatus;
  format?: LayerFormat;
  detail: string;
  blocker?: string;
};

const layers: CatalogLayer[] = [
  { id: 'mde', title: 'Modelo Digital de Elevação', group: 'Rasters', status: 'blocked', format: 'COG', detail: '5.057 × 7.567 px · EPSG:31983 · 10 classes hipsométricas', blocker: 'Confirmar NoData, fonte e licença.' },
  { id: 'hidrografia', title: 'Hidrografia', group: 'Bacia hidrográfica', status: 'blocked', format: 'GeoJSON direto', detail: '199 feições · MultiLineString · EPSG:4674', blocker: 'Registrar licença e atribuição.' },
  { id: 'vegetacao', title: 'Vegetação', group: 'Recursos naturais', status: 'blocked', format: 'GeoJSON particionado', detail: '6.721 feições · 132,42 MiB · EPSG:4674', blocker: 'Registrar licença e política de recorte.' },
  { id: 'imovel-rural-limites-propriedades', title: 'Limites de propriedade', group: 'Imóveis rurais', status: 'blocked', format: 'GeoJSON particionado', detail: '58.620 feições · 43,31 MiB · EPSG:4674', blocker: 'Definir campos públicos e licença.' },
  { id: 'pocos-siagas', title: 'Poços — SIAGAS', group: 'Poços', status: 'blocked', format: 'GeoJSON em Worker', detail: '935 feições pontuais · EPSG:4674', blocker: 'Revisar atributos potencialmente sensíveis.' },
  { id: 'geologia', title: 'Geologia', group: 'Recursos naturais', status: 'blocked', format: 'GeoJSON direto', detail: '231 feições · MultiPolygon · EPSG:4674', blocker: 'Registrar escala, licença e atribuição.' },
  { id: 'nivel-dinamico', title: 'Nível dinâmico', group: 'Rasters', status: 'blocked', format: 'COG', detail: '1.433 × 2.078 px · EPSG:4674', blocker: 'Confirmar unidade, significado e NoData.' },
  { id: 'nivel-estatico', title: 'Nível estático', group: 'Rasters', status: 'blocked', format: 'COG', detail: '1.433 × 2.078 px · EPSG:4674', blocker: 'Confirmar unidade, significado e NoData.' },
  { id: 'profundidade', title: 'Profundidade', group: 'Rasters', status: 'blocked', format: 'COG', detail: '1.433 × 2.078 px · EPSG:4674', blocker: 'Confirmar unidade, significado e NoData.' },
  { id: 'solos', title: 'Solos', group: 'Planejadas', status: 'planned', detail: 'Nenhum arquivo original foi submetido ao catálogo.', blocker: 'Aguardando fonte oficial e arquivo validável.' },
  { id: 'rodovias', title: 'Rodovias', group: 'Planejadas', status: 'planned', detail: 'Nenhum arquivo original foi submetido ao catálogo.', blocker: 'Aguardando fonte oficial e arquivo validável.' },
  { id: 'barragens', title: 'Barragens', group: 'Planejadas', status: 'planned', detail: 'Nenhum arquivo original foi submetido ao catálogo.', blocker: 'Aguardando fonte oficial e arquivo validável.' },
];

// O pipeline preenche esta lista somente depois que o gate de publicação passar.
const publishedMapLayers: MapLayerDefinition[] = [];

const statusLabel: Record<LayerStatus, string> = { blocked: 'Bloqueada', planned: 'Planejada', ready: 'Pronta' };

export function MapPage() {
  const [filter, setFilter] = useState<'all' | LayerStatus>('all');
  const visibleLayers = useMemo(() => filter === 'all' ? layers : layers.filter((layer) => layer.status === filter), [filter]);

  return (
    <section className="catalog-page" aria-labelledby="catalog-title">
      <header className="catalog-hero">
        <div>
          <span className="eyebrow">Catálogo geoespacial · Fase 3.5</span>
          <h1 id="catalog-title">Camadas com rastreabilidade antes do mapa.</h1>
          <p>O catálogo organiza as fontes da Bacia do Rio Paramirim e só libera uma camada depois que CRS, licença, unidade e qualidade foram confirmados.</p>
        </div>
        <div className="catalog-gate" role="status">
          <span className="catalog-gate-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span>
          <div><strong>Gate de publicação</strong><span>Conteúdo em validação</span></div>
        </div>
      </header>

      <div className="catalog-summary" aria-label="Resumo do catálogo">
        <div><strong>24</strong><span>camadas bloqueadas</span></div>
        <div><strong>17</strong><span>camadas planejadas</span></div>
        <div><strong>0</strong><span>publicadas sem validação</span></div>
      </div>

      <section className="catalog-map-panel" aria-labelledby="catalog-map-title">
        <div className="catalog-map-heading"><div><span className="eyebrow">Motor cartográfico</span><h2 id="catalog-map-title">Enquadramento da bacia</h2></div><span className="catalog-map-state"><i className="fa-solid fa-circle-pause" aria-hidden="true" /> Aguardando camadas</span></div>
        <MapCanvas layers={publishedMapLayers} />
      </section>

      <div className="catalog-toolbar">
        <div><span className="eyebrow">Inventário inicial</span><h2>Fontes e derivados previstos</h2></div>
        <div className="catalog-filters" role="group" aria-label="Filtrar camadas">
          {(['all', 'blocked', 'planned', 'ready'] as const).map((option) => (
            <button key={option} type="button" className={filter === option ? 'is-active' : ''} onClick={() => setFilter(option)}>{option === 'all' ? 'Todas' : statusLabel[option]}</button>
          ))}
        </div>
      </div>

      <div className="catalog-grid">
        {visibleLayers.map((layer) => (
          <article className={`catalog-layer-card status-${layer.status}`} key={layer.id}>
            <div className="catalog-layer-topline"><span className="catalog-layer-group">{layer.group}</span><span className="catalog-status"><i className={`fa-solid ${layer.status === 'blocked' ? 'fa-lock' : layer.status === 'planned' ? 'fa-clock' : 'fa-circle-check'}`} aria-hidden="true" />{statusLabel[layer.status]}</span></div>
            <h3>{layer.title}</h3>
            <p>{layer.detail}</p>
            {layer.format && <span className="catalog-format"><i className="fa-solid fa-layer-group" aria-hidden="true" /> Derivado: {layer.format}</span>}
            <div className="catalog-blocker"><i className="fa-solid fa-circle-info" aria-hidden="true" /><span>{layer.blocker}</span></div>
          </article>
        ))}
      </div>

      <footer className="catalog-footer-note"><i className="fa-solid fa-code-branch" aria-hidden="true" /><span>Manifesto de ingestão `v0.1.0` · originais preservados · nenhuma camada é copiada ou publicada automaticamente.</span></footer>
    </section>
  );
}
