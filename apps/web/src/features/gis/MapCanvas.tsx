import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import WebGLTileLayer from 'ol/layer/WebGLTile.js';
import XYZ from 'ol/source/XYZ.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import CircleStyle from 'ol/style/Circle.js';

export type MapBaseMap = 'osm' | 'carto-light' | 'carto-dark' | 'esri-imagery' | 'esri-topo';

export type MapLayerDefinition = {
  id: string;
  title: string;
  url: string;
  kind: 'vector' | 'raster';
  group?: string;
  statistics?: { min?: number; max?: number; p2?: number; p98?: number };
  opacity?: number;
};

export type MapFeatureSelection = {
  layerId: string;
  layerTitle: string;
  properties: Record<string, unknown>;
};

type MapCanvasProps = {
  layers?: MapLayerDefinition[];
  baseMap?: MapBaseMap;
  onFeatureSelect?: (selection: MapFeatureSelection | null) => void;
};

const INITIAL_CENTER = fromLonLat([-42.6, -12.6]);

const baseMapSources: Record<MapBaseMap, { url: string; attribution: string }> = {
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
  'carto-light': { url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attribution: '© OpenStreetMap © CARTO' },
  'carto-dark': { url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attribution: '© OpenStreetMap © CARTO' },
  'esri-imagery': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  'esri-topo': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
};

function vectorStyle(layerId: string) {
  const isHydro = layerId === 'hidrografia';
  const color = isHydro ? '#39a9e8' : '#b9ca48';
  return new Style({
    fill: new Fill({ color: isHydro ? 'rgba(57,169,232,.12)' : 'rgba(185,202,72,.18)' }),
    stroke: new Stroke({ color, width: isHydro ? 2.2 : 1.4 }),
    image: new CircleStyle({ radius: 4, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1 }) }),
  });
}

function rasterStyle(layer: MapLayerDefinition) {
  const min = layer.statistics?.p2 ?? layer.statistics?.min ?? 0;
  const max = layer.statistics?.p98 ?? layer.statistics?.max ?? min + 1;
  const span = Math.max(max - min, 1);
  const isElevation = layer.id === 'mde';
  const palette = isElevation
    ? ['rgba(0,0,0,0)', '#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']
    : ['rgba(0,0,0,0)', '#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'];
  const stops: any[] = ['interpolate', ['linear'], ['band', 1]];
  palette.forEach((color, index) => stops.push(min + (span * index) / (palette.length - 1), color));
  return { color: stops };
}

export function MapCanvas({ layers = [], baseMap = 'osm', onFeatureSelect }: MapCanvasProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [loading, setLoading] = useState(layers.length > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetRef.current) return undefined;
    const base = baseMapSources[baseMap];
    const baseLayer = new TileLayer({
      source: new XYZ({ url: base.url, attributions: base.attribution, crossOrigin: 'anonymous', maxZoom: 19 }),
      properties: { id: 'base-map', title: 'Mapa base' },
    });
    const map = new Map({
      target: targetRef.current,
      layers: [baseLayer],
      view: new View({ center: INITIAL_CENTER, zoom: 7, minZoom: 3, maxZoom: 19 }),
      controls: [],
    });
    mapRef.current = map;
    let cancelled = false;
    setLoading(layers.length > 0);
    setError(null);

    const loadLayers = async () => {
      try {
        const format = new GeoJSON();
        const loaded = await Promise.all(layers.map(async (layer) => {
          if (layer.kind === 'raster') {
            const source = new GeoTIFF({ sources: [{ url: layer.url }], normalize: false, convertToRGB: false });
            return new WebGLTileLayer({
              source,
              opacity: layer.opacity ?? 0.82,
              style: rasterStyle(layer),
              properties: { id: layer.id, title: layer.title, sourceUrl: layer.url, kind: layer.kind },
            });
          }
          const response = await fetch(layer.url, { headers: { Accept: 'application/geo+json, application/json' } });
          if (!response.ok) throw new Error(`${layer.title}: resposta ${response.status}`);
          const document = await response.json() as Record<string, unknown>;
          const features = format.readFeatures(document, { dataProjection: 'EPSG:4674', featureProjection: 'EPSG:3857' });
          return new VectorLayer({
            properties: { id: layer.id, title: layer.title, sourceUrl: layer.url, kind: layer.kind },
            source: new VectorSource({ features }),
            style: vectorStyle(layer.id),
          });
        }));
        if (cancelled) return;
        loaded.forEach((layer) => map.addLayer(layer));
        const vectorExtents = loaded
          .filter((layer): layer is VectorLayer<VectorSource> => layer instanceof VectorLayer)
          .map((layer) => layer.getSource()?.getExtent())
          .filter((extent): extent is [number, number, number, number] => Boolean(extent && extent.every(Number.isFinite)));
        if (vectorExtents.length > 0) {
          const firstExtent = vectorExtents[0] as [number, number, number, number];
          const extent: [number, number, number, number] = vectorExtents.slice(1).reduce((acc, current): [number, number, number, number] => [
            Math.min(acc[0], current[0]), Math.min(acc[1], current[1]), Math.max(acc[2], current[2]), Math.max(acc[3], current[3]),
          ], firstExtent);
          map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 11, duration: 260 });
        }
        setError(null);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a camada.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadLayers();

    const handleClick = (event: import('ol/MapBrowserEvent').default) => {
      let selection: MapFeatureSelection | null = null;
      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        const olLayer = layer as VectorLayer<VectorSource>;
        const properties = { ...feature.getProperties() } as Record<string, unknown>;
        delete properties.geometry;
        selection = { layerId: String(olLayer.get('id') ?? ''), layerTitle: String(olLayer.get('title') ?? 'Camada'), properties };
        return true;
      });
      onFeatureSelect?.(selection);
    };
    map.on('singleclick', handleClick);
    return () => {
      cancelled = true;
      map.un('singleclick', handleClick);
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [baseMap, layers, onFeatureSelect]);

  const zoom = (delta: number) => {
    const view = mapRef.current?.getView();
    const current = view?.getZoom();
    if (view && current !== undefined) view.animate({ zoom: current + delta, duration: 180 });
  };
  const resetView = () => mapRef.current?.getView().animate({ center: INITIAL_CENTER, zoom: 7, duration: 240 });

  return (
    <div className="map-canvas-shell">
      <div ref={targetRef} className="map-canvas" aria-label="Mapa interativo da Bacia do Rio Paramirim" />
      <div className="map-canvas-controls" aria-label="Controles do mapa">
        <button type="button" onClick={() => zoom(1)} aria-label="Aproximar"><i className="fa-solid fa-plus" aria-hidden="true" /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Afastar"><i className="fa-solid fa-minus" aria-hidden="true" /></button>
        <button type="button" onClick={resetView} aria-label="Repor vista"><i className="fa-solid fa-crosshairs" aria-hidden="true" /></button>
      </div>
      {layers.length === 0 && <div className="map-canvas-empty" role="status"><span><i className="fa-solid fa-layer-group" aria-hidden="true" /></span><div><strong>Selecione uma camada para começar</strong><p>Use o painel de camadas para ativar vetores ou rasters da base geoespacial.</p></div></div>}
      {loading && <div className="map-canvas-feedback" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Carregando camadas…</div>}
      {error && <div className="map-canvas-feedback is-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</div>}
    </div>
  );
}
