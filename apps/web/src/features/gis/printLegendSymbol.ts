export type VectorLegendSymbol = 'polygon' | 'line' | 'point' | 'unknown';

export function vectorGeometrySymbol(geometryTypes?: Record<string, number>): VectorLegendSymbol {
  if (!geometryTypes) return 'unknown';
  const counts: Record<Exclude<VectorLegendSymbol, 'unknown'>, number> = {
    polygon: (geometryTypes.Polygon ?? 0) + (geometryTypes.MultiPolygon ?? 0),
    line: (geometryTypes.LineString ?? 0) + (geometryTypes.MultiLineString ?? 0),
    point: (geometryTypes.Point ?? 0) + (geometryTypes.MultiPoint ?? 0),
  };
  return (Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count > 0)?.[0] ?? 'unknown') as VectorLegendSymbol;
}
