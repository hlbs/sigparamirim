import { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import proj4 from 'proj4';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat, getPointResolution, transform } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import WebGLTileLayer from 'ol/layer/WebGLTile.js';
import XYZ from 'ol/source/XYZ.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import { register } from 'ol/proj/proj4.js';
import { unByKey } from 'ol/Observable.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import CircleStyle from 'ol/style/Circle.js';
import Text from 'ol/style/Text.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Draw from 'ol/interaction/Draw.js';
import { getArea, getLength } from 'ol/sphere.js';
import ScaleLine from 'ol/control/ScaleLine.js';
import Graticule from 'ol/layer/Graticule.js';
import { fromArrayBuffer } from 'geotiff';
import { useDraggableMapPanel } from './useDraggableMapPanel';
import { unpackGeometry, type PackedGeometry } from './vectorCodec';
import { shouldProcessVectorInWorker } from './vectorLoadingStrategy';

export type MapBaseMap = 'osm' | 'osm-hot' | 'opentopomap' | 'cyclosm' | 'esri-street' | 'esri-topo' | 'esri-imagery' | 'esri-terrain' | 'esri-natgeo' | 'esri-relief';
export type RasterRange = { min: number; max: number };
export type VectorLayerStyle = { stroke?: string; fill?: string; strokeWidth?: number; pointRadius?: number };
export type FeatureFilter = {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string | number | boolean;
};
export type MapLayerDefinition = {
  id: string; title: string; url: string; kind: 'vector' | 'raster'; group?: string;
  sizeBytes?: number; featureCount?: number; geometryTypes?: Record<string, number>; crs?: string;
  statistics?: { min?: number; max?: number; p2?: number; p98?: number };
  palette?: string;
  styleDefault?: { palette?: string; colorInterpolation?: string; classificationMethod?: string; classCount?: number; resamplingMethod?: string; resamplingKernel?: string; noDataColor?: string };
  /** Interactive display range; defaults to p2–p98 and affects colors, not source values. */
  range?: RasterRange;
  /** Per-layer vector symbology supplied by the layer controls. */
  vectorStyle?: VectorLayerStyle;
  /** A single property predicate; omit to show all features. */
  featureFilter?: FeatureFilter | null;
  /** Whether map clicks should open the attribute popup for this vector layer. Defaults to true. */
  identifyEnabled?: boolean;
  opacity?: number; noData?: number;
};
export type MapFeatureSelection = { layerId: string; layerTitle: string; properties: Record<string, unknown> };
export type MeasurementHistoryEntry = {
  id: string;
  kind: 'measure-length' | 'measure-area';
  value: number;
  unit: 'm' | 'km' | 'm²' | 'km²';
  vertices: [number, number][];
  geometry: Record<string, unknown>;
};
type MapCanvasProps = {
  layers?: MapLayerDefinition[];
  baseMap?: MapBaseMap;
  tool?: 'identify' | 'measure-length' | 'measure-area';
  homeToken?: number;
  onMeasure?: (value: { value: number; unit: 'm' | 'km' | 'm²' | 'km²' } | null) => void;
  onFeatureSelect?: (selection: MapFeatureSelection | null) => void;
  /** Re-emitted when a layer's controlled display range changes; ranges belong to UI state. */
  onRasterRangeChange?: (layerId: string, range: RasterRange) => void;
  /** Features parsed during layer load (and after filtering), for a table without another fetch. */
  onLayerFeatures?: (layerId: string, rows: Record<string, unknown>[]) => void;
  /** Persistent in the current browser tab; coordinates are [longitude, latitude] in EPSG:4674. */
  onMeasurementHistoryChange?: (history: MeasurementHistoryEntry[]) => void;
  clearMeasurementsToken?: number;
};
type RenderedDataLayer = VectorLayer<VectorSource> | WebGLTileLayer;
type PackedFeature = { id?: number | string; properties: Record<string, unknown>; geometry: PackedGeometry | null };
type LayerLoadingStatus = { title: string; message: string; progress?: number };

function readVectorInWorker(url: string, dataProjection: string, signal: AbortSignal): Promise<PackedFeature[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Carregamento cancelado', 'AbortError')); return; }
    const worker = new Worker(new URL('./vectorWorker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => { finish(); reject(new DOMException('Carregamento cancelado', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => { finish(); reject(new Error(event.message || 'Falha no processamento vetorial em segundo plano.')); };
    worker.onmessage = (event: MessageEvent<{ features?: PackedFeature[]; error?: string }>) => {
      finish();
      if (event.data.error) { reject(new Error(event.data.error)); return; }
      resolve(event.data.features ?? []);
    };
    worker.postMessage({ url, dataProjection });
  });
}

export function readVectorPropertiesInWorker(url: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./vectorWorker.ts', import.meta.url), { type: 'module' });
    const finish = () => worker.terminate();
    worker.onerror = (event) => { finish(); reject(new Error(event.message || 'Falha ao carregar os atributos vetoriais.')); };
    worker.onmessage = (event: MessageEvent<{ properties?: Record<string, unknown>[]; error?: string }>) => {
      finish();
      if (event.data.error) { reject(new Error(event.data.error)); return; }
      resolve(event.data.properties ?? []);
    };
    worker.postMessage({ url, dataProjection: 'EPSG:4674', mode: 'attributes' });
  });
}

const INITIAL_CENTER = fromLonLat([-42.6, -12.6]);
proj4.defs('EPSG:4674', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:31983', '+proj=utm +zone=23 +south +ellps=GRS80 +units=m +no_defs +type=crs');
register(proj4);
export const baseMapSources: Record<MapBaseMap, { url: string; attribution: string }> = {
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
  'osm-hot': { url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors · Humanitarian style' },
  opentopomap: { url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors · SRTM · OpenTopoMap' },
  cyclosm: { url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors · CyclOSM' },
  'esri-street': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), (c) OpenStreetMap contributors, and the GIS User Community' },
  'esri-topo': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Sources: Esri, USGS, NOAA' },
  'esri-imagery': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
  'esri-terrain': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Sources: Esri, USGS, NOAA' },
  'esri-natgeo': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri, National Geographic Society, Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, increment P Corp.' },
  'esri-relief': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Sources: Esri, USGS' },
};

// Firebase Hosting currently returns 200/full-body responses to byte-range requests.
// Keep one full COG response per URL; the same bytes also power pixel identification.
const fullGeoTiffFiles = new globalThis.Map<string, Promise<ArrayBuffer>>();
const parsedGeoTiffFiles = new globalThis.Map<string, ReturnType<typeof fromArrayBuffer>>();
function getFullGeoTiffBuffer(url: string, headers: Headers) {
  let file = fullGeoTiffFiles.get(url);
  if (!file) {
    const fullFileHeaders = new Headers(headers);
    fullFileHeaders.delete('Range');
    file = fetch(url, { headers: fullFileHeaders, cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    });
    fullGeoTiffFiles.set(url, file);
    file.catch(() => fullGeoTiffFiles.delete(url));
  }
  return file;
}
async function loadGeoTiff(url: string, requestHeaders: HeadersInit, signal: AbortSignal) {
  const headers = new Headers(requestHeaders);
  const range = headers.has('Range');
  if (!range) return fetch(url, { headers, signal, cache: 'force-cache' });
  const body = await getFullGeoTiffBuffer(url, headers);
  return new Response(body.slice(0), { status: 200, headers: { 'Content-Type': 'image/tiff' } });
}

async function getGeoTiffImage(url: string) {
  let file = parsedGeoTiffFiles.get(url);
  if (!file) {
    file = getFullGeoTiffBuffer(url, new Headers()).then((buffer) => fromArrayBuffer(buffer.slice(0)));
    parsedGeoTiffFiles.set(url, file);
    file.catch(() => parsedGeoTiffFiles.delete(url));
  }
  const tiff = await file;
  return { tiff, image: await tiff.getImage(0) };
}

function vectorStyle(layerId: string, custom?: VectorLayerStyle) {
  const isHydro = layerId === 'hidrografia';
  const isBasin = layerId === 'bacia-hidrografica-paramirim';
  const colors = ['#9e803b', '#7a9b55', '#855c9c', '#c06d4f', '#477f86', '#b5813f', '#678bba'];
  const hash = [...layerId].reduce((value, char) => value + char.charCodeAt(0), 0);
  const color = custom?.stroke ?? (isHydro ? '#168fce' : isBasin ? '#68710a' : colors[hash % colors.length]);
  return new Style({
    fill: new Fill({ color: custom?.fill ?? (isHydro || isBasin ? 'rgba(0,0,0,0)' : `${color}33`) }),
    stroke: new Stroke({ color, width: custom?.strokeWidth ?? (isHydro ? 1.7 : isBasin ? 2.6 : 1.35) }),
    image: new CircleStyle({ radius: custom?.pointRadius ?? 4, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1 }) }),
  });
}

function rasterRange(layer: MapLayerDefinition): RasterRange {
  const min = layer.range?.min ?? layer.statistics?.p2 ?? layer.statistics?.min ?? 0;
  const max = layer.range?.max ?? layer.statistics?.p98 ?? layer.statistics?.max ?? min + 1;
  return { min, max: Math.max(max, min + Math.max(Math.abs(min) * 1e-9, 1e-9)) };
}

export const rasterPaletteCatalog: Record<string, string[]> = {
  viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
  plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'],
  magma: ['#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'],
  cividis: ['#00204c', '#19376b', '#3b4f78', '#59667b', '#777e78', '#96966f', '#b6ae63', '#d7c653', '#f1df45', '#fee838'],
  turbo: ['#30123b', '#466be3', '#28bbec', '#32f298', '#a4fc3c', '#e1dd37', '#f9a51a', '#ee5713', '#c22603', '#7a0403'],
  terrain: ['#333399', '#2765a5', '#2c91a2', '#6caa72', '#b4bd55', '#e2c36a', '#c99555', '#a46a48', '#e3d9c7'],
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  'bu-gn': ['#f7fcfd', '#e5f5f9', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'],
  'bu-pu': ['#f7fcfd', '#e0ecf4', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#810f7c', '#4d004b'],
  'gn-bu': ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  greys: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'],
  reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
  oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
  'or-rd': ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#b30000', '#7f0000'],
  'pu-bu': ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858'],
  'pu-bu-gn': ['#fff7fb', '#ece2f0', '#d0d1e6', '#a6bddb', '#67a9cf', '#3690c0', '#02818a', '#016c59', '#014636'],
  'pu-rd': ['#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7', '#df65b0', '#e7298a', '#ce1256', '#980043', '#67001f'],
  purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
  'rd-pu': ['#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'],
  'yl-gn': ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529'],
  'yl-gn-bu': ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'],
  'yl-or-br': ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506'],
  'yl-or-rd': ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
  'rd-bu': ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#f7f7f7', '#92c5de', '#4393c3', '#2166ac', '#053061'],
  'pi-yg': ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'],
  'pr-gn': ['#40004b', '#762a83', '#9970ab', '#c2a5cf', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837', '#00441b'],
  'rd-gy': ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#ffffff', '#e0e0e0', '#bababa', '#878787', '#4d4d4d', '#1a1a1a'],
  spectral: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
  'br-bg': ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'],
  'pu-or': ['#2d004b', '#542788', '#8073ac', '#b2abd2', '#d8daeb', '#f7f7f7', '#fee0b6', '#fdb863', '#e08214', '#b35806', '#7f3b08'],
  'rd-yl-gn': ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'],
  'rd-yl-bu': ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'],
};

export function getRasterPalette(layer: Pick<MapLayerDefinition, 'styleDefault' | 'palette'>) {
  return rasterPaletteCatalog[layer.styleDefault?.palette ?? layer.palette ?? ''] ?? rasterPaletteCatalog.viridis!;
}

export const rasterPaletteOptions = [
  { value: 'viridis', label: 'Viridis · rampas QGIS' },
  { value: 'plasma', label: 'Plasma · rampas QGIS' },
  { value: 'inferno', label: 'Inferno · rampas QGIS' },
  { value: 'magma', label: 'Magma · rampas QGIS' },
  { value: 'cividis', label: 'Cividis · rampas QGIS' },
  { value: 'turbo', label: 'Turbo · rampas QGIS' },
  { value: 'terrain', label: 'Terrain · catálogo QGIS' },
  { value: 'blues', label: 'Blues · ColorBrewer' },
  { value: 'bu-gn', label: 'BuGn · ColorBrewer' },
  { value: 'bu-pu', label: 'BuPu · ColorBrewer' },
  { value: 'gn-bu', label: 'GnBu · ColorBrewer' },
  { value: 'greens', label: 'Greens · ColorBrewer' },
  { value: 'greys', label: 'Greys · ColorBrewer' },
  { value: 'reds', label: 'Reds · ColorBrewer' },
  { value: 'oranges', label: 'Oranges · ColorBrewer' },
  { value: 'or-rd', label: 'OrRd · ColorBrewer' },
  { value: 'pu-bu', label: 'PuBu · ColorBrewer' },
  { value: 'pu-bu-gn', label: 'PuBuGn · ColorBrewer' },
  { value: 'pu-rd', label: 'PuRd · ColorBrewer' },
  { value: 'purples', label: 'Purples · ColorBrewer' },
  { value: 'rd-pu', label: 'RdPu · ColorBrewer' },
  { value: 'yl-gn', label: 'YlGn · ColorBrewer' },
  { value: 'yl-gn-bu', label: 'YlGnBu · ColorBrewer' },
  { value: 'yl-or-br', label: 'YlOrBr · ColorBrewer' },
  { value: 'yl-or-rd', label: 'YlOrRd · ColorBrewer' },
  { value: 'rd-bu', label: 'RdBu · ColorBrewer divergente' },
  { value: 'pi-yg', label: 'PiYG · ColorBrewer divergente' },
  { value: 'pr-gn', label: 'PRGn · ColorBrewer divergente' },
  { value: 'rd-gy', label: 'RdGy · ColorBrewer divergente' },
  { value: 'spectral', label: 'Spectral · ColorBrewer divergente' },
  { value: 'br-bg', label: 'BrBG · ColorBrewer divergente' },
  { value: 'pu-or', label: 'PuOr · ColorBrewer divergente' },
  { value: 'rd-yl-gn', label: 'RdYlGn · ColorBrewer divergente' },
  { value: 'rd-yl-bu', label: 'RdYlBu · ColorBrewer divergente' },
] as const;

export function getRasterGradient(layer: Pick<MapLayerDefinition, 'styleDefault' | 'palette'>) {
  return `linear-gradient(90deg, ${getRasterPalette(layer).join(', ')})`;
}

function rasterStyle(layer: MapLayerDefinition) {
  const { min, max } = rasterRange(layer);
  const palette = getRasterPalette(layer);
  const classCount = Math.max(1, Math.min(palette.length, layer.styleDefault?.classCount ?? palette.length));
  const classColors = classCount === 1
    ? [palette[0]]
    : Array.from({ length: classCount }, (_, index) => palette[Math.round((index * (palette.length - 1)) / (classCount - 1))]);
  const band: unknown[] = ['band', 1];
  const transparentSample = ['any', ['==', band, 0], ['!=', band, band]];
  if (layer.styleDefault?.colorInterpolation === 'continuous') {
    const expression: unknown[] = ['interpolate', ['linear'], band, ['var', 'rangeMin'], classColors[0]];
    classColors.slice(1).forEach((color, index) => expression.push(['+', ['var', 'rangeMin'], ['*', ['-', ['var', 'rangeMax'], ['var', 'rangeMin']], (index + 1) / Math.max(1, classColors.length - 1)], color]));
    return { color: ['case', transparentSample, ['color', 0, 0, 0, 0], expression] as any, variables: { rangeMin: min, rangeMax: max } };
  }
  const expression: unknown[] = ['case', transparentSample, ['color', 0, 0, 0, 0]];
  classColors.slice(0, -1).forEach((color, index) => {
    const threshold = ['+', ['var', 'rangeMin'], ['*', ['-', ['var', 'rangeMax'], ['var', 'rangeMin']], (index + 1) / classColors.length]];
    expression.push(['<=', band, threshold], color);
  });
  expression.push(classColors[classColors.length - 1]);
  return { color: expression as any, variables: { rangeMin: min, rangeMax: max } };
}

function matchesFeatureFilter(properties: Record<string, unknown>, filter?: FeatureFilter | null) {
  if (!filter) return true;
  const raw = properties[filter.field];
  if (raw == null) return false;
  const left = typeof raw === 'number' ? raw : String(raw).toLocaleLowerCase();
  const right = typeof raw === 'number' ? Number(filter.value) : String(filter.value).toLocaleLowerCase();
  switch (filter.operator) {
    case 'equals': return left === right;
    case 'contains': return String(left).includes(String(right));
    case 'gt': return Number(left) > Number(right);
    case 'gte': return Number(left) >= Number(right);
    case 'lt': return Number(left) < Number(right);
    case 'lte': return Number(left) <= Number(right);
  }
}

export function MapCanvas({ layers = [], baseMap = 'osm', tool = 'identify', homeToken = 0, onMeasure, onFeatureSelect, onRasterRangeChange, onLayerFeatures, onMeasurementHistoryChange, clearMeasurementsToken = 0 }: MapCanvasProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const scaleControlTargetRef = useRef<HTMLDivElement>(null);
  const scaleStackRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const dataLayersRef = useRef(new globalThis.Map<string, RenderedDataLayer>());
  const layerDefinitionsRef = useRef(layers);
  const rasterRangesRef = useRef(new globalThis.Map<string, RasterRange>());
  const rasterSourcesRef = useRef(new globalThis.Map<string, GeoTIFF>());
  const identifyRequestRef = useRef(0);
  const initialExtentRef = useRef<import('ol/extent').Extent | null>(null);
  const callbackRef = useRef(onFeatureSelect);
  const measureCallbackRef = useRef(onMeasure);
  const rasterRangeCallbackRef = useRef(onRasterRangeChange);
  const layerFeaturesCallbackRef = useRef(onLayerFeatures);
  const toolRef = useRef(tool);
  const drawRef = useRef<Draw | null>(null);
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const measurementSourceRef = useRef<VectorSource | null>(null);
  const aliveRef = useRef(false);
  const [loadingLayer, setLoadingLayer] = useState<LayerLoadingStatus | null>(layers.length ? { title: layers[0]?.title ?? 'Camada', message: 'Preparando camada…' } : null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [scaleDenominator, setScaleDenominator] = useState(0);
  const [scaleCollapsed, setScaleCollapsed] = useState(false);
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementHistoryEntry[]>([]);
  const [measurementPanelCollapsed, setMeasurementPanelCollapsed] = useState(false);
  const measurementPanelDrag = useDraggableMapPanel<HTMLElement>();
  const measurementHistoryCallbackRef = useRef(onMeasurementHistoryChange);

  useEffect(() => { callbackRef.current = onFeatureSelect; measureCallbackRef.current = onMeasure; rasterRangeCallbackRef.current = onRasterRangeChange; layerFeaturesCallbackRef.current = onLayerFeatures; measurementHistoryCallbackRef.current = onMeasurementHistoryChange; layerDefinitionsRef.current = layers; }, [layers, onFeatureSelect, onMeasure, onRasterRangeChange, onLayerFeatures, onMeasurementHistoryChange]);

  useEffect(() => {
    if (!targetRef.current) return undefined;
    aliveRef.current = true;
    const map = new Map({
      target: targetRef.current,
      layers: [],
      view: new View({ center: INITIAL_CENTER, zoom: 6.5, minZoom: 3, maxZoom: 19 }),
      controls: [new ScaleLine({ target: scaleControlTargetRef.current ?? undefined, units: 'metric', bar: true, steps: 4, text: false, minWidth: 130 })],
    });
    const graticule = new Graticule({
      showLabels: true,
      lonLabelPosition: 1,
      latLabelPosition: 0,
      targetSize: 135,
      // Keep coarser intervals available when zooming out. Without 45° and
      // 90° steps, OpenLayers cannot find a suitable interval at small scales
      // and turns the graticule off entirely.
      intervals: [90, 45, 30, 20, 15, 10, 5, 2, 1, 0.5, 0.25],
      lonLabelStyle: new Text({ font: '700 10px Inter, sans-serif', textBaseline: 'top', fill: new Fill({ color: 'rgba(50,65,45,.82)' }), stroke: new Stroke({ color: 'rgba(255,255,255,.9)', width: 3 }), padding: [3, 3, 2, 3] }),
      latLabelStyle: new Text({ font: '700 10px Inter, sans-serif', textAlign: 'start', fill: new Fill({ color: 'rgba(50,65,45,.82)' }), stroke: new Stroke({ color: 'rgba(255,255,255,.9)', width: 3 }), padding: [2, 3, 2, 3] }),
      wrapX: false,
      strokeStyle: new Stroke({ color: 'rgba(60, 77, 58, .18)', width: 1, lineDash: [2, 5] }),
      zIndex: 25,
    });
    map.addLayer(graticule);
    const measurementSource = new VectorSource();
    const measurementLayer = new VectorLayer({
      source: measurementSource,
      zIndex: 100,
      properties: { id: 'measurements', title: 'Medições' },
      style: (feature) => {
        const label = feature?.get('measurement:label') as string | undefined;
        if (label) return new Style({
          image: new CircleStyle({ radius: 1, fill: new Fill({ color: 'rgba(0,0,0,0)' }), stroke: new Stroke({ color: 'rgba(0,0,0,0)' }) }),
          text: new Text({ text: label, font: '700 12px Inter, sans-serif', fill: new Fill({ color: '#fff' }), backgroundFill: new Fill({ color: 'rgba(29,38,23,.92)' }), backgroundStroke: new Stroke({ color: 'rgba(255,255,255,.9)', width: 1 }), padding: [5, 8, 5, 8], textAlign: 'center', overflow: true }),
        });
        return new Style({ fill: new Fill({ color: 'rgba(225,189,45,.18)' }), stroke: new Stroke({ color: '#bd9e1a', width: 3, lineDash: [8, 5] }), image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#bd9e1a' }), stroke: new Stroke({ color: '#fff', width: 2 }) }) });
      },
    });
    map.addLayer(measurementLayer);
    measureLayerRef.current = measurementLayer;
    measurementSourceRef.current = measurementSource;
    try {
      const stored = sessionStorage.getItem('sigparamirim-webgis-measurements-v1');
      const restored = stored ? JSON.parse(stored) as MeasurementHistoryEntry[] : [];
      if (Array.isArray(restored)) {
        restored.forEach((entry) => {
          if (!entry?.geometry || !Array.isArray(entry.vertices)) return;
          const feature = new GeoJSON().readFeature({ type: 'Feature', properties: { measurementId: entry.id }, geometry: entry.geometry }, { dataProjection: 'EPSG:4674', featureProjection: 'EPSG:3857' });
          if (!feature || Array.isArray(feature)) return;
          measurementSource.addFeature(feature);
          const geometry = feature.getGeometry();
          const coordinate = entry.kind === 'measure-area' && geometry instanceof Polygon
            ? geometry.getInteriorPoint().getCoordinates()
            : geometry instanceof LineString ? geometry.getCoordinateAt(.5) : null;
          if (coordinate) measurementSource.addFeature(new Feature({ geometry: new Point(coordinate), 'measurement:label': `${entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${entry.unit}` }));
        });
        setMeasurementHistory(restored);
        measurementHistoryCallbackRef.current?.(restored);
      }
    } catch { try { sessionStorage.removeItem('sigparamirim-webgis-measurements-v1'); } catch { /* private browsing */ } }
    mapRef.current = map;
    const updateScale = () => {
      const view = map.getView();
      const resolution = view.getResolution();
      const center = view.getCenter();
      if (!resolution || !center) return;
      const groundResolution = getPointResolution(view.getProjection(), resolution, center, 'm');
      setScaleDenominator(Math.round(groundResolution * 3779.527559));
    };
    const scaleKeys = [map.getView().on('change:resolution', updateScale), map.getView().on('change:center', updateScale)];
    updateScale();
    const handleClick = async (event: import('ol/MapBrowserEvent').default) => {
      if (toolRef.current !== 'identify') return;
      const requestId = ++identifyRequestRef.current;
      let selection: MapFeatureSelection | null = null;
      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        const properties = { ...feature.getProperties() } as Record<string, unknown>;
        delete properties.geometry;
        selection = { layerId: String(layer?.get('id') ?? ''), layerTitle: String(layer?.get('title') ?? 'Camada'), properties };
        return true;
    }, { layerFilter: (layer) => layer.get('kind') === 'vector' && layerDefinitionsRef.current.some((definition) => definition.id === layer.get('id') && definition.identifyEnabled !== false) });
      const rasters = [...layerDefinitionsRef.current].filter((definition) => definition.kind === 'raster' && definition.identifyEnabled && rasterSourcesRef.current.has(definition.id)).reverse();
      for (const definition of rasters) {
        try {
          const source = rasterSourcesRef.current.get(definition.id)!;
          const projection = source.getProjection();
          if (!projection) continue;
          const coordinate = transform(event.coordinate, 'EPSG:3857', projection);
          const { image } = await getGeoTiffImage(definition.url);
          const [originX, originY] = image.getOrigin();
          const [resolutionX, resolutionY] = image.getResolution();
          if (![originX, originY, resolutionX, resolutionY, coordinate[0], coordinate[1]].every(Number.isFinite) || !resolutionX || !resolutionY) continue;
          const pixelX = Math.floor((coordinate[0]! - originX!) / resolutionX!);
          const pixelY = Math.floor((coordinate[1]! - originY!) / resolutionY!);
          if (pixelX < 0 || pixelY < 0 || pixelX >= image.getWidth() || pixelY >= image.getHeight()) continue;
          const samples = await image.readRasters({ window: [pixelX, pixelY, pixelX + 1, pixelY + 1], samples: [0], interleave: true });
          const value = Number((samples as unknown as ArrayLike<number>)[0]);
          if (!Number.isFinite(value) || value === 0 || value === definition.noData) continue;
          selection = {
            layerId: definition.id,
            layerTitle: definition.title,
            properties: {
              'Valor do pixel': value.toLocaleString('pt-BR', { maximumFractionDigits: 5 }),
              Banda: '1',
              'Sistema de referência': projection.getCode(),
              'Coordenada X': coordinate[0]!.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
              'Coordenada Y': coordinate[1]!.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
              'Intervalo visualizado': `${rasterRange(definition).min.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} – ${rasterRange(definition).max.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`,
            },
          };
          break;
        } catch (reason) {
          if (aliveRef.current && requestId === identifyRequestRef.current) setError(`Não foi possível consultar o pixel de “${definition.title}”: ${reason instanceof Error ? reason.message : String(reason)}`);
        }
      }
      if (requestId !== identifyRequestRef.current) return;
      callbackRef.current?.(selection);
    };
    map.on('singleclick', handleClick);
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(targetRef.current);
    const mapTarget = targetRef.current;
    const handlePrintResize = () => {
      map.updateSize();
      map.renderSync();
    };
    mapTarget.addEventListener('webgis:print-resize', handlePrintResize);
    const renderCompleteKey = map.on('rendercomplete', () => {
      mapTarget.dispatchEvent(new Event('webgis:rendercomplete'));
    });
    const scaleControlTarget = scaleControlTargetRef.current;
    const observedScaleBars = new WeakSet<Element>();
    const scaleWidthObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.target.getBoundingClientRect().width;
        if (width > 0 && scaleStackRef.current) {
          // Observe the rendered bar itself, not its OpenLayers wrapper. The
          // wrapper can shrink to the card width while the inner bar keeps its
          // intrinsic width, which makes the bar protrude from the white card.
          // Include the scale-line and card padding so both remain enclosed.
          scaleStackRef.current.style.setProperty('--scale-width', `${Math.ceil(width + 32)}px`);
        }
      }
    });
    const observeScaleBar = () => {
      const scaleBar = scaleControlTarget?.querySelector<HTMLElement>('.ol-scale-bar');
      const scaleBarContent = scaleBar?.querySelector<HTMLElement>('.ol-scale-bar-inner');
      if (scaleBarContent && !observedScaleBars.has(scaleBarContent)) {
        observedScaleBars.add(scaleBarContent);
        scaleWidthObserver.observe(scaleBarContent);
      }
    };
    const scaleMarkupObserver = new MutationObserver(observeScaleBar);
    if (scaleControlTarget) scaleMarkupObserver.observe(scaleControlTarget, { childList: true, subtree: true });
    observeScaleBar();
    requestAnimationFrame(observeScaleBar);
    // Middle-button drag rotates around the map center, without taking over left-drag pan.
    const viewport = map.getViewport()!;
    let rotationPointerId: number | null = null;
    let previousAngle = 0;
    const pointerAngle = (event: PointerEvent) => {
      const rect = viewport.getBoundingClientRect();
      return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (rotationPointerId !== event.pointerId) return;
      const angle = pointerAngle(event);
      let delta = angle - previousAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      map.getView().setRotation(map.getView().getRotation() + delta);
      previousAngle = angle;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (rotationPointerId !== event.pointerId) return;
      rotationPointerId = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      setRotation(map.getView().getRotation());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      rotationPointerId = event.pointerId;
      previousAngle = pointerAngle(event);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };
    viewport.addEventListener('pointerdown', onPointerDown);
    const rotationKey = map.getView().on('change:rotation', () => setRotation(map.getView().getRotation()));
    requestAnimationFrame(() => map.updateSize());
    return () => {
      aliveRef.current = false;
      observer.disconnect();
      scaleWidthObserver.disconnect();
      scaleMarkupObserver.disconnect();
      mapTarget.removeEventListener('webgis:print-resize', handlePrintResize);
      unByKey(renderCompleteKey);
      viewport.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      unByKey(rotationKey);
      unByKey(scaleKeys);
      map.un('singleclick', handleClick);
      map.setTarget(undefined);
      mapRef.current = null;
      baseLayerRef.current = null;
      dataLayersRef.current.clear();
      rasterRangesRef.current.clear();
      rasterSourcesRef.current.clear();
      initialExtentRef.current = null;
      drawRef.current = null;
      measureLayerRef.current = null;
      measurementSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    toolRef.current = tool;
    if (drawRef.current) map.removeInteraction(drawRef.current);
    drawRef.current = null;
    measureCallbackRef.current?.(null);
    if (tool === 'identify') return;
    const source = measurementSourceRef.current;
    if (!source) return;
    const draw = new Draw({ source, type: tool === 'measure-length' ? 'LineString' : 'Polygon' });
    drawRef.current = draw;
    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      if (!geometry) return;
      const raw = tool === 'measure-length' ? getLength(geometry) : getArea(geometry);
      const kind = tool as MeasurementHistoryEntry['kind'];
      const measured = kind === 'measure-length'
        ? raw >= 1000 ? { value: raw / 1000, unit: 'km' as const } : { value: raw, unit: 'm' as const }
        : raw >= 1_000_000 ? { value: raw / 1_000_000, unit: 'km²' as const } : { value: raw, unit: 'm²' as const };
      const geographic = geometry.clone().transform('EPSG:3857', 'EPSG:4674');
      const rawVertices = kind === 'measure-length'
        ? (geographic as LineString).getCoordinates()
        : (geographic as Polygon).getCoordinates()[0]?.slice(0, -1) ?? [];
      const vertices = rawVertices.map(([longitude, latitude]) => [longitude, latitude] as [number, number]);
      const id = crypto.randomUUID();
      event.feature.set('measurementId', id, true);
      const geometryObject = new GeoJSON().writeGeometryObject(geometry, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4674' }) as Record<string, unknown>;
      const entry: MeasurementHistoryEntry = { id, kind, ...measured, vertices, geometry: geometryObject };
      const labelCoordinate = geometry instanceof Polygon ? geometry.getInteriorPoint().getCoordinates() : geometry instanceof LineString ? geometry.getCoordinateAt(.5) : null;
      if (labelCoordinate) source.addFeature(new Feature({ geometry: new Point(labelCoordinate), 'measurement:label': `${measured.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${measured.unit}` }));
      setMeasurementHistory((current) => {
        const next = [...current, entry];
        try { sessionStorage.setItem('sigparamirim-webgis-measurements-v1', JSON.stringify(next)); } catch { /* session storage may be unavailable */ }
        measurementHistoryCallbackRef.current?.(next);
        return next;
      });
      measureCallbackRef.current?.(measured);
    });
    map.addInteraction(draw);
    return () => { if (mapRef.current) mapRef.current.removeInteraction(draw); };
  }, [tool]);

  useEffect(() => {
    if (!clearMeasurementsToken) return;
    measurementSourceRef.current?.clear();
    setMeasurementHistory([]);
    try { sessionStorage.removeItem('sigparamirim-webgis-measurements-v1'); } catch { /* private browsing */ }
    measurementHistoryCallbackRef.current?.([]);
    measureCallbackRef.current?.(null);
  }, [clearMeasurementsToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const base = baseMapSources[baseMap];
    const layer = new TileLayer({ source: new XYZ({ url: base.url, attributions: base.attribution, crossOrigin: 'anonymous', maxZoom: 19, transition: 150 }), properties: { id: 'base-map', title: 'Mapa base' }, zIndex: 0 });
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
        rasterRangesRef.current.delete(id);
        rasterSourcesRef.current.delete(id);
        continue;
      }
      const definition = layers.find((item) => item.id === id);
      if (definition) {
        existing.setOpacity(definition.opacity ?? (definition.kind === 'raster' ? .82 : 1));
        if (definition.kind === 'raster' && existing instanceof WebGLTileLayer) {
          const range = rasterRange(definition);
          existing.updateStyleVariables({ rangeMin: range.min, rangeMax: range.max });
          const styleKey = JSON.stringify([definition.styleDefault?.palette ?? definition.palette ?? 'blue-sequential', definition.styleDefault?.classCount ?? 10, definition.styleDefault?.colorInterpolation ?? 'classified']);
          if (existing.get('webgis:raster-style-key') !== styleKey) {
            existing.setStyle(rasterStyle(definition));
            existing.set('webgis:raster-style-key', styleKey);
          }
          const previousRange = rasterRangesRef.current.get(definition.id);
          if (previousRange?.min !== range.min || previousRange.max !== range.max) {
            rasterRangesRef.current.set(definition.id, range);
            rasterRangeCallbackRef.current?.(definition.id, range);
          }
        } else if (definition.kind === 'vector' && existing instanceof VectorLayer) {
          const styleKey = JSON.stringify(definition.vectorStyle ?? null);
          if (existing.get('webgis:vector-style-key') !== styleKey) {
            const style = vectorStyle(definition.id, definition.vectorStyle);
            existing.setStyle((feature) => feature?.get('webgis:filtered') ? undefined : style);
            existing.set('webgis:vector-style-key', styleKey);
          }
          const filterKey = JSON.stringify(definition.featureFilter ?? null);
          if (existing.get('webgis:feature-filter-key') !== filterKey) {
            const rows: Record<string, unknown>[] = [];
            existing.getSource()?.forEachFeature((feature) => {
              const properties = { ...feature.getProperties() } as Record<string, unknown>;
              delete properties.geometry;
              const filtered = !matchesFeatureFilter(properties, definition.featureFilter);
              feature.set('webgis:filtered', filtered, true);
              if (!filtered) rows.push(properties);
            });
            existing.set('webgis:feature-filter-key', filterKey);
            layerFeaturesCallbackRef.current?.(definition.id, rows);
            existing.changed();
          }
        }
      }
    }
    const missing = layers.filter((definition) => !dataLayersRef.current.has(definition.id));
    let cancelled = false;
    const loadController = new AbortController();
    setLoadingLayer(missing.length > 0 ? { title: missing[0]?.title ?? 'Camada', message: 'Preparando camada…' } : null);
    setError(null);

    const create = async (definition: MapLayerDefinition) => {
      let rendered: RenderedDataLayer;
      if (definition.kind === 'raster') {
        setLoadingLayer({ title: definition.title, message: 'Abrindo raster…' });
        const source = new GeoTIFF({
          sources: [{ url: definition.url, ...(definition.noData === undefined ? {} : { nodata: definition.noData }), loader: loadGeoTiff }],
          normalize: false, convertToRGB: false,
          // OpenLayers' bilinear GeoTIFF resampling samples the configured 2×2 kernel.
          interpolate: definition.styleDefault?.resamplingMethod ? definition.styleDefault.resamplingMethod === 'bilinear' : true,
          // Firebase Hosting currently advertises byte ranges but answers Range requests with 200/full body.
          // These optimized COGs are <= 13 MiB; permit the full-file fallback so geotiff.js can decode them.
          sourceOptions: { maxRanges: 1, allowFullFile: true, cacheSize: 24 },
        });
        try {
          // Forces metadata/IFD loading before the layer is added, so HTTP/CRS failures reach the UI.
          await source.getView();
          rasterSourcesRef.current.set(definition.id, source);
        } catch (reason) {
          const detail = reason instanceof Error ? reason.message : String(reason);
          throw new Error(`${definition.title}: falha ao abrir o COG (${detail}).`);
        }
        rendered = new WebGLTileLayer({ source, opacity: definition.opacity ?? .82, style: rasterStyle(definition), properties: { id: definition.id, title: definition.title, kind: definition.kind }, zIndex: 10 });
        rendered.set('webgis:raster-style-key', JSON.stringify([definition.styleDefault?.palette ?? definition.palette ?? 'blue-sequential', definition.styleDefault?.classCount ?? 10, definition.styleDefault?.colorInterpolation ?? 'classified']));
        const range = rasterRange(definition);
        rasterRangesRef.current.set(definition.id, range);
        rasterRangeCallbackRef.current?.(definition.id, range);
        source.on('change', () => {
          if (source.getState() === 'error' && aliveRef.current) {
            setError(`Não foi possível decodificar o raster “${definition.title}”. Verifique a resposta HTTP do COG e a definição de CRS.`);
          }
        });
      } else {
        const requiresWorker = shouldProcessVectorInWorker(definition);
        let packedFeatures: PackedFeature[] | null = null;
        let features: Feature[] | null = null;
        setLoadingLayer({ title: definition.title, message: requiresWorker ? 'Baixando e processando dados em segundo plano…' : 'Lendo dados…' });
        if (requiresWorker) {
          packedFeatures = await readVectorInWorker(definition.url, definition.crs ?? 'EPSG:4674', loadController.signal);
        } else {
          const response = await fetch(definition.url, { headers: { Accept: 'application/geo+json, application/json' }, signal: loadController.signal, cache: 'force-cache' });
          if (!response.ok) throw new Error(`${definition.title}: resposta ${response.status}`);
          const document = await response.json() as Record<string, unknown>;
          if (cancelled || !aliveRef.current) return;
          features = new GeoJSON().readFeatures(document, { dataProjection: definition.crs ?? 'EPSG:4674', featureProjection: 'EPSG:3857' });
        }
        if (cancelled || !aliveRef.current) return;
        const featureCount = packedFeatures?.length ?? features?.length ?? 0;
        const rows: Record<string, unknown>[] = [];
        const vectorSource = new VectorSource({ wrapX: false });
        const batchSize = requiresWorker ? 200 : 600;
        let lastReportedProgress = -1;
        setLoadingLayer({ title: definition.title, message: 'Preparando feições para o mapa…', progress: 0 });
        for (let start = 0; start < featureCount; start += batchSize) {
          if (cancelled || !aliveRef.current) return;
          const end = Math.min(start + batchSize, featureCount);
          const batch: Feature[] = [];
          for (let index = start; index < end; index += 1) {
            const packed = packedFeatures?.[index];
            const feature = packed ? new Feature(packed.properties) : features?.[index];
            if (!feature) continue;
            if (packed?.geometry) feature.setGeometry(unpackGeometry(packed.geometry));
            if (packed?.id !== undefined) feature.setId(packed.id);
            const properties = { ...feature.getProperties() } as Record<string, unknown>;
            delete properties.geometry;
            feature.set('webgis:filtered', !matchesFeatureFilter(properties, definition.featureFilter), true);
            rows.push(properties);
            batch.push(feature);
          }
          vectorSource.addFeatures(batch);
          const progress = Math.round((end / Math.max(featureCount, 1)) * 100);
          if (progress === 100 || progress - lastReportedProgress >= 2) {
            lastReportedProgress = progress;
            setLoadingLayer({ title: definition.title, message: `Desenhando feições… ${end.toLocaleString('pt-BR')} de ${featureCount.toLocaleString('pt-BR')}`, progress });
          }
          // Give the browser a paint opportunity between batches, so the progress
          // indicator stays responsive while complex polygons are being indexed.
          if (end < featureCount) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
        layerFeaturesCallbackRef.current?.(definition.id, rows);
        const style = vectorStyle(definition.id, definition.vectorStyle);
        rendered = new VectorLayer({ properties: { id: definition.id, title: definition.title, kind: definition.kind, 'webgis:feature-filter-key': JSON.stringify(definition.featureFilter ?? null), 'webgis:vector-style-key': JSON.stringify(definition.vectorStyle ?? null) }, source: vectorSource, style: (feature) => feature?.get('webgis:filtered') ? undefined : style, opacity: definition.opacity ?? 1, renderBuffer: 96, updateWhileAnimating: false, updateWhileInteracting: false, zIndex: 20 });
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
    void (async () => {
      try {
        for (const definition of missing) {
          if (cancelled) return;
          await create(definition);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a camada.');
      } finally {
        if (!cancelled) setLoadingLayer(null);
      }
    })();
    return () => { cancelled = true; loadController.abort(); };
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
      <button type="button" onClick={() => mapRef.current?.getView().animate({ rotation: 0, duration: 180 })} aria-label="Orientar norte" title="Orientar norte"><span className="map-north-arrow" style={{ transform: `rotate(${-rotation}rad)` }}>N<i className="fa-solid fa-location-arrow" /></span></button>
    </div>
    <div ref={scaleStackRef} className={`map-scale-stack ${scaleCollapsed ? 'is-collapsed' : ''}`}>
      <button className="map-scale-toggle" type="button" aria-label={scaleCollapsed ? 'Expandir escalas do mapa' : 'Minimizar escalas do mapa'} aria-expanded={!scaleCollapsed} title={scaleCollapsed ? 'Expandir escalas' : 'Minimizar escalas'} onClick={() => setScaleCollapsed((current) => !current)}>
        <i className={`fa-solid ${scaleCollapsed ? 'fa-ruler-horizontal' : 'fa-minus'}`} aria-hidden="true" />
      </button>
      <div ref={scaleControlTargetRef} className="map-scale-line-target" aria-label="Barra de escala gráfica" />
      {scaleDenominator > 0 && <div className="map-scale-denominator" aria-label={`Escala numérica 1 para ${scaleDenominator.toLocaleString('pt-BR')}`}><small>Escala numérica</small><strong>1 : {scaleDenominator.toLocaleString('pt-BR')}</strong></div>}
    </div>
    <div className="map-canvas-hint" aria-hidden="true">Botão do meio + arrastar para girar</div>
    {measurementHistory.length > 0 && <aside ref={measurementPanelDrag.panelRef} style={measurementPanelDrag.style} className={`map-measure-history ${measurementPanelCollapsed ? 'is-minimized' : ''}`} aria-label="Histórico de medições">
      <header className="map-floating-panel-handle" {...measurementPanelDrag.dragHandleProps}><strong>Medições</strong><span>{measurementHistory.length}</span><button type="button" aria-label={measurementPanelCollapsed ? 'Expandir medições' : 'Minimizar medições'} aria-expanded={!measurementPanelCollapsed} onClick={() => setMeasurementPanelCollapsed((current) => !current)}><i className={`fa-solid ${measurementPanelCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} /></button></header>
      {!measurementPanelCollapsed && <div className="map-measure-history-content">{measurementHistory.slice(-5).reverse().map((entry, index) => <details key={entry.id} open={index === 0}>
        <summary><span>{entry.kind === 'measure-area' ? 'Área' : 'Distância'}</span><strong>{entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {entry.unit}</strong></summary>
        <ol>{entry.vertices.map(([longitude, latitude], vertexIndex) => <li key={`${entry.id}-${vertexIndex}`}><span>V{vertexIndex + 1}</span><code>{latitude.toFixed(5)}, {longitude.toFixed(5)}</code></li>)}</ol>
      </details>)}</div>}
    </aside>}
    <div className="map-attribution">{baseMapSources[baseMap].attribution}</div>
    {loadingLayer && <div className="map-canvas-feedback map-loading-card" role="status" aria-live="polite"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /><span className="map-loading-copy"><strong>{loadingLayer.title}</strong><small>{loadingLayer.message}</small>{loadingLayer.progress !== undefined && <span className="map-loading-progress" role="progressbar" aria-label={`Carregamento de ${loadingLayer.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadingLayer.progress}><span style={{ width: `${loadingLayer.progress}%` }} /></span>}</span></div>}
    {error && <div className="map-canvas-feedback is-error" role="alert"><i className="fa-solid fa-triangle-exclamation" /> {error}</div>}
  </div>;
}
