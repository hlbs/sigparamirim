import { describe, expect, it } from 'vitest';
import { isPublishable, summarizeCatalog, type LayerValidation } from '../packages/gis/src/catalog';

describe('geospatial catalog quality gate', () => {
  it('keeps planned layers out of publication', () => {
    const planned: LayerValidation = {
      id: 'planned-layer',
      status: 'planned',
      publishable: false,
      issues: [{ code: 'planned-layer', severity: 'info', message: 'planned' }],
    };
    expect(isPublishable(planned)).toBe(false);
    expect(summarizeCatalog([planned]).vectorPlanned).toBe(1);
  });

  it('blocks a present layer with a data-quality error', () => {
    const blocked: LayerValidation = {
      id: 'blocked-layer',
      file: 'layer.geojson',
      status: 'present',
      publishable: false,
      issues: [{ code: 'crs-missing', severity: 'error', message: 'CRS missing' }],
    };
    expect(isPublishable(blocked)).toBe(false);
    expect(summarizeCatalog([blocked])).toMatchObject({ blocked: 1, errors: 1, publishable: 0 });
  });

  it('allows a validated present layer without errors', () => {
    const valid: LayerValidation = {
      id: 'valid-layer',
      file: 'layer.geojson',
      status: 'present',
      publishable: true,
      issues: [{ code: 'web-optimization-pending', severity: 'warning', message: 'derivative pending' }],
    };
    expect(isPublishable(valid)).toBe(true);
    expect(summarizeCatalog([valid])).toMatchObject({ vectorPresent: 1, publishable: 1, warnings: 1, errors: 0 });
  });
});
