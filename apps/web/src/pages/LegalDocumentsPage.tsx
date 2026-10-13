import { Link } from 'react-router-dom';
import termsText from '../content/terms.md?raw';
import privacyText from '../content/privacy.md?raw';
import { BrandLogo } from '../components/BrandLogo';

export function LegalDocumentsPage({ document }: { document: 'terms' | 'privacy' }) {
  const text = document === 'terms' ? termsText : privacyText;
  const title = document === 'terms' ? 'Termos de uso' : 'Política de Privacidade';
  return <div className="legal-page">
    <header className="legal-page-header">
      <Link className="brand" to="/" aria-label="SIG Paramirim — início"><BrandLogo kind="icon" alt="" /><span>SIG Paramirim</span></Link>
      <Link className="legal-back-link" to="/"><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar à plataforma</Link>
    </header>
    <main className="legal-document-shell">
      <nav className="legal-document-tabs" aria-label="Documentos legais">
        <Link className={document === 'terms' ? 'active' : ''} aria-current={document === 'terms' ? 'page' : undefined} to="/termos">Termos de uso</Link>
        <Link className={document === 'privacy' ? 'active' : ''} aria-current={document === 'privacy' ? 'page' : undefined} to="/privacidade">Privacidade</Link>
      </nav>
      <article className="legal-document-content" aria-labelledby="legal-document-title">
        <span className="eyebrow">SIG Paramirim · documento institucional</span>
        <h1 id="legal-document-title">{title}</h1>
        {text.split('\n').filter((line) => !line.startsWith('# ')).map((line, index) => {
          if (!line.trim()) return null;
          if (line.startsWith('## ')) return <h2 key={`${index}-${line}`}>{line.slice(3)}</h2>;
          if (line.startsWith('Versão ')) return <p className="legal-document-version" key={`${index}-${line}`}>{line}</p>;
          const link = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
          return <p key={`${index}-${line}`}>{link
            ? <>{line.slice(0, link.index)}<a href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>{line.slice((link.index ?? 0) + link[0].length)}</>
            : line}</p>;
        })}
      </article>
    </main>
  </div>;
}
