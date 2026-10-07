import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fromFile } from 'geotiff';
import type { CatalogIssue, GeospatialCatalogQualityReport, LayerValidation } from '../packages/gis/src/catalog.js';

type CatalogEntry = {
  id: string;
  status: 'present' | 'planned';
  file?: string;
  sha256?: string;
  sizeBytes?: number;
  featureCount?: number;
  geometryTypes?: Record<string, number>;
  crs?: string;
  source?: string;
  license?: string;
  noData?: number;
  width?: number;
  height?: number;
  bandCount?: number;
  dataType?: string;
  bbox?: number[];
  storage?: { compression?: string; rowsPerStrip?: number; internalOverviews?: boolean };
  risks?: string[];
};

type CatalogDocument = {
  catalogVersion: string;
  sourceRoot: string;
  vectorLayers: CatalogEntry[];
  plannedVectorLayers: CatalogEntry[];
  rasterLayers: CatalogEntry[];
};

const repoRoot = path.resolve(process.env.SIG_REPO_ROOT ?? process.cwd());
const catalogPath = path.join(repoRoot, 'docs', 'catalogo-camadas-inicial.json');
const defaultSourceRoot = path.resolve(repoRoot, '..', 'sig');
const defaultOutputPath = path.join(repoRoot, 'docs', 'catalogo-camadas-quality.json');

function issue(code: string, severity: CatalogIssue['severity'], message: string): CatalogIssue {
  return { code, severity, message };
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function geometryHasCoordinates(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (typeof value[0] === 'number') return value.length >= 2 && value.every((part) => typeof part === 'number' && Number.isFinite(part));
  return value.some(geometryHasCoordinates);
}

function geometryTypes(geometry: unknown, counts: Record<string, number>): void {
  if (!geometry || typeof geometry !== 'object') return;
  const candidate = geometry as { type?: unknown; geometries?: unknown };
  if (typeof candidate.type === 'string') counts[candidate.type] = (counts[candidate.type] ?? 0) + 1;
  if (candidate.type === 'GeometryCollection' && Array.isArray(candidate.geometries)) {
    for (const child of candidate.geometries) geometryTypes(child, counts);
  }
}

function collectCoordinatePairs(value: unknown, output: Array<[number, number]>): void {
  if (!Array.isArray(value) || value.length === 0) return;
  if (typeof value[0] === 'number' && typeof value[1] === 'number' && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    output.push([value[0], value[1]]);
    return;
  }
  for (const part of value) collectCoordinatePairs(part, output);
}

function observedBbox(features: unknown[]): [number, number, number, number] | null {
  const pairs: Array<[number, number]> = [];
  for (const feature of features) {
    if (!feature || typeof feature !== 'object') continue;
    const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
    collectCoordinatePairs(geometry?.coordinates, pairs);
  }
  if (pairs.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of pairs) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

function extractEpsg(geojson: unknown): string | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const crs = (geojson as { crs?: { properties?: { name?: unknown } } }).crs;
  const name = crs?.properties?.name;
  if (typeof name !== 'string') return null;
  const match = name.match(/EPSG(?::|::|\/)(\d+)/i);
  return match?.[1] ? `EPSG:${match[1]}` : name;
}

function compareNumbers(expected: number | undefined, observed: number | undefined): boolean {
  return expected === undefined || observed === undefined || expected === observed;
}

async function validateVector(entry: CatalogEntry, sourceRoot: string): Promise<LayerValidation> {
  const issues: CatalogIssue[] = [];
  const file = entry.file ? path.join(sourceRoot, entry.file) : undefined;
  if (!file || !existsSync(file)) {
    issues.push(issue('source-file-missing', 'error', 'Arquivo original não encontrado no diretório de ingestão.'));
    return { id: entry.id, file: entry.file, status: entry.status, publishable: false, issues };
  }

  const buffer = await readFile(file);
  const observed: LayerValidation['observed'] = { bytes: buffer.byteLength, sha256: sha256(buffer) };
  if (entry.sha256 && entry.sha256 !== observed.sha256) issues.push(issue('checksum-mismatch', 'error', 'SHA-256 diverge do catálogo; a revisão precisa ser registrada antes da publicação.'));
  if (!compareNumbers(entry.sizeBytes, observed.bytes)) issues.push(issue('size-mismatch', 'warning', 'Tamanho do arquivo diverge do inventário.'));

  let document: unknown;
  try {
    document = JSON.parse(buffer.toString('utf8')) as unknown;
  } catch {
    issues.push(issue('invalid-json', 'error', 'O arquivo não é um JSON válido.'));
    return { id: entry.id, file: entry.file, status: entry.status, publishable: false, issues, observed };
  }

  const collection = document as { type?: unknown; features?: unknown; crs?: unknown };
  const features = Array.isArray(collection.features) ? collection.features : [];
  if (collection.type !== 'FeatureCollection') issues.push(issue('not-feature-collection', 'error', 'A camada precisa ser uma GeoJSON FeatureCollection.'));
  if (!Array.isArray(collection.features)) issues.push(issue('features-missing', 'error', 'A propriedade features não é uma lista.'));
  const crs = extractEpsg(document);
  observed.featureCount = features.length;
  observed.crs = crs;
  observed.bbox = observedBbox(features);
  const types: Record<string, number> = {};
  const ids = new Set<string | number>();
  let nullGeometryCount = 0;
  let emptyGeometryCount = 0;
  for (const value of features) {
    if (!value || typeof value !== 'object') {
      issues.push(issue('invalid-feature', 'error', 'Foi encontrado um item que não é um objeto Feature.'));
      continue;
    }
    const feature = value as { id?: string | number; geometry?: { type?: unknown; coordinates?: unknown } | null };
    if (feature.id !== undefined) {
      if (ids.has(feature.id)) issues.push(issue('duplicate-feature-id', 'error', `ID de feição duplicado: ${String(feature.id)}.`));
      ids.add(feature.id);
    }
    if (feature.geometry === null || feature.geometry === undefined) {
      nullGeometryCount += 1;
      continue;
    }
    geometryTypes(feature.geometry, types);
    if (!geometryHasCoordinates(feature.geometry.coordinates)) emptyGeometryCount += 1;
  }
  observed.geometryTypes = types;
  if (entry.featureCount !== undefined && entry.featureCount !== features.length) issues.push(issue('feature-count-mismatch', 'error', `O catálogo informa ${entry.featureCount} feições, mas o arquivo contém ${features.length}.`));
  if (crs === null) issues.push(issue('crs-missing', 'error', 'CRS não declarado; publicação bloqueada.'));
  else if (entry.crs && crs !== entry.crs) issues.push(issue('crs-mismatch', 'error', `CRS observado ${crs} diverge do catálogo ${entry.crs}.`));
  if (nullGeometryCount > 0) issues.push(issue('null-geometry', 'error', `${nullGeometryCount} feições possuem geometria nula.`));
  if (emptyGeometryCount > 0) issues.push(issue('empty-geometry', 'error', `${emptyGeometryCount} feições possuem coordenadas vazias.`));
  if (!entry.license) issues.push(issue('license-metadata-missing', 'error', 'Licença/atribuição ainda não foi registrada no catálogo.'));
  if (entry.source?.toLowerCase().includes('não informado')) issues.push(issue('source-metadata-missing', 'error', 'Fonte não informada para esta camada.'));
  return { id: entry.id, file: entry.file, status: entry.status, publishable: issues.every((item) => item.severity !== 'error'), issues, observed };
}

async function validateRaster(entry: CatalogEntry, sourceRoot: string): Promise<LayerValidation> {
  const issues: CatalogIssue[] = [];
  const file = entry.file ? path.join(sourceRoot, entry.file) : undefined;
  if (!file || !existsSync(file)) {
    issues.push(issue('source-file-missing', 'error', 'Arquivo original não encontrado no diretório de ingestão.'));
    return { id: entry.id, file: entry.file, status: entry.status, publishable: false, issues };
  }
  const buffer = await readFile(file);
  const observed: LayerValidation['observed'] = { bytes: buffer.byteLength, sha256: sha256(buffer) };
  if (entry.sha256 && entry.sha256 !== observed.sha256) issues.push(issue('checksum-mismatch', 'error', 'SHA-256 diverge do catálogo; a revisão precisa ser registrada antes da publicação.'));
  try {
    const tiff = await fromFile(file);
    const image = await tiff.getImage();
    const fields = image.fileDirectory.actualizedFields;
    const compression = Number(fields.get(259) ?? 1);
    const rowsPerStrip = Number(fields.get(278) ?? 0);
    observed.width = image.getWidth();
    observed.height = image.getHeight();
    observed.bandCount = image.getSamplesPerPixel();
    observed.dataType = image.getBitsPerSample() === 32 ? 'float32' : image.getBitsPerSample() === 16 ? 'uint16' : `bits-${image.getBitsPerSample()}`;
    observed.noData = image.getGDALNoData();
    observed.compression = compression;
    observed.rowsPerStrip = rowsPerStrip;
    try {
      observed.internalOverviews = (await tiff.getImageCount()) > 1;
    } catch {
      observed.internalOverviews = false;
    }
    if (entry.width !== undefined && entry.width !== observed.width) issues.push(issue('width-mismatch', 'error', 'Largura raster diverge do catálogo.'));
    if (entry.height !== undefined && entry.height !== observed.height) issues.push(issue('height-mismatch', 'error', 'Altura raster diverge do catálogo.'));
    if (entry.bandCount !== undefined && entry.bandCount !== observed.bandCount) issues.push(issue('band-count-mismatch', 'error', 'Número de bandas diverge do catálogo.'));
    if (entry.noData !== undefined && entry.noData !== observed.noData) issues.push(issue('nodata-mismatch', 'error', 'Valor NoData observado diverge do catálogo.'));
    if (observed.noData === null || observed.noData === undefined) issues.push(issue('nodata-missing', 'error', 'NoData não está declarado.'));
  } catch (error) {
    issues.push(issue('raster-read-failed', 'error', `Não foi possível ler os metadados GeoTIFF: ${error instanceof Error ? error.message : String(error)}.`));
  }
  if (!entry.license) issues.push(issue('license-metadata-missing', 'error', 'Licença/atribuição ainda não foi registrada no catálogo.'));
  if (entry.source?.toLowerCase().includes('não informado')) issues.push(issue('source-metadata-missing', 'error', 'Fonte não informada para este raster.'));
  if (entry.risks?.some((risk) => risk.toLowerCase().includes('zero como nodata'))) issues.push(issue('nodata-semantics-unconfirmed', 'error', 'A semântica de zero como NoData ainda aguarda confirmação documental.'));
  if (entry.risks?.some((risk) => risk.toLowerCase().includes('unidade'))) issues.push(issue('raster-unit-unconfirmed', 'error', 'Unidade/significado do raster ainda aguarda confirmação documental.'));
  if (entry.risks?.some((risk) => risk.toLowerCase().includes('não otimizado'))) issues.push(issue('web-optimization-pending', 'warning', 'Raster original ainda não possui derivado otimizado para acesso web.'));
  return { id: entry.id, file: entry.file, status: entry.status, publishable: issues.every((item) => item.severity !== 'error'), issues, observed };
}

function reportSummary(layers: LayerValidation[]): GeospatialCatalogQualityReport['summary'] {
  return layers.reduce(
    (summary, layer) => {
      if (layer.status === 'planned') summary.vectorPlanned += 1;
      else if (layer.file?.toLowerCase().endsWith('.tif')) summary.rasterPresent += 1;
      else summary.vectorPresent += 1;
      if (layer.publishable) summary.publishable += 1;
      if (!layer.publishable && layer.status !== 'planned') summary.blocked += 1;
      summary.warnings += layer.issues.filter((item) => item.severity === 'warning').length;
      summary.errors += layer.issues.filter((item) => item.severity === 'error').length;
      return summary;
    },
    { vectorPresent: 0, vectorPlanned: 0, rasterPresent: 0, publishable: 0, blocked: 0, warnings: 0, errors: 0 },
  );
}

async function main(): Promise<void> {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as CatalogDocument;
  const sourceRoot = path.resolve(process.env.SIG_SOURCE_ROOT ?? defaultSourceRoot);
  const layers: LayerValidation[] = [];
  for (const entry of catalog.vectorLayers) layers.push(await validateVector(entry, sourceRoot));
  for (const entry of catalog.rasterLayers) layers.push(await validateRaster(entry, sourceRoot));
  for (const entry of catalog.plannedVectorLayers) {
    layers.push({ id: entry.id, file: entry.file, status: 'planned', publishable: false, issues: [issue('planned-layer', 'info', 'Camada planejada sem arquivo; não é publicada nesta fase.')] });
  }
  const summary = reportSummary(layers);
  const blockedReasons = layers.flatMap((layer) => layer.issues.filter((item) => item.severity === 'error').map((item) => `${layer.id}: ${item.code}`));
  const report: GeospatialCatalogQualityReport = {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(repoRoot, sourceRoot) || '.',
    catalogVersion: catalog.catalogVersion,
    summary,
    layers,
    gate: { passed: blockedReasons.length === 0, blockedReasons },
  };
  await writeFile(defaultOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Geospatial catalog: ${summary.vectorPresent} vetores, ${summary.rasterPresent} rasters, ${summary.vectorPlanned} planejadas.`);
  console.log(`Publishable: ${summary.publishable}; blocked: ${summary.blocked}; errors: ${summary.errors}; warnings: ${summary.warnings}.`);
  if (!report.gate.passed) {
    console.error(`Gate bloqueado por ${blockedReasons.length} achados. Relatório: ${path.relative(repoRoot, defaultOutputPath)}`);
    process.exitCode = 1;
  }
}

void main();
