import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import readXlsxFile from 'read-excel-file/node';
import {
  calculateAuditableMorphometry,
  type MorphometryGroup,
  type MorphometryMetric,
} from '../packages/domain/src/morphometry';

type SourceDefinition = { id: string; labelPtBr: string };

const definitions: Record<string, SourceDefinition> = {
  'Basin Area (A)': { id: 'basin_area', labelPtBr: 'Área da bacia (A)' },
  'Perimeter (P)': { id: 'perimeter', labelPtBr: 'Perímetro (P)' },
  'Basin Length (Lb)': { id: 'basin_length', labelPtBr: 'Comprimento da bacia (Lb)' },
  'Basin Width (B)': { id: 'basin_width', labelPtBr: 'Largura da bacia (B)' },
  'Maximum Elevation': { id: 'maximum_elevation', labelPtBr: 'Elevação máxima' },
  'Minimum Elevation': { id: 'minimum_elevation', labelPtBr: 'Elevação mínima' },
  'Mean Elevation': { id: 'mean_elevation', labelPtBr: 'Elevação média' },
  'Relief (H)': { id: 'relief', labelPtBr: 'Amplitude altimétrica (H)' },
  'Mean Slope of the Basin (degrees)': { id: 'mean_basin_slope_degrees', labelPtBr: 'Declividade média da bacia (graus)' },
  'Mean Slope of the Basin (percent)': { id: 'mean_basin_slope_percent', labelPtBr: 'Declividade média da bacia (percentual)' },
  'Main Channel Length (Lc)': { id: 'main_channel_length', labelPtBr: 'Comprimento do canal principal (Lc)' },
  'Start Elevation (Main Channel)': { id: 'main_channel_start_elevation', labelPtBr: 'Elevação inicial do canal principal' },
  'End Elevation (Main Channel)': { id: 'main_channel_end_elevation', labelPtBr: 'Elevação final do canal principal' },
  'Main Channel Gradient': { id: 'main_channel_gradient', labelPtBr: 'Gradiente do canal principal' },
  'Main Channel Sinuosity': { id: 'main_channel_sinuosity', labelPtBr: 'Sinuosidade do canal principal' },
  'Main Channel Slope - Endpoints (S)': { id: 'main_channel_slope_endpoints', labelPtBr: 'Declividade do canal principal entre extremos (S)' },
  'Compensated Channel Slope (Linear Regression)': { id: 'compensated_channel_slope_lr', labelPtBr: 'Declividade compensada do canal por regressão linear' },
  'Compensated Channel Slope - LR (%)': { id: 'compensated_channel_slope_lr_percent', labelPtBr: 'Declividade compensada por regressão linear (percentual)' },
  'Compensated Channel Slope (Taylor-Schwartz)': { id: 'compensated_channel_slope_ts', labelPtBr: 'Declividade compensada do canal por Taylor–Schwartz' },
  'Compensated Channel Slope - TS (%)': { id: 'compensated_channel_slope_ts_percent', labelPtBr: 'Declividade compensada por Taylor–Schwartz (percentual)' },
  'Total Length of Channels (Lt)': { id: 'total_channel_length', labelPtBr: 'Comprimento total dos canais (Lt)' },
  'Drainage Density (Dd)': { id: 'drainage_density', labelPtBr: 'Densidade de drenagem (Dd)' },
  'Stream Frequency (Fs)': { id: 'stream_frequency', labelPtBr: 'Frequência de canais (Fs)' },
  'Drainage Texture (Dt)': { id: 'drainage_texture', labelPtBr: 'Textura de drenagem (Dt)' },
  'Drainage Intensity (Id)': { id: 'drainage_intensity', labelPtBr: 'Intensidade de drenagem (Id)' },
  'Length of Overland Flow (Lo)': { id: 'overland_flow_length', labelPtBr: 'Comprimento do escoamento superficial (Lo)' },
  'Constant of Channel Maintenance (C)': { id: 'channel_maintenance_constant', labelPtBr: 'Coeficiente de manutenção de canais (C)' },
  'Infiltration Number (If)': { id: 'infiltration_number', labelPtBr: 'Número de infiltração (If)' },
  'Stream Order (Strahler)': { id: 'strahler_order', labelPtBr: 'Ordem dos canais (Strahler)' },
  'Number of Streams (Nu)': { id: 'number_of_streams', labelPtBr: 'Número de segmentos de canais (Nu)' },
  'Mean Stream Length (Lm)': { id: 'mean_stream_length', labelPtBr: 'Comprimento médio dos canais (Lm)' },
  'Bifurcation Ratio (Rb)': { id: 'bifurcation_ratio', labelPtBr: 'Razão de bifurcação (Rb)' },
  'Junction Density': { id: 'junction_density', labelPtBr: 'Densidade de confluências' },
  'Form Factor (Ff) - Horton (1932)': { id: 'form_factor', labelPtBr: 'Fator de forma (Ff)' },
  'Elongation Ratio (Re) - Schumm (1956)': { id: 'elongation_ratio', labelPtBr: 'Razão de elongação (Re)' },
  'Circularity Ratio (Rc)': { id: 'circularity_ratio', labelPtBr: 'Índice de circularidade (Rc)' },
  'Compactness Coefficient of Gravelius (Kc)': { id: 'compactness_coefficient', labelPtBr: 'Coeficiente de compacidade de Gravelius (Kc)' },
  'Asymmetry Factor (Af)': { id: 'asymmetry_factor', labelPtBr: 'Fator de assimetria (Af)' },
  'Fitness Ratio (Rf)': { id: 'fitness_ratio', labelPtBr: 'Índice de conformação (Rf)' },
  'Ruggedness Number (Rn)': { id: 'ruggedness_number', labelPtBr: 'Índice de rugosidade (Rn)' },
  'Orographic Coefficient (Oc)': { id: 'orographic_coefficient', labelPtBr: 'Coeficiente orográfico (Oc)' },
  'Massivity Index': { id: 'massivity_index', labelPtBr: 'Índice de massividade' },
  'Storage Coefficient': { id: 'storage_coefficient', labelPtBr: 'Coeficiente de armazenamento' },
  'Hypsometric Integral (HI)': { id: 'hypsometric_integral', labelPtBr: 'Integral hipsométrica (HI)' },
};

const concentrationMethods = [
  'Kirpich', 'Kerby', 'Giandotti', 'Témez', 'USDA', 'Passini', 'Ventura-Heras',
  'Bransby-Williams', 'Johnstone-Cross', 'Clark', 'California Culverts',
];
for (const method of concentrationMethods) {
  definitions[`Time of Concentration - ${method} (Tc)`] = {
    id: `concentration_time_${method.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')}`,
    labelPtBr: `Tempo de concentração — ${method} (Tc)`,
  };
}

const normalizedUnits: Record<string, string> = {
  'm a.s.l.': 'm', degrees: '°', hours: 'h', dimensionless: 'adimensional',
};

const directInputIds = new Set([
  'basin_area', 'perimeter', 'basin_length', 'maximum_elevation', 'minimum_elevation',
  'mean_elevation', 'mean_basin_slope_degrees', 'mean_basin_slope_percent',
  'main_channel_length', 'main_channel_start_elevation', 'main_channel_end_elevation',
  'main_channel_sinuosity', 'total_channel_length', 'strahler_order', 'number_of_streams',
]);

function groupForRow(rowNumber: number): MorphometryGroup {
  if (rowNumber <= 5) return 'geometry';
  if (rowNumber <= 11) return 'relief';
  if (rowNumber <= 21) return 'main_channel';
  if (rowNumber <= 34) return 'drainage_network';
  if (rowNumber <= 44) return 'shape_and_terrain';
  if (rowNumber <= 55) return 'concentration_time';
  return 'hypsometry';
}

function argument(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
const inputArgument = argument('--source') ?? process.argv.slice(2).find((value) => !value.startsWith('--'));
if (!inputArgument) throw new Error('Informe a planilha com --source <arquivo.xlsx>.');

const inputPath = resolve(inputArgument);
const outputDirectory = resolve(argument('--output') ?? 'data/morphometry');
const bytes = await readFile(inputPath);
const checksum = createHash('sha256').update(bytes).digest('hex').toUpperCase();
const workbook = await readXlsxFile(inputPath) as unknown as Array<{ sheet: string; data: unknown[][] }>;
const worksheet = workbook.find((sheet) => sheet.sheet === 'Planilha1');
if (!worksheet) throw new Error('A aba obrigatória "Planilha1" não foi encontrada.');

const [header, ...rows] = worksheet.data;
const validHeaders = [
  ['Parameter', 'Value', 'Unit', 'Interpreta'],
  ['Parameter', 'Value', 'Unit', 'Interpretation'],
];
if (!validHeaders.some((expectedHeader) => JSON.stringify(header) === JSON.stringify(expectedHeader))) {
  throw new Error(`Cabeçalho inesperado: ${JSON.stringify(header)}`);
}
if (rows.length !== 55) throw new Error(`Esperados 55 indicadores; encontrados ${rows.length}.`);

const metrics = rows.map((row, index): MorphometryMetric => {
  const [sourceLabel, rawValue, rawUnit, sourceInterpretation] = row;
  if (typeof sourceLabel !== 'string' || typeof rawValue !== 'number') {
    throw new Error(`Linha ${index + 2} possui parâmetro ou valor inválido.`);
  }
  const definition = definitions[sourceLabel];
  if (!definition) throw new Error(`Parâmetro sem mapeamento: ${sourceLabel}`);
  return {
    ...definition,
    group: groupForRow(index + 2),
    sourceLabel,
    value: rawValue,
    unit: typeof rawUnit === 'string' ? (normalizedUnits[rawUnit] ?? rawUnit) : null,
    sourceCell: `Planilha1!B${index + 2}`,
    sourceInterpretation: typeof sourceInterpretation === 'string' ? sourceInterpretation : null,
    reviewStatus: directInputIds.has(definition.id) ? 'source_only' : 'needs_review',
  };
});

const values = Object.fromEntries(metrics.map((metric) => [metric.id, metric.value]));
const derived = calculateAuditableMorphometry(values);
const comparisons: Array<Record<string, unknown>> = [];

for (const metric of metrics) {
  const calculation = derived[metric.id];
  if (!calculation) continue;
  const difference = Math.abs(metric.value - calculation.value);
  const precisionLoss = metric.id === 'infiltration_number' && metric.value === 0 && calculation.value > 0;
  const verified = difference <= 0.0051 && !precisionLoss;
  metric.reviewStatus = verified ? 'verified' : 'needs_review';
  metric.derivedValue = calculation.value;
  metric.derivation = calculation.derivation;
  metric.inputIds = calculation.inputIds;
  comparisons.push({
    id: metric.id,
    sourceValue: metric.value,
    recalculatedValue: calculation.value,
    absoluteDifference: difference,
    status: verified ? 'verified' : precisionLoss ? 'precision_loss' : 'divergent',
  });
}

const concentrationValues = metrics
  .filter((metric) => metric.group === 'concentration_time')
  .map((metric) => metric.value)
  .sort((a, b) => a - b);
const median = concentrationValues[Math.floor(concentrationValues.length / 2)];
const ratio = concentrationValues.at(-1)! / concentrationValues[0];
const missingUnitCells = metrics.filter((metric) => metric.unit === null).map((metric) => metric.sourceCell);

const canonical = {
  schemaVersion: 1,
  source: { fileName: basename(inputPath), worksheet: worksheet.sheet, sha256: checksum, rowCount: metrics.length },
  publicationStatus: 'blocked_pending_scientific_review',
  narrativePolicy: {
    mode: 'factual_source_attributed',
    allowedReviewStatuses: ['source_only', 'verified'],
    excludedReviewStatus: 'needs_review',
    sourceInterpretationAllowed: false,
  },
  metrics,
};
const narrative = {
  schemaVersion: 1,
  source: canonical.source,
  narrativePolicy: canonical.narrativePolicy,
  metrics: metrics
    .filter((metric) => metric.reviewStatus !== 'needs_review')
    .map(({ sourceInterpretation: _blockedInterpretation, ...metric }) => metric),
  concentrationTimeComparison: {
    mode: 'method_sensitivity_only',
    designUseAllowed: false,
    metrics: metrics
      .filter((metric) => metric.group === 'concentration_time')
      .map(({ sourceInterpretation: _blockedInterpretation, ...metric }) => metric),
  },
};
const validation = {
  schemaVersion: 1,
  sourceSha256: checksum,
  summary: {
    metricCount: metrics.length,
    recalculatedCount: comparisons.length,
    verifiedCount: comparisons.filter((item) => item.status === 'verified').length,
    needsReviewCount: metrics.filter((metric) => metric.reviewStatus === 'needs_review').length,
    missingUnitCount: missingUnitCells.length,
  },
  checks: comparisons,
  concentrationTime: {
    methodCount: concentrationValues.length,
    minimumHours: concentrationValues[0],
    medianHours: median,
    maximumHours: concentrationValues.at(-1),
    maxMinRatio: ratio,
    status: 'needs_review',
  },
  issues: [
    { severity: 'blocking', code: 'MISSING_METHOD_REFERENCES', message: 'A fonte não registra fórmulas, métodos, parâmetros intermediários ou referências com DOI.' },
    { severity: 'blocking', code: 'UNSUPPORTED_INTERPRETATIONS', message: 'As interpretações categóricas da fonte não possuem limiares nem referências verificáveis.' },
    { severity: 'warning', code: 'MISSING_UNITS', message: `${missingUnitCells.length} indicadores não possuem unidade explícita.`, sourceCells: missingUnitCells },
    { severity: 'warning', code: 'INFILTRATION_PRECISION_LOSS', message: 'O número de infiltração foi gravado como zero, mas o recálculo resulta em valor positivo.' },
    { severity: 'blocking', code: 'CONCENTRATION_TIME_DISPERSION', message: `As estimativas de Tc variam ${ratio.toFixed(2)} vezes entre o mínimo e o máximo e exigem avaliação de aplicabilidade.` },
    { severity: 'blocking', code: 'HYPSOMETRIC_METHOD_MISSING', message: 'A integral hipsométrica não pode ser reproduzida sem a curva ou o método utilizado.' },
  ],
};
const manifest = {
  schemaVersion: 1,
  sourceFile: basename(inputPath),
  worksheet: worksheet.sheet,
  sha256: checksum,
  canonicalData: 'morphometry.generated.json',
  narrativeData: 'narrative.generated.json',
  validationReport: 'validation-report.json',
  originalPreservedExternally: true,
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  writeFile(resolve(outputDirectory, 'morphometry.generated.json'), `${JSON.stringify(canonical, null, 2)}\n`, 'utf8'),
  writeFile(resolve(outputDirectory, 'narrative.generated.json'), `${JSON.stringify(narrative, null, 2)}\n`, 'utf8'),
  writeFile(resolve(outputDirectory, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`, 'utf8'),
]);

console.log(`Importação concluída: ${metrics.length} indicadores, ${comparisons.length} recálculos, ${missingUnitCells.length} unidades ausentes.`);
}

void main();
