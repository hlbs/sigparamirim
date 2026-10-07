import { useEffect, useRef } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat } from 'ol/proj.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';

type PublishedLayer = {
  id: string;
  title: string;
  url: string;
};

// Preenchido pelo pipeline quando uma camada passa pelo gate de publicação.
// Basemap permanece desativado até DP-013 definir fonte e atribuição permitidas.
const publishedLayers: PublishedLayer[] = [];

export function MapCanvas() {
  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!targetRef.current) return undefined;
    const vectorLayers = publishedLayers.map((layer) => new VectorLayer({
      properties: { id: layer.id, title: layer.title, sourceUrl: layer.url },
      source: new VectorSource(),
    }));
    const map = new Map({
      target: targetRef.current,
      layers: [
        // Nenhum basemap é adicionado automaticamente: a política ainda está pendente.
        ...vectorLayers,
      ],
      view: new View({ center: fromLonLat([-42.6, -12.6]), zoom: 7 }),
      controls: [],
    });
    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="map-canvas-shell">
      <div ref={targetRef} className="map-canvas" aria-label="Mapa OpenLayers do catálogo geoespacial" />
      {publishedLayers.length === 0 && (
        <div className="map-canvas-empty" role="status">
          <span><i className="fa-solid fa-map-location-dot" aria-hidden="true" /></span>
          <div><strong>Visualização aguardando publicação</strong><p>O enquadramento cartográfico está pronto. As camadas aparecerão aqui depois da validação de fonte, licença, CRS e NoData.</p></div>
        </div>
      )}
    </div>
  );
}
