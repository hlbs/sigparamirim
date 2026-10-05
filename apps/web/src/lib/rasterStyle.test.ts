import { describe, expect, it } from 'vitest';
import { buildEqualIntervalClasses } from './rasterStyle';

describe('buildEqualIntervalClasses', () => {
  it('cria dez classes contíguas de intervalo igual por padrão', () => {
    const classes = buildEqualIntervalClasses({ minimum: 0, maximum: 100, suffix: 'm' });

    expect(classes).toHaveLength(10);
    expect(classes[0]).toMatchObject({ minimum: 0, maximum: 10, includesMaximum: false });
    expect(classes[9]).toMatchObject({ minimum: 90, maximum: 100, includesMaximum: true });
    expect(classes[0]?.label).toBe('0,00 m–10,00 m');
  });

  it('mantém precisão interna e arredonda apenas o rótulo', () => {
    const classes = buildEqualIntervalClasses({ minimum: 0, maximum: 1, classCount: 3 });

    expect(classes[0]?.maximum).toBeCloseTo(1 / 3, 12);
    expect(classes[0]?.label).toBe('0,00–0,33');
  });

  it('gera uma única classe quando mínimo e máximo são iguais', () => {
    expect(buildEqualIntervalClasses({ minimum: 7, maximum: 7, suffix: 'm' })).toEqual([
      { index: 0, minimum: 7, maximum: 7, includesMaximum: true, label: '7,00 m' },
    ]);
  });

  it('rejeita limites invertidos e quantidade de classes inválida', () => {
    expect(() => buildEqualIntervalClasses({ minimum: 10, maximum: 0 })).toThrow();
    expect(() => buildEqualIntervalClasses({ minimum: 0, maximum: 10, classCount: 0 })).toThrow();
  });
});

