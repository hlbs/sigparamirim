import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  concentrationTimeMethods,
  formatMetric,
  narrativeMetric,
  scientificReferences,
  type NarrativeMetric,
} from '../features/morphometry/data';

function MetricCard({ metric, digits = 2 }: { metric: NarrativeMetric; digits?: number }) {
  return (
    <article className="story-metric-card">
      <MetricValue metric={metric} digits={digits} />
      <span className="metric-label">{metric.labelPtBr}</span>
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

const assessmentLabel = {
  scale_compatible: 'Escala de área compatível',
  extrapolated: 'Fora da escala de origem',
  insufficient_metadata: 'Método a confirmar',
} as const;

function ConcentrationTimeChart() {
  const maximum = Math.max(...concentrationTimeMethods.map((method) => method.value));
  return (
    <figure className="concentration-chart" aria-labelledby="concentration-chart-caption">
      <div className="concentration-chart-heading">
        <strong>Onze métodos, respostas muito diferentes</strong>
        <span>Escala logarítmica · horas</span>
      </div>
      <div className="concentration-methods">
        {concentrationTimeMethods.map((method) => {
          const width = Math.max(8, (Math.log10(method.value + 1) / Math.log10(maximum + 1)) * 100);
          return (
            <div className="concentration-method" key={method.id}>
              <div className="concentration-method-label">
                <strong>{method.method}</strong>
                <span>{method.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} h</span>
              </div>
              <span className="concentration-track" aria-hidden="true">
                <span className={`assessment-${method.assessment}`} style={{ width: `${width}%` }} />
              </span>
              <small className={`assessment-label assessment-${method.assessment}`}>{assessmentLabel[method.assessment]}</small>
            </div>
          );
        })}
      </div>
      <figcaption id="concentration-chart-caption">
        A comparação mostra sensibilidade metodológica. Nenhum desses valores deve ser adotado isoladamente como tempo de projeto.
      </figcaption>
    </figure>
  );
}

function SurfaceGroundwaterVisual() {
  return (
    <figure className="water-cycle-figure" aria-labelledby="water-cycle-caption">
      <svg viewBox="0 0 680 380" role="img" aria-labelledby="water-cycle-title water-cycle-description">
        <title id="water-cycle-title">Conexões entre água superficial e subterrânea</title>
        <desc id="water-cycle-description">Esquema conceitual com chuva, escoamento superficial, infiltração, aquífero e descarga para o rio.</desc>
        <path className="terrain" d="M20 120 C130 45 220 80 310 145 S500 95 660 170 L660 380 L20 380 Z" />
        <path className="river" d="M310 145 C370 166 420 185 492 175" />
        <path className="water-table" d="M55 265 C190 220 300 282 430 238 S560 234 640 218" />
        <path className="flow-arrow surface-flow" d="M150 107 Q225 115 292 146" />
        <path className="flow-arrow recharge-flow" d="M225 125 Q226 190 245 234" />
        <path className="flow-arrow base-flow" d="M445 248 Q465 218 493 183" />
        <g className="rain"><line x1="110" y1="24" x2="95" y2="58" /><line x1="160" y1="18" x2="145" y2="52" /><line x1="210" y1="31" x2="195" y2="65" /></g>
        <text x="58" y="88">Chuva</text>
        <text x="112" y="151">Escoamento</text>
        <text x="196" y="212">Infiltração</text>
        <text x="92" y="318">Armazenamento subterrâneo</text>
        <text x="458" y="278">Descarga de base</text>
        <text x="500" y="158">Rio</text>
      </svg>
      <figcaption id="water-cycle-caption">Esquema conceitual: a morfometria sugere controles, mas não mede recarga ou vazão subterrânea.</figcaption>
    </figure>
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
  const perimeter = narrativeMetric('perimeter');
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
  const channelSinuosity = narrativeMetric('main_channel_sinuosity');
  const totalChannels = narrativeMetric('total_channel_length');
  const streamCount = narrativeMetric('number_of_streams');
  const drainageDensity = narrativeMetric('drainage_density');
  const streamFrequency = narrativeMetric('stream_frequency');
  const drainageTexture = narrativeMetric('drainage_texture');
  const drainageIntensity = narrativeMetric('drainage_intensity');
  const strahlerOrder = narrativeMetric('strahler_order');
  const meanStreamLength = narrativeMetric('mean_stream_length');
  const overlandFlow = narrativeMetric('overland_flow_length');
  const channelMaintenance = narrativeMetric('channel_maintenance_constant');
  const formFactor = narrativeMetric('form_factor');
  const elongation = narrativeMetric('elongation_ratio');
  const circularity = narrativeMetric('circularity_ratio');
  const compactness = narrativeMetric('compactness_coefficient');
  const ruggedness = narrativeMetric('ruggedness_number');
  const massivity = narrativeMetric('massivity_index');
  const concentrationMinimum = Math.min(...concentrationTimeMethods.map((method) => method.value));
  const concentrationMaximum = Math.max(...concentrationTimeMethods.map((method) => method.value));

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
            <strong>{formatMetric(area)}</strong> de território
            <span aria-hidden="true">·</span>
            <strong>{formatMetric(channelLength)}</strong> de canal principal
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
        title="Um território de escala regional"
        description={<>
          <p>
            Com {formatMetric(area)}, a Bacia do Rio Paramirim é um sistema hidrográfico de grande extensão. Seu eixo mede
            {` ${formatMetric(length)}`}, a largura média calculada é {formatMetric(width)} e o divisor de águas forma um
            perímetro de {formatMetric(perimeter)}.
          </p>
          <p>
            Essa escala importa porque uma chuva raramente cobre toda a bacia com a mesma intensidade e duração. Diferentes
            setores recebem, armazenam e liberam água em momentos distintos. Por isso, estudos de projeto devem subdividir o
            território e considerar a distribuição espacial da chuva, do relevo, dos solos e do uso da terra.<Citation references={[6, 7, 10]} />
          </p>
        </>}
      >
        <div className="metric-grid">
          <MetricCard metric={area} />
          <MetricCard metric={perimeter} />
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
            Os valores encontrados — Ff {formatMetric(formFactor)}, Re {formatMetric(elongation)}, Rc {formatMetric(circularity)}
            e Kc {formatMetric(compactness)} — apontam para uma bacia alongada e pouco circular. Isso tende a distribuir
            a chegada das contribuições ao canal ao longo do tempo, em vez de concentrá-las simultaneamente como ocorreria
            em uma forma compacta. É uma interpretação de forma, não uma previsão de cheia.<Citation references={[1, 2, 3, 4, 6, 11]} />
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
          <div className="shape-insight"><strong>Leitura hidrológica</strong><span>Geometria alongada tende a espalhar os tempos de chegada, mas chuva, solos, armazenamento e rede de canais também controlam o hidrograma.</span></div>
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
          <p>
            A ordem máxima registrada é {formatMetric(strahlerOrder, 0)}; a frequência de canais é {formatMetric(streamFrequency)}
            e o comprimento médio dos segmentos é {formatMetric(meanStreamLength)}. Esses números descrevem a arquitetura
            da rede, cuja leitura depende também da escala e da resolução do mapeamento.<Citation references={[4, 5, 11]} />
          </p>
        </>}
      >
        <div className="drainage-visual">
          <div className="drainage-number"><MetricValue metric={drainageDensity} /><span>Densidade de drenagem</span></div>
          <div className="drainage-divider" />
          <div className="drainage-number"><MetricValue metric={overlandFlow} /><span>Comprimento médio estimado do escoamento superficial</span></div>
        </div>
        <div className="drainage-support-grid">
          <MetricCard metric={strahlerOrder} digits={0} />
          <MetricCard metric={streamFrequency} />
          <MetricCard metric={meanStreamLength} />
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
            A declividade entre os extremos é {formatMetric(channelSlope)} e a sinuosidade informada é {formatMetric(channelSinuosity)}.
            O desenho ao lado é uma representação didática desse trajeto — uma síntese, e não o perfil topográfico completo.<Citation references={[4, 6, 11]} />
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
            <span><strong>{formatMetric(channelSinuosity)}</strong> sinuosidade informada</span>
          </div>
          <figcaption id="channel-caption">Representação esquemática, sem escala vertical ou horizontal.</figcaption>
        </figure>
      </NarrativeSection>

      <NarrativeSection
        id="subsolo"
        eyebrow="06 · Superfície e subsolo"
        title="A água que vemos e a água que circula abaixo dela"
        tone="soft"
        description={<>
          <p>
            Com {formatMetric(drainageDensity)} de densidade de drenagem, {formatMetric(overlandFlow)} de comprimento médio
            estimado do escoamento superficial e {formatMetric(channelMaintenance)} de área associada a cada quilômetro de canal,
            a bacia oferece pistas sobre como a água pode se repartir entre o caminho superficial e o armazenamento no terreno.
          </p>
          <p>
            Uma rede menos densa pode estar associada a maior infiltração ou a materiais mais permeáveis, mas também pode
            refletir relevo, vegetação, clima, geologia e a resolução do mapeamento. Portanto, esses indicadores não medem
            recarga de aquífero. Para falar de água subterrânea com segurança, precisamos cruzá-los com litologia, solos,
            lineamentos, poços, nascentes, níveis d'água e séries de vazão.<Citation references={[5, 12, 13, 14]} />
          </p>
        </>}
      >
        <SurfaceGroundwaterVisual />
      </NarrativeSection>

      <NarrativeSection
        id="tempos"
        eyebrow="07 · Resposta à chuva"
        title="Por que os tempos de concentração divergem tanto?"
        tone="brand"
        description={<>
          <p>
            Tempo de concentração é uma forma de estimar quanto demora para a água do ponto hidraulicamente mais distante
            alcançar a saída da bacia. O relatório apresenta onze estimativas, de {concentrationMinimum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} h a {concentrationMaximum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} h:
            uma diferença de aproximadamente 294 vezes.
          </p>
          <p>
            Essa amplitude não significa que a bacia tenha onze tempos de resposta simultaneamente. Cada equação foi criada
            para um conjunto próprio de bacias, escalas, climas e variáveis. Kirpich, Kerby e California Culverts nasceram
            para situações muito menores; Johnstone–Cross também fica abaixo da área do Paramirim. O valor de Giandotti
            está dentro da faixa de área publicada, mas ainda depende da definição correta da altura, da trajetória e da
            validação regional. As demais estimativas não podem ser interpretadas sem recuperar suas fórmulas e unidades.<Citation references={[7, 8, 9, 10, 11]} />
          </p>
          <p>
            Para um projeto hidrológico, o próximo passo não é escolher o maior ou o menor número. É reconstruir cada método,
            dividir a bacia em sub-bacias, incorporar chuva, cobertura, solos e velocidades de escoamento e confrontar os
            resultados com hidrogramas observados ou regionalizados. O gráfico ao lado é, portanto, uma ferramenta de
            diagnóstico metodológico — não um valor de projeto.<Citation references={[7, 8, 9, 10]} />
          </p>
        </>}
      >
        <ConcentrationTimeChart />
      </NarrativeSection>

      <NarrativeSection
        id="sintese"
        eyebrow="08 · Síntese hidrológica"
        title="O que a morfometria permite compreender"
        description={<>
          <p>
            O Paramirim combina grande extensão territorial, amplitude altimétrica de {formatMetric(relief)}, declividade média
            de {formatMetric(slope)} e uma forma alongada. A rede possui baixa extensão de canais por área mapeada, enquanto o
            canal principal percorre {formatMetric(channelLength)} e desce, em média, {formatMetric(channelGradient)} por quilômetro.
          </p>
          <p>
            Em conjunto, esses dados sugerem uma resposta espacialmente complexa: setores íngremes podem transferir água com
            rapidez, enquanto a distância, a geometria alongada, a rugosidade agregada de {formatMetric(ruggedness)} e o
            armazenamento local podem distribuir essa resposta no tempo. A morfometria organiza hipóteses; quem confirma os
            processos são séries de chuva e vazão, mapas de solo e geologia, observações de campo e modelos calibrados.<Citation references={[5, 6, 11, 12, 13, 14]} />
          </p>
        </>}
      >
        <div className="synthesis-visual">
          <MetricCard metric={relief} />
          <MetricCard metric={ruggedness} />
          <MetricCard metric={massivity} />
          <div className="synthesis-note"><strong>Leitura integrada</strong><span>Forma, relevo, drenagem, chuva, solo e subsolo precisam ser analisados juntos.</span></div>
        </div>
      </NarrativeSection>

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
