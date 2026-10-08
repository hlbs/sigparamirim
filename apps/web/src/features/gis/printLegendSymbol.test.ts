import { describe, expect, it } from 'vitest';
import { vectorGeometrySymbol } from './printLegendSymbol';

describe('vectorGeometrySymbol', () => {
  it('uses point symbols for point and multipoint layers', () => {
    expect(vectorGeometrySymbol({ Point: 24 })).toBe('point');
    expect(vectorGeometrySymbol({ MultiPoint: 24 })).toBe('point');
  });

  it('distinguishes polygon and line geometries', () => {
    expect(vectorGeometrySymbol({ MultiPolygon: 8 })).toBe('polygon');
    expect(vectorGeometrySymbol({ MultiLineString: 8 })).toBe('line');
  });

  it('uses the dominant geometry when a layer contains mixed types', () => {
    expect(vectorGeometrySymbol({ Point: 3, MultiPolygon: 7 })).toBe('polygon');
    expect(vectorGeometrySymbol()).toBe('unknown');
  });
});
