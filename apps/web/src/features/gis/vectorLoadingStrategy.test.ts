import { describe, expect, it } from 'vitest';
import { shouldProcessVectorInWorker } from './vectorLoadingStrategy';

describe('shouldProcessVectorInWorker', () => {
  it('routes large files and high feature counts through the worker', () => {
    expect(shouldProcessVectorInWorker({ sizeBytes: 8 * 1024 * 1024 })).toBe(true);
    expect(shouldProcessVectorInWorker({ featureCount: 10_000 })).toBe(true);
  });

  it('routes complex polygon layers through the worker independent of their name or file size', () => {
    expect(shouldProcessVectorInWorker({ sizeBytes: 500_000, featureCount: 1_200, geometryTypes: { MultiPolygon: 1_200 } })).toBe(true);
    expect(shouldProcessVectorInWorker({ geometryTypes: { Polygon: 999 } })).toBe(false);
  });

  it('keeps small point and line layers on the lightweight path', () => {
    expect(shouldProcessVectorInWorker({ geometryTypes: { Point: 900 } })).toBe(false);
    expect(shouldProcessVectorInWorker({ geometryTypes: { MultiLineString: 900 } })).toBe(false);
  });
});
