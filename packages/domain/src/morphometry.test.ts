import { describe, expect, it } from 'vitest';
import { calculateAuditableMorphometry } from './morphometry';

const source = {
  basin_area: 17070.32,
  perimeter: 1057.67,
  basin_length: 258.62,
  maximum_elevation: 2022,
  minimum_elevation: 400,
  mean_elevation: 735.96,
  main_channel_length: 386.54,
  main_channel_start_elevation: 979.89,
  main_channel_end_elevation: 409,
  total_channel_length: 2092.98,
  number_of_streams: 199,
};

describe('calculateAuditableMorphometry', () => {
  it('recalcula as relações geométricas e de drenagem a partir das entradas', () => {
    const result = calculateAuditableMorphometry(source);
    expect(result.basin_width.value).toBeCloseTo(66.005, 3);
    expect(result.relief.value).toBe(1622);
    expect(result.drainage_density.value).toBeCloseTo(0.12261, 5);
    expect(result.circularity_ratio.value).toBeCloseTo(0.19176, 5);
  });

  it('preserva a precisão do número de infiltração antes da apresentação', () => {
    const result = calculateAuditableMorphometry(source);
    expect(result.infiltration_number.value).toBeCloseTo(0.001429, 6);
    expect(result.infiltration_number.value).toBeGreaterThan(0);
  });

  it('falha quando uma entrada obrigatória não está disponível', () => {
    expect(() => calculateAuditableMorphometry({ ...source, basin_area: Number.NaN }))
      .toThrow('basin_area');
  });
});
