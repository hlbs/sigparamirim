import Geometry from 'ol/geom/Geometry.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import type { GeometryLayout } from 'ol/geom/Geometry.js';

export type PackedGeometry = { type: string; layout: string; coordinates?: ArrayBuffer; ends?: number[]; endss?: number[][]; geometries?: PackedGeometry[] };

export function packGeometry(geometry: Geometry, transfers: Transferable[]): PackedGeometry {
  if (geometry instanceof GeometryCollection) {
    return { type: 'GeometryCollection', layout: 'XY', geometries: geometry.getGeometries().map((child) => packGeometry(child, transfers)) };
  }
  if (!(geometry instanceof SimpleGeometry)) throw new Error(`Geometria não suportada: ${geometry.getType()}`);
  const coordinates = Float64Array.from(geometry.getFlatCoordinates());
  transfers.push(coordinates.buffer);
  const packed: PackedGeometry = { type: geometry.getType(), layout: geometry.getLayout(), coordinates: coordinates.buffer };
  if (geometry instanceof Polygon || geometry instanceof MultiLineString) packed.ends = geometry.getEnds();
  if (geometry instanceof MultiPolygon) packed.endss = geometry.getEndss();
  return packed;
}

export function unpackGeometry(packed: PackedGeometry): Geometry {
  if (packed.type === 'GeometryCollection') return new GeometryCollection((packed.geometries ?? []).map(unpackGeometry));
  const coordinates = new Float64Array(packed.coordinates ?? new ArrayBuffer(0));
  // OL stores flat coordinates as number[] internally and uses indexed access;
  // retaining this transferred buffer avoids a large extra copy on the UI thread.
  const flatCoordinates = coordinates as unknown as number[];
  const layout = packed.layout as GeometryLayout;
  switch (packed.type) {
    case 'Point': return new Point(flatCoordinates, layout);
    case 'MultiPoint': return new MultiPoint(flatCoordinates, layout);
    case 'LineString': return new LineString(flatCoordinates, layout);
    case 'MultiLineString': return new MultiLineString(flatCoordinates, layout, packed.ends);
    case 'Polygon': return new Polygon(flatCoordinates, layout, packed.ends);
    case 'MultiPolygon': return new MultiPolygon(flatCoordinates, layout, packed.endss);
    default: throw new Error(`Tipo geométrico vetorial não suportado: ${packed.type}`);
  }
}
