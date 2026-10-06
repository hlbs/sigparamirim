export type MorphometryGroup =
  | 'geometry'
  | 'relief'
  | 'main_channel'
  | 'drainage_network'
  | 'shape_and_terrain'
  | 'concentration_time'
  | 'hypsometry';

export type MorphometryReviewStatus = 'source_only' | 'verified' | 'needs_review';

export interface MorphometryMetric {
  id: string;
  group: MorphometryGroup;
  labelPtBr: string;
  sourceLabel: string;
  value: number;
  unit: string | null;
  sourceCell: string;
  sourceInterpretation: string | null;
  reviewStatus: MorphometryReviewStatus;
  derivedValue?: number;
  derivation?: string;
  inputIds?: string[];
}

export type MorphometryValues = Record<string, number>;

export interface DerivedMorphometry {
  value: number;
  derivation: string;
  inputIds: string[];
}

const requireValue = (values: MorphometryValues, id: string): number => {
  const value = values[id];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Indicador obrigatório ausente ou inválido: ${id}`);
  }
  return value;
};

export function calculateAuditableMorphometry(values: MorphometryValues): Record<string, DerivedMorphometry> {
  const area = requireValue(values, 'basin_area');
  const perimeter = requireValue(values, 'perimeter');
  const basinLength = requireValue(values, 'basin_length');
  const maxElevation = requireValue(values, 'maximum_elevation');
  const minElevation = requireValue(values, 'minimum_elevation');
  const meanElevation = requireValue(values, 'mean_elevation');
  const channelLength = requireValue(values, 'main_channel_length');
  const channelStart = requireValue(values, 'main_channel_start_elevation');
  const channelEnd = requireValue(values, 'main_channel_end_elevation');
  const totalChannelLength = requireValue(values, 'total_channel_length');
  const streamCount = requireValue(values, 'number_of_streams');

  const drainageDensity = totalChannelLength / area;
  const streamFrequency = streamCount / area;
  const elevationDifference = channelStart - channelEnd;

  return {
    basin_width: { value: area / basinLength, derivation: 'A / Lb', inputIds: ['basin_area', 'basin_length'] },
    relief: { value: maxElevation - minElevation, derivation: 'Hmax - Hmin', inputIds: ['maximum_elevation', 'minimum_elevation'] },
    main_channel_gradient: { value: elevationDifference / channelLength, derivation: '(Hmontante - Hjusante) / Lc', inputIds: ['main_channel_start_elevation', 'main_channel_end_elevation', 'main_channel_length'] },
    main_channel_slope_endpoints: { value: elevationDifference / (channelLength * 1_000) * 100, derivation: '((Hmontante - Hjusante) / (Lc × 1.000)) × 100', inputIds: ['main_channel_start_elevation', 'main_channel_end_elevation', 'main_channel_length'] },
    drainage_density: { value: drainageDensity, derivation: 'Lt / A', inputIds: ['total_channel_length', 'basin_area'] },
    stream_frequency: { value: streamFrequency, derivation: 'Nu / A', inputIds: ['number_of_streams', 'basin_area'] },
    drainage_texture: { value: streamCount / perimeter, derivation: 'Nu / P', inputIds: ['number_of_streams', 'perimeter'] },
    drainage_intensity: { value: streamFrequency / drainageDensity, derivation: 'Fs / Dd', inputIds: ['stream_frequency', 'drainage_density'] },
    overland_flow_length: { value: 1 / (2 * drainageDensity), derivation: '1 / (2 × Dd)', inputIds: ['drainage_density'] },
    channel_maintenance_constant: { value: 1 / drainageDensity, derivation: '1 / Dd', inputIds: ['drainage_density'] },
    infiltration_number: { value: drainageDensity * streamFrequency, derivation: 'Dd × Fs', inputIds: ['drainage_density', 'stream_frequency'] },
    mean_stream_length: { value: totalChannelLength / streamCount, derivation: 'Lt / Nu', inputIds: ['total_channel_length', 'number_of_streams'] },
    form_factor: { value: area / basinLength ** 2, derivation: 'A / Lb²', inputIds: ['basin_area', 'basin_length'] },
    elongation_ratio: { value: (2 * Math.sqrt(area / Math.PI)) / basinLength, derivation: '(2 × √(A / π)) / Lb', inputIds: ['basin_area', 'basin_length'] },
    circularity_ratio: { value: (4 * Math.PI * area) / perimeter ** 2, derivation: '(4 × π × A) / P²', inputIds: ['basin_area', 'perimeter'] },
    compactness_coefficient: { value: perimeter / (2 * Math.sqrt(Math.PI * area)), derivation: 'P / (2 × √(π × A))', inputIds: ['perimeter', 'basin_area'] },
    fitness_ratio: { value: channelLength / perimeter, derivation: 'Lc / P', inputIds: ['main_channel_length', 'perimeter'] },
    ruggedness_number: { value: (maxElevation - minElevation) / 1_000 * drainageDensity, derivation: '(H / 1.000) × Dd', inputIds: ['relief', 'drainage_density'] },
    massivity_index: { value: meanElevation / area, derivation: 'Elevação média / A', inputIds: ['mean_elevation', 'basin_area'] },
  };
}
