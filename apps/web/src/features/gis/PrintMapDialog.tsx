import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/print-map.css';

export type PrintMapLayer = { id: string; title: string; kind: 'vector' | 'raster'; palette?: string; crs?: string };

type PrintMapDialogProps = {
  layers?: PrintMapLayer[];
  triggerClassName?: string;
};

type PageSize = 'A4' | 'A3';
type Orientation = 'landscape' | 'portrait';
type PageMargin = '6mm' | '10mm' | '15mm';

function renderMapSnapshot(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(rect.width * pixelRatio));
  output.height = Math.max(1, Math.round(rect.height * pixelRatio));
  const context = output.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem do mapa.');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const canvases = target.querySelectorAll<HTMLCanvasElement>('.ol-layer canvas');
  let rendered = 0;
  canvases.forEach((canvas) => {
    if (!canvas.width || !canvas.height) return;
    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;
    const layer = canvas.parentElement;
    const opacity = Number.parseFloat(layer ? getComputedStyle(layer).opacity : '1');
    const background = layer ? getComputedStyle(layer).backgroundColor : 'transparent';
    context.save();
    context.globalAlpha = Number.isFinite(opacity) ? opacity : 1;
    // Use the canvas' rendered viewport bounds. OpenLayers moves buffered layer
    // canvases with CSS transforms; replaying only the transform matrix drops
    // its layout offset and leaves a large blank strip in the print frame.
    const x = canvasRect.left - rect.left;
    const y = canvasRect.top - rect.top;
    if (background && background !== 'rgba(0, 0, 0, 0)') {
      context.fillStyle = background;
      context.fillRect(x, y, canvasRect.width, canvasRect.height);
    }
    context.drawImage(canvas, x, y, canvasRect.width, canvasRect.height);
    context.restore();
    rendered += 1;
  });

  if (!rendered) throw new Error('O mapa ainda não terminou de renderizar. Aguarde alguns segundos e tente novamente.');
  try {
    return output.toDataURL('image/png');
  } catch {
    throw new Error('Não foi possível compor a impressão porque uma camada externa bloqueou a captura. Verifique as permissões CORS do serviço de mapas.');
  }
}

function printableDate() {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
}

const vectorColors = ['#9e803b', '#7a9b55', '#855c9c', '#c06d4f', '#477f86', '#b5813f', '#678bba'];
const rasterPalettes: Record<string, string[]> = {
  hypsometric: ['#315c37', '#477c3d', '#669644', '#8daf4a', '#b7c957', '#d8d66a', '#e5bd58', '#d99949', '#b87542', '#eee5c8'],
  'blue-cyan-sequential': ['#f0f9ff', '#d9f0f7', '#b9e4ef', '#91d5e5', '#65c2da', '#3eabc9', '#278caf', '#216f91', '#205775', '#193f5b'],
  'blue-sequential': ['#f1f8fe', '#dcecf8', '#c4def1', '#a7cceb', '#86b6e0', '#679dd1', '#4d81bd', '#3b65a5', '#304e88', '#243a6c'],
  'blue-indigo-sequential': ['#f3f1fa', '#e0dcf1', '#c9c3e6', '#ada7d8', '#918bc9', '#7773b6', '#625ba1', '#514889', '#403970', '#302a57'],
};

function vectorColor(id: string) {
  if (id === 'hidrografia') return '#168fce';
  if (id === 'bacia-hidrografica-paramirim') return '#68710a';
  const hash = [...id].reduce((value, char) => value + char.charCodeAt(0), 0);
  return vectorColors[hash % vectorColors.length];
}

/** Professional print composer for the current WebGIS view. */
export function PrintMapDialog({ layers = [], triggerClassName = 'webgis-print-trigger' }: PrintMapDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Mapa da Bacia do Rio Paramirim');
  const [subtitle, setSubtitle] = useState('Sistema de Informações Geográficas do Paramirim');
  const [pageSize, setPageSize] = useState<PageSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [pageMargin, setPageMargin] = useState<PageMargin>('10mm');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeNorth, setIncludeNorth] = useState(true);
  const [includeAttribution, setIncludeAttribution] = useState(true);
  const [printError, setPrintError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const print = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = document.querySelector<HTMLElement>('.webgis-map-area .map-canvas');
    const sheet = sheetRef.current;
    if (!source || !sheet) return;

    const mapHost = sheet.querySelector<HTMLElement>('.webgis-print-map');
    if (!mapHost) return;
    setPrintError('');
    try {
      const snapshot = renderMapSnapshot(source);
      mapHost.replaceChildren();
      const image = document.createElement('img');
      image.src = snapshot;
      image.alt = 'Mapa atual do WebGIS';
      image.className = 'webgis-print-map-image';
      mapHost.append(image);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'Falha ao compor a impressão.');
      return;
    }

    sheet.dataset.pageSize = pageSize;
    sheet.dataset.orientation = orientation;
    sheet.classList.add('is-printing');
    setOpen(false);

    const pageRule = document.createElement('style');
    pageRule.dataset.webgisPrint = 'page';
    pageRule.textContent = `@media print { @page { size: ${pageSize} ${orientation}; margin: ${pageMargin}; } }`;
    document.head.append(pageRule);
    const cleanup = () => {
      sheet.classList.remove('is-printing');
      pageRule.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(() => window.print(), 160);
  };

  const attribution = document.querySelector('.webgis-map-area .map-attribution')?.textContent?.trim();
  const sourceCrs = [...new Set(layers.map((layer) => layer.crs?.trim()).filter((crs): crs is string => Boolean(crs)))].sort();
  const dataCrsLabel = sourceCrs.length ? `CRS dos dados ativos: ${sourceCrs.join(', ')}` : 'Dados em CRS de origem; CRS não informado no catálogo';

  return <>
    <button ref={triggerRef} type="button" className={triggerClassName} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <i className="fa-solid fa-print" aria-hidden="true" /><span>Compor impressão</span>
    </button>
    {createPortal(<div className="webgis-print-portal">
    {open && <div className="webgis-print-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="webgis-print-dialog" role="dialog" aria-modal="true" aria-labelledby="webgis-print-title" tabIndex={-1}>
        <header><div><small>Saída cartográfica</small><h2 id="webgis-print-title">Compor impressão</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><i className="fa-solid fa-xmark" /></button></header>
        <form className="webgis-print-form" onSubmit={print}>
          <label>Título do mapa<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
          <label>Subtítulo / projeto<input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={140} /></label>
          <label>Formato da folha<select value={pageSize} onChange={(event) => setPageSize(event.target.value as PageSize)}><option value="A4">A4 — 210 × 297 mm</option><option value="A3">A3 — 297 × 420 mm</option></select></label>
          <label>Orientação<select value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}><option value="landscape">Paisagem</option><option value="portrait">Retrato</option></select></label>
          <label>Margens<select value={pageMargin} onChange={(event) => setPageMargin(event.target.value as PageMargin)}><option value="6mm">Estreitas — 6 mm</option><option value="10mm">Padrão — 10 mm</option><option value="15mm">Amplas — 15 mm</option></select></label>
          <div className="webgis-print-checks" aria-label="Elementos do mapa">
            <label><input type="checkbox" checked={includeLegend} onChange={(event) => setIncludeLegend(event.target.checked)} /> Legenda das camadas</label>
            <label><input type="checkbox" checked={includeNorth} onChange={(event) => setIncludeNorth(event.target.checked)} /> Norte</label>
            <label><input type="checkbox" checked={includeAttribution} onChange={(event) => setIncludeAttribution(event.target.checked)} /> Créditos cartográficos</label>
          </div>
          {printError && <p className="webgis-print-error" role="alert"><i className="fa-solid fa-triangle-exclamation" /> {printError}</p>}
          <p className="webgis-print-note">A composição usa a extensão e as camadas atualmente visíveis no mapa. Na janela de impressão, escolha “Salvar como PDF” para gerar o arquivo.</p>
          <footer><button type="button" onClick={() => setOpen(false)}>Cancelar</button><button type="submit"><i className="fa-solid fa-file-arrow-down" /> Visualizar impressão</button></footer>
        </form>
      </div>
    </div>}
    <section ref={sheetRef} className="webgis-print-sheet" aria-hidden="true">
      <header><div><small>SIG PARAMIRIM · PRODUTO CARTOGRÁFICO</small><h1>{title}</h1><p>{subtitle}</p></div><span>{printableDate()}</span></header>
      <div className="webgis-print-map">{includeNorth && <div className="webgis-print-north" aria-label="Norte">↑<small>N</small></div>}</div>
      {includeLegend && layers.length > 0 && <section className="webgis-print-legend"><h2>Legenda</h2>{layers.map((layer) => {
        const palette = layer.palette ? rasterPalettes[layer.palette] : undefined;
        const symbolStyle = layer.kind === 'vector'
          ? { '--print-color': vectorColor(layer.id) }
          : { '--print-raster-palette': palette ? `linear-gradient(90deg, ${palette.join(',')})` : '#c5c8bd' };
        return <span className="webgis-print-legend-item" key={layer.id}><i className={`webgis-print-legend-swatch ${layer.kind}`} style={symbolStyle as CSSProperties} />{layer.title}{layer.kind === 'raster' && !palette && <small> (simbologia não configurada)</small>}</span>;
      })}</section>}
      <footer><span>{includeAttribution ? attribution || 'Créditos das fontes conforme o catálogo geoespacial' : 'SIG Paramirim'}</span><span>Elaboração: Hermes Santos / SIG Paramirim · Visualização: EPSG:3857 (Web Mercator) · {dataCrsLabel} · {printableDate()}</span></footer>
    </section>
    </div>, document.body)}
  </>;
}
