export type LayerStatus = 'present' | 'planned' | 'staging' | 'published' | 'blocked';

export type CatalogIssueSeverity = 'error' | 'warning' | 'info';

export type CatalogIssue = {
  code: string;
  severity: CatalogIssueSeverity;
  message: string;
};

export type LayerValidation = {
  id: string;
  file?: string;
  status: LayerStatus;
  publishable: boolean;
  issues: CatalogIssue[];
  observed?: {
    bytes?: number;
    sha256?: string;
    featureCount?: number;
    geometryTypes?: Record<string, number>;
    crs?: string | null;
    bbox?: [number, number, number, number] | null;
    width?: number;
    height?: number;
    bandCount?: number;
    dataType?: string;
    noData?: number | null;
    compression?: number | null;
    rowsPerStrip?: number | null;
    internalOverviews?: boolean;
  };
};

export type GeospatialCatalogQualityReport = {
  generatedAt: string;
  sourceRoot: string;
  catalogVersion: string;
  summary: {
    vectorPresent: number;
    vectorPlanned: number;
    rasterPresent: number;
    publishable: number;
    blocked: number;
    warnings: number;
    errors: number;
  };
  layers: LayerValidation[];
  gate: {
    passed: boolean;
    blockedReasons: string[];
  };
};

export type DerivationFormat = 'geojson-direct' | 'geojson-worker' | 'partitioned-geojson' | 'cog';

export type DerivationPlan = {
  id: string;
  sourceFile?: string;
  sourceStatus: LayerStatus;
  publicationStatus: 'planned' | 'blocked' | 'ready';
  format?: DerivationFormat;
  outputPath?: string;
  parameters: Record<string, string | number | boolean | string[]>;
  blockers: string[];
};

export type GeospatialIngestionManifest = {
  manifestVersion: string;
  generatedAt: string;
  sourceCatalog: string;
  qualityReport: string;
  immutableSourcePolicy: string;
  plans: DerivationPlan[];
};

export function isPublishable(layer: LayerValidation): boolean {
  return layer.status !== 'planned' && layer.issues.every((issue) => issue.severity !== 'error');
}

export function summarizeCatalog(layers: LayerValidation[]): GeospatialCatalogQualityReport['summary'] {
  return layers.reduce(
    (summary, layer) => {
      if (layer.status === 'planned') summary.vectorPlanned += 1;
      else if (layer.file?.toLowerCase().endsWith('.tif')) summary.rasterPresent += 1;
      else summary.vectorPresent += 1;
      if (layer.publishable) summary.publishable += 1;
      if (!layer.publishable && layer.status !== 'planned') summary.blocked += 1;
      summary.warnings += layer.issues.filter((issue) => issue.severity === 'warning').length;
      summary.errors += layer.issues.filter((issue) => issue.severity === 'error').length;
      return summary;
    },
    { vectorPresent: 0, vectorPlanned: 0, rasterPresent: 0, publishable: 0, blocked: 0, warnings: 0, errors: 0 },
  );
}
