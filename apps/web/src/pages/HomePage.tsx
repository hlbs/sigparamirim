import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BrandLogo } from '../components/BrandLogo';
import { ThemeDetail } from '../components/ThemeDetail';
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

function Citation({ references }: { references: readonly number[] }) {
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

function ConcentrationTimeMethods() {
  const renderEquation = (id: string) => {
    const tc = '<msub><mi>T</mi><mi>c</mi></msub><mo>=</mo>';
    const math = (body: string) => `<math display="block">${body}</math>`;
    switch (id) {
      case 'concentration_time_kirpich': return math(`${tc}<mn>0,0663</mn><mo>·</mo><msup><mi>L</mi><mn>0,77</mn></msup><mo>·</mo><msup><mi>S</mi><mrow><mo>−</mo><mn>0,385</mn></mrow></msup><mtext> h</mtext>`);
      case 'concentration_time_kerby': return math(`${tc}<mn>1,44</mn><msup><mrow><mo>(</mo><mfrac><mrow><mi>N</mi><mo>·</mo><mi>L</mi></mrow><msqrt><mi>S</mi></msqrt></mfrac><mo>)</mo></mrow><mn>0,467</mn></msup><mtext> min</mtext>`);
      case 'concentration_time_giandotti': return math(`${tc}<mfrac><mrow><mn>4</mn><msqrt><mi>A</mi></msqrt><mo>+</mo><mn>1,5</mn><mi>L</mi></mrow><mrow><mn>0,8</mn><msqrt><mrow><msub><mi>H</mi><mi>m</mi></msub><mo>−</mo><msub><mi>H</mi><mn>0</mn></msub></mrow></msqrt></mrow></mfrac><mtext> h</mtext>`);
      case 'concentration_time_temez': return math(`${tc}<mn>0,3</mn><mo>·</mo><msup><mrow><mo>(</mo><mfrac><mi>L</mi><msup><mi>S</mi><mn>0,25</mn></msup></mfrac><mo>)</mo></mrow><mn>0,76</mn></msup><mtext> h</mtext>`);
      case 'concentration_time_usda': return math('<msub><mi>T</mi><mi>c</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>t</mi><mi>i</mi></msub>');
      case 'concentration_time_passini': return math(`${tc}<mn>0,108</mn><mo>·</mo><msup><mrow><mi>A</mi><mo>·</mo><mi>L</mi></mrow><mfrac><mn>1</mn><mn>3</mn></mfrac></msup><mo>·</mo><msup><mi>S</mi><mrow><mo>−</mo><mn>0,5</mn></mrow></msup><mtext> h</mtext>`);
      case 'concentration_time_ventura_heras': return math(`${tc}<mn>0,1272</mn><mo>·</mo><msqrt><mfrac><mi>A</mi><mi>S</mi></mfrac></msqrt><mtext> h</mtext>`);
      case 'concentration_time_bransby_williams': return math(`<msub><mi>T</mi><mi>c</mi></msub><mo>≈</mo><mn>0,243</mn><mo>·</mo><mi>L</mi><mo>·</mo><msup><mi>A</mi><mrow><mo>−</mo><mn>0,1</mn></mrow></msup><mo>·</mo><msup><mi>S</mi><mrow><mo>−</mo><mn>0,2</mn></mrow></msup><mtext> h</mtext>`);
      case 'concentration_time_johnstone_cross': return math(`${tc}<mn>0,0543</mn><mo>·</mo><msqrt><mfrac><mi>L</mi><mi>S</mi></mfrac></msqrt><mtext> h</mtext>`);
      case 'concentration_time_california_culverts': return math(`${tc}<mn>0,87</mn><mo>·</mo><msup><mfrac><msup><mi>L</mi><mn>3</mn></msup><mi>H</mi></mfrac><mn>0,385</mn></msup><mtext> h</mtext>`);
      default: return math('<msub><mi>T</mi><mi>c</mi></msub>');
    }
  };
  const orderedMethods = [...concentrationTimeMethods].sort((left, right) =>
    Number(right.assessment === 'scale_compatible') - Number(left.assessment === 'scale_compatible'),
  );
  return (
    <figure className="concentration-recommendation" aria-label="Comparação de resultados de tempo de concentração">
      <div className="concentration-method-intro">
        <span className="concentration-recommendation-kicker">Comparação de métodos</span>
        <h3>Equações, parâmetros e domínio de aplicação</h3>
      </div>
      <div className="concentration-method-grid" aria-label="Comparação de métodos de tempo de concentração">
        {orderedMethods.map((candidate) => (
          <article className={`concentration-method-card ${candidate.assessment === 'scale_compatible' ? 'is-selected' : ''}`} key={candidate.id}>
            <header>
              <strong>{candidate.method}</strong>
              <span className={`method-fit method-fit-${candidate.assessment}`}>
                {candidate.assessment === 'scale_compatible' ? 'Mais compatível quanto à faixa de área' : candidate.assessment === 'extrapolated' ? 'Fora da faixa consultada' : 'Dados de aplicação limitados'}
              </span>
            </header>
            <p className="method-time">{candidate.id === 'concentration_time_clark' ? 'Tc usado como entrada' : 'Resultado informado'} <strong>{candidate.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {candidate.unit}</strong></p>
            {candidate.id === 'concentration_time_clark' ? (
              <div className="method-equation method-equation-note" role="note">Tc é um parâmetro de entrada do método Clark.</div>
            ) : (
              <div className="method-equation" role="math" aria-label={candidate.formula} dangerouslySetInnerHTML={{ __html: renderEquation(candidate.id) }} />
            )}
            <p><b>Parâmetros:</b> {candidate.parameters}</p>
            <p><b>Faixa/condição:</b> {candidate.limit}</p>
            <p className="method-context">{candidate.context}</p>
          </article>
        ))}
      </div>
    </figure>
  );
}

function TerrainModelVisual() {
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const northRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.6, 6.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.HemisphereLight(0xf5f4d8, 0x1f260c, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.8); light.position.set(-2, 5, 3); scene.add(light);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minDistance = 2.3;
    controls.maxDistance = 13;
    controls.minPolarAngle = .18;
    controls.maxPolarAngle = Math.PI * .48;
    controls.target.set(0, .2, 0);
    controlsRef.current = controls;
    let disposed = false;
    let animationFrame = 0;
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
      const sampleHeight = (x: number, y: number) => {
        let total = 0; let count = 0;
        for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
          const sx = Math.max(0, Math.min(cols - 1, x + ox)); const sy = Math.max(0, Math.min(rows - 1, y + oy));
          const value = (pixels[index(sx, sy) * 4] ?? 0) / 255;
          if (value > 0) { total += value; count += 1; }
        }
        return count ? total / count : 0;
      };
      for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) {
        const p = index(x, y) * 4; const raw = (pixels[p] ?? 0) / 255; const h = sampleHeight(x, y); const px = (x / (cols - 1) - .5) * 4.8; const pz = (y / (rows - 1) - .5) * 7.2;
        positions.push(px, h * .24, pz); const color = new THREE.Color().setHSL(.25 - h * .19, .68, .34 + h * .16); colors.push(color.r, color.g, color.b, raw > 0 ? 1 : 0);
      }
      for (let y = 0; y < rows - 1; y += 1) for (let x = 0; x < cols - 1; x += 1) { const a = index(x, y); const b = index(x + 1, y); const c = index(x + 1, y + 1); const d = index(x, y + 1); indices.push(a, b, d, b, c, d); }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: .9, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material); group.add(mesh);
      fetch('/hidrografia-3d.json').then((response) => response.json() as Promise<{ lines: number[][][]; main: number[][] }>).then((hydrography) => {
        if (disposed) return;
        const drape = (line: number[][]) => line.map(([x = 0, z = 0]) => { const ix = Math.max(0, Math.min(cols - 1, Math.round(((x + 2.4) / 4.8) * (cols - 1)))); const iy = Math.max(0, Math.min(rows - 1, Math.round(((z + 3.6) / 7.2) * (rows - 1)))); const h = sampleHeight(ix, iy); return new THREE.Vector3(x, h * .24 + .028, z); });
        hydrography.lines.forEach((line) => { const points = drape(line); if (points.length < 2) return; const lineGeometry = new THREE.BufferGeometry().setFromPoints(points); group.add(new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0x2f9ed0, transparent: true, opacity: .86 }))); });
      }).catch(() => undefined);
    };
    const animate = () => { if (disposed) return; controls.update(); if (northRef.current) northRef.current.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`; renderer.render(scene, camera); animationFrame = requestAnimationFrame(animate); }; animationFrame = requestAnimationFrame(animate);
    return () => { disposed = true; cancelAnimationFrame(animationFrame); observer.disconnect(); controls.dispose(); controlsRef.current = null; renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return (
    <figure className="terrain-figure" aria-label="Modelo tridimensional do relevo da Bacia do Rio Paramirim">
      <div
        className="terrain-stage"
        role="application"
        aria-label="Modelo tridimensional do relevo da Bacia do Rio Paramirim"
      >
        <div ref={stageRef} className="terrain-canvas" />
        <div className="terrain-toolbar" aria-label="Controles do relevo">
          <span className="terrain-north" title="Orientação norte"><span ref={northRef} className="terrain-north-arrow"><i className="fa-solid fa-location-arrow" /></span><b>N</b></span>
          <button type="button" title="Repor vista" aria-label="Repor vista" onClick={() => controlsRef.current?.reset()}><i className="fa-solid fa-rotate-left" /></button>
          <button type="button" title="Aproximar" aria-label="Aproximar" onClick={() => { controlsRef.current?.dollyIn(1.18); controlsRef.current?.update(); }}><i className="fa-solid fa-plus" /></button>
          <button type="button" title="Afastar" aria-label="Afastar" onClick={() => { controlsRef.current?.dollyOut(1.18); controlsRef.current?.update(); }}><i className="fa-solid fa-minus" /></button>
        </div>
      </div>
      <div className="terrain-legend" aria-label="Legenda hipsométrica da falsa-cor">
        <span className="terrain-gradient" aria-hidden="true" />
        <span>420 m</span><span>900 m</span><span>1.417 m</span>
      </div>
    </figure>
  );
}

function TerritoryContextTabs() {
  const [active, setActive] = useState('clima');
  const tabs = {
    clima: {
      label: 'Clima e água', icon: 'fa-cloud-sun', title: 'O pulso sazonal da bacia',
      body: 'O diagnóstico do Macrozoneamento Ecológico-Econômico do São Francisco descreve o Vale do Paramirim no domínio semiárido, com precipitação anual entre 650 e 1.250 mm concentrada em cerca de quatro meses do verão e temperaturas médias anuais entre 23 e 25 °C. A classificação regional varia com o relevo: áreas baixas são mais secas, enquanto serras e transições próximas à Chapada Diamantina são mais úmidas.', refs: [] as number[],
      items: [['Chuva concentrada', 'No Vale do Paramirim, a precipitação anual varia de 650 a 1.250 mm e se concentra em cerca de quatro meses do verão; essa concentração sazonal ajuda a explicar a alternância entre resposta rápida e estiagem prolongada.'], ['Serras e vales', 'O domínio semiárido não é uniforme: os vales mais baixos são secos, enquanto serras e áreas de transição próximas à Chapada Diamantina recebem mais umidade.'], ['Temperatura média', 'As médias anuais regionais ficam entre 23 e 25 °C. Para comparar municípios, ainda é necessário preservar a estação, o período e o método de agregação.']],
    },
    vegetacao: {
      label: 'Vegetação e solo', icon: 'fa-leaf', title: 'Cobertura, infiltração e erosão',
      body: 'O estudo florístico da sub-bacia registra um gradiente entre formações serranas mais conservadas, áreas de transição e Caatinga arbustivo-arbórea nas porções mais baixas. A análise da água subterrânea em Boquira mostra por que geologia, solos e qualidade da água precisam acompanhar a leitura da cobertura vegetal.', refs: [15],
      items: [['Serras conservadas', 'O levantamento florístico identifica formações serranas mais conservadas e um gradiente que desce até a Caatinga arbustivo-arbórea nas porções mais baixas da sub-bacia.'], ['Água subterrânea em Boquira', 'A qualidade da água subterrânea estudada em Boquira mostra que litologia, solo e cobertura vegetal precisam ser interpretados em conjunto, especialmente onde a infiltração é limitada.'], ['Cobertura e erosão', 'A transição entre encostas serranas, áreas de uso agropecuário e Caatinga cria contrastes de proteção do solo e de concentração do escoamento que devem orientar o monitoramento.']],
    },
    sociedade: {
      label: 'Sociedade e cultura', icon: 'fa-people-group', title: 'Água como território vivido',
      body: 'A pesquisa sobre o Território de Identidade Bacia do Paramirim reúne indicadores educacionais, demográficos e socioeconômicos de 2011 a 2022. Estudos sobre educação quilombola reforçam que território, memória e identidade não são camadas decorativas: são dimensões concretas da gestão da água e da divulgação científica.', refs: [16, 17],
      items: [['Indicadores territoriais', 'O diagnóstico do Território de Identidade Bacia do Paramirim acompanha indicadores educacionais, demográficos e socioeconômicos entre 2011 e 2022, permitindo observar mudanças além da paisagem física.'], ['Educação quilombola', 'Pesquisas sobre educação quilombola na região mostram que memória, identidade e território fazem parte da gestão da água e não podem ser tratados como informação acessória.'], ['Acesso à água', 'A leitura social da bacia deve cruzar a localização das comunidades e dos serviços com a sazonalidade, a infraestrutura hídrica e as desigualdades de acesso.']],
    },
    economia: {
      label: 'Economia territorial', icon: 'fa-chart-line', title: 'Produção, infraestrutura e resiliência',
      body: 'A economia regional combina agropecuária, serviços, infraestrutura hídrica e atividades minerais. O estudo sobre conflitos da mineração na Bahia inclui ocorrências no Território Bacia do Paramirim e ajuda a enquadrar a vocação econômica junto de seus passivos, disputas e efeitos ambientais, sem confundir potencial mineral com desenvolvimento social automático.', refs: [18],
      items: [['Agropecuária e serviços', 'A economia regional combina produção agropecuária e serviços; a análise espacial deve mostrar onde essa atividade depende de água regular e onde a estiagem impõe maior vulnerabilidade.'], ['Mineração em Boquira', 'Estudos sobre conflitos da mineração na Bahia registram ocorrências no Território Bacia do Paramirim e recomendam separar potencial mineral de efeitos ambientais e benefícios sociais efetivos.'], ['Infraestrutura hídrica', 'Barragens, poços, adutoras e captações sustentam a economia durante a estiagem, mas também definem quem está mais exposto quando a chuva se concentra em poucos meses.']],
    },
  } as const;
  const current = tabs[active as keyof typeof tabs];
  return <div className="territory-tabs">
    <div className="territory-tab-list" role="tablist" aria-label="Contexto territorial">
      {Object.entries(tabs).map(([key, tab]) => <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? 'is-active' : ''} onClick={() => setActive(key)}><i className={`fa-solid ${tab.icon}`} />{tab.label}</button>)}
    </div>
    <article className="territory-tab-panel" role="tabpanel">
      <span className="eyebrow">{current.label}</span><h3>{current.title}</h3><p>{current.body}{current.refs.length > 0 && <Citation references={current.refs} />}</p>
    </article>
  </div>;
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
      {tone === 'brand' && <ThemeDetail className="story-detail" />}
      <div className="story-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <div className="story-description">{description}</div>}
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
    }, { threshold: 0.01, rootMargin: '0px 0px -4% 0px' });
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
  const drainageDensity = narrativeMetric('drainage_density');
  const channelMaintenance = narrativeMetric('channel_maintenance_constant');
  const formFactor = narrativeMetric('form_factor');
  const elongation = narrativeMetric('elongation_ratio');
  const circularity = narrativeMetric('circularity_ratio');
  const compactness = narrativeMetric('compactness_coefficient');
  const ruggedness = narrativeMetric('ruggedness_number');
  const massivity = narrativeMetric('massivity_index');

  const elevationPosition = (value: number) => (
    ((value - minimumElevation.value) / (maximumElevation.value - minimumElevation.value)) * 100
  );

  return (
    <div className="home-story">
      <section className="story-hero" aria-labelledby="home-title">
        <ThemeDetail className="story-detail" />
        <div className="story-hero-copy">
          <BrandLogo kind="logo" variant="dark" alt="SIG Paramirim" className="story-hero-logo" />
          <span className="eyebrow">Bacia Hidrográfica do Rio Paramirim</span>
          <h1 id="home-title">Uma leitura territorial construída com dados e informações.</h1>
          <p>
            Descubra como o relevo, a forma e a rede de drenagem ajudam a contar a história da Bacia do
            Rio Paramirim.
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
      </section>

      <NarrativeSection
        id="dimensao"
        eyebrow="01 · Dimensão territorial"
        title="Um território de escala regional"
        description={<>
          <p>
            Com {formatMetric(area)}, a Bacia do Rio Paramirim é um sistema hidrográfico de grande extensão. Seu eixo é
            estimado em {formatMetric(length)}, possui largura média calculada da ordem de {formatMetric(width)} e
            perímetro de {formatMetric(perimeter)}.
          </p>
          <p>
            A partir dessa escala podemos compreender melhor como um evento pluviométrico se dispersa em sua área de
            drenagem, embora uma chuva raramente cubra toda a bacia com a mesma intensidade e duração. Diferentes setores
            recebem, armazenam e liberam água em momentos distintos. Por isso, estudos de projeto devem subdividir o
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
            O território vai de {formatMetric(minimumElevation)} a {formatMetric(maximumElevation)}. Entre esses extremos
            há uma amplitude de {formatMetric(relief)}.
          </p>
          <p>
            A elevação média, de {formatMetric(meanElevation)}, e a declividade média, de {formatMetric(slope)}, resumem
            como as altitudes e inclinações se distribuem pela bacia. O conhecimento da topografia e da distribuição das
            declividades é essencial para compreender a formação dos trechos de drenagem, mas esses dados não devem ser
            interpretados isoladamente.
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
            Além do tamanho, a geometria da bacia pode ser descrita por relações entre área, perímetro e comprimento. Fator
            de forma, razão de elongação e circularidade variam entre 0 e 1; para esses índices, 1 é o limite geométrico
            superior. Já o coeficiente de compacidade tem mínimo teórico 1 e não possui máximo fixo.
          </p>
          <p>
            Os valores encontrados — Ff {formatMetric(formFactor)}, Re {formatMetric(elongation)}, Rc {formatMetric(circularity)}
            e Kc {formatMetric(compactness)} — apontam para uma bacia alongada e pouco circular. Em conjunto, podem sugerir
            que as contribuições chegam ao canal em tempos diferentes, mas não calculam uma cheia nem substituem a análise
            de chuva, relevo, solos e armazenamento.<Citation references={[1, 2, 3, 4, 6, 11]} />
          </p>
        </>}
      >
        <div className="shape-metrics">
          {[formFactor, elongation, circularity].map((metric) => (
            <article key={metric.id} className="shape-row">
              <div><span>{metric.labelPtBr}</span><strong>{formatMetric(metric)}</strong></div>
              <span className="shape-track" role="img" aria-label={`${formatMetric(metric)} em uma escala de zero a um`}><span style={{ width: `${Math.max(0, Math.min(metric.value * 100, 100))}%` }} /></span>
            </article>
          ))}
          <p className="shape-scale-note">Escala dos três índices: 0–1. A compacidade (Kc) é mostrada separadamente porque cresce a partir de 1 e não é limitada a esse intervalo.</p>
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
            Na bacia, predominam cursos d’água intermitentes: eles fluem nos períodos chuvosos e podem secar durante a estiagem.
          </p>
          <p>
            A densidade de drenagem relaciona essa extensão com a área da bacia. O resultado é {formatMetric(drainageDensity)}.
            Sob a classificação morfométrica adotada, esse valor indica baixa
            densidade — por vezes descrita como uma rede “mal drenada”. É um descritor da rede mapeada, não um diagnóstico
            isolado de permeabilidade: geologia, solos, vegetação, clima e escala cartográfica também influenciam a leitura.<Citation references={[1, 2, 4, 5]} />
          </p>
        </>}
      >
        <div className="drainage-visual drainage-visual-single">
          <div className="drainage-number"><MetricValue metric={totalChannels} /><span>Extensão total da rede de canais identificada</span></div>
        </div>
      </NarrativeSection>

      <NarrativeSection
        id="canal"
        eyebrow="05 · Canal principal"
        title="O caminho do canal principal"
        tone="soft"
        description={<>
          <p>
            O canal principal (Rio Paramirim) recebe a contribuição de seus tributários ao longo de {formatMetric(channelLength)}.
            A diferença de altitude distribuída por esse percurso produz um gradiente médio de {formatMetric(channelGradient)},
            com declividade entre os extremos de {formatMetric(channelSlope)}. A sinuosidade estimada é {formatMetric(channelSinuosity)},
            valor que sugere um traçado sinuoso, associado à formação de meandros. O desenho ao lado é didático e não substitui
            o perfil levantado em campo.<Citation references={[4, 6, 11, 19, 20]} />
          </p>
        </>}
      >
        <figure className="channel-profile" aria-label="Representação didática do perfil do canal principal">
          <svg viewBox="0 0 680 320" role="img" aria-labelledby="channel-svg-title channel-svg-description">
            <title id="channel-svg-title">Perfil simplificado do canal principal</title>
            <desc id="channel-svg-description">Linha descendente entre 979,89 e 409 metros ao longo de 386,54 quilômetros.</desc>
            <defs><linearGradient id="channel-gradient" x1="0" x2="1"><stop offset="0" stopColor="#dce67a" /><stop offset="1" stopColor="#5a5e0b" /></linearGradient></defs>
            <g className="channel-grid"><path d="M56 54H632M56 112H632M56 170H632M56 228H632" /><path d="M56 30V246M200 30V246M344 30V246M488 30V246M632 30V246" /></g>
            <path className="channel-area" d="M56 54 C180 72 236 126 344 145 S510 188 632 228 L632 246 L56 246Z" />
            <path className="channel-line" d="M56 54 C180 72 236 126 344 145 S510 188 632 228" />
            <circle className="channel-point" cx="56" cy="54" r="8" /><circle className="channel-point" cx="632" cy="228" r="8" />
            <text className="channel-axis-label" x="56" y="18">Altitude (m)</text><text className="channel-axis-label" x="632" y="305" textAnchor="end">Percurso do canal (km)</text>
            <text className="channel-value-label" x="56" y="39">{formatMetric(channelStart)}</text><text className="channel-value-label" x="632" y="213" textAnchor="end">{formatMetric(channelEnd)}</text>
            <text className="channel-end-label" x="56" y="272">Nascente</text><text className="channel-end-label" x="632" y="272" textAnchor="end">Jusante</text>
          </svg>
          <div className="channel-stats">
            <span><strong>{formatMetric(channelGradient)}</strong> gradiente</span>
            <span><strong>{formatMetric(channelSlope)}</strong> declividade entre extremos</span>
            <span><strong>{formatMetric(channelSinuosity)}</strong> sinuosidade informada</span>
          </div>
        </figure>
      </NarrativeSection>

      <NarrativeSection
        id="subsolo"
        eyebrow="06 · Superfície e subsolo"
        title="A interação entre as águas superficiais e subterrâneas"
        tone="soft"
        description={<>
          <p>
            A água que escoa nos rios e a que circula no subsolo fazem parte de um mesmo sistema, mas sua conexão depende
            das rochas, fraturas, coberturas superficiais e condições de recarga. A densidade de drenagem da bacia
            ({formatMetric(drainageDensity)}) não mede recarga nem disponibilidade subterrânea; é apenas uma característica
            da rede de canais mapeada.
          </p>
          <p>
            Em Boquira, estudos geológicos e hidrogeológicos descrevem diferentes domínios: rochas cristalinas do Complexo
            Paramirim e granitos; metassedimentos e metavulcânicas, incluindo as formações Boquira e Botuporã; rochas
            vulcânicas da Formação Pajeú; e coberturas cenozoicas. Em terrenos cristalinos, a água tende a ser armazenada
            sobretudo em fraturas; coberturas superficiais podem oferecer condições distintas. O cadastro nacional
            da ANA/CPRM organiza os sistemas aquíferos em domínios porosos, cársticos e fraturados, uma classificação
            regional que não substitui o mapeamento hidrogeológico local. Em Boquira, pesquisas analisaram poços, nascentes
            e águas associadas à antiga área de mineração; seus resultados reforçam a necessidade de avaliar cada ponto e
            sua unidade geológica, sem generalizar qualidade ou produtividade para toda a bacia.<Citation references={[13, 15, 21, 22]} />
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
        description={null}
      >
        <ConcentrationTimeMethods />
      </NarrativeSection>

      <NarrativeSection
        id="sintese"
        eyebrow="08 · Síntese hidrológica"
        title="O que a morfometria permite compreender"
        description={<>
          <p>
            O Paramirim é uma bacia extensa, com amplitude altimétrica de {formatMetric(relief)} e declividade média de
            {` ${formatMetric(slope)}`}. Seu formato alongado e a rede de canais com densidade de {formatMetric(drainageDensity)}
            ajudam a descrever o território; o canal principal percorre {formatMetric(channelLength)} e apresenta gradiente médio
            de {formatMetric(channelGradient)} por quilômetro.
          </p>
          <p>
            Esses números não contam a história toda. Chuva irregular, encostas, solos, fraturas, cobertura vegetal, canais
            intermitentes e usos da água mudam de um setor para outro. A morfometria ajuda a formular perguntas — onde a água
            se concentra, quanto demora para chegar ao rio, que áreas podem armazená-la —, mas só observações de campo, dados
            de chuva e vazão e análises geológicas e hidrogeológicas permitem testar essas hipóteses.<Citation references={[5, 6, 11, 12, 13, 14]} />
          </p>
        </>}
      >
        <div className="synthesis-visual">
          <MetricCard metric={relief} />
          <MetricCard metric={ruggedness} />
          <MetricCard metric={massivity} />
          <MetricCard metric={channelMaintenance} />
        </div>
      </NarrativeSection>

      <NarrativeSection
        id="territorio"
        eyebrow="09 · Contexto territorial"
        title="Clima, paisagem e vida social"
        tone="soft"
        description={<>
          <p>Conhecer a bacia é acompanhar o pulso da água e as pessoas que vivem com ele. As abas organizam os principais contextos ambientais e sociais que precisam ser lidos junto da morfometria.</p>
        </>}
      >
        <TerritoryContextTabs />
      </NarrativeSection>

      <section className="references-section" aria-labelledby="references-title">
        <span className="eyebrow">Referências</span>
        <h2 id="references-title">As bases científicas desta leitura</h2>
        <ol>
          {scientificReferences.map((reference, index) => (
            <li key={reference.doi} id={`ref-${index + 1}`}>
              <span>{reference.author} ({reference.year}). {reference.title}.</span>
              {reference.url && <a href={reference.url} target="_blank" rel="noreferrer">{reference.url.startsWith('https://doi.org/') ? `DOI: ${reference.doi}` : reference.doi}</a>}
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
