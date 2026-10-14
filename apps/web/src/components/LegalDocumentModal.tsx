import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import termsText from '../content/terms.md?raw';
import privacyText from '../content/privacy.md?raw';

type LegalDocumentModalProps = {
  documentType: 'terms' | 'privacy';
  onClose: () => void;
};

export function LegalDocumentModal({ documentType, onClose }: LegalDocumentModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const text = documentType === 'terms' ? termsText : privacyText;
  const title = documentType === 'terms' ? 'Termos de uso' : 'Política de privacidade';

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = closeButtonRef.current?.closest<HTMLElement>('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="legal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="legal-modal legal-modal-platform" role="dialog" aria-modal="true" aria-labelledby="platform-legal-title" aria-describedby="platform-legal-content">
        <header className="legal-modal-header">
          <div>
            <span className="eyebrow">SIG Paramirim · documento vigente</span>
            <h2 id="platform-legal-title">{title}</h2>
          </div>
          <button ref={closeButtonRef} className="legal-modal-close" type="button" aria-label="Fechar documento" onClick={onClose}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </header>
        <div className="legal-modal-content legal-modal-platform-content" id="platform-legal-content">
          {text.split('\n').map((line, index) => {
            if (!line.trim()) return null;
            if (line.startsWith('# ')) return null;
            if (line.startsWith('## ')) return <h3 key={`${index}-${line}`}>{line.slice(3)}</h3>;
            if (line.startsWith('Versão ')) return <p className="legal-document-version" key={`${index}-${line}`}>{line}</p>;
            const link = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
            return <p key={`${index}-${line}`}>{link
              ? <>{line.slice(0, link.index)}<a href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>{line.slice((link.index ?? 0) + link[0].length)}</>
              : line}</p>;
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
