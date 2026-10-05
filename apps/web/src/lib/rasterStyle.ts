export type RasterClass = {
  index: number;
  minimum: number;
  maximum: number;
  includesMaximum: boolean;
  label: string;
};

type EqualIntervalOptions = {
  minimum: number;
  maximum: number;
  classCount?: number;
  precision?: number;
  suffix?: string;
  locale?: string;
};

export function buildEqualIntervalClasses({
  minimum,
  maximum,
  classCount = 10,
  precision = 2,
  suffix = '',
  locale = 'pt-BR',
}: EqualIntervalOptions): RasterClass[] {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    throw new Error('Os limites do raster devem ser números finitos.');
  }

  if (!Number.isInteger(classCount) || classCount < 1) {
    throw new Error('A quantidade de classes deve ser um inteiro positivo.');
  }

  if (maximum < minimum) {
    throw new Error('O valor máximo não pode ser menor que o valor mínimo.');
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  const normalizedSuffix = suffix.trim();
  const format = (value: number) => `${formatter.format(value)}${normalizedSuffix ? ` ${normalizedSuffix}` : ''}`;

  if (maximum === minimum) {
    return [{
      index: 0,
      minimum,
      maximum,
      includesMaximum: true,
      label: format(minimum),
    }];
  }

  const interval = (maximum - minimum) / classCount;
  return Array.from({ length: classCount }, (_, index) => {
    const classMinimum = minimum + interval * index;
    const classMaximum = index === classCount - 1 ? maximum : minimum + interval * (index + 1);
    return {
      index,
      minimum: classMinimum,
      maximum: classMaximum,
      includesMaximum: index === classCount - 1,
      label: `${format(classMinimum)}–${format(classMaximum)}`,
    };
  });
}

