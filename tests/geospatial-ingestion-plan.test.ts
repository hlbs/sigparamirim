import { describe, expect, it } from 'vitest';
import type { DerivationPlan } from '../packages/gis/src/catalog';

describe('geospatial ingestion plan contract', () => {
  it('uses worker-backed or partitioned derivatives for large vectors', () => {
    const plan: DerivationPlan = {
      id: 'vegetacao',
      sourceFile: 'recursos_naturais/vegetacao.geojson',
      sourceStatus: 'present',
      publicationStatus: 'blocked',
      format: 'partitioned-geojson',
      outputPath: 'data/geospatial/derived/vegetacao/z{z}/x{x}/y{y}.geojson',
      parameters: { parseInWorker: true, loadOnDemand: true },
      blockers: ['license-metadata-missing'],
    };
    expect(plan.format).toBe('partitioned-geojson');
    expect(plan.parameters.parseInWorker).toBe(true);
    expect(plan.blockers).toContain('license-metadata-missing');
  });

  it('keeps raster derivation blocked while NoData is unresolved', () => {
    const plan: DerivationPlan = {
      id: 'mde',
      sourceFile: 'tif/mde.tif',
      sourceStatus: 'present',
      publicationStatus: 'blocked',
      format: 'cog',
      outputPath: 'data/geospatial/derived/mde/mde.cog.tif',
      parameters: { classes: 10, interpolation: 'discrete', noDataColor: 'transparent' },
      blockers: ['nodata-semantics-unconfirmed'],
    };
    expect(plan.format).toBe('cog');
    expect(plan.parameters.noDataColor).toBe('transparent');
    expect(plan.publicationStatus).toBe('blocked');
  });
});
