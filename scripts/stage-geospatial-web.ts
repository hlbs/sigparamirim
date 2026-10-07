import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

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
  statistics?: { min?: number; max?: number; p2?: number; p98?: number };
  storage?: Record<string, unknown>;
};

type CatalogDocument = { vectorLayers: CatalogEntry[]; plannedVectorLayers: CatalogEntry[]; rasterLayers: CatalogEntry[] };

const repoRoot = path.resolve(process.env.SIG_REPO_ROOT ?? process.cwd());
const sourceRoot = path.resolve(process.env.SIG_SOURCE_ROOT ?? path.join(repoRoot, '..', 'sig'));
const outputRoot = path.join(repoRoot, 'apps', 'web', 'public', 'geospatial');
const catalogPath = path.join(repoRoot, 'docs', 'catalogo-camadas-inicial.json');
const referencesSource = path.resolve(process.env.SIG_REFERENCES_CSV ?? path.join(repoRoot, '..', 'database', 'referencias_csv_geoambientais.csv'));
const execFileAsync = promisify(execFile);

async function findGdalTranslate(): Promise<string> {
  const configured = process.env.GDAL_TRANSLATE;
  if (configured && existsSync(configured)) return configured;

  const executable = process.platform === 'win32' ? 'gdal_translate.exe' : 'gdal_translate';
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.join(directory, executable);
    if (existsSync(candidate)) return candidate;
  }

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    const qgisRoots = (await readdir(programFiles, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^QGIS\s/i.test(entry.name))
      .map((entry) => path.join(programFiles, entry.name))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const root of qgisRoots) {
      const candidate = path.join(root, 'bin', executable);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('GDAL gdal_translate não foi encontrado. Defina GDAL_TRANSLATE ou instale GDAL/QGIS antes de gerar os rasters web.');
}

async function createWebCog(input: string, output: string, noData: number | undefined, dataType: string | undefined, force: boolean): Promise<boolean> {
  if (!force && existsSync(output)) {
    const [sourceInfo, outputInfo] = await Promise.all([stat(input), stat(output)]);
    if (outputInfo.mtimeMs >= sourceInfo.mtimeMs) return false;
  }
  const gdalTranslate = await findGdalTranslate();
  const executableDirectory = path.dirname(gdalTranslate);
  const qgisRoot = path.dirname(executableDirectory);
  const env = { ...process.env, PATH: `${executableDirectory}${path.delimiter}${process.env.PATH ?? ''}` };
  const gdalDataCandidates = [path.join(qgisRoot, 'apps', 'gdal', 'share', 'gdal'), path.join(qgisRoot, 'share', 'gdal')];
  const projDataCandidates = [path.join(qgisRoot, 'apps', 'proj', 'share', 'proj'), path.join(qgisRoot, 'share', 'proj')];
  if (!env.GDAL_DATA) env.GDAL_DATA = gdalDataCandidates.find(existsSync);
  if (!env.PROJ_DATA && !env.PROJ_LIB) env.PROJ_DATA = projDataCandidates.find(existsSync);

  const temporary = output.replace(/\.tif$/i, `.tmp-${process.pid}.tif`);
  const args = ['-of', 'COG', '-co', 'COMPRESS=DEFLATE', '-co', 'LEVEL=6', '-co', `PREDICTOR=${dataType?.toLowerCase().includes('float') ? 'FLOATING_POINT' : 'STANDARD'}`, '-co', 'BLOCKSIZE=256', '-co', 'OVERVIEWS=AUTO', '-co', 'RESAMPLING=BILINEAR', '-co', 'NUM_THREADS=ALL_CPUS'];
  if (noData !== undefined) args.push('-a_nodata', String(noData));
  args.push(input, temporary);
  try {
    const { stdout, stderr } = await execFileAsync(gdalTranslate, args, { env, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.log(stderr.trim());
    await rm(output, { force: true });
    await rename(temporary, output);
    return true;
  } catch (error) {
    await rm(temporary, { force: true });
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao criar COG ${path.basename(output)} com interpolação bilinear: ${detail}`);
  }
}

async function copySourceIfChanged(input: string, output: string): Promise<boolean> {
  if (existsSync(output)) {
    const [sourceInfo, outputInfo] = await Promise.all([stat(input), stat(output)]);
    if (outputInfo.mtimeMs >= sourceInfo.mtimeMs && outputInfo.size === sourceInfo.size) return false;
  }
  await cp(input, output, { force: true });
  return true;
}

async function main(): Promise<void> {
  if (!existsSync(sourceRoot)) throw new Error(`Diretório SIG_SOURCE_ROOT não encontrado: ${sourceRoot}`);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as CatalogDocument;
  const present = [...catalog.vectorLayers, ...catalog.rasterLayers].filter((entry) => entry.status === 'present' && entry.file);
  await mkdir(path.join(outputRoot, 'layers'), { recursive: true });
  const runtimeUrls = new Map<string, string>();
  const forceCogRebuild = process.env.FORCE_COG_REBUILD === '1';
  let rebuiltRasters = 0;
  let reusedRasters = 0;
  let copiedVectors = 0;
  let reusedVectors = 0;
  for (const entry of present) {
    const source = path.join(sourceRoot, entry.file as string);
    if (!existsSync(source)) throw new Error(`Arquivo do catálogo ausente: ${source}`);
    const target = path.join(outputRoot, 'layers', entry.file as string);
    await mkdir(path.dirname(target), { recursive: true });
    if (entry.file?.toLowerCase().endsWith('.tif')) {
      const webFile = entry.file.replace(/\.tif$/i, '.cog.tif');
      const webTarget = path.join(outputRoot, 'layers', webFile);
      if (await createWebCog(source, webTarget, entry.noData, entry.dataType, forceCogRebuild)) rebuiltRasters += 1;
      else reusedRasters += 1;
      runtimeUrls.set(entry.id, `/geospatial/layers/${webFile.replaceAll('\\', '/')}`);
      // Do not ship a second, unoptimized copy of this raster in the public bundle.
      await rm(target, { force: true });
    } else {
      if (await copySourceIfChanged(source, target)) copiedVectors += 1;
      else reusedVectors += 1;
      runtimeUrls.set(entry.id, `/geospatial/layers/${entry.file.replaceAll('\\', '/')}`);
    }
  }
  const runtimeLayers = [...catalog.vectorLayers, ...catalog.rasterLayers, ...catalog.plannedVectorLayers].map((entry) => ({
    ...entry,
    kind: entry.file?.toLowerCase().endsWith('.tif') ? 'raster' : 'vector',
    url: runtimeUrls.get(entry.id) ?? null,
    webStorage: entry.file?.toLowerCase().endsWith('.tif') ? { format: 'COG', compression: 'DEFLATE', blockSize: 256, overviews: 'bilinear', interpolation: entry.styleDefault?.resamplingMethod ?? 'bilinear' } : undefined,
    visibleByDefault: entry.id === 'bacia-hidrografica-paramirim' || entry.id === 'hidrografia',
  }));
  await writeFile(path.join(outputRoot, 'catalog.json'), `${JSON.stringify({ version: '0.2.0', generatedAt: new Date().toISOString(), sourceRoot: 'sig/', layers: runtimeLayers }, null, 2)}\n`, 'utf8');
  if (existsSync(referencesSource)) await cp(referencesSource, path.join(outputRoot, 'references.csv'), { force: true });
  const rasterCount = catalog.rasterLayers.filter((entry) => entry.status === 'present').length;
  console.log(`Staged ${copiedVectors} copied / ${reusedVectors} cached vector sources and ${rebuiltRasters} rebuilt / ${reusedRasters} cached COG rasters in ${path.relative(repoRoot, outputRoot)}.${forceCogRebuild ? ' (force enabled)' : ''}`);
}

void main();
