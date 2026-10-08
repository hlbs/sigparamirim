import proj4 from 'proj4';
import GeoJSON from 'ol/format/GeoJSON.js';
import { register } from 'ol/proj/proj4.js';
import { packGeometry, type PackedGeometry } from './vectorCodec';

proj4.defs('EPSG:4674', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:31983', '+proj=utm +zone=23 +south +ellps=GRS80 +units=m +no_defs +type=crs');
register(proj4);

type PackedFeature = { id?: number | string; properties: Record<string, unknown>; geometry: PackedGeometry | null };
type WorkerRequest = { url: string; dataProjection: string; mode?: 'features' | 'attributes' };
type WorkerResponse = { features?: PackedFeature[]; properties?: Record<string, unknown>[]; error?: string };

const transfers: Transferable[] = [];
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  transfers.length = 0;
  try {
    const response = await fetch(event.data.url, { headers: { Accept: 'application/geo+json, application/json' }, cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const document = await response.json() as Record<string, unknown>;
    if (event.data.mode === 'attributes') {
      const features = Array.isArray(document.features) ? document.features as Array<{ properties?: unknown }> : [];
      const properties = features.map((feature) => feature.properties && typeof feature.properties === 'object' ? feature.properties as Record<string, unknown> : {});
      workerScope.postMessage({ properties } satisfies WorkerResponse);
      return;
    }
    const features = new GeoJSON().readFeatures(document, { dataProjection: event.data.dataProjection, featureProjection: 'EPSG:3857' });
    const packed = features.map((feature): PackedFeature => {
      const properties = { ...feature.getProperties() } as Record<string, unknown>;
      delete properties.geometry;
      const geometry = feature.getGeometry();
      const id = feature.getId();
      return { ...(typeof id === 'string' || typeof id === 'number' ? { id } : {}), properties, geometry: geometry ? packGeometry(geometry, transfers) : null };
    });
    workerScope.postMessage({ features: packed } satisfies WorkerResponse, transfers);
  } catch (error) {
    workerScope.postMessage({ error: error instanceof Error ? error.message : String(error) } satisfies WorkerResponse);
  }
};
