import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogIssue, DerivationPlan, GeospatialIngestionManifest, GeospatialCatalogQualityReport } from '../packages/gis/src/catalog.js';

type CatalogEntry = {
  id: string;
  status: 'present' | 'planned';
  file?: string;
  sizeBytes?: number;
  featureCount?: number;
  risks?: string[];
};

type CatalogDocument = {
  vectorLayers: CatalogEntry[];
  plannedVectorLayers: CatalogEntry[];
  rasterLayers: CatalogEntry[];
};

const repoRoot = path.resolve(process.env.SIG_REPO_ROOT ?? process.cwd());
const catalogFile = path.join(repoRoot, 'docs', 'catalogo-camadas-inicial.json');
const qualityFile = path.join(repoRoot, 'docs', 'catalogo-camadas-quality.json');
const outputFile = path.join(repoRoot, 'docs', 'catalogo-ingestao-manifest.json');

function errorCodes(quality: GeospatialCatalogQualityReport, id: string): string[] {
  const layer = quality.layers.find((candidate) => candidate.id === id);
  return layer?.issues.filter((item: CatalogIssue) => item.severity === 'error').map((item: CatalogIssue) => item.code) ?? [];
}

function planVector(entry: CatalogEntry, quality: GeospatialCatalogQualityReport): DerivationPlan {
  const blockers = errorCodes(quality, entry.id);
  const size = entry.sizeBytes ?? 0;
  const features = entry.featureCount ?? 0;
  const format = size > 25 * 1024 * 1024 || features > 25_000 ? 'partitioned-geojson' : size > 8 * 1024 * 1024 || features > 10_000 ? 'geojson-worker' : 'geojson-direct';
  const outputPath = `data/geospatial/derived/${entry.id}/${format === 'partitioned-geojson' ? 'z{z}/x{x}/y{y}.geojson' : `${entry.id}.geojson`}`;
  return {
    id: entry.id,
    sourceFile: entry.file,
    sourceStatus: entry.status,
    publicationStatus: blockers.length > 0 ? 'blocked' : 'ready',
    format,
    outputPath,
    parameters: {
      immutableSource: true,
      parseInWorker: format !== 'geojson-direct',
      loadOnDemand: format !== 'geojson-direct',
      canonicalCrs: 'EPSG:4674',
      geometrySimplification: 'deferred-until-scale-policy',
    },
    blockers,
  };
}

function planRaster(entry: CatalogEntry, quality: GeospatialCatalogQualityReport): DerivationPlan {
  const blockers = errorCodes(quality, entry.id);
  return {
    id: entry.id,
    sourceFile: entry.file,
    sourceStatus: entry.status,
    publicationStatus: blockers.length > 0 ? 'blocked' : 'ready',
    format: 'cog',
    outputPath: `data/geospatial/derived/${entry.id}/${entry.id}.cog.tif`,
    parameters: {
      immutableSource: true,
      compression: 'DEFLATE',
      blockSize: 256,
      overviews: ['2x', '4x', '8x', '16x'],
      resampling: 'bilinear',
      noDataColor: 'transparent',
      classes: 10,
      interpolation: 'discrete',
      labelPrecision: 2,
    },
    blockers,
  };
}

function planPlanned(entry: CatalogEntry): DerivationPlan {
  return {
    id: entry.id,
    sourceFile: entry.file,
    sourceStatus: 'planned',
    publicationStatus: 'planned',
    parameters: { immutableSource: true },
    blockers: ['planned-layer'],
  };
}

async function main(): Promise<void> {
  const catalog = JSON.parse(await readFile(catalogFile, 'utf8')) as CatalogDocument;
  const quality = JSON.parse(await readFile(qualityFile, 'utf8')) as GeospatialCatalogQualityReport;
  const plans: DerivationPlan[] = [
    ...catalog.vectorLayers.map((entry) => planVector(entry, quality)),
    ...catalog.rasterLayers.map((entry) => planRaster(entry, quality)),
    ...catalog.plannedVectorLayers.map(planPlanned),
  ];
  const manifest: GeospatialIngestionManifest = {
    manifestVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    sourceCatalog: 'docs/catalogo-camadas-inicial.json',
    qualityReport: 'docs/catalogo-camadas-quality.json',
    immutableSourcePolicy: 'Os arquivos em sig/ são somente leitura; derivados recebem novo caminho, checksum e revisão.',
    plans,
  };
  await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const counts = plans.reduce<Record<'planned' | 'blocked' | 'ready', number>>((result, plan) => {
    result[plan.publicationStatus] += 1;
    return result;
  }, { planned: 0, blocked: 0, ready: 0 });
  console.log(`Ingestion manifest: ${counts.ready} ready, ${counts.blocked} blocked, ${counts.planned} planned.`);
  console.log(`Manifest: ${path.relative(repoRoot, outputFile)}`);
}

void main();
