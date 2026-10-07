export type VectorGeometry = 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
export type RasterInterpolation = 'discrete' | 'continuous';
export type RasterResampling = 'nearest' | 'bilinear';

export type VectorStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  fillColor?: string;
  fillOpacity?: number;
  pointRadius?: number;
};

export type RasterStyle = {
  band: number;
  colorPalette: string[];
  colorInterpolation: RasterInterpolation;
  classificationMethod: 'equalInterval' | 'manual';
  classCount: number;
  manualBreaks?: number[];
  noDataValue?: number;
  resamplingMethod: RasterResampling;
  resamplingKernel: '1x1' | '2x2';
  labelPrecision: number;
  labelSuffix: string;
  unit?: string;
};

export * from './catalog.js';
