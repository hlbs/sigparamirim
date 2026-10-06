import type { MorphometryMetric } from '@sig-paramirim/domain';
import narrativeSource from '../../../../../data/morphometry/narrative.generated.json';
import validationSource from '../../../../../data/morphometry/validation-report.json';

type NarrativeDataset = {
  schemaVersion: number;
  source: { fileName: string; worksheet: string; sha256: string; rowCount: number };
  narrativePolicy: {
    mode: 'factual_source_attributed';
    allowedReviewStatuses: Array<'source_only' | 'verified'>;
    excludedReviewStatus: 'needs_review';
    sourceInterpretationAllowed: false;
  };
  metrics: NarrativeMetric[];
};

export type NarrativeMetric = Omit<MorphometryMetric, 'sourceInterpretation'>;

type ValidationReport = {
  summary: {
    metricCount: number;
    recalculatedCount: number;
    verifiedCount: number;
    needsReviewCount: number;
    missingUnitCount: number;
  };
  concentrationTime: {
    methodCount: number;
    minimumHours: number;
    medianHours: number;
    maximumHours: number;
    maxMinRatio: number;
    status: string;
  };
};

export const morphometryDataset = narrativeSource as unknown as NarrativeDataset;
export const morphometryValidation = validationSource as unknown as ValidationReport;

export const narrativeMetricIds = [
  'basin_area',
  'basin_length',
  'basin_width',
  'maximum_elevation',
  'minimum_elevation',
  'mean_elevation',
  'relief',
  'mean_basin_slope_percent',
  'main_channel_length',
  'main_channel_start_elevation',
  'main_channel_end_elevation',
  'main_channel_gradient',
  'main_channel_slope_endpoints',
  'total_channel_length',
  'drainage_density',
  'number_of_streams',
  'overland_flow_length',
  'form_factor',
  'elongation_ratio',
  'circularity_ratio',
  'compactness_coefficient',
] as const;

const metricIndex = new Map(morphometryDataset.metrics.map((metric) => [metric.id, metric]));

export function narrativeMetric(id: typeof narrativeMetricIds[number]): NarrativeMetric {
  const metric = metricIndex.get(id);
  if (!metric) throw new Error(`Indicador narrativo ausente: ${id}`);
  if (!morphometryDataset.narrativePolicy.allowedReviewStatuses.some((status) => status === metric.reviewStatus)) {
    throw new Error(`Indicador sem autorização científica para narrativa: ${id}`);
  }
  return metric;
}

export function formatMetric(metric: NarrativeMetric, digits = 2): string {
  const value = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(metric.value) ? 0 : Math.min(digits, 2),
    maximumFractionDigits: digits,
  }).format(metric.value);
  return metric.unit ? `${value} ${metric.unit}` : value;
}

export const scientificReferences = [
  {
    author: 'Horton, R. E.',
    year: 1932,
    title: 'Drainage-basin characteristics',
    doi: '10.1029/TR013i001p00350',
    url: 'https://doi.org/10.1029/TR013i001p00350',
  },
  {
    author: 'Horton, R. E.',
    year: 1945,
    title: 'Erosional development of streams and their drainage basins',
    doi: '10.1130/0016-7606(1945)56[275:EDOSAT]2.0.CO;2',
    url: 'https://doi.org/10.1130/0016-7606(1945)56%5B275:EDOSAT%5D2.0.CO;2',
  },
  {
    author: 'Schumm, S. A.',
    year: 1956,
    title: 'Evolution of drainage systems and slopes in badlands at Perth Amboy, New Jersey',
    doi: '10.1130/0016-7606(1956)67[597:EODSAS]2.0.CO;2',
    url: 'https://doi.org/10.1130/0016-7606(1956)67%5B597:EODSAS%5D2.0.CO;2',
  },
  {
    author: 'Strahler, A. N.',
    year: 1957,
    title: 'Quantitative analysis of watershed geomorphology',
    doi: '10.1029/TR038i006p00913',
    url: 'https://doi.org/10.1029/TR038i006p00913',
  },
  {
    author: 'Montgomery, D. R.; Dietrich, W. E.',
    year: 1989,
    title: 'Source areas, drainage density, and channel initiation',
    doi: '10.1029/WR025i008p01907',
    url: 'https://doi.org/10.1029/WR025i008p01907',
  },
  {
    author: 'Moussa, R.',
    year: 2003,
    title: 'On morphometric properties of basins, scale effects and hydrological response',
    doi: '10.1002/hyp.1114',
    url: 'https://doi.org/10.1002/hyp.1114',
  },
] as const;
