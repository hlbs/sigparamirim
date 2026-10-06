import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  compatibleConcentrationTime,
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

function ConcentrationTimeRecommendation() {
  const [method] = compatibleConcentrationTime;
  if (!method) return null;
  return (
    <figure className="concentration-recommendation" aria-labelledby="concentration-recommendation-caption">
      <div className="concentration-recommendation-kicker">Método compatível com a escala territorial</div>
      <div className="concentration-recommendation-value">
        <strong>{method.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
        <span>h</span>
      </div>
      <div className="concentration-recommendation-method">Equação de {method.method}</div>
      <div className="concentration-rationale">
        <span className="rationale-icon" aria-hidden="true">✓</span>
        <p>{method.context}</p>
      </div>
      <div className="concentration-audit-heading">Auditoria das demais metodologias</div>
      <div className="concentration-audit" role="table" aria-label="Resultados e limites das metodologias de tempo de concentração">
        <div className="concentration-audit-row concentration-audit-header" role="row">
          <span>Método</span><span>Resultado</span><span>Limite / condição verificada</span>
        </div>
        {concentrationTimeMethods.map((candidate) => (
          <div className={`concentration-audit-row ${candidate.assessment === 'scale_compatible' ? 'is-selected' : ''}`} role="row" key={candidate.id}>
            <strong>{candidate.method}</strong>
            <span>{candidate.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} h</span>
            <span>{candidate.limit}</span>
          </div>
        ))}
      </div>
      <figcaption id="concentration-recommendation-caption">
        A área de estudo é 17.070,32 km². Entre as onze metodologias presentes no relatório, Giandotti é a única cuja faixa de calibração publicada contempla essa escala. Os demais resultados permanecem visíveis para auditoria, mas não são considerados referências para esta bacia. A estimativa selecionada ainda precisa ser validada com chuva, sub-bacias e hidrogramas observados antes de qualquer dimensionamento.
      </figcaption>
    </figure>
  );
}

function SurfaceGroundwaterVisual() {
  return (
    <figure className="water-cycle-figure" aria-labelledby="water-cycle-caption">
      <svg viewBox="0 0 760 470" role="img" aria-labelledby="water-cycle-title water-cycle-description">
        <title id="water-cycle-title">Conexões entre água superficial e subterrânea</title>
        <defs>
          <marker id="water-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
          <linearGradient id="aquifer-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b3d9e3" stopOpacity=".6" /><stop offset="1" stopColor="#4a86a2" stopOpacity=".85" /></linearGradient>
        </defs>
        <path className="terrain" d="M24 165 C125 86 226 95 310 165 S493 110 736 178 L736 414 L24 414 Z" />
        <path className="bedrock" d="M24 350 C180 330 284 368 410 340 S585 346 736 321 L736 414 L24 414 Z" />
        <path className="aquifer" d="M24 272 C154 244 250 298 370 269 S579 262 736 244 L736 350 C584 375 472 365 350 380 S157 345 24 366 Z" />
        <path className="water-table" d="M42 271 C164 238 258 290 372 260 S579 254 718 235" />
        <path className="river" d="M324 166 C384 188 436 205 504 190 S590 168 648 177" />
        <path className="flow-arrow surface-flow" d="M128 142 Q223 137 306 169" />
        <path className="flow-arrow recharge-flow" d="M240 155 Q244 208 268 273" />
        <path className="flow-arrow groundwater-flow" d="M322 307 Q420 290 523 270" />
        <path className="flow-arrow base-flow" d="M523 270 Q567 231 608 186" />
        <g className="rain"><line x1="112" y1="28" x2="94" y2="70" /><line x1="164" y1="20" x2="146" y2="62" /><line x1="216" y1="32" x2="198" y2="74" /></g>
        <text x="56" y="103">Precipitação</text>
        <text x="122" y="157">Escoamento superficial</text>
        <text x="180" y="227">Recarga</text>
        <text x="48" y="321">Aquífero raso</text>
        <text x="45" y="397">Rocha / baixa permeabilidade</text>
        <text x="526" y="300">Fluxo subterrâneo</text>
        <text x="579" y="226">Descarga de base</text>
        <text x="650" y="162">Rio</text>
      </svg>
      <figcaption id="water-cycle-caption">Modelo conceitual de uma bacia efluente: a chuva pode gerar escoamento, infiltrar-se na zona não saturada, alimentar o aquífero e retornar ao rio como descarga de base. A direção e a espessura das setas são ilustrativas; a morfometria não mede recarga, nível freático ou vazão subterrânea.</figcaption>
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
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { threshold: 0.2, rootMargin: '-7% 0px -7% 0px' });
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
  const compatibleTime = compatibleConcentrationTime[0]!;

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
        title="Um tempo de referência compatível com a escala da bacia"
        tone="brand"
        description={<>
          <p>
            Tempo de concentração é uma estimativa do intervalo necessário para que a água do ponto hidraulicamente mais distante
            alcance a saída da bacia. Depois de revisar as onze metodologias listadas no relatório, apenas a equação de Giandotti
            apresentou faixa de calibração publicada compatível com a área do Paramirim. O valor de referência é, portanto, {compatibleTime.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} h.
          </p>
          <p>
            As demais foram descartadas para esta leitura pública: algumas foram calibradas em bacias muito menores; outras exigem
            parâmetros, variantes ou unidades que o relatório não documenta. Isso não significa que sejam “erradas” em qualquer contexto,
            mas que não são defensáveis como referência para esta bacia sem reconstrução e validação específicas.<Citation references={[7, 8, 9, 10, 11]} />
          </p>
          <p>
            Giandotti é uma referência de escala, não uma calibração automática. Em projetos, o valor deve ser refinado por sub-bacias,
            distribuição espacial da chuva, cobertura, solos, trajetória hidráulica e confronto com hidrogramas observados ou regionalizados.
            Assim, a plataforma mostra um único número compatível, mas preserva a responsabilidade técnica sobre seu uso.<Citation references={[7, 8, 9, 10]} />
          </p>
        </>}
      >
        <ConcentrationTimeRecommendation />
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
