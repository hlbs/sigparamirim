import { describe, expect, it } from 'vitest';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import Point from 'ol/geom/Point.js';
import SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import { packGeometry, unpackGeometry } from './vectorCodec';

function roundTrip<T extends import('ol/geom/Geometry.js').default>(geometry: T): T {
  const transfers: Transferable[] = [];
  const packed = packGeometry(geometry, transfers);
  expect(transfers.length).toBeGreaterThan(0);
  const restored = unpackGeometry(packed);
  expect(restored.getType()).toBe(geometry.getType());
  expect(restored.getExtent()).toEqual(geometry.getExtent());
  return restored as T;
}

function coordinateSnapshot(geometry: import('ol/geom/Geometry.js').default): unknown {
  if (geometry instanceof GeometryCollection) return geometry.getGeometries().map(coordinateSnapshot);
  if (geometry instanceof SimpleGeometry) return Array.from(geometry.getFlatCoordinates());
  return null;
}

describe('codec de geometrias vetoriais em worker', () => {
  it('preserva coordenadas e limites de linhas múltiplas', () => {
    const geometry = new MultiLineString([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]);
    expect(coordinateSnapshot(roundTrip(geometry))).toEqual(coordinateSnapshot(geometry));
  });

  it('preserva anéis e partes de multipolígonos', () => {
    const geometry = new MultiPolygon([[[[0, 0], [0, 2], [2, 2], [0, 0]]], [[[4, 4], [4, 6], [6, 6], [4, 4]]]]);
    expect(coordinateSnapshot(roundTrip(geometry))).toEqual(coordinateSnapshot(geometry));
  });

  it('preserva coleções geométricas e pontos sem coordenadas aninhadas no transporte', () => {
    const geometry = new GeometryCollection([new Point([10, 20]), new MultiLineString([[[1, 2], [3, 4]]])]);
    const restored = roundTrip(geometry);
    expect(coordinateSnapshot(restored)).toEqual(coordinateSnapshot(geometry));
  });
});
