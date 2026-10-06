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
  concentrationTimeComparison: {
    mode: 'method_sensitivity_only';
    designUseAllowed: false;
    metrics: NarrativeMetric[];
  };
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
  'perimeter',
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
  'main_channel_sinuosity',
  'total_channel_length',
  'drainage_density',
  'stream_frequency',
  'drainage_texture',
  'drainage_intensity',
  'number_of_streams',
  'strahler_order',
  'mean_stream_length',
  'overland_flow_length',
  'channel_maintenance_constant',
  'form_factor',
  'elongation_ratio',
  'circularity_ratio',
  'compactness_coefficient',
  'ruggedness_number',
  'massivity_index',
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

export type ConcentrationTimeAssessment = 'scale_compatible' | 'extrapolated' | 'insufficient_metadata';

const concentrationContext = [
  { id: 'concentration_time_kirpich', method: 'Kirpich', assessment: 'extrapolated', context: 'Calibrada originalmente em pequenas bacias rurais; a área do Paramirim supera amplamente a faixa de origem.' },
  { id: 'concentration_time_kerby', method: 'Kerby', assessment: 'extrapolated', context: 'Representa sobretudo o escoamento inicial sobre a superfície e foi desenvolvida com comprimentos muito menores.' },
  { id: 'concentration_time_giandotti', method: 'Giandotti', assessment: 'scale_compatible', context: 'A faixa de calibração publicada, de 170 a 70.000 km², inclui a área da bacia; ainda requer validação regional.' },
  { id: 'concentration_time_temez', method: 'Témez', assessment: 'insufficient_metadata', context: 'Equação regional desenvolvida para condições espanholas; o relatório não documenta a variante nem os insumos adotados.' },
  { id: 'concentration_time_usda', method: 'USDA', assessment: 'insufficient_metadata', context: 'Métodos USDA/NRCS dependem de características como cobertura, retenção e trajetória de fluxo, ausentes no relatório.' },
  { id: 'concentration_time_passini', method: 'Passini', assessment: 'insufficient_metadata', context: 'O valor não pode ser reproduzido sem a fórmula, a convenção de unidades e a identificação inequívoca do método.' },
  { id: 'concentration_time_ventura_heras', method: 'Ventura–Heras', assessment: 'insufficient_metadata', context: 'O valor extremo sugere forte sensibilidade à formulação ou às unidades; faltam elementos para reproduzi-lo.' },
  { id: 'concentration_time_bransby_williams', method: 'Bransby–Williams', assessment: 'insufficient_metadata', context: 'Usa área, comprimento e declividade, mas precisa ter variante, unidades e domínio de aplicação confirmados.' },
  { id: 'concentration_time_johnstone_cross', method: 'Johnstone–Cross', assessment: 'extrapolated', context: 'A calibração publicada alcança cerca de 4.206 km²; o Paramirim possui mais de quatro vezes essa área.' },
  { id: 'concentration_time_clark', method: 'Clark', assessment: 'insufficient_metadata', context: 'O método de Clark exige parâmetros de translação e armazenamento; a origem do valor isolado não está documentada.' },
  { id: 'concentration_time_california_culverts', method: 'California Culverts', assessment: 'extrapolated', context: 'Desenvolvida para pequenas bacias montanhosas da Califórnia, muito diferentes da escala regional analisada.' },
] as const satisfies ReadonlyArray<{ id: string; method: string; assessment: ConcentrationTimeAssessment; context: string }>;

const concentrationIndex = new Map(
  morphometryDataset.concentrationTimeComparison.metrics.map((metric) => [metric.id, metric]),
);

export const concentrationTimeMethods = concentrationContext.map((method) => {
  const metric = concentrationIndex.get(method.id);
  if (!metric) throw new Error(`Estimativa de tempo de concentração ausente: ${method.id}`);
  return { ...method, value: metric.value, unit: metric.unit ?? 'h' };
});

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
  {
    author: 'Grimaldi, S. et al.',
    year: 2012,
    title: 'Time of concentration: a paradox in modern hydrology',
    doi: '10.1080/02626667.2011.644244',
    url: 'https://doi.org/10.1080/02626667.2011.644244',
  },
  {
    author: 'Almeida, I. K. et al.',
    year: 2017,
    title: 'Performance of methods for estimating the time of concentration in a watershed of a tropical region',
    doi: '10.1080/02626667.2017.1384549',
    url: 'https://doi.org/10.1080/02626667.2017.1384549',
  },
  {
    author: 'Fang, X. et al.',
    year: 2008,
    title: 'Time of concentration estimated using watershed parameters determined by automated and manual methods',
    doi: '10.1061/(ASCE)0733-9437(2008)134:2(202)',
    url: 'https://doi.org/10.1061/%28ASCE%290733-9437%282008%29134%3A2%28202%29',
  },
  {
    author: 'Michailidi, E. M. et al.',
    year: 2018,
    title: 'Timing the time of concentration: shedding light on a paradox',
    doi: '10.1080/02626667.2018.1450985',
    url: 'https://doi.org/10.1080/02626667.2018.1450985',
  },
  {
    author: 'Silveira, A. L. L.',
    year: 2005,
    title: 'Desempenho de fórmulas de tempo de concentração em bacias urbanas e rurais',
    doi: '10.21168/rbrh.v10n1.p5-29',
    url: 'https://doi.org/10.21168/rbrh.v10n1.p5-29',
  },
  {
    author: 'Shekar, P. R.; Mathew, A.',
    year: 2024,
    title: 'Morphometric analysis of watersheds: a comprehensive review of data sources, quality, and geospatial techniques',
    doi: '10.1016/j.wsee.2023.12.001',
    url: 'https://doi.org/10.1016/j.wsee.2023.12.001',
  },
  {
    author: 'Sophocleous, M.',
    year: 2002,
    title: 'Interactions between groundwater and surface water: the state of the science',
    doi: '10.1007/s10040-001-0170-8',
    url: 'https://doi.org/10.1007/s10040-001-0170-8',
  },
  {
    author: 'Luijendijk, E.',
    year: 2022,
    title: 'Transmissivity and groundwater flow exert a strong influence on drainage density',
    doi: '10.5194/esurf-10-1-2022',
    url: 'https://doi.org/10.5194/esurf-10-1-2022',
  },
] as const;
