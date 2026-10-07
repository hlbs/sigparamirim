import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as THREE from 'three';
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

function TerrainModelVisual() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState({ x: -0.9, y: -0.35 });
  const dragRef = useRef<{ x: number; y: number; rotation: { x: number; y: number } } | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 2.2, 4.4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);
    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);
    scene.add(new THREE.HemisphereLight(0xf5f4d8, 0x1f260c, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.8); light.position.set(-2, 5, 3); scene.add(light);
    let disposed = false;
    const resize = () => { const rect = stage.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(rect.height, 1); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize();
    const image = new Image(); image.src = '/mde-height.png';
    image.onload = () => {
      if (disposed) return;
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); if (!context) return; context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const cols = image.width; const rows = image.height; const positions: number[] = []; const colors: number[] = []; const indices: number[] = [];
      const index = (x: number, y: number) => y * cols + x;
      for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) {
        const p = index(x, y) * 4; const h = (pixels[p] ?? 0) / 255; const px = (x / (cols - 1) - .5) * 4.8; const pz = (y / (rows - 1) - .5) * 7.2;
        positions.push(px, h * 1.55, pz); const color = new THREE.Color().setHSL(.64 - h * .62, .78, .38 + h * .12); colors.push(color.r, color.g, color.b, (pixels[p + 3] ?? 0) / 255);
      }
      for (let y = 0; y < rows - 1; y += 1) for (let x = 0; x < cols - 1; x += 1) { const a = index(x, y); const b = index(x + 1, y); const c = index(x + 1, y + 1); const d = index(x, y + 1); indices.push(a, b, d, b, c, d); }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: .9, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material); group.add(mesh);
    };
    const animate = () => { if (disposed) return; renderer.render(scene, camera); requestAnimationFrame(animate); }; animate();
    return () => { disposed = true; observer.disconnect(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  useEffect(() => { if (!groupRef.current) return; groupRef.current.rotation.x = rotation.x; groupRef.current.rotation.y = rotation.y; groupRef.current.scale.setScalar(zoom); }, [rotation, zoom]);
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, rotation }; };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => { if (!dragRef.current) return; setRotation({ x: Math.max(-1.35, Math.min(-.25, dragRef.current.rotation.x + (event.clientY - dragRef.current.y) * .006)), y: dragRef.current.rotation.y + (event.clientX - dragRef.current.x) * .008 }); };
  const handlePointerUp = () => { dragRef.current = null; };
  return (
    <figure className="terrain-figure" aria-labelledby="terrain-caption">
      <div
        className="terrain-stage"
        role="application"
        aria-label="Modelo tridimensional interativo derivado do MDE da Bacia do Rio Paramirim. Arraste para girar e use a roda do mouse ou os controles para aproximar."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={(event) => { event.preventDefault(); setZoom((current) => Math.max(.78, Math.min(1.35, current - event.deltaY * .001))); }}
      >
        <div ref={stageRef} className="terrain-canvas" />
        <div className="terrain-north">N</div>
      </div>
      <div className="terrain-controls" aria-label="Controles do modelo">
        <button type="button" onClick={() => setRotation({ x: 54, y: -12 })}>Repor vista</button>
        <button type="button" onClick={() => setZoom((current) => Math.min(1.35, current + .1))}>+</button>
        <button type="button" onClick={() => setZoom((current) => Math.max(.78, current - .1))}>−</button>
      </div>
      <div className="terrain-legend" aria-label="Legenda hipsométrica da falsa-cor">
        <span className="terrain-gradient" aria-hidden="true" />
        <span>420 m</span><span>900 m</span><span>1.417 m</span>
      </div>
      <figcaption id="terrain-caption">Modelo exploratório derivado do MDE da bacia, com valores nulos (0) transparentes, relevo sombreado e falsa-cor hipsométrica. Arraste para girar e use a roda do mouse ou os controles para aproximar.</figcaption>
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
        <TerrainModelVisual />
      </NarrativeSection>

      <NarrativeSection
        id="tempos"
        eyebrow="07 · Resposta à chuva"
        title="Um tempo de referência compatível com a escala da bacia"
        tone="brand"
        description={<>
          <p>
            Tempo de concentração não é uma propriedade fixa como a área ou o relevo. Dependendo do estudo, ele pode representar
            tempo de viagem, tempo de equilíbrio ou uma escala de resposta do hidrograma. Essa diferença conceitual é uma das razões
            pelas quais equações empíricas não devem ser comparadas como se medissem exatamente a mesma coisa.<Citation references={[7, 10]} />
          </p>
          <p>
            Para a escala territorial do Paramirim, a revisão das onze metodologias listadas no relatório encontrou apenas a equação
            de Giandotti com faixa de calibração publicada compatível. O valor de referência é, portanto, {compatibleTime.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} h.
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

      <NarrativeSection
        id="territorio"
        eyebrow="09 · Contexto territorial"
        title="Uma bacia é também clima, paisagem e vida social"
        tone="soft"
        description={<>
          <p>
            A leitura hidrológica ganha sentido quando o mapa físico é relacionado ao cotidiano. A documentação pública do INEMA
            situa as bacias dos rios Paramirim e Santo Onofre no semiárido nordestino, afluentes do São Francisco, com diferenças
            locais de relevo, disponibilidade hídrica e cobertura vegetal. Essas transições ajudam a explicar por que uma mesma chuva
            pode produzir respostas distintas entre as cabeceiras, os vales e os setores de jusante.
          </p>
          <p>
            Para a plataforma, clima, vegetação, ocupação do solo, economia e cultura serão incorporados como camadas e textos
            documentados: cada afirmação deverá indicar escala, período, fonte e DOI quando houver publicação científica. Assim,
            divulgação e rigor caminham juntos, sem transformar hipótese regional em diagnóstico automático.<Citation references={[5, 6, 12, 13]} />
          </p>
        </>}
      >
        <div className="territory-context-grid">
          <article><i className="fa-solid fa-cloud-sun" /><strong>Clima e chuva</strong><span>Variabilidade sazonal e eventos intensos controlam a alternância entre déficit hídrico e resposta rápida.</span></article>
          <article><i className="fa-solid fa-leaf" /><strong>Vegetação e solo</strong><span>Cobertura, crostas e propriedades do solo modulam infiltração, erosão e armazenamento local.</span></article>
          <article><i className="fa-solid fa-people-group" /><strong>Sociedade e cultura</strong><span>Água, produção rural e modos de vida dependem da regularidade dos rios, nascentes e reservatórios.</span></article>
          <article><i className="fa-solid fa-chart-line" /><strong>Economia territorial</strong><span>Infraestrutura hídrica e uso da terra devem ser avaliados com recorte temporal e evidência verificável.</span></article>
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
