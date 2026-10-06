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
        {verified ? '✓ Relação verificada' : '○ Registro da fonte'}
      </span>
      <strong>{formatMetric(metric, digits)}</strong>
      <span className="metric-label">{metric.labelPtBr}</span>
      <details>
        <summary>Rastreabilidade</summary>
        <p>Origem: {metric.sourceCell}</p>
        {metric.derivation && <p>Cálculo: {metric.derivation}</p>}
      </details>
    </article>
  );
}

function ReferenceLink({ index }: { index: number }) {
  const reference = scientificReferences[index];
  if (!reference) return null;
  return (
    <a className="doi-link" href={reference.url} target="_blank" rel="noreferrer">
      {reference.author}, {reference.year} · DOI: {reference.doi}
    </a>
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
    <section className="story-section" data-tone={tone} aria-labelledby={`${id}-title`}>
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
            Explore dimensões, relevo, geometria e drenagem. Cada número informa se foi transcrito da
            fonte ou recalculado pelo pipeline da plataforma.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#dimensao">Conhecer a bacia</a>
            <NavLink className="button button-secondary" to="/mapa">Abrir o WebGIS</NavLink>
          </div>
          <div className="story-audit-line">
            <strong>{morphometryValidation.summary.verifiedCount}</strong> relações conferidas
            <span aria-hidden="true">·</span>
            <strong>{morphometryDataset.source.rowCount}</strong> indicadores preservados
          </div>
        </div>
        <div className="story-hero-mark" aria-label="Identidade do SIG Paramirim">
          <img src="/sig-logo.png" alt="SIG Paramirim" />
          <span>Relatório morfométrico</span>
          <small>Fonte versionada por checksum</small>
        </div>
      </section>

      <NarrativeSection
        id="dimensao"
        eyebrow="01 · Dimensão territorial"
        title="Escala e proporção da bacia"
        description={<>
          <p>
            A planilha registra uma área de {formatMetric(area)}, com eixo de comprimento de {formatMetric(length)}.
            A largura média de {formatMetric(width)} foi reproduzida pela relação entre área e comprimento.
          </p>
          <p className="scientific-caution">Essas medidas descrevem a escala geométrica; isoladamente, não determinam a resposta hidrológica.</p>
          <ReferenceLink index={3} />
          <ReferenceLink index={5} />
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
            A diferença entre as elevações máxima e mínima reproduz exatamente a amplitude registrada.
            A declividade média de {formatMetric(slope)} permanece identificada como valor transcrito da fonte.
          </p>
          <p className="scientific-caution">A visualização apresenta a distribuição vertical conhecida, sem classificar o terreno ou inferir processos erosivos.</p>
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
            Fator de forma, elongação, circularidade e compacidade foram recalculados com área, perímetro e
            comprimento. A leitura conjunta registra a geometria sem convertê-la automaticamente em previsão de cheia.
          </p>
          <ReferenceLink index={1} />
          <ReferenceLink index={2} />
          <ReferenceLink index={3} />
          <ReferenceLink index={5} />
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
        title="Extensão de canais relacionada à área"
        tone="brand"
        description={<>
          <p>
            O inventário registra {formatMetric(totalChannels)} de canais e {formatMetric(streamCount, 0)} segmentos.
            A densidade de {formatMetric(drainageDensity)} resulta da divisão do comprimento total pela área.
          </p>
          <p className="scientific-caution">O valor é apresentado sem atribuir, por si só, infiltração, permeabilidade ou risco hidrológico.</p>
          <ReferenceLink index={0} />
          <ReferenceLink index={1} />
          <ReferenceLink index={3} />
          <ReferenceLink index={4} />
        </>}
      >
        <div className="drainage-visual">
          <div className="drainage-number"><strong>{formatMetric(drainageDensity)}</strong><span>Densidade de drenagem verificada</span></div>
          <div className="drainage-divider" />
          <div className="drainage-number"><strong>{formatMetric(overlandFlow)}</strong><span>Comprimento de escoamento superficial calculado</span></div>
        </div>
      </NarrativeSection>

      <NarrativeSection
        id="canal"
        eyebrow="05 · Canal principal"
        title="Um perfil longitudinal resumido"
        tone="soft"
        description={<>
          <p>
            Ao longo de {formatMetric(channelLength)}, os extremos informados passam de {formatMetric(channelStart)}{' '}
            para {formatMetric(channelEnd)}. A relação entre essa diferença e o comprimento gera o gradiente apresentado.
          </p>
          <p className="scientific-caution">O perfil completo e as declividades compensadas permanecem reservados até a validação dos dados intermediários.</p>
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
          <span className="eyebrow">Transparência científica</span>
          <h2 id="method-title">O que já pode ser mostrado — e o que continua bloqueado</h2>
          <p>
            O pipeline preserva {morphometryValidation.summary.metricCount} indicadores e recalculou {morphometryValidation.summary.recalculatedCount} relações.
            Nesta entrega, somente valores de origem selecionados e relações verificadas alimentam a narrativa.
          </p>
        </div>
        <dl className="audit-grid">
          <div><dt>Compatíveis com o recálculo</dt><dd>{morphometryValidation.summary.verifiedCount}</dd></div>
          <div><dt>Aguardando revisão</dt><dd>{morphometryValidation.summary.needsReviewCount}</dd></div>
          <div><dt>Unidades a confirmar</dt><dd>{morphometryValidation.summary.missingUnitCount}</dd></div>
        </dl>
        <div className="blocked-data-note">
          <strong>Fora da narrativa nesta versão</strong>
          <p>
            As {morphometryValidation.concentrationTime.methodCount} estimativas de tempo de concentração e a integral hipsométrica
            aguardam métodos, insumos e referências suficientes para uma publicação responsável.
          </p>
        </div>
      </section>

      <section className="references-section" aria-labelledby="references-title">
        <span className="eyebrow">Referências metodológicas</span>
        <h2 id="references-title">Fontes com DOI verificado</h2>
        <ol>
          {scientificReferences.map((reference) => (
            <li key={reference.doi}>
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
