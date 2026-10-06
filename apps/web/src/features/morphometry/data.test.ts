import { describe, expect, it } from 'vitest';
import {
  formatMetric,
  morphometryDataset,
  narrativeMetric,
  narrativeMetricIds,
  scientificReferences,
} from './data';
import narrativeSource from '../../../../../data/morphometry/narrative.generated.json';

describe('dados narrativos morfométricos', () => {
  it('não permite indicador pendente de revisão na narrativa', () => {
    for (const id of narrativeMetricIds) {
      const metric = narrativeMetric(id);
      expect(metric.reviewStatus).not.toBe('needs_review');
      expect(metric).not.toHaveProperty('sourceInterpretation');
    }
    expect(morphometryDataset.narrativePolicy.sourceInterpretationAllowed).toBe(false);
    expect(narrativeSource.metrics.every((metric) => !('sourceInterpretation' in metric))).toBe(true);
    expect(narrativeSource.metrics.every((metric) => metric.reviewStatus !== 'needs_review')).toBe(true);
  });

  it('resolve os valores a partir do JSON canônico', () => {
    expect(narrativeMetric('basin_area').value).toBe(17070.32);
    expect(narrativeMetric('relief').derivedValue).toBe(1622);
    expect(morphometryDataset.source.rowCount).toBe(55);
  });

  it('formata valores no padrão brasileiro com unidade', () => {
    expect(formatMetric(narrativeMetric('basin_area'))).toBe('17.070,32 km²');
    expect(formatMetric(narrativeMetric('relief'))).toBe('1.622 m');
  });

  it('mantém DOI explícito em todas as referências publicadas', () => {
    expect(scientificReferences).toHaveLength(6);
    for (const reference of scientificReferences) {
      expect(reference.doi).toMatch(/^10\./);
      expect(reference.url).toContain('doi.org/10.');
    }
  });
});
