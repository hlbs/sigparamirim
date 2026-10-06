import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  formatMetric,
  morphometryDataset,
  morphometryValidation,
  narrativeMetric,
  scientificReferences,
  type NarrativeMetric,
} from '../features/morphometry/data';

function MetricCard({ metric, digits = 2 }: { metric: NarrativeMetric; digits?: number }) {
  const verified = metric.reviewStatus === 'verified';
  return (
    <article className="story-metric-card">
      <span className={`metric-review ${verified ? 'verified' : 'source'}`}>
        {verified ? '✓ Cálculo conferido' : '○ Dado do estudo'}
      </span>
      <MetricValue metric={metric} digits={digits} />
      <span className="metric-label">{metric.labelPtBr}</span>
      <details>
        <summary>Conheça a origem do dado</summary>
        <p>Origem: {metric.sourceCell}</p>
        {metric.derivation && <p>Cálculo: {metric.derivation}</p>}
      </details>
    </article>
  );
}

function MetricValue({ metric, digits = 2 }: { metric: NarrativeMetric; digits?: number }) {
  const formatted = formatMetric(metric, digits);
  const [value, ...unitParts] = formatted.split(' ');
  return (
    <strong className="metric-value">
      <span>{value}</span>
      {unitParts.length > 0 && <small>{unitParts.join(' ')}</small>}
    </strong>
  );
}

function Citation({ references }: { references: number[] }) {
  return (
    <sup className="citation" aria-label={`Referências ${references.join(', ')}`}>
      {references.map((reference, index) => (
        <span key={reference}>
          {index > 0 && ', '}
          <a href={`#ref-${reference}`}>[{reference}]</a>
        </span>
      ))}
    </sup>
  );
}

function NarrativeSection({
  id,
  eyebrow,
  title,
  description,
  tone = 'surface',
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  tone?: 'surface' | 'soft' | 'brand';
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="story-section" data-tone={tone} aria-labelledby={`${id}-title`}>
      <div className="story-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="story-description">{description}</div>
      </div>
      <div className="story-visual">{children}</div>
    </section>
  );
}

export function HomePage() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.story-section'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const area = narrativeMetric('basin_area');
  const length = narrativeMetric('basin_length');
  const width = narrativeMetric('basin_width');
  const minimumElevation = narrativeMetric('minimum_elevation');
  const meanElevation = narrativeMetric('mean_elevation');
  const maximumElevation = narrativeMetric('maximum_elevation');
  const relief = narrativeMetric('relief');
  const slope = narrativeMetric('mean_basin_slope_percent');
  const channelLength = narrativeMetric('main_channel_length');
  const channelStart = narrativeMetric('main_channel_start_elevation');
  const channelEnd = narrativeMetric('main_channel_end_elevation');
  const channelGradient = narrativeMetric('main_channel_gradient');
  const channelSlope = narrativeMetric('main_channel_slope_endpoints');
  const totalChannels = narrativeMetric('total_channel_length');
  const streamCount = narrativeMetric('number_of_streams');
  const drainageDensity = narrativeMetric('drainage_density');
  const overlandFlow = narrativeMetric('overland_flow_length');
  const formFactor = narrativeMetric('form_factor');
  const elongation = narrativeMetric('elongation_ratio');
  const circularity = narrativeMetric('circularity_ratio');
  const compactness = narrativeMetric('compactness_coefficient');

  const elevationPosition = (value: number) => (
    ((value - minimumElevation.value) / (maximumElevation.value - minimumElevation.value)) * 100
  );

  return (
    <div className="home-story">
      <section className="story-hero" aria-labelledby="home-title">
        <div className="story-hero-copy">
          <span className="eyebrow">Bacia Hidrográfica do Rio Paramirim</span>
          <h1 id="home-title">Uma leitura territorial construída com dados rastreáveis.</h1>
          <p>
            Descubra como o relevo, a forma e a rede de drenagem ajudam a contar a história da Bacia do
            Rio Paramirim. Aqui, números ganham contexto sem perder o vínculo com a ciência que os sustenta.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#dimensao">Conhecer a bacia</a>
            <NavLink className="button button-secondary" to="/mapa">Abrir o WebGIS</NavLink>
          </div>
          <div className="story-audit-line">
            <strong>{morphometryValidation.summary.verifiedCount}</strong> cálculos conferidos
            <span aria-hidden="true">·</span>
            <strong>{morphometryDataset.source.rowCount}</strong> indicadores documentados
          </div>
        </div>
        <div className="story-hero-mark" aria-label="Identidade do SIG Paramirim">
          <img src="/sig-logo.png" alt="SIG Paramirim" />
          <span>Conheça a bacia</span>
          <small>Informação científica acessível e rastreável</small>
        </div>
      </section>

      <NarrativeSection
        id="dimensao"
        eyebrow="01 · Dimensão territorial"
        title="Escala e proporção da bacia"
        description={<>
          <p>
            A Bacia do Rio Paramirim ocupa {formatMetric(area)} e se estende por cerca de {formatMetric(length)} em
            seu eixo principal. Para visualizar melhor essas proporções, imagine uma largura média de {formatMetric(width)}.
          </p>
          <p>
            Área, comprimento e largura formam um primeiro retrato do território. Na hidrologia, porém, esse retrato
            ganha significado quando é lido em conjunto com relevo, clima, solos e drenagem.<Citation references={[4, 6]} />
          </p>
        </>}
      >
        <div className="metric-grid metric-grid-three">
          <MetricCard metric={area} />
          <MetricCard metric={length} />
          <MetricCard metric={width} />
        </div>
      </NarrativeSection>

      <NarrativeSection
        id="relevo"
        eyebrow="02 · Relevo"
        title="Uma amplitude altimétrica de 1.622 metros"
        tone="soft"
        description={<>
          <p>
            O território se eleva de {formatMetric(minimumElevation)} a {formatMetric(maximumElevation)}. Entre esses
            extremos há uma diferença de {formatMetric(relief)}, ou seja, uma variação vertical de mais de 1,6 quilômetro.
          </p>
          <p>
            A elevação média, de {formatMetric(meanElevation)}, e a declividade média, de {formatMetric(slope)}, resumem
            como as alturas e inclinações se distribuem pela bacia. São informações essenciais para entender o caminho
            da água, mas não devem ser interpretadas isoladamente.
          </p>
        </>}
      >
        <figure className="elevation-figure" aria-labelledby="elevation-caption">
          <div className="elevation-scale" aria-hidden="true">
            <span className="elevation-fill" />
            <span className="elevation-point maximum" style={{ bottom: '100%' }} />
            <span className="elevation-point mean" style={{ bottom: `${elevationPosition(meanElevation.value)}%` }} />
            <span className="elevation-point minimum" style={{ bottom: '0%' }} />
          </div>
          <dl className="elevation-values">
            <div><dt>Máxima</dt><dd>{formatMetric(maximumElevation)}</dd></div>
            <div><dt>Média</dt><dd>{formatMetric(meanElevation)}</dd></div>
            <div><dt>Mínima</dt><dd>{formatMetric(minimumElevation)}</dd></div>
            <div className="elevation-relief"><dt>Amplitude verificada</dt><dd>{formatMetric(relief)}</dd></div>
          </dl>
          <figcaption id="elevation-caption">Faixa altimétrica registrada no relatório, com valores equivalentes em texto.</figcaption>
        </figure>
      </NarrativeSection>

      <NarrativeSection
        id="forma"
        eyebrow="03 · Geometria"
        title="Quatro razões descrevem a forma"
        description={<>
          <p>
            Além do tamanho, uma bacia também pode ser compreendida pelo seu desenho. Fator de forma, razão de
            elongação, circularidade e compacidade comparam área, perímetro e comprimento por diferentes pontos de vista.
          </p>
          <p>
            Esses índices facilitam a comparação entre bacias de dimensões distintas. Eles ajudam a organizar a leitura
            do território, mas não funcionam como previsão de cheias quando observados sozinhos.<Citation references={[1, 2, 3, 4, 6]} />
          </p>
        </>}
      >
        <div className="shape-metrics">
          {[formFactor, elongation, circularity].map((metric) => (
            <article key={metric.id} className="shape-row">
              <div><span>{metric.labelPtBr}</span><strong>{formatMetric(metric)}</strong></div>
              <span className="shape-track" aria-hidden="true"><span style={{ width: `${Math.min(metric.value * 100, 100)}%` }} /></span>
            </article>
          ))}
          <MetricCard metric={compactness} />
        </div>
      </NarrativeSection>

      <NarrativeSection
        id="drenagem"
        eyebrow="04 · Rede de drenagem"
        title="Uma rede que percorre mais de dois mil quilômetros"
        tone="brand"
        description={<>
          <p>
            Se todos os trechos de canais identificados fossem colocados em linha, eles somariam {formatMetric(totalChannels)}.
            Essa rede está organizada em {formatMetric(streamCount, 0)} segmentos que conduzem a água através da paisagem.
          </p>
          <p>
            A densidade de drenagem relaciona essa extensão com a área da bacia. O resultado, {formatMetric(drainageDensity)},
            funciona como uma medida de comparação: ele descreve quanto canal foi mapeado por unidade de área, sem determinar,
            por si só, infiltração, permeabilidade ou risco hidrológico.<Citation references={[1, 2, 4, 5]} />
          </p>
        </>}
      >
        <div className="drainage-visual">
          <div className="drainage-number"><MetricValue metric={drainageDensity} /><span>Densidade de drenagem</span></div>
          <div className="drainage-divider" />
          <div className="drainage-number"><MetricValue metric={overlandFlow} /><span>Comprimento médio estimado do escoamento superficial</span></div>
        </div>
      </NarrativeSection>

      <NarrativeSection
        id="canal"
        eyebrow="05 · Canal principal"
        title="O caminho do canal principal"
        tone="soft"
        description={<>
          <p>
            O canal principal funciona como um eixo da drenagem: ao longo de {formatMetric(channelLength)}, ele conecta um
            ponto a {formatMetric(channelStart)} de altitude a outro situado a {formatMetric(channelEnd)}.
          </p>
          <p>
            A diferença de altitude distribuída por esse percurso produz um gradiente médio de {formatMetric(channelGradient)}.
            O desenho ao lado é uma representação didática desse trajeto — uma síntese, e não o perfil topográfico completo.
            <Citation references={[4, 6]} />
          </p>
        </>}
      >
        <figure className="channel-profile" aria-labelledby="channel-caption">
          <svg viewBox="0 0 640 240" role="img" aria-labelledby="channel-svg-title channel-svg-description">
            <title id="channel-svg-title">Perfil simplificado do canal principal</title>
            <desc id="channel-svg-description">Linha descendente entre 979,89 e 409 metros ao longo de 386,54 quilômetros.</desc>
            <path d="M40 48 C180 70 230 120 340 135 S500 172 600 194" />
            <circle cx="40" cy="48" r="7" /><circle cx="600" cy="194" r="7" />
            <text x="40" y="28">{formatMetric(channelStart)}</text>
            <text x="600" y="224" textAnchor="end">{formatMetric(channelEnd)}</text>
          </svg>
          <div className="channel-stats">
            <span><strong>{formatMetric(channelGradient)}</strong> gradiente</span>
            <span><strong>{formatMetric(channelSlope)}</strong> declividade entre extremos</span>
          </div>
          <figcaption id="channel-caption">Representação esquemática, sem escala vertical ou horizontal.</figcaption>
        </figure>
      </NarrativeSection>

      <section className="method-section" aria-labelledby="method-title">
        <div>
          <span className="eyebrow">Como construímos esta leitura</span>
          <h2 id="method-title">Dados confiáveis, explicações responsáveis</h2>
          <p>
            Cada indicador mantém uma ligação com sua origem, enquanto as relações matemáticas que podem ser reproduzidas
            passam por uma conferência independente. Assim, a informação fica mais fácil de compreender sem perder a
            rastreabilidade necessária à pesquisa científica.
          </p>
        </div>
        <dl className="audit-grid">
          <div><dt>Indicadores documentados</dt><dd>{morphometryValidation.summary.metricCount}</dd></div>
          <div><dt>Relações recalculadas</dt><dd>{morphometryValidation.summary.recalculatedCount}</dd></div>
          <div><dt>Cálculos conferidos</dt><dd>{morphometryValidation.summary.verifiedCount}</dd></div>
        </dl>
        <div className="curation-note">
          <strong>Curadoria científica contínua</strong>
          <p>
            Novas interpretações são incorporadas à plataforma somente depois da conferência de métodos, unidades e referências.
            Esse cuidado evita conclusões apressadas e mantém a experiência clara para diferentes públicos.
          </p>
        </div>
      </section>

      <section className="references-section" aria-labelledby="references-title">
        <span className="eyebrow">Referências</span>
        <h2 id="references-title">As bases científicas desta leitura</h2>
        <ol>
          {scientificReferences.map((reference, index) => (
            <li key={reference.doi} id={`ref-${index + 1}`}>
              <span>{reference.author} ({reference.year}). {reference.title}.</span>
              <a href={reference.url} target="_blank" rel="noreferrer">DOI: {reference.doi}</a>
            </li>
          ))}
        </ol>
      </section>

      <section className="story-next" aria-label="Próximos módulos">
        <div><span className="eyebrow">Continue explorando</span><h2>Do relatório ao território</h2></div>
        <div className="story-next-actions">
          <NavLink className="button button-primary" to="/mapa">Explorar o mapa</NavLink>
          <NavLink className="button button-outline" to="/observatorio">Abrir o Observatório</NavLink>
        </div>
      </section>
    </div>
  );
}
