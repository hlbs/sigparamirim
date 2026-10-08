export type VectorLoadMetadata = {
  sizeBytes?: number;
  featureCount?: number;
  geometryTypes?: Record<string, number>;
};

/** Route computationally heavy vector parsing away from the UI thread, independent of layer identity. */
export function shouldProcessVectorInWorker(layer: VectorLoadMetadata) {
  const polygonCount = (layer.geometryTypes?.Polygon ?? 0) + (layer.geometryTypes?.MultiPolygon ?? 0);
  return (layer.sizeBytes ?? 0) >= 8 * 1024 * 1024
    || (layer.featureCount ?? 0) >= 10_000
    || polygonCount >= 1_000;
}
