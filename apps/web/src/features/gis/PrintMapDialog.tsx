import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/print-map.css';
import { rasterPaletteCatalog } from './MapCanvas';
import { vectorGeometrySymbol } from './printLegendSymbol';

export type PrintMapLayer = { id: string; title: string; kind: 'vector' | 'raster'; palette?: string; crs?: string; geometryTypes?: Record<string, number>; range?: { min: number; max: number } };

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
  if (!rect.width || !rect.height) throw new Error('Não foi possível calcular o tamanho do mapa para impressão.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
  canvas.style.cssText = `position:fixed;left:-10000px;top:0;width:${rect.width}px;height:${rect.height}px;`;
  canvas.setAttribute('aria-hidden', 'true');

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('O OpenLayers não concluiu a composição das camadas para impressão. Tente novamente.')), 15000);
    const done = (capture: () => void) => {
      window.clearTimeout(timeout);
      capture();
    };
    target.dispatchEvent(new CustomEvent('webgis:print-capture', {
      detail: {
        canvas,
        resolve: (dataUrl: string) => done(() => resolve(dataUrl)),
        reject: (error: Error) => done(() => reject(error)),
      },
    }));
  });
}

function nextMapRender(target: HTMLElement) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      target.removeEventListener('webgis:rendercomplete', onRender);
      reject(new Error('O mapa não concluiu a renderização para impressão. Tente novamente.'));
    }, 15000);
    const onRender = () => {
      window.clearTimeout(timeout);
      target.removeEventListener('webgis:rendercomplete', onRender);
      resolve();
    };
    target.addEventListener('webgis:rendercomplete', onRender, { once: true });
  });
}

function printableDate() {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
}

const vectorColors = ['#9e803b', '#7a9b55', '#855c9c', '#c06d4f', '#477f86', '#b5813f', '#678bba'];
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

  const print = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = document.querySelector<HTMLElement>('.webgis-map-area .map-canvas');
    const sheet = sheetRef.current;
    if (!source || !sheet) return;

    const mapHost = sheet.querySelector<HTMLElement>('.webgis-print-map');
    if (!mapHost) return;
    setPrintError('');
    sheet.dataset.pageSize = pageSize;
    sheet.dataset.orientation = orientation;
    sheet.style.setProperty('--print-page-margin', pageMargin);
    const sheetWidth = pageSize === 'A4' ? 210 : 297;
    const sheetHeight = pageSize === 'A4' ? 297 : 420;
    const [width, height] = orientation === 'landscape' ? [sheetHeight, sheetWidth] : [sheetWidth, sheetHeight];
    sheet.style.setProperty('--print-sheet-width', `${width}mm`);
    sheet.style.setProperty('--print-sheet-height', `${height}mm`);
    sheet.classList.add('is-printing', 'is-composing');

    const originalMapStyle = source.getAttribute('style');
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const frame = mapHost.getBoundingClientRect();
      const mapBounds = source.getBoundingClientRect();
      if (!frame.width || !frame.height || !mapBounds.width) throw new Error('Não foi possível calcular a área útil do mapa para impressão.');

      // Render the live map at the print frame's aspect ratio before capture.
      // This prevents edge graticule labels from being clipped by cover/crop in A4 portrait.
      source.style.position = 'absolute';
      source.style.inset = '0 auto auto 0';
      const captureWidth = Math.max(mapBounds.width, frame.width);
      source.style.width = `${captureWidth}px`;
      source.style.height = `${captureWidth * frame.height / frame.width}px`;
      const rendered = nextMapRender(source);
      source.dispatchEvent(new Event('webgis:print-resize'));
      await rendered;
      // rendercomplete signals OpenLayers tile readiness; two paint frames also
      // allow the browser compositor to present the WebGL result after resize.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const snapshot = await renderMapSnapshot(source);
      mapHost.replaceChildren();
      const image = document.createElement('img');
      image.src = snapshot;
      image.alt = 'Mapa atual do WebGIS';
      image.className = 'webgis-print-map-image';
      mapHost.append(image);
      await image.decode();
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'Falha ao compor a impressão.');
      sheet.classList.remove('is-printing', 'is-composing');
      sheet.style.removeProperty('--print-page-margin');
      sheet.style.removeProperty('--print-sheet-width');
      sheet.style.removeProperty('--print-sheet-height');
      return;
    } finally {
      if (originalMapStyle === null) source.removeAttribute('style');
      else source.setAttribute('style', originalMapStyle);
      source.dispatchEvent(new Event('webgis:print-resize'));
    }

    sheet.classList.remove('is-composing');
    setOpen(false);

    const pageRule = document.createElement('style');
    pageRule.dataset.webgisPrint = 'page';
    // Zero page margin disables browser-injected URL/date/page headers. The
    // selected user margin is applied as padding to the print sheet itself.
    pageRule.textContent = `@media print { @page { size: ${pageSize} ${orientation}; margin: 0; } }`;
    document.head.append(pageRule);
    const cleanup = () => {
      sheet.classList.remove('is-printing', 'is-composing');
      sheet.style.removeProperty('--print-page-margin');
      sheet.style.removeProperty('--print-sheet-width');
      sheet.style.removeProperty('--print-sheet-height');
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
      <header><div><small>SIG PARAMIRIM · PRODUTO CARTOGRÁFICO</small><h1>{title}</h1><p>{subtitle}</p></div><time>{printableDate()}</time></header>
      <div className="webgis-print-map">{includeNorth && <div className="webgis-print-north" aria-label="Norte">↑<small>N</small></div>}</div>
      {includeLegend && layers.length > 0 && <section className="webgis-print-legend"><h2>Legenda</h2>{layers.map((layer) => {
        const palette = layer.palette ? rasterPaletteCatalog[layer.palette] : undefined;
        const symbolStyle = layer.kind === 'vector'
          ? { '--print-color': vectorColor(layer.id) }
          : { '--print-raster-palette': palette ? `linear-gradient(90deg, ${palette.join(',')})` : '#c5c8bd' };
        if (layer.kind === 'raster') {
          const range = layer.range ?? { min: 0, max: 0 };
          return <span className="webgis-print-legend-item raster" key={layer.id}>
            <strong>{layer.title}</strong>
            <span className="webgis-print-raster-scale"><small>Mín. {range.min.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</small><i className="webgis-print-legend-swatch raster" style={symbolStyle as CSSProperties} /><small>Máx. {range.max.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</small></span>
            {!palette && <small>Simbologia não configurada</small>}
          </span>;
        }
        const geometrySymbol = vectorGeometrySymbol(layer.geometryTypes);
        return <span className="webgis-print-legend-item" key={layer.id}><i className={`webgis-print-legend-swatch vector ${geometrySymbol}`} style={symbolStyle as CSSProperties} aria-hidden="true" />{layer.title}</span>;
      })}</section>}
      <footer><span>{includeAttribution ? attribution || 'Créditos das fontes conforme o catálogo geoespacial' : 'SIG Paramirim'}</span><img className="webgis-print-footer-logo" src="/logo_w.svg" alt="SIG Paramirim" /><span>Elaboração: Hermes Santos / SIG Paramirim · Visualização: EPSG:3857 (Web Mercator) · {dataCrsLabel} · {printableDate()}</span></footer>
    </section>
    </div>, document.body)}
  </>;
}
