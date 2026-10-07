import { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import proj4 from 'proj4';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import WebGLTileLayer from 'ol/layer/WebGLTile.js';
import XYZ from 'ol/source/XYZ.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import { register } from 'ol/proj/proj4.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import CircleStyle from 'ol/style/Circle.js';
import Draw from 'ol/interaction/Draw.js';
import { getArea, getLength } from 'ol/sphere.js';

export type MapBaseMap = 'osm' | 'carto-light' | 'carto-dark' | 'esri-imagery' | 'esri-topo';
export type MapLayerDefinition = {
  id: string; title: string; url: string; kind: 'vector' | 'raster'; group?: string;
  statistics?: { min?: number; max?: number; p2?: number; p98?: number };
  opacity?: number; noData?: number;
};
export type MapFeatureSelection = { layerId: string; layerTitle: string; properties: Record<string, unknown> };
type MapCanvasProps = {
  layers?: MapLayerDefinition[];
  baseMap?: MapBaseMap;
  tool?: 'identify' | 'measure-length' | 'measure-area';
  homeToken?: number;
  onMeasure?: (value: { value: number; unit: 'm' | 'km' | 'm²' | 'km²' } | null) => void;
  onFeatureSelect?: (selection: MapFeatureSelection | null) => void;
};
type RenderedDataLayer = VectorLayer<VectorSource> | WebGLTileLayer;

const INITIAL_CENTER = fromLonLat([-42.6, -12.6]);
proj4.defs('EPSG:4674', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:31983', '+proj=utm +zone=23 +south +ellps=GRS80 +units=m +no_defs +type=crs');
register(proj4);
const baseMapSources: Record<MapBaseMap, { url: string; attribution: string }> = {
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
  'carto-light': { url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attribution: '© OpenStreetMap © CARTO' },
  'carto-dark': { url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attribution: '© OpenStreetMap © CARTO' },
  'esri-imagery': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  'esri-topo': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
};

function vectorStyle(layerId: string) {
  const isHydro = layerId === 'hidrografia';
  const isBasin = layerId === 'bacia-hidrografica-paramirim';
  const colors = ['#9e803b', '#7a9b55', '#855c9c', '#c06d4f', '#477f86', '#b5813f', '#678bba'];
  const hash = [...layerId].reduce((value, char) => value + char.charCodeAt(0), 0);
  const color = isHydro ? '#168fce' : isBasin ? '#68710a' : colors[hash % colors.length];
  return new Style({
    fill: new Fill({ color: isHydro || isBasin ? 'rgba(0,0,0,0)' : `${color}33` }),
    stroke: new Stroke({ color, width: isHydro ? 1.7 : isBasin ? 2.6 : 1.35 }),
    image: new CircleStyle({ radius: 4, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1 }) }),
  });
}

function rasterStyle(layer: MapLayerDefinition) {
  const min = layer.statistics?.p2 ?? layer.statistics?.min ?? 0;
  const max = layer.statistics?.p98 ?? layer.statistics?.max ?? min + 1;
  const span = Math.max(max - min, 1);
  const palette = layer.id === 'mde'
    ? ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']
    : ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'];
  const expression: unknown[] = ['interpolate', ['linear'], ['band', 1], layer.noData ?? 0, 'rgba(0,0,0,0)'];
  palette.forEach((color, index) => expression.push(min + (span * index) / (palette.length - 1), color));
  return { color: expression as any };
}

export function MapCanvas({ layers = [], baseMap = 'osm', tool = 'identify', homeToken = 0, onMeasure, onFeatureSelect }: MapCanvasProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const dataLayersRef = useRef(new globalThis.Map<string, RenderedDataLayer>());
  const initialExtentRef = useRef<import('ol/extent').Extent | null>(null);
  const callbackRef = useRef(onFeatureSelect);
  const measureCallbackRef = useRef(onMeasure);
  const toolRef = useRef(tool);
  const drawRef = useRef<Draw | null>(null);
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const aliveRef = useRef(false);
  const [loading, setLoading] = useState(layers.length > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { callbackRef.current = onFeatureSelect; measureCallbackRef.current = onMeasure; }, [onFeatureSelect, onMeasure]);

  useEffect(() => {
    if (!targetRef.current) return undefined;
    aliveRef.current = true;
    const map = new Map({
      target: targetRef.current,
      layers: [],
      view: new View({ center: INITIAL_CENTER, zoom: 6.5, minZoom: 3, maxZoom: 19 }),
      controls: [],
    });
    mapRef.current = map;
    const handleClick = (event: import('ol/MapBrowserEvent').default) => {
      if (toolRef.current !== 'identify') return;
      let selection: MapFeatureSelection | null = null;
      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        const properties = { ...feature.getProperties() } as Record<string, unknown>;
        delete properties.geometry;
        selection = { layerId: String(layer?.get('id') ?? ''), layerTitle: String(layer?.get('title') ?? 'Camada'), properties };
        return true;
      });
      callbackRef.current?.(selection);
    };
    map.on('singleclick', handleClick);
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(targetRef.current);
    requestAnimationFrame(() => map.updateSize());
    return () => {
      aliveRef.current = false;
      observer.disconnect();
      map.un('singleclick', handleClick);
      map.setTarget(undefined);
      mapRef.current = null;
      baseLayerRef.current = null;
      dataLayersRef.current.clear();
      initialExtentRef.current = null;
      drawRef.current = null;
      measureLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    toolRef.current = tool;
    if (drawRef.current) map.removeInteraction(drawRef.current);
    drawRef.current = null;
    if (measureLayerRef.current) map.removeLayer(measureLayerRef.current);
    measureLayerRef.current = null;
    measureCallbackRef.current?.(null);
    if (tool === 'identify') return;
    const source = new VectorSource();
    const measureLayer = new VectorLayer({ source, style: new Style({ fill: new Fill({ color: 'rgba(225, 189, 45, .18)' }), stroke: new Stroke({ color: '#bd9e1a', width: 3, lineDash: [8, 5] }), image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#bd9e1a' }), stroke: new Stroke({ color: '#fff', width: 2 }) }) }) });
    measureLayerRef.current = measureLayer;
    map.addLayer(measureLayer);
    const draw = new Draw({ source, type: tool === 'measure-length' ? 'LineString' : 'Polygon' });
    drawRef.current = draw;
    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      if (!geometry) return;
      const raw = tool === 'measure-length' ? getLength(geometry) : getArea(geometry);
      if (tool === 'measure-length') measureCallbackRef.current?.(raw >= 1000 ? { value: raw / 1000, unit: 'km' } : { value: raw, unit: 'm' });
      else measureCallbackRef.current?.(raw >= 1_000_000 ? { value: raw / 1_000_000, unit: 'km²' } : { value: raw, unit: 'm²' });
    });
    map.addInteraction(draw);
    return () => { if (mapRef.current) mapRef.current.removeInteraction(draw); };
  }, [tool]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const base = baseMapSources[baseMap];
    const layer = new TileLayer({ source: new XYZ({ url: base.url, attributions: base.attribution, crossOrigin: 'anonymous', maxZoom: 19, transition: 150 }), properties: { id: 'base-map', title: 'Mapa base' } });
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    baseLayerRef.current = layer;
    map.getLayers().insertAt(0, layer);
  }, [baseMap]);

  useEffect(() => {
    if (homeToken === 0) return;
    const map = mapRef.current;
    if (map && initialExtentRef.current) map.getView().fit(initialExtentRef.current, { padding: [36, 36, 36, 36], maxZoom: 9, duration: 240 });
    else map?.getView().animate({ center: INITIAL_CENTER, zoom: 7, duration: 240 });
  }, [homeToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const desiredIds = new Set(layers.map((layer) => layer.id));
    for (const [id, existing] of dataLayersRef.current) {
      if (!desiredIds.has(id)) {
        map.removeLayer(existing);
        dataLayersRef.current.delete(id);
        continue;
      }
      const definition = layers.find((item) => item.id === id);
      if (definition) existing.setOpacity(definition.opacity ?? (definition.kind === 'raster' ? .82 : 1));
    }
    const missing = layers.filter((definition) => !dataLayersRef.current.has(definition.id));
    let cancelled = false;
    setLoading(missing.length > 0);
    setError(null);

    const create = async (definition: MapLayerDefinition) => {
      let rendered: RenderedDataLayer;
      if (definition.kind === 'raster') {
        const source = new GeoTIFF({
          sources: [{ url: definition.url, nodata: definition.noData ?? 0 }],
          normalize: false, convertToRGB: false, interpolate: true, sourceOptions: { maxRanges: 4 },
        });
        rendered = new WebGLTileLayer({ source, opacity: definition.opacity ?? .82, style: rasterStyle(definition), properties: { id: definition.id, title: definition.title, kind: definition.kind } });
      } else {
        const response = await fetch(definition.url, { headers: { Accept: 'application/geo+json, application/json' } });
        if (!response.ok) throw new Error(`${definition.title}: resposta ${response.status}`);
        const document = await response.json() as Record<string, unknown>;
        if (cancelled || !aliveRef.current) return;
        const features = new GeoJSON().readFeatures(document, { dataProjection: 'EPSG:4674', featureProjection: 'EPSG:3857' });
        const vectorSource = new VectorSource({ features });
        rendered = new VectorLayer({ properties: { id: definition.id, title: definition.title, kind: definition.kind }, source: vectorSource, style: vectorStyle(definition.id), opacity: definition.opacity ?? 1 });
        if (definition.id === 'bacia-hidrografica-paramirim') {
          const extent = vectorSource.getExtent();
          if (extent && extent.every(Number.isFinite)) initialExtentRef.current = extent;
        }
      }
      if (cancelled || !aliveRef.current || !mapRef.current) return;
      rendered.setVisible(desiredIds.has(definition.id));
      dataLayersRef.current.set(definition.id, rendered);
      map.addLayer(rendered);
      if (definition.id === 'bacia-hidrografica-paramirim' && rendered instanceof VectorLayer) {
        const extent = rendered.getSource()?.getExtent();
        if (extent && extent.every(Number.isFinite)) map.getView().fit(extent, { padding: [42, 42, 42, 42], maxZoom: 9, duration: 280 });
      }
    };
    Promise.all(missing.map((definition) => create(definition)))
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a camada.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [layers]);

  const zoom = (delta: number) => {
    const view = mapRef.current?.getView();
    const current = view?.getZoom();
    if (view && current !== undefined) view.animate({ zoom: current + delta, duration: 160 });
  };
  const resetView = () => mapRef.current?.getView().animate({ center: INITIAL_CENTER, zoom: 6.5, duration: 220 });

  return <div className="map-canvas-shell" data-tool={tool}>
    <div ref={targetRef} className="map-canvas" aria-label="Mapa interativo da Bacia do Rio Paramirim" />
    <div className="map-canvas-controls" aria-label="Controles do mapa">
      <button type="button" onClick={() => zoom(1)} aria-label="Aproximar"><i className="fa-solid fa-plus" /></button>
      <button type="button" onClick={() => zoom(-1)} aria-label="Afastar"><i className="fa-solid fa-minus" /></button>
      <button type="button" onClick={resetView} aria-label="Repor vista"><i className="fa-solid fa-crosshairs" /></button>
    </div>
    <div className="map-attribution">{baseMapSources[baseMap].attribution}</div>
    {loading && <div className="map-canvas-feedback" role="status"><i className="fa-solid fa-spinner fa-spin" /> Carregando camada…</div>}
    {error && <div className="map-canvas-feedback is-error" role="alert"><i className="fa-solid fa-triangle-exclamation" /> {error}</div>}
  </div>;
}
