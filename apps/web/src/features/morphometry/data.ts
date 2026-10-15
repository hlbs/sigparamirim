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
  { id: 'concentration_time_kirpich', method: 'Kirpich', assessment: 'extrapolated', formula: 'Tc = 0,0663 × L^0,77 × S^-0,385 (h)', parameters: 'L: percurso do canal (km); S: declividade do canal (m/m).', limit: 'Calibração: 0,005–0,453 km² e declividade de 3–10%.', context: 'Equação de pequenas bacias rurais do Tennessee; não representa o percurso superficial em toda a bacia. A área do Paramirim excede muito a calibração.' },
  { id: 'concentration_time_kerby', method: 'Kerby', assessment: 'extrapolated', formula: 'Tc = 1,44 × (N·L/√S)^0,467 (min)', parameters: 'N: retardamento da superfície; L: percurso superficial (m); S: declividade (m/m).', limit: 'Bacias < 4 ha; L ensaiado até 366 m; S média < 1%; N entre 0,02 e 0,80.', context: 'Estima sobretudo o escoamento superficial inicial; não deve ser lido como tempo de viagem pelo canal principal.' },
  { id: 'concentration_time_giandotti', method: 'Giandotti', assessment: 'scale_compatible', formula: 'Tc = (4√A + 1,5L) / (0,8√(Hm − H0)) (h)', parameters: 'A: área (km²); L: percurso principal (km); Hm e H0: altitude média e da saída (m).', limit: 'Sínteses consultadas: 170–70.000 km²; algumas recomendam uso acima de 100 km².', context: 'É a única equação deste conjunto cuja faixa de área publicada abrange os 17.070,32 km² da bacia. A faixa é de escala, não validação regional; conferir a variante e os insumos antes de qualquer uso de projeto.' },
  { id: 'concentration_time_temez', method: 'Témez', assessment: 'extrapolated', formula: 'Tc = 0,3 × (L/S^0,25)^0,76 (h)', parameters: 'L: percurso principal (km); S: declividade do canal (m/m).', limit: 'Faixa do método racional modificado: até 3.000 km² e Tc entre 0,25–24 h.', context: 'Desenvolvido para condições naturais/rurais da Espanha. A bacia excede a faixa de área da aplicação citada; não confundir a faixa do método completo com validação universal da equação.' },
  { id: 'concentration_time_usda', method: 'USDA SCS/NRCS (TR-55)', assessment: 'insufficient_metadata', formula: 'Tc = Σ tempos de percurso por segmento', parameters: 'Escoamento em lâmina (n, L, chuva e S), concentrado raso (velocidade) e canal (L/V).', limit: 'TR-55: Tc de 0,1–10 h, CN composto > 40, chuva uniforme; lâmina ≤ 91 m na edição de 1986.', context: 'Método segmentado, não uma fórmula única. Faltam CN, cobertura, trajetórias e velocidades para reproduzir o cálculo; deve ser montado por sub-bacia e caminho hidráulico.' },
  { id: 'concentration_time_passini', method: 'Passini', assessment: 'insufficient_metadata', formula: 'Tc = 0,108 × (A·L)^(1/3) × S^-0,5 (h)', parameters: 'A: área (km²); L: percurso (km); S: declividade (m/m).', limit: 'Literatura consultada descreve bacias rurais italianas, mas não confirma uma faixa numérica original.', context: 'A referência primária e a variante usadas não foram recuperadas. Resultado mantido apenas para auditoria; não é recomendação para a bacia.' },
  { id: 'concentration_time_ventura_heras', method: 'Ventura–Heras', assessment: 'insufficient_metadata', formula: 'Tc = 0,1272 × √(A/S) (h) — variante comum', parameters: 'A: área (km²); S: declividade (m/m). O coeficiente varia entre fontes.', limit: 'Domínio qualitativo rastreado: bacias rurais do vale do Pó; faixa numérica original não confirmada.', context: 'A forma “Heras” e o coeficiente dependem da compilação. Sem confirmar fonte, unidades e variante, o valor do relatório não é reproduzível.' },
  { id: 'concentration_time_bransby_williams', method: 'Bransby–Williams', assessment: 'extrapolated', formula: 'Tc ≈ 0,243 × L × A^-0,1 × S^-0,2 (h)', parameters: 'L: canal principal (km); A: área (km²); S: declividade do canal (m/m).', limit: 'Bacias rurais da Índia; limite citado: aproximadamente 130 km².', context: 'A área do Paramirim é muito superior à escala publicada. A unidade e a versão da fórmula também precisam ser conferidas antes de reaplicar.' },
  { id: 'concentration_time_johnstone_cross', method: 'Johnstone–Cross', assessment: 'extrapolated', formula: 'Tc = 0,0543 × √(L/S) (h)', parameters: 'L: percurso do canal (km); S: declividade do canal (m/m).', limit: '19 bacias de Ohio; aproximadamente 65–4.206 km².', context: 'A calibração publicada não alcança os 17.070,32 km² do Paramirim. O resultado é extrapolação, não valor recomendado.' },
  { id: 'concentration_time_clark', method: 'Clark', assessment: 'insufficient_metadata', formula: 'Não possui equação morfométrica autônoma para Tc.', parameters: 'Hidrograma unitário: Tc de entrada, histograma tempo-área e coeficiente de armazenamento R.', limit: 'Requer translação e armazenamento estimados ou calibrados; não há limite universal de área.', context: 'Clark transforma chuva efetiva em hidrograma. O “Tc” da planilha não é um resultado calculado pela equação de Clark e não deve ser comparado aos tempos empíricos.' },
  { id: 'concentration_time_california_culverts', method: 'California Culverts', assessment: 'extrapolated', formula: 'Tc = 0,87 × (L³/H)^0,385 (h; forma métrica comum)', parameters: 'L: canal (km); H: diferença de cotas (m).', limit: 'Pequenas bacias montanhosas; limite numérico de 40,47 km² citado em fontes secundárias.', context: 'A formulação é uma modificação de Kirpich para bueiros/canais. A faixa numérica não foi confirmada na fonte original e a escala local é muito maior.' },
] as const satisfies ReadonlyArray<{ id: string; method: string; assessment: ConcentrationTimeAssessment; formula: string; parameters: string; limit: string; context: string }>;

const concentrationIndex = new Map(
  morphometryDataset.concentrationTimeComparison.metrics.map((metric) => [metric.id, metric]),
);

export const concentrationTimeMethods = concentrationContext.map((method) => {
  const metric = concentrationIndex.get(method.id);
  if (!metric) throw new Error(`Estimativa de tempo de concentração ausente: ${method.id}`);
  return { ...method, value: metric.value, unit: metric.unit ?? 'h' };
});

/**
 * Única estimativa cuja faixa de calibração publicada contempla a escala
 * territorial do Paramirim. Isso é compatibilidade de escala, não calibração
 * hidrológica regional nem autorização automática para dimensionamento.
 */
export const compatibleConcentrationTime = concentrationTimeMethods.filter(
  (method) => method.assessment === 'scale_compatible',
);

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
  {
    author: 'Gomes, M. C. R. et al.',
    year: 2021,
    title: 'Análise geoquímica das águas subterrâneas no município de Boquira, no semiárido baiano',
    doi: '10.21715/GB2358-2812.2021351007',
    url: 'https://doi.org/10.21715/GB2358-2812.2021351007',
  },
  {
    author: 'Souza, M. D. B.; Santos, A. R.',
    year: 2024,
    title: 'O Território de Identidade Bacia do Paramirim: aspectos educacionais de um território em desenvolvimento',
    doi: '10.56839/bd.v34i1.a8',
    url: 'https://doi.org/10.56839/bd.v34i1.a8',
  },
  {
    author: 'Rocha, A. R. O.; Nogueira, E. M. S.',
    year: 2024,
    title: 'Construction of Decolonial Education in the Paramirim Basin: case study on Quilombola School Education',
    doi: '10.31496/rpd.v24i49.1639',
    url: 'https://doi.org/10.31496/rpd.v24i49.1639',
  },
  {
    author: 'Oliveira, G. G.; Marques, J. B.; Bomfim, E. P.',
    year: 2022,
    title: 'Mapeamento dos conflitos da mineração na Bahia',
    doi: '10.48075/amb.v4i1.28230',
    url: 'https://doi.org/10.48075/amb.v4i1.28230',
  },
  {
    author: 'Leopold, L. B.; Wolman, M. G.',
    year: 1957,
    title: 'River channel patterns: braided, meandering, and straight. U.S. Geological Survey Professional Paper 282-B, p. 39–85. Washington, D.C.',
    doi: '10.3133/pp282B',
    url: 'https://doi.org/10.3133/pp282B',
  },
  {
    author: 'Schumm, S. A.',
    year: 1963,
    title: 'A tentative classification of alluvial river channels. U.S. Geological Survey Circular 477. Washington, D.C.',
    doi: '10.3133/cir477',
    url: 'https://doi.org/10.3133/cir477',
  },
  {
    author: 'Daltro, R. R.',
    year: 2017,
    title: 'Impactos ambientais nos recursos hídricos por metais tóxicos: o caso do município de Boquira, no semiárido baiano. Dissertação (Mestrado em Geologia) — Instituto de Geociências, Universidade Federal da Bahia, Salvador.',
    doi: 'Dissertação de mestrado, UFBA',
    url: '',
  },
  {
    author: 'Agência Nacional de Águas e Saneamento Básico; Serviço Geológico do Brasil.',
    year: 2016,
    title: 'Disponibilidade hídrica dos sistemas aquíferos: mapa de áreas aflorantes e sistemas aquíferos do Brasil. SNIRH, serviço cartográfico.',
    doi: 'Serviço cartográfico ANA/CPRM',
    url: 'https://www.snirh.gov.br/arcgis/rest/services/SNIRH2016/Disponibilidade_hidrica_sistemas_aquiferos/MapServer',
  },
] as const;
