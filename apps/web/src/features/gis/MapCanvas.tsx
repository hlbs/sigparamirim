import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';

export type MapLayerDefinition = {
  id: string;
  title: string;
  url: string;
};

const INITIAL_CENTER = fromLonLat([-42.6, -12.6]);

export function MapCanvas({ layers = [] }: { layers?: MapLayerDefinition[] }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [loading, setLoading] = useState(layers.length > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetRef.current) return undefined;
    const map = new Map({
      target: targetRef.current,
      // Nenhum basemap é adicionado automaticamente: a política ainda está pendente.
      layers: [],
      view: new View({ center: INITIAL_CENTER, zoom: 7 }),
      controls: [],
    });
    mapRef.current = map;
    let cancelled = false;
    const loadLayers = async () => {
      if (layers.length === 0) { setLoading(false); return; }
      try {
        const format = new GeoJSON();
        const loaded = await Promise.all(layers.map(async (layer) => {
          const response = await fetch(layer.url, { headers: { Accept: 'application/geo+json, application/json' } });
          if (!response.ok) throw new Error(`${layer.title}: resposta ${response.status}`);
          const document = await response.json() as Record<string, unknown>;
          const features = format.readFeatures(document, { dataProjection: 'EPSG:4674', featureProjection: 'EPSG:3857' });
          return new VectorLayer({ properties: { id: layer.id, title: layer.title, sourceUrl: layer.url }, source: new VectorSource({ features }) });
        }));
        if (cancelled) return;
        loaded.forEach((layer) => map.addLayer(layer));
        setError(null);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a camada.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadLayers();
    return () => {
      cancelled = true;
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [layers]);

  const zoom = (delta: number) => {
    const view = mapRef.current?.getView();
    const current = view?.getZoom();
    if (view && current !== undefined) view.animate({ zoom: current + delta, duration: 180 });
  };

  const resetView = () => mapRef.current?.getView().animate({ center: INITIAL_CENTER, zoom: 7, duration: 240 });

  return (
    <div className="map-canvas-shell">
      <div ref={targetRef} className="map-canvas" aria-label="Mapa OpenLayers do catálogo geoespacial" />
      <div className="map-canvas-controls" aria-label="Controles do mapa">
        <button type="button" onClick={() => zoom(1)} aria-label="Aproximar"><i className="fa-solid fa-plus" aria-hidden="true" /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Afastar"><i className="fa-solid fa-minus" aria-hidden="true" /></button>
        <button type="button" onClick={resetView} aria-label="Repor vista"><i className="fa-solid fa-expand" aria-hidden="true" /></button>
      </div>
      {layers.length === 0 && (
        <div className="map-canvas-empty" role="status">
          <span><i className="fa-solid fa-map-location-dot" aria-hidden="true" /></span>
          <div><strong>Visualização aguardando publicação</strong><p>O enquadramento cartográfico está pronto. As camadas aparecerão aqui depois da validação de fonte, licença, CRS e NoData.</p></div>
        </div>
      )}
      {loading && <div className="map-canvas-feedback" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Carregando camadas…</div>}
      {error && <div className="map-canvas-feedback is-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</div>}
    </div>
  );
}
