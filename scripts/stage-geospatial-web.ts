import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

type CatalogEntry = {
  id: string;
  title: string;
  group?: string;
  status: 'present' | 'planned';
  file?: string;
  crs?: string;
  featureCount?: number;
  geometryTypes?: Record<string, number>;
  width?: number;
  height?: number;
  bandCount?: number;
  dataType?: string;
  noData?: number;
  bbox?: number[];
  statistics?: { min?: number; max?: number };
  styleDefault?: Record<string, unknown>;
  source?: string;
  observation?: string;
  risks?: string[];
};

type CatalogDocument = { vectorLayers: CatalogEntry[]; plannedVectorLayers: CatalogEntry[]; rasterLayers: CatalogEntry[] };

const repoRoot = path.resolve(process.env.SIG_REPO_ROOT ?? process.cwd());
const sourceRoot = path.resolve(process.env.SIG_SOURCE_ROOT ?? path.join(repoRoot, '..', 'sig'));
const outputRoot = path.join(repoRoot, 'apps', 'web', 'public', 'geospatial');
const catalogPath = path.join(repoRoot, 'docs', 'catalogo-camadas-inicial.json');
const referencesSource = path.resolve(process.env.SIG_REFERENCES_CSV ?? path.join(repoRoot, '..', 'database', 'referencias_csv_geoambientais.csv'));

async function main(): Promise<void> {
  if (!existsSync(sourceRoot)) throw new Error(`Diretório SIG_SOURCE_ROOT não encontrado: ${sourceRoot}`);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as CatalogDocument;
  const present = [...catalog.vectorLayers, ...catalog.rasterLayers].filter((entry) => entry.status === 'present' && entry.file);
  await mkdir(path.join(outputRoot, 'layers'), { recursive: true });
  for (const entry of present) {
    const source = path.join(sourceRoot, entry.file as string);
    if (!existsSync(source)) throw new Error(`Arquivo do catálogo ausente: ${source}`);
    const target = path.join(outputRoot, 'layers', entry.file as string);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { force: true });
  }
  const runtimeLayers = [...catalog.vectorLayers, ...catalog.rasterLayers, ...catalog.plannedVectorLayers].map((entry) => ({
    ...entry,
    kind: entry.file?.toLowerCase().endsWith('.tif') ? 'raster' : 'vector',
    url: entry.file ? `/geospatial/layers/${entry.file.replaceAll('\\', '/')}` : null,
    visibleByDefault: entry.id === 'bacia-hidrografica-paramirim' || entry.id === 'hidrografia',
  }));
  await writeFile(path.join(outputRoot, 'catalog.json'), `${JSON.stringify({ version: '0.2.0', generatedAt: new Date().toISOString(), sourceRoot: 'sig/', layers: runtimeLayers }, null, 2)}\n`, 'utf8');
  if (existsSync(referencesSource)) await cp(referencesSource, path.join(outputRoot, 'references.csv'), { force: true });
  console.log(`Staged ${present.length} geospatial sources in ${path.relative(repoRoot, outputRoot)}.`);
}

void main();
